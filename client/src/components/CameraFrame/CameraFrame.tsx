import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import styles from './CameraFrame.module.css';

interface CameraFrameProps {
  className?: string;
  onFrameSize?: (width: number, height: number) => void;
  onFrameReady?: (isWithinSpecs: boolean) => void;
}

export const CameraFrame: React.FC<CameraFrameProps> = ({ 
  className,
  onFrameSize,
  onFrameReady
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // نسبة البطاقة القومية (عرض/ارتفاع)
  const ID_CARD_RATIO = 1.586;
  
  // الحد الأدنى المطلوب للـ OCR (بالبيكسل)
  const MIN_WIDTH_FOR_OCR = 600;
  const IDEAL_WIDTH_FOR_OCR = 1000;
  
  const adjustFrameSize = () => {
    if (!frameRef.current) return;
    
    const isLandscape = window.innerWidth > window.innerHeight;
    let frameWidth, frameHeight;
    
    if (isLandscape) {
      // في الوضع الأفقي نستخدم 75% من ارتفاع الشاشة
      frameHeight = window.innerHeight * 0.75;
      frameWidth = frameHeight * ID_CARD_RATIO;
      
      // تأكد من أن العرض لا يتجاوز 80% من عرض الشاشة
      if (frameWidth > window.innerWidth * 0.8) {
        frameWidth = window.innerWidth * 0.8;
        frameHeight = frameWidth / ID_CARD_RATIO;
      }
    } else {
      // في الوضع الرأسي نستخدم 80% من عرض الشاشة
      frameWidth = window.innerWidth * 0.8;
      frameHeight = frameWidth / ID_CARD_RATIO;
    }
    
    frameRef.current.style.width = `${frameWidth}px`;
    frameRef.current.style.height = `${frameHeight}px`;
    
    // التحقق من مناسبة الحجم للـ OCR
    const isWithinOcrSpecs = frameWidth >= MIN_WIDTH_FOR_OCR;
    onFrameReady?.(isWithinOcrSpecs);
    
    // إخطار الأب بأبعاد الإطار
    onFrameSize?.(frameWidth, frameHeight);
    
    console.log(`Frame dimensions: ${Math.round(frameWidth)}x${Math.round(frameHeight)}px`);
    console.log(`OCR quality: ${frameWidth >= IDEAL_WIDTH_FOR_OCR ? 'Excellent' : 
                               frameWidth >= MIN_WIDTH_FOR_OCR ? 'Good' : 
                               'Below minimum'}`);
  };
  
  const initCamera = async () => {
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
      }
    } catch (err) {
      console.error('خطأ في تشغيل الكاميرا:', err);
    }
  };
  
  useEffect(() => {
    initCamera();
    adjustFrameSize();
    
    const handleResize = () => {
      adjustFrameSize();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // إيقاف الكاميرا عند إزالة المكون
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // منع التكبير على الموبايل
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.scale !== undefined && e.scale !== 1) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('touchmove', preventZoom, { passive: false });
    return () => document.removeEventListener('touchmove', preventZoom);
  }, []);

  return (
    <div className={cn(
      "relative w-full h-screen overflow-hidden bg-black",
      className
    )}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      <div
        ref={frameRef}
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "border-2 border-white rounded-lg",
          "shadow-[0_0_0_2000px_rgba(0,0,0,0.7)]"
        )}
      >
        {/* أركان الإطار */}
        <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-blue-500" />
        <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-blue-500" />
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-blue-500" />
        <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-blue-500" />
        
        {/* هوامش الأمان */}
        <div className="absolute inset-[8%] border border-white/50 border-dashed pointer-events-none" />
      </div>
      
      {/* نص الإرشادات */}
      <div className={cn(
        "absolute bottom-[10%] left-1/2 -translate-x-1/2",
        "w-[90%] text-center text-white text-lg",
        "direction-rtl",
        styles.textShadowSm
      )}>
        ضع البطاقة داخل الإطار وتأكد من وضوح كل البيانات
      </div>
    </div>
  );
};

export default CameraFrame;