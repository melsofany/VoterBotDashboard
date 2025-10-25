# حل مشكلة رفع الصور مع Service Account

## المشكلة
عند استخدام Service Account، يظهر الخطأ التالي:
```
Service Accounts do not have storage quota
```

## السبب
حسابات الخدمة (Service Accounts) في Google لا تملك مساحة تخزين خاصة بها في Google Drive.

---

## الحلول المتاحة

### ✅ الحل الأول: استخدام Shared Drive (موصى به للمؤسسات)

**ملاحظة:** يتطلب حساب Google Workspace (مدفوع)

#### الخطوات:
1. افتح Google Drive من حسابك
2. من القائمة الجانبية، اختر **"Shared drives"**
3. اضغط **"New"** لإنشاء Shared Drive جديد
4. أعطه اسماً (مثل: "Voter ID Cards")
5. انسخ رابط الـ Shared Drive
6. استخرج الـ ID من الرابط وضعه في `GOOGLE_DRIVE_FOLDER_ID`
7. في الـ Shared Drive، اضغط على الإعدادات (⚙️)
8. اختر **"Manage members"**
9. أضف Service Account Email كعضو بصلاحية **"Content manager"**

**مزايا هذا الحل:**
- ✅ لا توجد حدود للمساحة (حسب باقة Workspace)
- ✅ يدعم التعاون والمشاركة
- ✅ إدارة أفضل للصلاحيات

---

### ✅ الحل الثاني: إنشاء المجلد من Service Account نفسه (مجاني ✨)

هذا الحل يعمل مع الحسابات المجانية!

#### الخطوات:

1. **أنشئ سكريبت مؤقت لإنشاء المجلد:**

قم بإنشاء ملف اسمه `create-folder.js` في مجلد المشروع:

```javascript
const { google } = require('googleapis');

async function createFolder() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // إنشاء المجلد
  const folderMetadata = {
    name: 'Voter ID Cards - Service Account',
    mimeType: 'application/vnd.google-apps.folder',
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: 'id, webViewLink',
  });

  console.log('✅ Folder created successfully!');
  console.log('📁 Folder ID:', folder.data.id);
  console.log('🔗 Link:', folder.data.webViewLink);
  console.log('');
  console.log('📋 Add this to your environment variables:');
  console.log(`GOOGLE_DRIVE_FOLDER_ID=${folder.data.id}`);
  
  // منح صلاحيات للحساب الشخصي (اختياري)
  const yourEmail = 'YOUR_EMAIL@gmail.com'; // غيّر هذا لبريدك الإلكتروني
  
  if (yourEmail !== 'YOUR_EMAIL@gmail.com') {
    await drive.permissions.create({
      fileId: folder.data.id,
      requestBody: {
        role: 'writer',
        type: 'user',
        emailAddress: yourEmail,
      },
    });
    console.log(`✅ Permissions granted to: ${yourEmail}`);
  }
}

createFolder().catch(console.error);
```

2. **شغّل السكريبت:**

في Replit Shell أو Terminal، شغّل:

```bash
node create-folder.js
```

3. **انسخ الـ Folder ID الذي ظهر وضعه في `GOOGLE_DRIVE_FOLDER_ID`**

4. **احذف ملف `create-folder.js` بعد الانتهاء**

**مزايا هذا الحل:**
- ✅ مجاني تماماً
- ✅ لا يحتاج Google Workspace
- ✅ يعمل مع الحسابات العادية
- ✅ المجلد مملوك بالكامل لـ Service Account

---

### ✅ الحل الثالث: تعطيل رفع الصور مؤقتاً (للاختبار فقط)

إذا كنت تريد تشغيل المشروع بسرعة بدون رفع الصور:

1. افتح ملف `server/routes.ts`
2. ابحث عن الكود الذي يرفع الصور
3. عطّل رفع الصور مؤقتاً (سنعطيك الكود إذا طلبت)

**ملاحظة:** هذا الحل للاختبار فقط ولا يُنصح به في الإنتاج!

---

## التحقق من نجاح الحل

بعد تطبيق أي حل:

1. أعد تشغيل المشروع
2. جرّب رفع صورة بطاقة من البوت
3. إذا نجح الرفع، ستظهر رسالة: `✅ Image uploaded to Google Drive`
4. تحقق من المجلد في Google Drive - يجب أن تجد الصورة

---

## الأسئلة الشائعة

**س: هل Service Account مجاني؟**
ج: نعم، تماماً! Google Cloud مجاني للاستخدام الأساسي.

**س: ما حجم التخزين المتاح؟**
ج: عند استخدام الحل الثاني، الملفات تُخزّن في مساحة Service Account وليس لها حد معين (ضمن حدود معقولة).

**س: هل الصور آمنة؟**
ج: نعم! الصور خاصة بـ Service Account ولا يمكن الوصول لها إلا عبر التطبيق.

**س: أيهما أفضل؟**
ج: للحسابات المجانية → **الحل الثاني**
   للمؤسسات مع Google Workspace → **الحل الأول**

---

## تحديثات الكود

الكود تم تحديثه تلقائياً لدعم:
- ✅ Shared Drives (`supportsAllDrives: true`)
- ✅ إدارة الصلاحيات التلقائية
- ✅ رسائل خطأ واضحة

لا حاجة لتعديل أي كود - فقط اختر الحل المناسب لك!
