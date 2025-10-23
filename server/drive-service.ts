import { getUncachableGoogleDriveClient } from './google-services';
import { Readable } from 'stream';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

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
      fields: 'id, webViewLink, webContentLink'
    });

    // Make the file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Get the direct link
    const file = await drive.files.get({
      fileId: response.data.id!,
      fields: 'webContentLink'
    });

    console.log('✅ Image uploaded to Google Drive:', nationalId);
    return file.data.webContentLink || `https://drive.google.com/file/d/${response.data.id}/view`;
  } catch (error) {
    console.error('❌ Error uploading to Drive:', error);
    throw error;
  }
}
