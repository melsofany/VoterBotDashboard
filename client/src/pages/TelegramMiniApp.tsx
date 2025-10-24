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
          width: { ideal: 1920 },
          height: { ideal: 1080 }
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

  const calculateImageQuality = (imageData: ImageData) => {
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
    
    return { brightness: normalizedBrightness, sharpness: normalizedSharpness };
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
          const quality = calculateImageQuality(imageData);
          
          setBrightness(quality.brightness);
          setSharpness(quality.sharpness);
          
          if (quality.brightness >= 40 && quality.brightness <= 85 && quality.sharpness >= 15) {
            clearInterval(checkInterval);
            capturePhoto();
          }
        }
      }
    }, 500);
    
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

  const isGoodQuality = brightness >= 40 && brightness <= 85 && sharpness >= 15;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            📸 مسح البطاقة الشخصية
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            ضع البطاقة داخل الإطار حتى يتم التقاطها تلقائياً
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
                    <rect x="10" y="25" width="80" height="50" rx="2" fill="black" />
                  </mask>
                </defs>
                
                <rect
                  width="100"
                  height="100"
                  fill="rgba(0,0,0,0.5)"
                  mask="url(#card-mask)"
                />
                
                <rect
                  x="10"
                  y="25"
                  width="80"
                  height="50"
                  rx="2"
                  fill="none"
                  stroke={isGoodQuality ? '#10b981' : '#f59e0b'}
                  strokeWidth="0.5"
                  strokeDasharray={isGoodQuality ? '0' : '2 1'}
                />
                
                <line x1="10" y1="50" x2="90" y2="50" stroke="rgba(255,255,255,0.3)" strokeWidth="0.2" />
                <line x1="50" y1="25" x2="50" y2="75" stroke="rgba(255,255,255,0.3)" strokeWidth="0.2" />
                
                {[
                  { x: 10, y: 25 },
                  { x: 90, y: 25 },
                  { x: 10, y: 75 },
                  { x: 90, y: 75 }
                ].map((corner, i) => (
                  <circle
                    key={i}
                    cx={corner.x}
                    cy={corner.y}
                    r="1"
                    fill={isGoodQuality ? '#10b981' : '#f59e0b'}
                  />
                ))}
              </svg>
              
              <div className="absolute bottom-4 left-0 right-0 px-4">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white">الإضاءة:</span>
                    <span className={`font-bold ${getQualityColor(brightness, 'brightness')}`}>
                      {brightness.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white">الوضوح:</span>
                    <span className={`font-bold ${getQualityColor(sharpness, 'sharpness')}`}>
                      {sharpness.toFixed(0)}%
                    </span>
                  </div>
                  {isGoodQuality && (
                    <div className="flex items-center justify-center gap-2 text-green-400 text-sm mt-2 animate-pulse">
                      <CheckCircle className="w-4 h-4" />
                      <span>جاهز للالتقاط...</span>
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

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>💡 نصائح للحصول على أفضل نتائج:</p>
          <ul className="mt-2 space-y-1">
            <li>• تأكد من وجود إضاءة جيدة</li>
            <li>• ضع البطاقة بشكل مستوٍ</li>
            <li>• تجنب الظلال والانعكاسات</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
