import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CheckCircle, AlertCircle, Loader2, ZapOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// =============================================
// التعريفات والثوابت
// =============================================

const EGYPTIAN_ID_ASPECT_RATIO = 1.586; // نسبة البطاقة المصرية الدقيقة (85.60 / 53.98)
const FRAME_WIDTH_PERCENT = 0.80; // 80% من عرض الشاشة
const CAMERA_RESOLUTION = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  aspectRatio: { ideal: 16/9 }
};

const QUALITY_THRESHOLDS = {
  brightness: { min: 40, max: 85 },
  sharpness: { min: 15 },
  edgeThreshold: 40
};

const CHECK_INTERVAL = 300; // ms

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        showAlert: (message: string) => void;
      };
    };
  }
}

interface EdgeDetection {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

interface QualityMetrics {
  brightness: number;
  sharpness: number;
  edges: EdgeDetection;
}

interface OCRResult {
  nationalId: string | null;
  fullName: string | null;
  address: string | null;
}

// =============================================
// دوال مساعدة لمعالجة الصور
// =============================================

/**
 * حساب أبعاد إطار البطاقة
 */
function calculateFrameDimensions(videoWidth: number, videoHeight: number) {
  const frameWidth = Math.floor(videoWidth * FRAME_WIDTH_PERCENT);
  const frameHeight = Math.floor(frameWidth / EGYPTIAN_ID_ASPECT_RATIO);
  const frameX = Math.floor((videoWidth - frameWidth) / 2);
  const frameY = Math.floor((videoHeight - frameHeight) / 2);
  
  return { frameWidth, frameHeight, frameX, frameY };
}

/**
 * كشف حافة واحدة من البطاقة
 */
function detectSingleEdge(
  imageData: ImageData,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  direction: 'horizontal' | 'vertical',
  threshold: number
): boolean {
  const data = imageData.data;
  const width = imageData.width;
  
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  };
  
  let edgeCount = 0;
  const sampleInterval = 5;
  let totalSamples = 0;
  
  if (direction === 'horizontal') {
    for (let x = x1; x < x2; x += sampleInterval) {
      const inside = getPixel(x, y1);
      const outside = getPixel(x, Math.max(0, y1 - 3));
      if (Math.abs(inside - outside) > threshold) edgeCount++;
      totalSamples++;
    }
  } else {
    for (let y = y1; y < y2; y += sampleInterval) {
      const inside = getPixel(x1, y);
      const outside = getPixel(Math.max(0, x1 - 3), y);
      if (Math.abs(inside - outside) > threshold) edgeCount++;
      totalSamples++;
    }
  }
  
  return edgeCount > totalSamples / 15;
}

/**
 * كشف جميع حواف البطاقة
 */
function detectAllEdges(
  imageData: ImageData,
  videoWidth: number,
  videoHeight: number
): EdgeDetection {
  const { frameWidth, frameHeight, frameX, frameY } = calculateFrameDimensions(videoWidth, videoHeight);
  const threshold = QUALITY_THRESHOLDS.edgeThreshold;
  
  return {
    top: detectSingleEdge(imageData, frameX, frameY, frameX + frameWidth, frameY, 'horizontal', threshold),
    bottom: detectSingleEdge(imageData, frameX, frameY + frameHeight, frameX + frameWidth, frameY + frameHeight, 'horizontal', threshold),
    left: detectSingleEdge(imageData, frameX, frameY, frameX, frameY + frameHeight, 'vertical', threshold),
    right: detectSingleEdge(imageData, frameX + frameWidth, frameY, frameX + frameWidth, frameY + frameHeight, 'vertical', threshold)
  };
}

/**
 * حساب جودة الصورة (الإضاءة والوضوح)
 */
function calculateImageQuality(imageData: ImageData): Omit<QualityMetrics, 'edges'> {
  const data = imageData.data;
  let totalBrightness = 0;
  let edges = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    totalBrightness += brightness;
    
    if (i > 0) {
      const prevR = data[i - 4];
      const diff = Math.abs(r - prevR);
      if (diff > 30) edges++;
    }
  }
  
  const avgBrightness = totalBrightness / (data.length / 4);
  const normalizedBrightness = Math.max(0, Math.min(100, (avgBrightness / 255) * 100));
  const normalizedSharpness = Math.min(100, (edges / (data.length / 4)) * 1000);
  
  return {
    brightness: normalizedBrightness,
    sharpness: normalizedSharpness
  };
}

/**
 * تحسين الصورة قبل الإرسال
 */
function enhanceImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // تحسين التباين
  const contrast = 1.2;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;     // R
    data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
    data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * قص الصورة حسب إطار البطاقة
 */
function cropToFrame(
  sourceCanvas: HTMLCanvasElement,
  videoWidth: number,
  videoHeight: number
): HTMLCanvasElement {
  const { frameWidth, frameHeight, frameX, frameY } = calculateFrameDimensions(videoWidth, videoHeight);
  
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = frameWidth;
  croppedCanvas.height = frameHeight;
  
  const ctx = croppedCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  
  ctx.drawImage(
    sourceCanvas,
    frameX, frameY, frameWidth, frameHeight,
    0, 0, frameWidth, frameHeight
  );
  
  return croppedCanvas;
}

// =============================================
// المكون الرئيسي
// =============================================

export default function TelegramMiniApp() {
  // المراجع
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // الحالات
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [brightness, setBrightness] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [edgesDetected, setEdgesDetected] = useState<EdgeDetection>({
    top: false,
    right: false,
    bottom: false,
    left: false
  });
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');
  
  const { toast } = useToast();
  
  // =============================================
  // دوال الكاميرا
  // =============================================
  
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          ...CAMERA_RESOLUTION
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsReady(true);
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          startQualityCheck();
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'خطأ في الكاميرا',
        description: 'لا يمكن الوصول إلى الكاميرا. تأكد من منح الأذونات اللازمة.',
        variant: 'destructive'
      });
    }
  }, [toast]);
  
  const stopCamera = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);
  
  // =============================================
  // فحص الجودة التلقائي
  // =============================================
  
  const checkQuality = useCallback(() => {
    if (!videoRef.current || !overlayCanvasRef.current || isProcessing || capturedImage) {
      return;
    }
    
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.videoWidth === 0) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const quality = calculateImageQuality(imageData);
    const edges = detectAllEdges(imageData, video.videoWidth, video.videoHeight);
    
    setBrightness(quality.brightness);
    setSharpness(quality.sharpness);
    setEdgesDetected(edges);
    
    // التقاط تلقائي عند تحقق الشروط
    const allEdgesDetected = edges.top && edges.right && edges.bottom && edges.left;
    const brightnessOk = quality.brightness >= QUALITY_THRESHOLDS.brightness.min && 
                        quality.brightness <= QUALITY_THRESHOLDS.brightness.max;
    const sharpnessOk = quality.sharpness >= QUALITY_THRESHOLDS.sharpness.min;
    
    if (brightnessOk && sharpnessOk && allEdgesDetected) {
      capturePhoto();
    }
  }, [isProcessing, capturedImage]);
  
  const startQualityCheck = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    
    checkIntervalRef.current = setInterval(checkQuality, CHECK_INTERVAL);
  }, [checkQuality]);
  
  // =============================================
  // التقاط ومعالجة الصورة
  // =============================================
  
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    // إيقاف الفحص التلقائي
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // التقاط الصورة الكاملة
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // قص الصورة حسب الإطار
    const croppedCanvas = cropToFrame(canvas, video.videoWidth, video.videoHeight);
    
    // تحسين الصورة
    const enhancedCanvas = enhanceImage(croppedCanvas);
    
    // تحويل إلى DataURL
    const imageDataUrl = enhancedCanvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(imageDataUrl);
    stopCamera();
    
    await processImage(imageDataUrl);
  }, [stopCamera]);
  
  const processImage = useCallback(async (imageDataUrl: string) => {
    setIsProcessing(true);
    
    try {
      const blob = await fetch(imageDataUrl).then(r => r.blob());
      const formData = new FormData();
      formData.append('image', blob, 'id-card.jpg');
      
      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('فشل في معالجة الصورة');
      }
      
      const data = await response.json();
      setResult(data);
      
      if (window.Telegram?.WebApp) {
        if (data.nationalId) {
          window.Telegram.WebApp.showAlert(
            `تم استخراج البيانات بنجاح!\n\nالرقم القومي: ${data.nationalId}\nالاسم: ${data.fullName || 'غير متوفر'}`
          );
        } else {
          window.Telegram.WebApp.showAlert('لم يتم العثور على رقم قومي في الصورة. حاول مرة أخرى.');
        }
      }
      
      toast({
        title: 'تم الاستخراج بنجاح',
        description: `الرقم القومي: ${data.nationalId || 'غير متوفر'}`,
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'خطأ في المعالجة',
        description: 'حدث خطأ أثناء معالجة الصورة. حاول مرة أخرى.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);
  
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setResult(null);
    setBrightness(0);
    setSharpness(0);
    setEdgesDetected({ top: false, right: false, bottom: false, left: false });
    startCamera();
  }, [startCamera]);
  
  // =============================================
  // تأثيرات React
  // =============================================
  
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(() => {
        stopCamera();
        window.Telegram?.WebApp?.close();
      });
    }
    
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);
  
  // =============================================
  // دوال مساعدة للواجهة
  // =============================================
  
  const getQualityColor = (value: number, type: 'brightness' | 'sharpness') => {
    if (type === 'brightness') {
      const { min, max } = QUALITY_THRESHOLDS.brightness;
      if (value >= min && value <= max) return 'text-green-500';
      if (value >= min - 10 && value <= max + 10) return 'text-yellow-500';
      return 'text-red-500';
    } else {
      const { min } = QUALITY_THRESHOLDS.sharpness;
      if (value >= min) return 'text-green-500';
      if (value >= min - 5) return 'text-yellow-500';
      return 'text-red-500';
    }
  };
  
  const allEdgesDetected = edgesDetected.top && edgesDetected.right && edgesDetected.bottom && edgesDetected.left;
  const isGoodQuality = 
    brightness >= QUALITY_THRESHOLDS.brightness.min && 
    brightness <= QUALITY_THRESHOLDS.brightness.max && 
    sharpness >= QUALITY_THRESHOLDS.sharpness.min && 
    allEdgesDetected;
  
  // =============================================
  // واجهة المستخدم
  // =============================================
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-3" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            التحقق من البطاقة
          </h1>
          
          {/* Tabs */}
          {!capturedImage && (
            <div className="flex gap-2 max-w-sm mx-auto mb-3">
              <button
                onClick={() => setActiveTab('front')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'front'
                    ? 'bg-teal-500 text-white shadow-md'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
                }`}
                data-testid="tab-front"
              >
                تصوير الوجه الأمامي
              </button>
              <button
                onClick={() => setActiveTab('back')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${
                  activeTab === 'back'
                    ? 'bg-teal-500 text-white shadow-md'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600'
                }`}
                data-testid="tab-back"
              >
                تصوير الوجه الخلفي
              </button>
            </div>
          )}
        </div>

        {!capturedImage ? (
          <Card className="overflow-hidden shadow-2xl">
            <div className="relative bg-black">
              {/* رسالة توجيهية في الأعلى */}
              <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
                <div className="bg-black/75 backdrop-blur-sm rounded-full px-4 py-2">
                  <p className="text-white text-xs font-semibold text-center">
                    {activeTab === 'front' ? '📸 ضع الوجه الأمامي للبطاقة داخل الإطار' : '📸 ضع الوجه الخلفي للبطاقة داخل الإطار'}
                  </p>
                </div>
              </div>
              
              <video
                ref={videoRef}
                className="w-full h-auto"
                playsInline
                muted
                data-testid="camera-video"
              />
              
              <canvas ref={overlayCanvasRef} className="hidden" />
              
              {/* إطار البطاقة والمؤشرات */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <mask id="card-mask">
                    <rect width="100" height="100" fill="white" />
                    <rect x="10" y="25.2" width="80" height="50.4" rx="1.5" fill="black" />
                  </mask>
                </defs>
                
                {/* خلفية داكنة خارج الإطار */}
                <rect
                  width="100"
                  height="100"
                  fill="rgba(0,0,0,0.65)"
                  mask="url(#card-mask)"
                />
                
                {/* الإطار الأبيض الخارجي */}
                <rect
                  x="9.5"
                  y="24.7"
                  width="81"
                  height="51.4"
                  rx="2"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.2"
                  className={allEdgesDetected ? 'animate-pulse' : ''}
                />
                
                {/* الزوايا المميزة */}
                {[
                  { x: 10, y: 25.2, path: 'M 10 30 L 10 25.2 L 15 25.2' },
                  { x: 90, y: 25.2, path: 'M 85 25.2 L 90 25.2 L 90 30' },
                  { x: 10, y: 75.6, path: 'M 10 71 L 10 75.6 L 15 75.6' },
                  { x: 90, y: 75.6, path: 'M 85 75.6 L 90 75.6 L 90 71' }
                ].map((corner, i) => (
                  <path
                    key={i}
                    d={corner.path}
                    fill="none"
                    stroke={allEdgesDetected ? '#10b981' : '#14b8a6'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={allEdgesDetected ? 'animate-pulse' : ''}
                  />
                ))}
                
                {/* مؤشرات الحواف */}
                {[
                  { x: 50, y: 25.2, detected: edgesDetected.top, label: 'top' },
                  { x: 90, y: 50.4, detected: edgesDetected.right, label: 'right' },
                  { x: 50, y: 75.6, detected: edgesDetected.bottom, label: 'bottom' },
                  { x: 10, y: 50.4, detected: edgesDetected.left, label: 'left' }
                ].map((indicator, i) => (
                  <circle
                    key={i}
                    cx={indicator.x}
                    cy={indicator.y}
                    r="0.8"
                    fill={indicator.detected ? '#10b981' : 'rgba(255,255,255,0.3)'}
                    className={indicator.detected ? 'animate-pulse' : ''}
                  />
                ))}
              </svg>
              
              {/* مؤشر الجاهزية */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                {isGoodQuality ? (
                  <div className="bg-green-500 backdrop-blur-sm rounded-full px-6 py-3 shadow-lg animate-pulse">
                    <div className="flex items-center gap-2 text-white">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-bold text-sm">يتم الالتقاط الآن...</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/75 backdrop-blur-sm rounded-full px-5 py-2.5">
                    <p className="text-white text-xs font-medium">
                      {!allEdgesDetected ? '⚠️ حرّك البطاقة لتظهر داخل الإطار بالكامل' :
                       brightness < QUALITY_THRESHOLDS.brightness.min ? '💡 الإضاءة ضعيفة - حرك البطاقة لمكان أكثر إضاءة' :
                       brightness > QUALITY_THRESHOLDS.brightness.max ? '☀️ الإضاءة قوية جداً - تجنب الضوء المباشر' :
                       sharpness < QUALITY_THRESHOLDS.sharpness.min ? '📷 ثبّت الهاتف للحصول على صورة أوضح' :
                       '✓ استمر في التثبيت...'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <canvas ref={canvasRef} className="hidden" />
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-2xl">
            <img
              src={capturedImage}
              alt="Captured ID"
              className="w-full h-auto"
              data-testid="captured-image"
            />
            
            {isProcessing ? (
              <div className="p-6 text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-gray-700 dark:text-gray-300 font-semibold">
                  جاري معالجة الصورة واستخراج البيانات...
                </p>
              </div>
            ) : result ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-4">
                  <CheckCircle className="w-6 h-6" />
                  <h3 className="text-xl font-bold">تم استخراج البيانات بنجاح!</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">الرقم القومي</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-nationalId">
                      {result.nationalId || 'غير متوفر'}
                    </p>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">الاسم</p>
                    <p className="text-lg font-semibold text-purple-600 dark:text-purple-400" data-testid="text-fullName">
                      {result.fullName || 'غير متوفر'}
                    </p>
                  </div>
                  
                  {result.address && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">العنوان</p>
                      <p className="text-base text-green-600 dark:text-green-400" data-testid="text-address">
                        {result.address}
                      </p>
                    </div>
                  )}
                </div>
                
                <Button
                  onClick={retakePhoto}
                  className="w-full"
                  variant="outline"
                  data-testid="button-retake"
                >
                  <Camera className="w-4 h-4 ml-2" />
                  التقاط صورة جديدة
                </Button>
              </div>
            ) : null}
          </Card>
        )}

        <div className="mt-4 text-center text-xs text-gray-600 dark:text-gray-400">
          <p className="font-semibold mb-1">💡 للحصول على أفضل نتائج:</p>
          <ul className="space-y-0.5">
            <li>• تأكد من إضاءة جيدة وتجنب الظلال</li>
            <li>• حاذي جميع حواف البطاقة مع الإطار</li>
            <li>• انتظر حتى تتحول جميع الحواف للأخضر</li>
            <li>• ثبت الموبايل جيداً لوضوح أفضل</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
