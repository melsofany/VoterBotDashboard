# دليل إعداد المشروع على Replit

## المتغيرات البيئية المطلوبة

لتشغيل المشروع على Replit، تحتاج إلى إضافة هذه المتغيرات في **Secrets**:

### 1️⃣ افتح Secrets في Replit
1. في المشروع، اضغط على **Tools** في الشريط الجانبي
2. اختر **Secrets**
3. أضف المتغيرات التالية واحدة تلو الأخرى

---

### 2️⃣ المتغيرات الأساسية (مطلوبة):

#### TELEGRAM_BOT_TOKEN
```
Key: TELEGRAM_BOT_TOKEN
Value: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```
**كيفية الحصول عليه:**
1. افتح [@BotFather](https://t.me/botfather) في تيليجرام
2. أرسل `/newbot`
3. اتبع التعليمات لإنشاء بوت جديد
4. سيعطيك BotFather الـ token

---

#### GOOGLE_SHEET_ID
```
Key: GOOGLE_SHEET_ID
Value: 1abc2def3ghi4jkl5mno6pqr7stu8vwx9yz
```
**كيفية الحصول عليه:**
1. افتح [Google Sheets](https://sheets.google.com)
2. أنشئ ملف جديد (Blank Spreadsheet)
3. انسخ الـ ID من الرابط:
   ```
   https://docs.google.com/spreadsheets/d/[هذا_هو_الـID]/edit
   ```

---

#### GOOGLE_DRIVE_FOLDER_ID
```
Key: GOOGLE_DRIVE_FOLDER_ID
Value: 1abc2def3ghi4jkl5mno6pqr
```
**كيفية الحصول عليه:**
1. افتح [Google Drive](https://drive.google.com)
2. أنشئ مجلد جديد (اسمه مثلاً: "Voter ID Cards")
3. افتح المجلد وانسخ الـ ID من الرابط:
   ```
   https://drive.google.com/drive/folders/[هذا_هو_الـID]
   ```

---

#### ADMIN_USERNAME
```
Key: ADMIN_USERNAME
Value: admin
```
(أو اختر اسم المستخدم الذي تريده للوحة التحكم)

---

#### ADMIN_PASSWORD
```
Key: ADMIN_PASSWORD
Value: كلمة_مرور_قوية_هنا
```
**مهم:** استخدم كلمة مرور قوية!

---

### 3️⃣ إعداد Google Sheets Integration (الطريقة الأسهل على Replit)

#### الخيار 1: استخدام Replit Integration ⭐ (موصى به)
1. في Replit، اضغط على **Tools** → **Integrations**
2. ابحث عن **Google Sheets**
3. اضغط **Connect**
4. اتبع التعليمات لربط حساب Google
5. ✅ تم! Replit سيضيف الـ credentials تلقائياً

#### الخيار 2: استخدام Service Account يدوياً
إذا لم تنجح الطريقة الأولى:
1. اتبع الدليل في `GOOGLE_SERVICE_ACCOUNT_GUIDE.md`
2. أضف الـ credentials في Secrets

---

### 4️⃣ متغيرات اختيارية (لكن موصى بها):

#### HUGGINGFACE_TOKEN (لتحسين OCR)
```
Key: HUGGINGFACE_TOKEN
Value: hf_xxxxxxxxxxxxxxxxxxxxx
```
**كيفية الحصول عليه:**
1. سجل حساب مجاني في [Hugging Face](https://huggingface.co/join)
2. اذهب إلى [Settings > Access Tokens](https://huggingface.co/settings/tokens)
3. أنشئ token جديد (Read permissions كافية)

---

## ✅ بعد إضافة جميع المتغيرات:

1. **أعد تشغيل المشروع** (اضغط Stop ثم Run)
2. انتظر حتى ترى:
   ```
   ✅ Server running on port 5000
   🤖 Telegram Bot started in POLLING mode
   📊 Dashboard: http://localhost:5000
   ```
3. افتح الـ Webview لرؤية لوحة التحكم
4. جرّب البوت في تيليجرام بإرسال `/start`

---

## 🔧 استكشاف الأخطاء:

### الخطأ: "GOOGLE_SHEET_ID environment variable is not set"
**الحل:** تأكد من إضافة المتغير في Secrets (بحروف كبيرة تماماً)

### الخطأ: "Google Sheets API has not been used"
**الحل:** 
1. استخدم Replit Integration للـ Google Sheets
2. أو فعّل Google Sheets API في Google Cloud Console

### البوت لا يستجيب
**الحل:**
1. تأكد من `TELEGRAM_BOT_TOKEN` صحيح
2. افتح Logs وابحث عن أخطاء
3. تحقق من إضافة User IDs في Google Sheet (ورقة Representatives)

---

## 📝 ملاحظات مهمة:

1. **على Replit**: لا تحتاج `WEBHOOK_URL` - البوت يستخدم POLLING تلقائياً ✅
2. **على Render**: أضف `WEBHOOK_URL` لاستخدام WEBHOOK للكفاءة ✅
3. **الأمان**: لا تشارك الـ Secrets مع أي شخص
4. **Google Sheets**: تأكد من مشاركة الـ Sheet مع Service Account Email

---

## 🎯 الخطوات التالية:

بعد تشغيل المشروع:
1. افتح Google Sheet وأضف User IDs للمناديب في ورقة "Representatives"
2. جرّب البوت بإرسال `/start`
3. افتح لوحة التحكم وسجّل دخول بـ ADMIN_USERNAME/PASSWORD
4. أضف ناخبين عبر البوت وشاهدهم في Dashboard

---

**بالتوفيق! 🚀**
