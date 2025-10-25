import TelegramBot from 'node-telegram-bot-api';
import type { Express } from 'express';
import express from 'express';
import { nanoid } from 'nanoid';
import { extractDataFromIDCard } from './ocr-service';
import { uploadImageToDrive } from './drive-service';
import { addVoter, getAuthorizedRepresentatives } from './sheets-service';
import sharp from 'sharp';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

interface UserSession {
  step: 'idle' | 'awaiting_photo' | 'awaiting_data_confirmation' | 'awaiting_manual_national_id' | 'awaiting_manual_name' | 'awaiting_location' | 'awaiting_manual_address' | 'awaiting_family' | 'awaiting_phone' | 'awaiting_stance';
  nationalId?: string;
  fullName?: string;
  photoBuffer?: Buffer;
  latitude?: number;
  longitude?: number;
  address?: string;
  familyName?: string;
  phoneNumber?: string;
  representativeId: string;
  representativeName?: string;
}

const sessions = new Map<number, UserSession>();

export async function startTelegramBot(app?: Express) {
  const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
  // Use webhook only if WEBHOOK_URL is explicitly set
  const USE_WEBHOOK = !!WEBHOOK_URL;

  const bot = USE_WEBHOOK
    ? new TelegramBot(BOT_TOKEN)
    : new TelegramBot(BOT_TOKEN, { polling: true });

  console.log(`🤖 Telegram Bot started in ${USE_WEBHOOK ? 'WEBHOOK' : 'POLLING'} mode`);

  // Setup webhook endpoint if WEBHOOK_URL is set
  if (USE_WEBHOOK && app) {
    const webhookPath = `/bot${BOT_TOKEN}`;
    
    app.post(webhookPath, express.json(), (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });

    try {
      await bot.setWebHook(`${WEBHOOK_URL}${webhookPath}`);
      console.log(`✅ Webhook set to: ${WEBHOOK_URL}${webhookPath}`);
    } catch (error) {
      console.error('❌ Failed to set webhook:', error);
      throw error;
    }
  }

  // Command: /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString() || '';

    // Check if user is authorized
    const authorizedReps = await getAuthorizedRepresentatives();
    
    if (!authorizedReps.includes(userId)) {
      await bot.sendMessage(
        chatId,
        '❌ عذراً، أنت غير مصرح لك باستخدام هذا البوت.\n\nيرجى التواصل مع المشرف لإضافة معرّفك إلى قائمة المناديب المصرح لهم.\n\nمعرّفك: ' + userId
      );
      return;
    }

    // Initialize session
    sessions.set(chatId, {
      step: 'awaiting_photo',
      representativeId: userId,
      representativeName: msg.from?.first_name || undefined
    });

    const webAppUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/telegram-mini-app`
      : 'http://localhost:5000/telegram-mini-app';

    await bot.sendMessage(
      chatId,
      '🎉 مرحباً بك في نظام جمع بيانات الناخبين\n' +
      'حملة المرشح علاء سليمان الحديوي\n\n' +
      '📸 اختر طريقة إرسال الصورة:',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 فتح الكاميرا الذكية', web_app: { url: webAppUrl } }],
            [{ text: '🖼️ إرسال صورة عادية', callback_data: 'send_regular_photo' }]
          ]
        }
      }
    );
  });

  // Handle callback for sending regular photo
  bot.on('callback_query', async (query) => {
    if (query.data === 'send_regular_photo') {
      const chatId = query.message?.chat.id;
      if (chatId) {
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(
          chatId,
          '📸 من فضلك قم بإرسال صورة واضحة لبطاقة الرقم القومي للناخب',
          {
            reply_markup: {
              keyboard: [[{ text: '❌ إلغاء' }]],
              resize_keyboard: true
            }
          }
        );
      }
    }
  });

  // Handle photo
  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const session = sessions.get(chatId);

    if (!session || session.step !== 'awaiting_photo') {
      await bot.sendMessage(chatId, 'الرجاء البدء بالأمر /start أولاً');
      return;
    }

    try {
      await bot.sendMessage(chatId, '⏳ جاري معالجة الصورة واستخراج البيانات...');

      // Get highest quality photo
      const photo = msg.photo![msg.photo!.length - 1];
      const file = await bot.getFile(photo.file_id);
      const filePath = file.file_path!;
      
      // Download photo
      const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
      const response = await fetch(photoUrl);
      const arrayBuffer = await response.arrayBuffer();
      let photoBuffer = Buffer.from(arrayBuffer);

      // Optimize image
      photoBuffer = await sharp(photoBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Extract data using OCR
      const ocrResult = await extractDataFromIDCard(photoBuffer);

      if (!ocrResult.nationalId) {
        await bot.sendMessage(
          chatId,
          '⚠️ لم نتمكن من قراءة الرقم القومي تلقائياً.\n\nيرجى التأكد من:\n' +
          '• وضوح الصورة\n' +
          '• إضاءة جيدة\n' +
          '• عدم وجود انعكاسات\n\n' +
          'أعد إرسال صورة أوضح أو أرسل /start للبدء من جديد'
        );
        return;
      }

      // Save to session
      session.nationalId = ocrResult.nationalId;
      session.fullName = ocrResult.fullName || 'غير محدد';
      session.photoBuffer = photoBuffer;
      session.step = 'awaiting_data_confirmation';

      // Build message with decoded information
      let message = '✅ تم استخراج البيانات!\n\n';
      message += `📋 الرقم القومي: ${ocrResult.nationalId}\n`;
      message += `👤 الاسم: ${ocrResult.fullName || 'غير محدد'}\n`;
      
      // Add decoded information if available
      if (ocrResult.decodedInfo && ocrResult.decodedInfo.isValid) {
        message += '\n🔍 معلومات إضافية من الرقم القومي:\n';
        if (ocrResult.decodedInfo.birthDate) {
          message += `📅 تاريخ الميلاد: ${ocrResult.decodedInfo.birthDate}\n`;
        }
        if (ocrResult.decodedInfo.governorate) {
          message += `📍 المحافظة: ${ocrResult.decodedInfo.governorate}\n`;
        }
        if (ocrResult.decodedInfo.gender) {
          const genderText = ocrResult.decodedInfo.gender === 'male' ? 'ذكر' : 'أنثى';
          message += `👤 النوع: ${genderText}\n`;
        }
      }
      
      message += '\n⚠️ يرجى التحقق من صحة البيانات:';

      await bot.sendMessage(
        chatId,
        message,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ البيانات صحيحة', callback_data: 'confirm_data' }],
              [{ text: '✏️ تعديل الرقم القومي', callback_data: 'edit_national_id' }],
              [{ text: '✏️ تعديل الاسم', callback_data: 'edit_name' }]
            ]
          }
        }
      );
    } catch (error) {
      console.error('Error processing photo:', error);
      await bot.sendMessage(
        chatId,
        '❌ حدث خطأ أثناء معالجة الصورة. يرجى المحاولة مرة أخرى.'
      );
    }
  });

  // Handle location
  bot.on('location', async (msg) => {
    const chatId = msg.chat.id;
    const session = sessions.get(chatId);

    if (!session || session.step !== 'awaiting_location') {
      return;
    }

    session.latitude = msg.location!.latitude;
    session.longitude = msg.location!.longitude;
    session.step = 'awaiting_family';

    await bot.sendMessage(
      chatId,
      '✅ تم حفظ الموقع\n\n' +
      '👨‍👩‍👧‍👦 الخطوة التالية:\n' +
      'أدخل اسم العائلة',
      {
        reply_markup: {
          keyboard: [[{ text: '❌ إلغاء' }]],
          resize_keyboard: true
        }
      }
    );
  });

  // Handle text messages
  bot.on('message', async (msg) => {
    if (msg.photo || msg.location || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const session = sessions.get(chatId);

    // Handle cancel
    if (text === '❌ إلغاء') {
      sessions.delete(chatId);
      await bot.sendMessage(
        chatId,
        '❌ تم إلغاء العملية. أرسل /start للبدء من جديد',
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }

    // Handle skip location
    if (text === '⏭️ تخطي الموقع' && session?.step === 'awaiting_location') {
      session.step = 'awaiting_family';
      await bot.sendMessage(
        chatId,
        '👨‍👩‍👧‍👦 الخطوة التالية:\n' +
        'أدخل اسم العائلة',
        {
          reply_markup: {
            keyboard: [[{ text: '❌ إلغاء' }]],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    // Handle manual address entry option
    if (text === '🏠 إدخال العنوان يدوياً' && session?.step === 'awaiting_location') {
      session.step = 'awaiting_manual_address';
      await bot.sendMessage(
        chatId,
        '🏠 من فضلك أدخل العنوان:\n' +
        '(مثال: 15 شارع الجمهورية، المنصورة، الدقهلية)',
        {
          reply_markup: {
            keyboard: [[{ text: '❌ إلغاء' }]],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    if (!session) return;

    // Handle manual address
    if (session.step === 'awaiting_manual_address') {
      if (text.length < 5) {
        await bot.sendMessage(chatId, '⚠️ يرجى إدخال عنوان صحيح (على الأقل 5 أحرف)');
        return;
      }

      session.address = text;
      session.step = 'awaiting_family';

      await bot.sendMessage(
        chatId,
        '✅ تم حفظ العنوان\n\n' +
        '👨‍👩‍👧‍👦 الخطوة التالية:\n' +
        'أدخل اسم العائلة',
        {
          reply_markup: {
            keyboard: [[{ text: '❌ إلغاء' }]],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    // Handle manual national ID
    if (session.step === 'awaiting_manual_national_id') {
      const nationalIdRegex = /^\d{14}$/;
      if (!nationalIdRegex.test(text)) {
        await bot.sendMessage(
          chatId,
          '⚠️ الرقم القومي غير صحيح\n\nيجب أن يكون 14 رقم بالضبط'
        );
        return;
      }

      session.nationalId = text;
      session.step = 'awaiting_data_confirmation';

      await bot.sendMessage(
        chatId,
        '✅ تم تحديث الرقم القومي!\n\n' +
        `📋 الرقم القومي: ${session.nationalId}\n` +
        `👤 الاسم: ${session.fullName}\n\n` +
        'هل البيانات صحيحة الآن؟',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ البيانات صحيحة', callback_data: 'confirm_data' }],
              [{ text: '✏️ تعديل الرقم القومي', callback_data: 'edit_national_id' }],
              [{ text: '✏️ تعديل الاسم', callback_data: 'edit_name' }]
            ]
          }
        }
      );
      return;
    }

    // Handle manual name
    if (session.step === 'awaiting_manual_name') {
      if (text.length < 3) {
        await bot.sendMessage(chatId, '⚠️ يرجى إدخال اسم صحيح (على الأقل 3 أحرف)');
        return;
      }

      session.fullName = text;
      session.step = 'awaiting_data_confirmation';

      await bot.sendMessage(
        chatId,
        '✅ تم تحديث الاسم!\n\n' +
        `📋 الرقم القومي: ${session.nationalId}\n` +
        `👤 الاسم: ${session.fullName}\n\n` +
        'هل البيانات صحيحة الآن؟',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '✅ البيانات صحيحة', callback_data: 'confirm_data' }],
              [{ text: '✏️ تعديل الرقم القومي', callback_data: 'edit_national_id' }],
              [{ text: '✏️ تعديل الاسم', callback_data: 'edit_name' }]
            ]
          }
        }
      );
      return;
    }

    // Handle family name
    if (session.step === 'awaiting_family') {
      if (text.length < 2) {
        await bot.sendMessage(chatId, '⚠️ يرجى إدخال اسم عائلة صحيح (على الأقل حرفين)');
        return;
      }

      session.familyName = text;
      session.step = 'awaiting_phone';

      await bot.sendMessage(
        chatId,
        '✅ تم حفظ اسم العائلة\n\n' +
        '📱 الخطوة التالية:\n' +
        'أدخل رقم الهاتف (11 رقم يبدأ بـ 01)',
        {
          reply_markup: {
            keyboard: [[{ text: '❌ إلغاء' }]],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    // Handle phone number
    if (session.step === 'awaiting_phone') {
      const phoneRegex = /^01\d{9}$/;
      if (!phoneRegex.test(text)) {
        await bot.sendMessage(
          chatId,
          '⚠️ رقم الهاتف غير صحيح\n\n' +
          'يجب أن يكون:\n' +
          '• 11 رقم\n' +
          '• يبدأ بـ 01\n\n' +
          'مثال: 01234567890'
        );
        return;
      }

      session.phoneNumber = text;
      session.step = 'awaiting_stance';

      await bot.sendMessage(
        chatId,
        '✅ تم حفظ رقم الهاتف\n\n' +
        '🗳️ الخطوة الأخيرة:\n' +
        'ما هو الموقف السياسي للناخب؟',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ مؤيد', callback_data: 'stance_supporter' },
                { text: '❌ معارض', callback_data: 'stance_opponent' },
                { text: '⚪ محايد', callback_data: 'stance_neutral' }
              ]
            ]
          }
        }
      );
      return;
    }
  });

  // Handle callback queries
  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const session = sessions.get(chatId);

    if (!session || !query.data) {
      return;
    }

    // Handle data confirmation
    if (query.data === 'confirm_data' && session.step === 'awaiting_data_confirmation') {
      await bot.answerCallbackQuery(query.id, { text: 'البيانات صحيحة ✅' });
      session.step = 'awaiting_location';
      
      await bot.sendMessage(
        chatId,
        '📍 الخطوة التالية:\nشارك موقع الناخب الحالي أو أدخل العنوان يدوياً',
        {
          reply_markup: {
            keyboard: [
              [{ text: '📍 مشاركة الموقع', request_location: true }],
              [{ text: '🏠 إدخال العنوان يدوياً' }],
              [{ text: '⏭️ تخطي الموقع' }],
              [{ text: '❌ إلغاء' }]
            ],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    // Handle edit national ID
    if (query.data === 'edit_national_id' && session.step === 'awaiting_data_confirmation') {
      await bot.answerCallbackQuery(query.id, { text: 'أدخل الرقم القومي' });
      session.step = 'awaiting_manual_national_id';
      
      await bot.sendMessage(
        chatId,
        '✏️ أدخل الرقم القومي الصحيح (14 رقم):',
        {
          reply_markup: {
            keyboard: [[{ text: '❌ إلغاء' }]],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    // Handle edit name
    if (query.data === 'edit_name' && session.step === 'awaiting_data_confirmation') {
      await bot.answerCallbackQuery(query.id, { text: 'أدخل الاسم' });
      session.step = 'awaiting_manual_name';
      
      await bot.sendMessage(
        chatId,
        '✏️ أدخل الاسم الكامل للناخب:',
        {
          reply_markup: {
            keyboard: [[{ text: '❌ إلغاء' }]],
            resize_keyboard: true
          }
        }
      );
      return;
    }

    // Handle stance selection
    if (!query.data.startsWith('stance_') || session.step !== 'awaiting_stance') {
      return;
    }

    try {
      await bot.answerCallbackQuery(query.id, { text: 'جاري الحفظ...' });
      await bot.sendMessage(chatId, '⏳ جاري حفظ البيانات...', {
        reply_markup: { remove_keyboard: true }
      });

      const stance = query.data.replace('stance_', '');

      // Upload image to Drive
      const imageUrl = await uploadImageToDrive(session.photoBuffer!, session.nationalId!);

      // Save to Google Sheets
      await addVoter({
        id: nanoid(),
        nationalId: session.nationalId!,
        fullName: session.fullName!,
        familyName: session.familyName!,
        phoneNumber: session.phoneNumber!,
        latitude: session.latitude || null,
        longitude: session.longitude || null,
        address: session.address || null,
        stance: stance,
        idCardImageUrl: imageUrl,
        representativeId: session.representativeId,
        representativeName: session.representativeName || null,
        createdAt: new Date()
      });

      // Success message
      const stanceEmoji = {
        supporter: '✅',
        opponent: '❌',
        neutral: '⚪'
      }[stance] || '⚪';

      const stanceText = {
        supporter: 'مؤيد',
        opponent: 'معارض',
        neutral: 'محايد'
      }[stance] || 'محايد';

      await bot.sendMessage(
        chatId,
        '🎉 تم حفظ بيانات الناخب بنجاح!\n\n' +
        '📋 ملخص البيانات:\n' +
        `👤 الاسم: ${session.fullName}\n` +
        `🆔 الرقم القومي: ${session.nationalId}\n` +
        `👨‍👩‍👧‍👦 العائلة: ${session.familyName}\n` +
        `📱 الهاتف: ${session.phoneNumber}\n` +
        `🗳️ الموقف: ${stanceEmoji} ${stanceText}\n\n` +
        '✅ تم رفع البطاقة وحفظ جميع البيانات\n\n' +
        'أرسل /start لإضافة ناخب جديد'
      );

      // Clear session
      sessions.delete(chatId);
    } catch (error: any) {
      console.error('Error saving voter:', error);
      
      let errorMessage = '❌ حدث خطأ أثناء حفظ البيانات.\n\n';
      
      if (error.message && error.message.includes('موجود بالفعل في النظام')) {
        errorMessage = `❌ ${error.message}\n\n` +
          'يرجى التحقق من البيانات المدخلة.\n\n' +
          'أرسل /start للبدء من جديد';
      } else if (error.message && error.message.includes('Google')) {
        errorMessage = '❌ حدث خطأ في الاتصال مع خدمة التخزين.\n\n' +
          'يرجى المحاولة مرة أخرى بعد قليل.\n\n' +
          'أرسل /start للبدء من جديد';
      } else {
        errorMessage = '❌ حدث خطأ أثناء حفظ البيانات.\n\n' +
          `التفاصيل: ${error.message || 'خطأ غير معروف'}\n\n` +
          'أرسل /start للبدء من جديد';
      }
      
      await bot.sendMessage(chatId, errorMessage);
      console.error('🔍 Detailed error for voter saving:', {
        nationalId: session.nationalId,
        phoneNumber: session.phoneNumber,
        error: error.message,
        stack: error.stack
      });
    }
  });

  // Error handling
  bot.on('polling_error', (error: any) => {
    if (error.code === 'ETELEGRAM' && error.response?.body?.error_code === 409) {
      return;
    }
    console.error('Polling error:', error);
  });
}
