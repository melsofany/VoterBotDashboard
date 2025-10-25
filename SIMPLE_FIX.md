# الحل البسيط لمشكلة رفع الصور

## الخطوات (دقيقتان فقط):

### 1️⃣ افتح ملف Service Account JSON
افتح ملف الـ JSON الذي استخدمته في `GOOGLE_SERVICE_ACCOUNT_JSON`

### 2️⃣ انسخ Service Account Email
ابحث عن السطر:
```json
"client_email": "your-service@project.iam.gserviceaccount.com"
```
انسخ البريد الإلكتروني بالكامل

### 3️⃣ شارك مجلد Google Drive
1. افتح Google Drive: https://drive.google.com
2. اذهب إلى المجلد الذي معرفه في `GOOGLE_DRIVE_FOLDER_ID`
3. اضغط كليك يمين على المجلد → **Share** (مشاركة)
4. الصق Service Account Email في حقل المشاركة
5. اختر **Editor** من القائمة المنسدلة
6. **ألغِ تحديد** "Notify people" (عدم إرسال إشعار)
7. اضغط **Share**

### 4️⃣ تم!
أعد تشغيل التطبيق على Render وجرب رفع صورة.

---

## ملاحظة مهمة:
إذا لم يعمل هذا الحل، المشكلة أن Google Drive العادي لا يدعم Service Accounts للرفع.

**الحل الوحيد في هذه الحالة:**
امسح `GOOGLE_DRIVE_FOLDER_ID` نهائياً من Environment Variables على Render، وسيُنشئ التطبيق مجلد جديد تلقائياً مملوك من Service Account ويعمل 100%.
