import { getUncachableGoogleDriveClient } from './google-services';
import { Readable } from 'stream';
import type { Response } from 'express';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

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
    
    if (error.message && error.message.includes('storage quota')) {
      const serviceEmail = await getServiceAccountEmail();
      throw new Error(
        `❌ المجلد غير مشارك مع Service Account!\n\n` +
        `📋 الحل:\n` +
        `1. افتح Google Drive: https://drive.google.com/drive/folders/${FOLDER_ID}\n` +
        `2. اضغط كليك يمين على المجلد → Share\n` +
        `3. أضف هذا البريد: ${serviceEmail}\n` +
        `4. اختر صلاحية: Editor\n` +
        `5. اضغط Share\n\n` +
        `ثم حاول مرة أخرى.`
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
