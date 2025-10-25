# حل مشكلة بوت التليجرام على Render

## المشكلة
البوت يستخدم **Polling** وهذا لا يعمل جيداً على Render، خاصة في الخطة المجانية.

## الحل: التحويل إلى Webhooks

### الخطوة 1: تعديل ملف server/telegram-bot.ts

استبدل السطر:
```typescript
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
```

بهذا الكود:
```typescript
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const USE_WEBHOOK = process.env.NODE_ENV === 'production';

const bot = USE_WEBHOOK
  ? new TelegramBot(BOT_TOKEN, { webHook: true })
  : new TelegramBot(BOT_TOKEN, { polling: true });

// Setup webhook in production
if (USE_WEBHOOK && WEBHOOK_URL) {
  bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`);
  console.log(`✅ Webhook set to: ${WEBHOOK_URL}/bot${BOT_TOKEN}`);
}
```

### الخطوة 2: إضافة endpoint للـ webhook في server/index.ts

أضف هذا الكود بعد `setupAuth(app);`:

```typescript
// Telegram Bot Webhook (only in production)
if (process.env.NODE_ENV === 'production') {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
  app.post(`/bot${BOT_TOKEN}`, express.json(), (req, res) => {
    // The bot will handle the update automatically
    res.sendStatus(200);
  });
}
```

### الخطوة 3: إضافة متغير بيئة جديد في Render

في إعدادات Render، أضف:
```
Key: WEBHOOK_URL
Value: https://your-app-name.onrender.com
```
(استبدل `your-app-name` باسم تطبيقك على Render)

### الخطوة 4: تعديل startTelegramBot function

في `server/telegram-bot.ts`، عدّل دالة `startTelegramBot` لتقبل `app`:

```typescript
import type { Express } from 'express';

export async function startTelegramBot(app?: Express) {
  const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
  const USE_WEBHOOK = process.env.NODE_ENV === 'production';
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

  const bot = USE_WEBHOOK
    ? new TelegramBot(BOT_TOKEN)
    : new TelegramBot(BOT_TOKEN, { polling: true });

  console.log('🤖 Telegram Bot started successfully!');

  // Setup webhook endpoint if in production
  if (USE_WEBHOOK && app && WEBHOOK_URL) {
    app.post(`/bot${BOT_TOKEN}`, express.json(), (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
    
    await bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`);
    console.log(`✅ Webhook set to: ${WEBHOOK_URL}/bot${BOT_TOKEN}`);
  }

  // ... باقي الكود كما هو
}
```

### الخطوة 5: تحديث استدعاء البوت في server/index.ts

غيّر من:
```typescript
await startTelegramBot();
```

إلى:
```typescript
await startTelegramBot(app);
```

---

## الخيار الأسهل (إذا كنت تريد استخدام Polling)

إذا كنت لا تريد تعديل الكود، يمكنك:

### الحل 1: استخدام Render Starter Plan ($7/شهر)
- السيرفر لن ينام
- Polling سيعمل بشكل مستمر
- **لكن هذا ليس الحل الأمثل!**

### الحل 2: استخدام UptimeRobot (مجاني)
1. سجل في [UptimeRobot.com](https://uptimerobot.com)
2. أضف monitor جديد من نوع HTTP(S)
3. ضع رابط Render الخاص بك
4. اضبط الفحص كل 5 دقائق
5. هذا سيمنع السيرفر من النوم

**لكن الحل الأفضل هو استخدام Webhooks كما شرحنا أعلاه!**

---

## ملخص المتغيرات البيئية المطلوبة في Render

```
TELEGRAM_BOT_TOKEN=your_token
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
HUGGINGFACE_TOKEN=your_hf_token (optional)
WEBHOOK_URL=https://your-app-name.onrender.com  ← جديد!
```

---

## التحقق من عمل الـ Webhook

بعد النشر، افتح Logs في Render وابحث عن:
```
✅ Webhook set to: https://your-app.onrender.com/botXXXXXX
```

إذا ظهرت هذه الرسالة، البوت يعمل بشكل صحيح!

---

## استكشاف الأخطاء

### الخطأ: "Conflict: terminated by other getUpdates request"
**الحل:** تأكد من أنك لا تشغل البوت في مكانين (Replit + Render). أوقف واحد منهما.

### الخطأ: "Webhook not set"
**الحل:** تأكد من إضافة `WEBHOOK_URL` في متغيرات البيئة في Render.

### البوت لا يستجيب
**الحل:** 
1. افتح Logs في Render
2. ابحث عن أخطاء في الـ webhook endpoint
3. تأكد من أن الرابط صحيح
