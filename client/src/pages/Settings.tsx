import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function Settings() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    email?: string;
  } | null>(null);

  const testDriveConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const data = await apiRequest<{
        success: boolean;
        message: string;
        email?: string;
      }>('GET', '/api/test-drive');
      
      setTestResult(data);
    } catch (error: any) {
      const errorMessage = error.message || 'خطأ غير معروف';
      setTestResult({
        success: false,
        message: `❌ خطأ في الاتصال: ${errorMessage}\n\nتأكد من أنك مسجل دخول بشكل صحيح.`
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">الإعدادات والتشخيص</h1>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">اختبار الاتصال بـ Google Drive</h2>
        <p className="text-muted-foreground mb-4">
          هذا الاختبار يتحقق من أن التطبيق يستطيع الوصول إلى مجلد Google Drive بشكل صحيح.
        </p>
        
        <Button 
          onClick={testDriveConnection} 
          disabled={testing}
          className="mb-4"
        >
          {testing ? (
            <>
              <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
              جاري الاختبار...
            </>
          ) : (
            'اختبار الاتصال'
          )}
        </Button>

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {testResult.success ? 'نجح الاتصال!' : 'فشل الاتصال'}
            </AlertTitle>
            <AlertDescription className="whitespace-pre-line mt-2">
              {testResult.message}
            </AlertDescription>
            {testResult.email && (
              <AlertDescription className="mt-4 p-3 bg-muted rounded">
                <strong>Service Account Email:</strong>
                <br />
                <code className="text-sm">{testResult.email}</code>
              </AlertDescription>
            )}
          </Alert>
        )}

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">الأخطاء الشائعة وحلولها:</h3>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>
              <strong>خطأ 404:</strong> المجلد غير موجود أو غير مشارك. تأكد من مشاركة المجلد مع Service Account.
            </li>
            <li>
              <strong>خطأ 403:</strong> ليس لديك صلاحية. تأكد من إعطاء صلاحية "Editor" وليس "Viewer".
            </li>
            <li>
              <strong>لا يمكن إضافة ملفات:</strong> تأكد من أن الصلاحية "Editor" وليس "Viewer".
            </li>
            <li>
              <strong>المجلد في "Shared with me":</strong> انقل المجلد إلى "My Drive" الخاص بك.
            </li>
          </ul>
        </div>

        <div className="mt-6 p-4 border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
          <h3 className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">
            📋 خطوات التأكد من المشاركة الصحيحة:
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-900 dark:text-yellow-100">
            <li>افتح Google Drive وابحث عن المجلد</li>
            <li>اضغط كليك يمين على المجلد → "مشاركة" أو "Share"</li>
            <li>احذف أي مشاركات سابقة للـ Service Account</li>
            <li>أضف البريد الإلكتروني للـ Service Account من جديد</li>
            <li>اختر صلاحية "Editor" (محرر)</li>
            <li>اضغط "مشاركة" → "تم"</li>
            <li>انتظر 30 ثانية ثم اختبر الاتصال مرة أخرى</li>
          </ol>
        </div>
      </Card>
    </div>
  );
}
