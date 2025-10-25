import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function GoogleAuth() {
  const [status, setStatus] = useState<'checking' | 'needs_auth' | 'authenticated'>('checking');

  const { data: oauthStatus, isLoading } = useQuery({
    queryKey: ['/api/oauth/status'],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (oauthStatus) {
      setStatus(oauthStatus.authenticated ? 'authenticated' : 'needs_auth');
    }
  }, [oauthStatus]);

  const handleGoogleAuth = () => {
    window.location.href = '/auth/google';
  };

  if (isLoading || status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" data-testid="loader-checking" />
            <p className="text-lg">جاري التحقق من الاتصال...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600" dir="rtl">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="h-8 w-8 text-green-600" data-testid="icon-success" />
              تم الاتصال بنجاح!
            </CardTitle>
            <CardDescription>
              تم الربط مع Google Drive و Google Sheets بنجاح
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">
                ✅ يمكنك الآن استخدام التطبيق بشكل كامل
                <br />
                🤖 البوت نشط ويمكنه حفظ البيانات
                <br />
                📊 لوحة التحكم جاهزة للاستخدام
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600" dir="rtl">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold mb-2">
            مرحباً بك في نظام جمع بيانات الناخبين
          </CardTitle>
          <CardDescription className="text-lg">
            حملة المرشح علاء سليمان الحديوي
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-5 w-5 text-yellow-600" data-testid="icon-warning" />
            <AlertDescription className="text-yellow-800">
              <strong>مطلوب:</strong> الربط مع Google لتفعيل النظام
            </AlertDescription>
          </Alert>

          <div className="space-y-3 text-sm">
            <h3 className="font-semibold text-lg mb-3">لماذا نحتاج الربط مع Google؟</h3>
            <div className="flex items-start gap-2">
              <span className="text-primary">📊</span>
              <p>حفظ بيانات الناخبين في Google Sheets</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">🖼️</span>
              <p>رفع صور البطاقات إلى Google Drive</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">🔒</span>
              <p>الوصول الآمن بدون الحاجة لمشاركة المجلدات يدوياً</p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2 text-blue-900">خطوات بسيطة:</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>اضغط على زر "الربط مع Google"</li>
              <li>سجل دخول بحساب Google الخاص بك</li>
              <li>امنح الصلاحيات المطلوبة</li>
              <li>استمتع بالنظام! 🎉</li>
            </ol>
          </div>

          <Button 
            onClick={handleGoogleAuth}
            size="lg"
            className="w-full text-lg h-14"
            data-testid="button-google-auth"
          >
            <svg className="w-6 h-6 ml-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            الربط مع Google
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            لن نصل إلى بياناتك الشخصية. فقط Google Sheets و Drive
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
