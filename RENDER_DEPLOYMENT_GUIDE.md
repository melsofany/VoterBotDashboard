# دليل نشر المشروع على Render

## نظرة عامة
هذا الدليل يشرح خطوة بخطوة كيفية نشر مشروع **لوحة تحكم بوت الناخبين** على منصة Render.

---

## الخطوة 1: رفع المشروع على GitHub

قبل النشر على Render، يجب رفع المشروع على GitHub:

### 1. إنشاء Repository جديد
1. اذهب إلى [GitHub](https://github.com)
2. اضغط على "New Repository"
3. اختر اسماً للمشروع (مثل: `VoterBotDashboard`)
4. اجعله **Private** لحماية البيانات
5. اضغط "Create Repository"

### 2. رفع الملفات
```bash
git init
git add .
git commit -m "Initial commit - Voter Dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/VoterBotDashboard.git
git push -u origin main
```

**ملاحظة مهمة:** تأكد من عدم رفع الملفات الحساسة (credentials) على GitHub

---

## الخطوة 2: إعداد حساب Render

1. اذهب إلى [Render.com](https://render.com)
2. سجل حساب جديد أو سجل دخول
3. يمكنك استخدام حساب GitHub للتسجيل
4. اربط حساب Render بحساب GitHub الخاص بك

---

## الخطوة 3: إنشاء Web Service على Render

### الإعدادات الأساسية

في لوحة تحكم Render:
1. اضغط على **"New +"** في الأعلى
2. اختر **"Web Service"**
3. اختر repository الخاص بك من GitHub

### ملء نموذج الإعدادات

#### **Name** (اسم الخدمة)
```
VoterBotDashboard
```
أو أي اسم تفضله - سيكون جزء من الرابط النهائي

#### **Project** (المشروع) - اختياري
يمكنك إضافة الخدمة لمشروع موجود أو تركه فارغاً

#### **Environment** (البيئة)
```
Production
```

#### **Language** (لغة البرمجة)
```
Node
```

#### **Branch** (الفرع)
```
main
```

#### **Region** (المنطقة)
اختر المنطقة الأقرب لمستخدميك:
- **Frankfurt (EU Central)** - للمستخدمين في أوروبا والشرق الأوسط
- **Singapore** - لآسيا
- **Oregon (US West)** - لأمريكا

#### **Root Directory** (المجلد الرئيسي)
اتركه **فارغاً**

#### **Build Command** (أمر البناء)
```
npm install && npm run build
```

#### **Start Command** (أمر التشغيل)
```
npm run start
```

#### **Instance Type** (نوع الخادم)

##### للتجربة (مجاني):
```
Free - $0/month
- 512 MB RAM
- 0.1 CPU
- الخادم ينام بعد 15 دقيقة من عدم النشاط
- 750 ساعة مجانية شهرياً
```

##### للاستخدام الفعلي (موصى به):
```
Starter - $7/month
- 512 MB RAM
- 0.5 CPU
- يعمل 24/7 بدون انقطاع
- دعم SSL مجاني
- نطاق مخصص
```

##### للاستخدام المكثف:
```
Standard - $25/month
- 2 GB RAM
- 1 CPU
- أداء أفضل
```

---

## الخطوة 4: إضافة متغيرات البيئة (Environment Variables)

**مهم جداً:** المشروع لن يعمل بدون هذه المتغيرات!

اضغط على **"Advanced"** أسفل النموذج، ثم اضغط **"Add Environment Variable"**

### المتغيرات المطلوبة:

#### 1. TELEGRAM_BOT_TOKEN
```
Key: TELEGRAM_BOT_TOKEN
Value: YOUR_BOT_TOKEN_FROM_BOTFATHER
```
- احصل عليه من [@BotFather](https://t.me/botfather)
- يبدأ بشكل مثل: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### 2. GOOGLE_SHEET_ID
```
Key: GOOGLE_SHEET_ID
Value: YOUR_SHEET_ID
```
- من رابط Google Sheet: `https://docs.google.com/spreadsheets/d/[SHEET_ID_HERE]/edit`
- انسخ الجزء بين `/d/` و `/edit`

#### 3. GOOGLE_DRIVE_FOLDER_ID
```
Key: GOOGLE_DRIVE_FOLDER_ID
Value: YOUR_FOLDER_ID
```
- من رابط Google Drive Folder
- انسخ الجزء الأخير من الرابط

#### 4. ADMIN_USERNAME
```
Key: ADMIN_USERNAME
Value: admin
```
أو اختر اسم مستخدم آخر لتسجيل الدخول للوحة التحكم

#### 5. ADMIN_PASSWORD
```
Key: ADMIN_PASSWORD
Value: YOUR_SECURE_PASSWORD
```
**مهم:** استخدم كلمة مرور قوية!

#### 6. HUGGINGFACE_TOKEN (اختياري - لكن موصى به)
```
Key: HUGGINGFACE_TOKEN
Value: YOUR_HF_TOKEN
```
- يحسن دقة OCR (قراءة البطاقات)
- احصل عليه من [Hugging Face Settings](https://huggingface.co/settings/tokens)
- إذا لم تضعه، سيستخدم النظام Tesseract فقط

#### 7. PORT (يُضاف تلقائياً)
```
Key: PORT
Value: 10000
```
**ملاحظة:** Render يضيف هذا المتغير تلقائياً - لا تحتاج إضافته

#### 8. NODE_ENV (يُضاف تلقائياً)
```
Key: NODE_ENV
Value: production
```
**ملاحظة:** Render يضيف هذا المتغير تلقائياً - لا تحتاج إضافته

---

## الخطوة 5: إعداد Google Sheets API

### 1. الحصول على Credentials

المشروع يستخدم **Google Sheets Integration** من Replit:

#### الطريقة 1: نسخ من Replit (الأسهل)
إذا كان المشروع يعمل بالفعل على Replit:
1. افتح المشروع على Replit
2. اذهب إلى **Tools** → **Secrets**
3. ابحث عن secrets بأسماء مثل:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
4. انسخ القيم وأضفها كمتغيرات بيئة في Render

#### الطريقة 2: إنشاء جديد من Google Cloud
1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com)
2. أنشئ مشروع جديد أو استخدم موجود
3. فعّل **Google Sheets API** و **Google Drive API**
4. أنشئ **Service Account**
5. حمّل ملف JSON للـ credentials
6. من الملف، استخرج:
   - `client_email` → أضفه كـ `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → أضفه كـ `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

### 2. مشاركة Google Sheet
1. افتح Google Sheet الخاص بك
2. اضغط **Share** (مشاركة)
3. أضف البريد الإلكتروني للـ Service Account
4. أعطه صلاحية **Editor**

### 3. مشاركة Google Drive Folder
افعل نفس الشيء مع مجلد Drive لرفع صور البطاقات

---

## الخطوة 6: النشر

بعد ملء جميع الإعدادات:

1. **راجع جميع الإعدادات** للتأكد من صحتها
2. اضغط على **"Create Web Service"**
3. انتظر... سيبدأ Render في:
   - استنساخ الكود من GitHub
   - تثبيت الحزم (`npm install`)
   - بناء المشروع (`npm run build`)
   - تشغيل الخادم (`npm run start`)

### مراقبة عملية النشر
- ستظهر لك شاشة بها Logs مباشرة
- انتظر حتى ترى: `✅ Server running on port XXXX`
- إذا ظهرت أخطاء، راجع الخطوات أعلاه

---

## الخطوة 7: الوصول للتطبيق

### رابط التطبيق
بعد نجاح النشر، سيكون لديك رابط مثل:
```
https://voterbot-dashboard-xyz.onrender.com
```

### تسجيل الدخول
1. افتح الرابط في المتصفح
2. سترى صفحة تسجيل الدخول
3. أدخل `ADMIN_USERNAME` و `ADMIN_PASSWORD`
4. استمتع بلوحة التحكم! 🎉

---

## الخطوة 8: تحديث Telegram Bot Webhook (اختياري)

إذا كنت تستخدم Webhooks بدلاً من Polling:

```bash
curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook?url=https://your-app.onrender.com/webhook"
```

**ملاحظة:** المشروع الحالي يستخدم **Polling** (سحب التحديثات)، لذا لا تحتاج هذه الخطوة.

---

## استكشاف الأخطاء (Troubleshooting)

### المشكلة 1: Build Failed
**الأعراض:** فشل البناء أثناء `npm install` أو `npm run build`

**الحلول:**
- تأكد من أن جميع التبعيات موجودة في `package.json`
- تحقق من Logs للعثور على الخطأ المحدد
- تأكد من أن Node.js version متوافق

### المشكلة 2: Application Error عند التشغيل
**الأعراض:** التطبيق يبدأ لكن يتوقف فوراً

**الحلول:**
- تحقق من **Environment Variables** - هل أضفت جميع المتغيرات المطلوبة؟
- راجع Logs بحثاً عن رسائل خطأ
- تأكد من أن Google Sheets API معدّ بشكل صحيح

### المشكلة 3: البوت لا يستجيب
**الأعراض:** لوحة التحكم تعمل لكن البوت لا يرد

**الحلول:**
- تحقق من `TELEGRAM_BOT_TOKEN` - هل هو صحيح؟
- افتح Logs وابحث عن "Telegram Bot: Active and listening"
- تأكد من أن البوت غير معطّل من BotFather

### المشكلة 4: الخادم المجاني ينام
**الأعراض:** التطبيق يصبح بطيئاً أو لا يستجيب بعد فترة

**الحلول:**
- هذا طبيعي في الخطة المجانية (Free)
- الحل: الترقية إلى خطة **Starter** ($7/شهر) للعمل 24/7
- أو استخدام خدمة Uptime Monitor مثل [UptimeRobot](https://uptimerobot.com) لإرسال ping كل 5 دقائق

### المشكلة 5: Sheets API Error
**الأعراض:** أخطاء تتعلق بـ Google Sheets

**الحلول:**
- تأكد من مشاركة الـ Sheet مع Service Account Email
- تحقق من تفعيل Google Sheets API في Google Cloud
- راجع صلاحيات الـ Service Account

---

## نصائح مهمة

### الأمان
1. ✅ **لا تشارك Environment Variables** مع أي شخص
2. ✅ اجعل GitHub Repository **خاصاً (Private)**
3. ✅ استخدم **كلمة مرور قوية** لـ ADMIN_PASSWORD
4. ✅ غيّر Telegram Bot Token إذا تم تسريبه

### الأداء
1. استخدم خطة **Starter** أو أعلى للعمل المستمر
2. اختر Region قريب من مستخدميك
3. راقب استخدام الذاكرة من لوحة تحكم Render

### الصيانة
1. تحديثات الكود تُنشر تلقائياً عند `git push` للـ main branch
2. يمكنك تعطيل Auto-Deploy من إعدادات Render
3. احفظ نسخة احتياطية من Google Sheet بانتظام

### المراقبة
1. افتح صفحة Logs في Render لمراقبة الأخطاء
2. فعّل Notifications في Render لتلقي تنبيهات
3. راجع Dashboard بانتظام للتأكد من عمل النظام

---

## ملخص سريع للإعدادات المطلوبة في Render

```yaml
Name: VoterBotDashboard
Environment: Production
Language: Node
Branch: main
Build Command: npm install && npm run build
Start Command: npm run start

Environment Variables:
  - TELEGRAM_BOT_TOKEN=your_token
  - GOOGLE_SHEET_ID=your_sheet_id
  - GOOGLE_DRIVE_FOLDER_ID=your_folder_id
  - ADMIN_USERNAME=admin
  - ADMIN_PASSWORD=your_password
  - HUGGINGFACE_TOKEN=your_hf_token (optional)
  - GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
  - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...

Instance Type: Starter ($7/month) أو Free للتجربة
```

---

## الدعم

إذا واجهت أي مشاكل:
1. راجع **Logs** في Render بعناية
2. تأكد من صحة جميع **Environment Variables**
3. راجع [Render Documentation](https://render.com/docs)
4. تحقق من [Telegram Bot API Docs](https://core.telegram.org/bots/api)

---

## الخطوات التالية بعد النشر

1. ✅ اختبر تسجيل الدخول للوحة التحكم
2. ✅ اختبر البوت على Telegram
3. ✅ أضف المناديب في Google Sheets
4. ✅ اختبر إضافة ناخب عبر البوت
5. ✅ تحقق من ظهور البيانات في Dashboard
6. ✅ اختبر رفع الصور على Google Drive

---

**تهانينا! 🎉**
مشروعك الآن يعمل على Render ويمكن الوصول إليه من أي مكان في العالم!
