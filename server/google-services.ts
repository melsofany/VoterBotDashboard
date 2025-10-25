import { google } from 'googleapis';

let auth: any = null;
let oauthClient: any = null;

export function getOAuth2Client() {
  if (oauthClient) {
    return oauthClient;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/auth/google/callback`
    : 'http://localhost:5000/auth/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Missing OAuth credentials: GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
  }

  oauthClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauthClient;
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive'
    ],
    prompt: 'consent'
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

export function setOAuthCredentials(tokens: any) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  auth = oauth2Client;
}

function getGoogleAuth() {
  if (auth) {
    return auth;
  }

  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (oauthClientId) {
    return getOAuth2Client();
  } else if (serviceAccountJson) {
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
      'Missing Google credentials.\n\n' +
      'Please add ONE of the following options:\n\n' +
      'Option 1 (OAuth - Recommended):\n' +
      '  GOOGLE_OAUTH_CLIENT_ID\n' +
      '  GOOGLE_OAUTH_CLIENT_SECRET\n\n' +
      'Option 2 (Service Account):\n' +
      '  GOOGLE_SERVICE_ACCOUNT_JSON = {entire JSON file contents}\n\n' +
      'Option 3 (Service Account Alternative):\n' +
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
