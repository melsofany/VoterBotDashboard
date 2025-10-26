import { getUncachableGoogleDriveClient } from './google-services';
import { Readable } from 'stream';
import type { Response } from 'express';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

export async function testDriveConnection(): Promise<{ success: boolean; message: string; email?: string }> {
  try {
    if (!FOLDER_ID) {
      return {
        success: false,
        message: '❌ GOOGLE_DRIVE_FOLDER_ID غير معرّف في متغيرات البيئة.'
      };
    }

    const drive = await getUncachableGoogleDriveClient();
    const serviceEmail = await getServiceAccountEmail();
    
    const result = await drive.files.get({
      fileId: FOLDER_ID,
      fields: 'id, name, capabilities',
      supportsAllDrives: true
    });

    const capabilities = result.data.capabilities || {};
    
    if (!capabilities.canAddChildren) {
      return {
        success: false,
        email: serviceEmail,
        message: `❌ Service Account (${serviceEmail}) لا يملك صلاحية إضافة ملفات للمجلد.\nتأكد من إعطائه صلاحية "Editor" وليس "Viewer".`
      };
    }

    return {
      success: true,
      email: serviceEmail,
      message: `✅ الاتصال بـ Google Drive ناجح!\nالمجلد: ${result.data.name}\nService Account: ${serviceEmail}`
    };
  } catch (error: any) {
    const serviceEmail = await getServiceAccountEmail();
    const errorMessage = error.message || '';
    const errorCode = error.code || error.response?.status;

    if (errorCode === 404) {
      return {
        success: false,
        email: serviceEmail,
        message: `❌ المجلد غير موجود أو غير مشارك!\nFolder ID: ${FOLDER_ID}\nتأكد من مشاركة المجلد مع: ${serviceEmail}`
      };
    }

    if (errorCode === 403) {
      return {
        success: false,
        email: serviceEmail,
        message: `❌ ليس لديك صلاحية الوصول للمجلد!\nتأكد من مشاركة المجلد مع: ${serviceEmail} بصلاحية Editor`
      };
    }

    return {
      success: false,
      email: serviceEmail,
      message: `❌ خطأ في الاتصال: ${errorMessage}`
    };
  }
}

async function getServiceAccountEmail(): Promise<string> {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
    return credentials.client_email || 'غير معروف';
  } catch {
    return 'غير معروف';
  }
}

export async function uploadImageToDrive(
  imageBuffer: Buffer,
  nationalId: string
): Promise<string> {
  if (!FOLDER_ID) {
    throw new Error('❌ GOOGLE_DRIVE_FOLDER_ID غير معرّف في متغيرات البيئة.');
  }

  try {
    const drive = await getUncachableGoogleDriveClient();

    const fileMetadata = {
      name: `${nationalId}.jpg`,
      parents: [FOLDER_ID],
      writersCanShare: false
    };

    const media = {
      mimeType: 'image/jpeg',
      body: Readable.from(imageBuffer)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    const fileId = response.data.id!;
    
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        },
        supportsAllDrives: true
      });
      console.log('✅ File permissions set for:', nationalId);
    } catch (permError) {
      console.log('⚠️ Could not set public permissions (file will be restricted):', nationalId);
    }
    
    const secureViewLink = `https://drive.google.com/file/d/${fileId}/view`;
    
    console.log('✅ Image uploaded to Google Drive:', nationalId);
    return secureViewLink;
  } catch (error: any) {
    console.error('❌ Error uploading to Drive:', error);
    
    const errorMessage = error.message || '';
    const errorCode = error.code || error.response?.status;
    
    if (
      errorCode === 403 ||
      errorCode === 404 ||
      errorMessage.includes('storage quota') ||
      errorMessage.includes('insufficient permissions') ||
      errorMessage.includes('File not found') ||
      errorMessage.includes('permission') ||
      errorMessage.includes('The user does not have sufficient permissions')
    ) {
      const serviceEmail = await getServiceAccountEmail();
      throw new Error(
        `❌ المجلد غير مشارك بشكل صحيح مع Service Account!\n\n` +
        `📋 الحل المضمون:\n` +
        `1. افتح Google Drive: https://drive.google.com/drive/folders/${FOLDER_ID}\n` +
        `2. اضغط كليك يمين على المجلد → "مشاركة" أو "Share"\n` +
        `3. تأكد من حذف أي مشاركات سابقة لنفس البريد إن وجدت\n` +
        `4. أضف هذا البريد من جديد: ${serviceEmail}\n` +
        `5. اختر صلاحية: "محرر" أو "Editor" (وليس Viewer)\n` +
        `6. تأكد من إلغاء تحديد "Notify people" إذا لم ترغب بإرسال إشعار\n` +
        `7. اضغط "مشاركة" أو "Share" → "تم" أو "Done"\n` +
        `8. انتظر 30 ثانية ثم حاول مرة أخرى\n\n` +
        `💡 نصيحة: تأكد أن المجلد ليس داخل "Shared with me" بل في "My Drive" الخاص بك\n\n` +
        `الخطأ التقني: ${errorMessage}`
      );
    }
    
    throw error;
  }
}

export async function streamImageFromDrive(
  imageUrl: string,
  res: Response
): Promise<void> {
  try {
    const fileIdMatch = imageUrl.match(/\/file\/d\/([^\/]+)/);
    if (!fileIdMatch) {
      throw new Error('Invalid Drive URL format');
    }
    
    const fileId = fileIdMatch[1];
    const drive = await getUncachableGoogleDriveClient();
    
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    response.data.pipe(res);
  } catch (error) {
    console.error('❌ Error streaming image from Drive:', error);
    throw error;
  }
}
