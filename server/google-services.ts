import { google } from 'googleapis';

let auth: any = null;

function getGoogleAuth() {
  if (auth) {
    return auth;
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (serviceAccountJson) {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      
      auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive'
        ],
      });

      return auth;
    } catch (error) {
      throw new Error(
        'Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON.\n' +
        'Please ensure it contains valid JSON from the Service Account key file.'
      );
    }
  } else if (serviceAccountEmail && serviceAccountPrivateKey) {
    const privateKey = serviceAccountPrivateKey.replace(/\\n/g, '\n');

    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ],
    });

    return auth;
  } else {
    throw new Error(
      'Missing Google Service Account credentials.\n\n' +
      'Please add ONE of the following options:\n\n' +
      'Option 1 (Recommended - Easier):\n' +
      '  GOOGLE_SERVICE_ACCOUNT_JSON = {entire JSON file contents}\n\n' +
      'Option 2:\n' +
      '  GOOGLE_SERVICE_ACCOUNT_EMAIL = xxx@xxx.iam.gserviceaccount.com\n' +
      '  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----...\n\n' +
      'See GOOGLE_SERVICE_ACCOUNT_GUIDE.md for detailed instructions.'
    );
  }
}

export async function getUncachableGoogleDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

export async function getUncachableGoogleSheetClient() {
  const auth = getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}
