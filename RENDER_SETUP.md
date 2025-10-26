# دليل إعداد البوت على Render

## المشكلة: البوت لا يستجيب على Render

إذا كان البوت لا يستجيب على Render، السبب على الأرجح أن **Webhook غير مضبوط بشكل صحيح**.

## الحل: خطوات الإعداد الصحيحة

### 1. تأكد من وجود المتغيرات البيئية المطلوبة

في Render Dashboard > Environment Variables، تأكد من إضافة:

**مطلوب للبوت:**
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

**مطلوب لـ Google (اختر Service Account):**
```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```

**مطلوب لتسجيل الدخول:**
```
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
```

**مطلوب للـ Webhook (تلقائي):**
```
WEBHOOK_URL=https://your-app-name.onrender.com
```

⚠️ **ملاحظة مهمة**: 
- استبدل `your-app-name.onrender.com` برابط تطبيقك الفعلي على Render
- يمكنك إيجاد الرابط في Render Dashboard تحت اسم التطبيق

### 2. إعداد WEBHOOK_URL

#### الطريقة الأولى (موصى بها): ضبط يدوي
في Render Environment Variables، أضف:
```
WEBHOOK_URL=https://your-app-name.onrender.com
```

#### الطريقة الثانية: تلقائي
النظام الآن يكتشف `RENDER_EXTERNAL_URL` تلقائياً، لكن من الأفضل إضافة `WEBHOOK_URL` يدوياً.

### 3. التحقق من حالة البوت

بعد نشر التطبيق، افتح:
```
https://your-app-name.onrender.com/api/bot/status
```

ستحصل على معلومات عن:
- ✅ هل البوت متصل؟
- ✅ هل الـ Webhook مضبوط؟
- ✅ ما هو رابط الـ Webhook؟
- ✅ هل هناك أخطاء؟

### 4. فحص Logs على Render

في Render Dashboard > Logs، ابحث عن:

#### علامات النجاح ✅:
```
🤖 Telegram Bot started in WEBHOOK mode
📡 Webhook URL: https://your-app-name.onrender.com
✅ Webhook set to: https://your-app-name.onrender.com/bot...
📋 Webhook info: { url: '...', pending_update_count: 0 }
```

#### علامات المشاكل ❌:
```
⚠️ WARNING: Running in POLLING mode
❌ Failed to set webhook
```

### 5. إذا كان البوت ما زال لا يستجيب

#### أ) تحقق من Service Account

تأكد من:
1. مشاركة Google Sheet مع `client_email` من Service Account
2. مشاركة Google Drive Folder مع نفس `client_email`
3. الصلاحيات: Editor للـ Sheet، Content Manager للـ Drive

#### ب) أعد تشغيل التطبيق

في Render Dashboard:
1. اضغط "Manual Deploy" > "Clear build cache & deploy"
2. انتظر حتى ينتهي النشر
3. تحقق من Logs

#### ج) احذف الـ Webhook القديم

إذا كنت قد غيّرت الرابط، احذف الـ Webhook القديم:

1. افتح Terminal محلي
2. شغل:
```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook
```

3. ثم أعد تشغيل التطبيق على Render

### 6. اختبار البوت

بعد الإعداد:
1. افتح Telegram
2. ابحث عن البوت الخاص بك
3. أرسل `/start`
4. يجب أن يرد البوت فوراً

### 7. إضافة مندوب للاختبار

1. افتح Google Sheet
2. في ورقة "Representatives"
3. أضف User ID الخاص بك (احصل عليه من @userinfobot)

| user_id   | name        |
|-----------|-------------|
| 123456789 | اسمك هنا   |

## استكشاف الأخطاء الشائعة

### خطأ: "❌ عذراً، أنت غير مصرح لك"
**الحل**: أضف User ID الخاص بك في Google Sheet > ورقة Representatives

### خطأ: "GOOGLE_SHEET_ID environment variable is not set"
**الحل**: أضف `GOOGLE_SHEET_ID` في Render Environment Variables

### خطأ: البوت لا يرد على الإطلاق
**الحل**: 
1. تحقق من `/api/bot/status`
2. تأكد من `WEBHOOK_URL` مضبوط
3. فحص Logs في Render

### خطأ: "No access, refresh token"
**الحل**: استخدم Service Account بدلاً من OAuth على Render

## نصائح للأداء الأفضل

1. **استخدم Free Instance بحذر**: Render Free tier ينام بعد 15 دقيقة خمول
2. **Upgrade للـ Paid**: للحصول على استجابة سريعة دائماً
3. **فحص Logs بانتظام**: لاكتشاف المشاكل مبكراً

## الدعم

إذا ما زالت المشكلة موجودة:
1. افحص `/api/bot/status`
2. أرسل Logs من Render
3. تحقق من جميع المتغيرات البيئية
