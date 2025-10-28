import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Response } from 'express';

const WASABI_ACCESS_KEY = process.env.WASABI_ACCESS_KEY!;
const WASABI_SECRET_KEY = process.env.WASABI_SECRET_KEY!;
const WASABI_BUCKET_NAME = process.env.WASABI_BUCKET_NAME!;
const WASABI_REGION = process.env.WASABI_REGION!;
const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT!;

const s3Client = new S3Client({
  endpoint: `https://${WASABI_ENDPOINT}`,
  region: WASABI_REGION,
  credentials: {
    accessKeyId: WASABI_ACCESS_KEY,
    secretAccessKey: WASABI_SECRET_KEY,
  },
});

export async function testWasabiConnection(): Promise<{ success: boolean; message: string }> {
  try {
    if (!WASABI_ACCESS_KEY || !WASABI_SECRET_KEY || !WASABI_BUCKET_NAME) {
      return {
        success: false,
        message: '❌ معلومات Wasabi غير مكتملة في متغيرات البيئة.',
      };
    }

    const testKey = `test-${Date.now()}.txt`;
    const testContent = 'Test connection';

    await s3Client.send(
      new PutObjectCommand({
        Bucket: WASABI_BUCKET_NAME,
        Key: testKey,
        Body: testContent,
      })
    );

    try {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: WASABI_BUCKET_NAME,
          Key: testKey,
        })
      );
    } catch (deleteError) {
      console.warn('⚠️ Could not clean up test file:', deleteError);
    }

    return {
      success: true,
      message: `✅ الاتصال بـ Wasabi ناجح!\nالـ Bucket: ${WASABI_BUCKET_NAME}\nالمنطقة: ${WASABI_REGION}`,
    };
  } catch (error: any) {
    console.error('❌ Error testing Wasabi connection:', error);
    return {
      success: false,
      message: `❌ خطأ في الاتصال بـ Wasabi: ${error.message || 'Unknown error'}`,
    };
  }
}

export async function uploadImageToWasabi(
  imageBuffer: Buffer,
  nationalId: string
): Promise<string> {
  if (!WASABI_BUCKET_NAME) {
    throw new Error('❌ WASABI_BUCKET_NAME غير معرّف في متغيرات البيئة.');
  }

  try {
    const key = `id-cards/${nationalId}.jpg`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: WASABI_BUCKET_NAME,
        Key: key,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      })
    );

    const publicUrl = `https://${WASABI_BUCKET_NAME}.${WASABI_ENDPOINT}/${key}`;

    console.log('✅ Image uploaded to Wasabi:', nationalId);
    return publicUrl;
  } catch (error: any) {
    console.error('❌ Error uploading to Wasabi:', error);
    throw new Error(
      `❌ فشل رفع الصورة إلى Wasabi!\n\n` +
      `تأكد من:\n` +
      `1. صحة معلومات الاتصال (Access Key, Secret Key)\n` +
      `2. وجود الـ Bucket: ${WASABI_BUCKET_NAME}\n` +
      `3. صلاحيات الكتابة على الـ Bucket\n\n` +
      `الخطأ التقني: ${error.message || 'Unknown error'}`
    );
  }
}

export async function streamImageFromWasabi(
  imageUrl: string,
  res: Response
): Promise<void> {
  try {
    const keyMatch = imageUrl.match(/id-cards\/(.+\.jpg)/);
    if (!keyMatch) {
      throw new Error('Invalid Wasabi URL format');
    }

    const key = `id-cards/${keyMatch[1]}`;

    const command = new GetObjectCommand({
      Bucket: WASABI_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('No image data received from Wasabi');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const stream = response.Body as any;
    stream.pipe(res);
  } catch (error) {
    console.error('❌ Error streaming image from Wasabi:', error);
    throw error;
  }
}
