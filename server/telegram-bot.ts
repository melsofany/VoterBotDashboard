import TelegramBot from 'node-telegram-bot-api';
import { nanoid } from 'nanoid';
import { extractDataFromIDCard } from './ocr-service';
import { uploadImageToDrive } from './drive-service';
import { addVoter, getAuthorizedRepresentatives } from './sheets-service';
import sharp from 'sharp';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

interface UserSession {
  step: 'idle' | 'awaiting_photo' | 'awaiting_location' | 'awaiting_family' | 'awaiting_phone' | 'awaiting_stance';
  nationalId?: string;
  fullName?: string;
  photoBuffer?: Buffer;
  latitude?: number;
  longitude?: number;
  familyName?: string;
  phoneNumber?: string;
  representativeId: string;
  representativeName?: string;
}

const sessions = new Map<number, UserSession>();

export async function startTelegramBot() {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  console.log('🤖 Telegram Bot started successfully!');

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

    await bot.sendMessage(
      chatId,
      '🎉 مرحباً بك في نظام جمع بيانات الناخبين\n' +
      'حملة المرشح علاء سليمان الحديوي\n\n' +
      '📸 الخطوة الأولى:\n' +
      'من فضلك قم بإرسال صورة واضحة لبطاقة الرقم القومي للناخب',
      {
        reply_markup: {
          keyboard: [[{ text: '❌ إلغاء' }]],
          resize_keyboard: true
        }
      }
    );
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
      session.step = 'awaiting_location';

      await bot.sendMessage(
        chatId,
        '✅ تم استخراج البيانات بنجاح!\n\n' +
        `📋 الرقم القومي: ${ocrResult.nationalId}\n` +
        `👤 الاسم: ${ocrResult.fullName || 'غير محدد'}\n\n` +
        '📍 الخطوة التالية:\n' +
        'شارك موقع الناخب الحالي',
        {
          reply_markup: {
            keyboard: [
              [{ text: '📍 مشاركة الموقع', request_location: true }],
              [{ text: '⏭️ تخطي الموقع' }],
              [{ text: '❌ إلغاء' }]
            ],
            resize_keyboard: true
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

    if (!session) return;

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

  // Handle stance selection
  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const session = sessions.get(chatId);

    if (!session || session.step !== 'awaiting_stance' || !query.data?.startsWith('stance_')) {
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
    } catch (error) {
      console.error('Error saving voter:', error);
      await bot.sendMessage(
        chatId,
        '❌ حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.\n\n' +
        'أرسل /start للبدء من جديد'
      );
    }
  });

  // Error handling
  bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
  });
}
