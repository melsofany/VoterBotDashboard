import { getUncachableGoogleDriveClient } from './google-services';
import { Readable } from 'stream';
import type { Response } from 'express';

let FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
let folderCreatedAutomatically = false;

export async function ensureDriveFolder(): Promise<string> {
  if (FOLDER_ID && !folderCreatedAutomatically) {
    return FOLDER_ID;
  }

  try {
    const drive = await getUncachableGoogleDriveClient();
    
    console.log('📁 Creating a new Google Drive folder for Service Account...');
    
    const folderMetadata = {
      name: 'Voter ID Cards - Service Account',
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, webViewLink',
    });

    FOLDER_ID = folder.data.id!;
    folderCreatedAutomatically = true;

    console.log('✅ Google Drive folder created successfully!');
    console.log('📁 Folder ID:', FOLDER_ID);
    console.log('🔗 Folder Link:', folder.data.webViewLink);
    console.log('');
    console.log('⚠️ IMPORTANT: Add this to your environment variables:');
    console.log(`   GOOGLE_DRIVE_FOLDER_ID=${FOLDER_ID}`);
    console.log('');

    return FOLDER_ID;
  } catch (error) {
    console.error('❌ Error creating Drive folder:', error);
    throw new Error('Failed to create Google Drive folder. Please check Service Account permissions.');
  }
}

export async function uploadImageToDrive(
  imageBuffer: Buffer,
  nationalId: string
): Promise<string> {
  try {
    const folderId = await ensureDriveFolder();
    const drive = await getUncachableGoogleDriveClient();

    const fileMetadata = {
      name: `${nationalId}.jpg`,
      parents: [folderId],
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
      throw new Error('فشل رفع الصورة. المجلد الحالي غير متوافق مع Service Account. سيتم إنشاء مجلد جديد تلقائياً في المرة القادمة.');
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
