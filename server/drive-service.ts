import { getUncachableGoogleDriveClient } from './google-services';
import { Readable } from 'stream';
import type { Response } from 'express';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1V_ZX_LXZyWx6w9K72gdeMgFRPjNKw8SG';

export async function uploadImageToDrive(
  imageBuffer: Buffer,
  nationalId: string
): Promise<string> {
  try {
    const drive = await getUncachableGoogleDriveClient();

    const fileMetadata = {
      name: `${nationalId}.jpg`,
      parents: [FOLDER_ID]
    };

    const media = {
      mimeType: 'image/jpeg',
      body: Readable.from(imageBuffer)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    // DO NOT make files public - keep them private for security
    // Only authorized users with Google account access can view
    
    // Return a secure view link that requires authentication
    const fileId = response.data.id!;
    const secureViewLink = `https://drive.google.com/file/d/${fileId}/view`;
    
    console.log('✅ Image uploaded to Google Drive (private):', nationalId);
    return secureViewLink;
  } catch (error) {
    console.error('❌ Error uploading to Drive:', error);
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
