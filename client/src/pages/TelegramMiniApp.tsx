import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
        };
        showAlert: (message: string) => void;
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
      };
    };
  }
}

interface OCRResult {
  nationalId: string | null;
  fullName: string | null;
  address: string | null;
}

interface EdgeDetection {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export default function TelegramMiniApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
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
  const { toast } = useToast();

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
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const detectEdges = (imageData: ImageData, videoWidth: number, videoHeight: number): EdgeDetection => {
    const cardX = Math.floor(videoWidth * 0.175);
    const cardWidth = Math.floor(videoWidth * 0.65);
    const EGYPTIAN_ID_ASPECT_RATIO = 85.60 / 53.98;
    const cardHeight = Math.floor(cardWidth / EGYPTIAN_ID_ASPECT_RATIO);
    const cardY = Math.floor((videoHeight - cardHeight) / 2);
    
    const edgeThreshold = 40;
    const data = imageData.data;
    const width = imageData.width;
    
    const getPixel = (x: number, y: number) => {
      const idx = (y * width + x) * 4;
      return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    };
    
    const checkEdge = (x1: number, y1: number, x2: number, y2: number, direction: 'horizontal' | 'vertical'): boolean => {
      let edgeCount = 0;
      const totalPoints = direction === 'horizontal' ? Math.abs(x2 - x1) : Math.abs(y2 - y1);
      
      if (direction === 'horizontal') {
        for (let x = x1; x < x2; x += 5) {
          const inside = getPixel(x, y1);
          const outside = getPixel(x, Math.max(0, y1 - 3));
          if (Math.abs(inside - outside) > edgeThreshold) edgeCount++;
        }
      } else {
        for (let y = y1; y < y2; y += 5) {
          const inside = getPixel(x1, y);
          const outside = getPixel(Math.max(0, x1 - 3), y);
          if (Math.abs(inside - outside) > edgeThreshold) edgeCount++;
        }
      }
      
      return edgeCount > totalPoints / 15;
    };
    
    return {
      top: checkEdge(cardX, cardY, cardX + cardWidth, cardY, 'horizontal'),
      bottom: checkEdge(cardX, cardY + cardHeight, cardX + cardWidth, cardY + cardHeight, 'horizontal'),
      left: checkEdge(cardX, cardY, cardX, cardY + cardHeight, 'vertical'),
      right: checkEdge(cardX + cardWidth, cardY, cardX + cardWidth, cardY + cardHeight, 'vertical')
    };
  };

  const calculateImageQuality = (imageData: ImageData, videoWidth: number, videoHeight: number) => {
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
    
    const edgeDetection = detectEdges(imageData, videoWidth, videoHeight);
    
    return { brightness: normalizedBrightness, sharpness: normalizedSharpness, edges: edgeDetection };
  };

  const startQualityCheck = () => {
    const checkInterval = setInterval(() => {
      if (videoRef.current && overlayCanvasRef.current && !isProcessing && !capturedImage) {
        const video = videoRef.current;
        const canvas = overlayCanvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const quality = calculateImageQuality(imageData, video.videoWidth, video.videoHeight);
          
          setBrightness(quality.brightness);
          setSharpness(quality.sharpness);
          setEdgesDetected(quality.edges);
          
          const allEdgesDetected = quality.edges.top && quality.edges.right && quality.edges.bottom && quality.edges.left;
          
          if (quality.brightness >= 40 && quality.brightness <= 85 && quality.sharpness >= 15 && allEdgesDetected) {
            clearInterval(checkInterval);
            capturePhoto();
          }
        }
      }
    }, 300);
    
    return () => clearInterval(checkInterval);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(imageDataUrl);
    stopCamera();
    
    await processImage(imageDataUrl);
  };

  const processImage = async (imageDataUrl: string) => {
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
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setResult(null);
    startCamera();
  };

  const getQualityColor = (value: number, type: 'brightness' | 'sharpness') => {
    if (type === 'brightness') {
      if (value >= 40 && value <= 85) return 'text-green-500';
      if (value >= 30 && value <= 95) return 'text-yellow-500';
      return 'text-red-500';
    } else {
      if (value >= 15) return 'text-green-500';
      if (value >= 10) return 'text-yellow-500';
      return 'text-red-500';
    }
  };

  const allEdgesDetected = edgesDetected.top && edgesDetected.right && edgesDetected.bottom && edgesDetected.left;
  const isGoodQuality = brightness >= 40 && brightness <= 85 && sharpness >= 15 && allEdgesDetected;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            📸 مسح البطاقة الشخصية
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ضع البطاقة داخل الإطار - سيتم الالتقاط تلقائياً
          </p>
        </div>

        {!capturedImage ? (
          <Card className="overflow-hidden shadow-2xl">
            <div className="relative bg-black">
              <video
                ref={videoRef}
                className="w-full h-auto"
                playsInline
                muted
                data-testid="camera-video"
              />
              
              <canvas ref={overlayCanvasRef} className="hidden" />
              
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <mask id="card-mask">
                    <rect width="100" height="100" fill="white" />
                    <rect x="15" y="28" width="70" height="44" rx="1.5" fill="black" />
                  </mask>
                </defs>
                
                <rect
                  width="100"
                  height="100"
                  fill="rgba(0,0,0,0.6)"
                  mask="url(#card-mask)"
                />
                
                <line
                  x1="15" y1="28"
                  x2="85" y2="28"
                  stroke={edgesDetected.top ? '#10b981' : '#f59e0b'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
                
                <line
                  x1="85" y1="28"
                  x2="85" y2="72"
                  stroke={edgesDetected.right ? '#10b981' : '#f59e0b'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
                
                <line
                  x1="85" y1="72"
                  x2="15" y2="72"
                  stroke={edgesDetected.bottom ? '#10b981' : '#f59e0b'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
                
                <line
                  x1="15" y1="72"
                  x2="15" y2="28"
                  stroke={edgesDetected.left ? '#10b981' : '#f59e0b'}
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
                
                <line x1="15" y1="50" x2="85" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="0.15" />
                <line x1="50" y1="28" x2="50" y2="72" stroke="rgba(255,255,255,0.2)" strokeWidth="0.15" />
                
                {[
                  { x: 15, y: 28, detected: edgesDetected.top && edgesDetected.left },
                  { x: 85, y: 28, detected: edgesDetected.top && edgesDetected.right },
                  { x: 15, y: 72, detected: edgesDetected.bottom && edgesDetected.left },
                  { x: 85, y: 72, detected: edgesDetected.bottom && edgesDetected.right }
                ].map((corner, i) => (
                  <circle
                    key={i}
                    cx={corner.x}
                    cy={corner.y}
                    r="1.2"
                    fill={corner.detected ? '#10b981' : '#f59e0b'}
                    className={corner.detected ? 'animate-pulse' : ''}
                  />
                ))}
              </svg>
              
              <div className="absolute bottom-3 left-0 right-0 px-3">
                <div className="bg-black/75 backdrop-blur-sm rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white">الإضاءة:</span>
                    <span className={`font-bold ${getQualityColor(brightness, 'brightness')}`}>
                      {brightness.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white">الوضوح:</span>
                    <span className={`font-bold ${getQualityColor(sharpness, 'sharpness')}`}>
                      {sharpness.toFixed(0)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {[
                      { label: 'العلوي', detected: edgesDetected.top },
                      { label: 'الأيمن', detected: edgesDetected.right },
                      { label: 'السفلي', detected: edgesDetected.bottom },
                      { label: 'الأيسر', detected: edgesDetected.left }
                    ].map((edge, i) => (
                      <div key={i} className="text-center">
                        <div className={`w-full h-1 rounded-full mb-0.5 ${edge.detected ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className={`text-[10px] ${edge.detected ? 'text-green-400' : 'text-gray-400'}`}>
                          {edge.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  {isGoodQuality && (
                    <div className="flex items-center justify-center gap-2 text-green-400 text-xs mt-2 animate-pulse">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="font-semibold">جاهز للالتقاط...</span>
                    </div>
                  )}
                </div>
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
          </ul>
        </div>
      </div>
    </div>
  );
}
