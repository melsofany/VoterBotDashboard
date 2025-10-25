# دليل إنشاء Google Service Account

## لماذا نحتاج Service Account؟
عند النشر على Render (أو أي منصة خارج Replit)، لا يمكننا استخدام تكاملات Replit. لذلك نحتاج إلى Service Account من Google للوصول إلى Google Sheets و Google Drive.

---

## الخطوة 1: إنشاء مشروع في Google Cloud

1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. سجل دخول بحساب Google الخاص بك
3. اضغط على القائمة المنسدلة في الأعلى (بجانب "Google Cloud")
4. اضغط **"New Project"** (مشروع جديد)
5. اختر اسماً للمشروع (مثل: `voter-bot-project`)
6. اضغط **"Create"**
7. انتظر حتى يتم إنشاء المشروع (ستظهر إشعار في الأعلى)
8. تأكد من تحديد المشروع الجديد من القائمة المنسدلة

---

## الخطوة 2: تفعيل Google Sheets API و Google Drive API

### تفعيل Google Sheets API:
1. في Google Cloud Console، اذهب إلى القائمة الجانبية
2. اختر **"APIs & Services"** → **"Library"**
3. ابحث عن `Google Sheets API`
4. اضغط على النتيجة الأولى
5. اضغط **"Enable"** (تفعيل)
6. انتظر حتى يتم التفعيل

### تفعيل Google Drive API:
1. ارجع إلى **"Library"**
2. ابحث عن `Google Drive API`
3. اضغط على النتيجة الأولى
4. اضغط **"Enable"** (تفعيل)

---

## الخطوة 3: إنشاء Service Account

1. في القائمة الجانبية، اذهب إلى:
   **"APIs & Services"** → **"Credentials"** (بيانات الاعتماد)

2. اضغط على **"Create Credentials"** في الأعلى

3. اختر **"Service Account"**

4. املأ التفاصيل:
   - **Service account name:** `voter-bot-service`
   - **Service account ID:** سيُملأ تلقائياً
   - **Description:** `Service account for Voter Bot Dashboard`

5. اضغط **"Create and Continue"**

6. في **"Grant this service account access to project"**:
   - يمكنك تخطي هذا (Optional)
   - اضغط **"Continue"**

7. في **"Grant users access to this service account"**:
   - يمكنك تخطي هذا (Optional)
   - اضغط **"Done"**

---

## الخطوة 4: إنشاء وتحميل Private Key

1. في صفحة **Credentials**، ستجد Service Account الجديد في قسم **"Service Accounts"**

2. اضغط على البريد الإلكتروني للـ Service Account (ينتهي بـ `@voter-bot-project.iam.gserviceaccount.com`)

3. اذهب إلى تبويب **"Keys"** (المفاتيح)

4. اضغط **"Add Key"** → **"Create new key"**

5. اختر نوع المفتاح: **JSON**

6. اضغط **"Create"**

7. سيتم تحميل ملف JSON تلقائياً على جهازك
   - **مهم جداً:** احفظ هذا الملف في مكان آمن!
   - **لا تشاركه مع أحد أبداً!**

---

## الخطوة 5: استخدام ملف JSON في Render

### الطريقة الأولى (الأسهل - موصى بها) ⭐

افتح ملف JSON الذي تم تحميله، وانسخ **محتوى الملف بالكامل** (كل شيء من `{` إلى `}`).

سيكون شكل الملف هكذا:

```json
{
  "type": "service_account",
  "project_id": "voter-bot-project",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "voter-bot-service@voter-bot-project.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

في Render، أضف متغير بيئة واحد فقط:

```
Key: GOOGLE_SERVICE_ACCOUNT_JSON
Value: [الصق كل محتوى ملف JSON هنا]
```

**مهم:** الصق الملف كاملاً من `{` إلى `}` بما في ذلك جميع الأسطر!

---

### الطريقة الثانية (البديلة)

إذا كنت تفضل تقسيم البيانات:

#### 1. GOOGLE_SERVICE_ACCOUNT_EMAIL
```
من حقل: "client_email" في ملف JSON
مثال: voter-bot-service@voter-bot-project.iam.gserviceaccount.com
```

#### 2. GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
```
من حقل: "private_key" في ملف JSON
مثال: -----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n
```

أضف في Render:

```
Key: GOOGLE_SERVICE_ACCOUNT_EMAIL
Value: [البريد الإلكتروني]

Key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
Value: [المفتاح الخاص كاملاً]
```

---

## الخطوة 6: مشاركة Google Sheet مع Service Account

1. افتح Google Sheet الخاص بك

2. اضغط على زر **"Share"** (مشاركة) في الأعلى

3. في حقل **"Add people and groups"**:
   - ألصق البريد الإلكتروني للـ Service Account
   - من حقل `"client_email"` في ملف JSON
   - مثال: `voter-bot-service@voter-bot-project.iam.gserviceaccount.com`

4. تأكد من اختيار **"Editor"** (محرر) من القائمة المنسدلة

5. **ألغِ تحديد** "Notify people" (عدم إرسال إشعار)

6. اضغط **"Share"** (مشاركة)

---

## الخطوة 7: مشاركة Google Drive Folder مع Service Account

1. افتح Google Drive Folder الذي تريد رفع صور البطاقات إليه

2. اضغط بالزر الأيمن على المجلد → **"Share"**

3. في حقل **"Add people and groups"**:
   - ألصق نفس البريد الإلكتروني للـ Service Account

4. تأكد من اختيار **"Editor"** (محرر)

5. **ألغِ تحديد** "Notify people"

6. اضغط **"Share"**

---

## ملخص المتغيرات المطلوبة في Render

### الطريقة السهلة (موصى بها):

```
TELEGRAM_BOT_TOKEN=...
GOOGLE_SHEET_ID=...
GOOGLE_DRIVE_FOLDER_ID=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
HUGGINGFACE_TOKEN=... (اختياري)
```

### الطريقة البديلة:

```
TELEGRAM_BOT_TOKEN=...
GOOGLE_SHEET_ID=...
GOOGLE_DRIVE_FOLDER_ID=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
HUGGINGFACE_TOKEN=... (اختياري)
```

---

## استكشاف الأخطاء

### خطأ: "Missing Google Service Account credentials"
- تأكد من إضافة `GOOGLE_SERVICE_ACCOUNT_JSON` أو (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`)

### خطأ: "Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON"
- تأكد من أن القيمة هي JSON صحيح (يجب أن تبدأ بـ `{` وتنتهي بـ `}`)
- تأكد من نسخ الملف كاملاً بدون تعديل

### خطأ: "Permission denied" عند الوصول للـ Sheet
- تأكد من مشاركة الـ Sheet مع Service Account Email
- تأكد من أن الصلاحية **Editor** وليست **Viewer**

### خطأ: "Invalid private key"
- تأكد من نسخ المفتاح الخاص **كاملاً** من ملف JSON
- تأكد من أنه يبدأ بـ `-----BEGIN PRIVATE KEY-----`
- تأكد من أنه ينتهي بـ `-----END PRIVATE KEY-----\n`

---

## الأمان

⚠️ **تحذير مهم:**
- **لا تشارك** ملف JSON مع أي شخص
- **لا ترفع** ملف JSON على GitHub أو أي مكان عام
- **احذف** ملف JSON من جهازك بعد إضافته في Render Secrets
- إذا تم تسريب الملف، احذف Service Account وأنشئ واحداً جديداً فوراً

---

## مثال عملي

لنفترض أن ملف JSON الخاص بك هو:

```json
{
  "type": "service_account",
  "project_id": "my-project-123",
  "private_key_id": "abc123def456",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n",
  "client_email": "my-bot@my-project-123.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### في Render، أضف:

```
Key: GOOGLE_SERVICE_ACCOUNT_JSON
Value: {"type":"service_account","project_id":"my-project-123","private_key_id":"abc123def456","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n","client_email":"my-bot@my-project-123.iam.gserviceaccount.com","client_id":"123456789","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}
```

**ملاحظة:** يمكنك لصق الملف كاملاً مع المسافات والأسطر أو بدونها - كلاهما يعمل!

---

**تهانينا! 🎉**
الآن لديك Service Account جاهز للاستخدام مع مشروعك على Render!
