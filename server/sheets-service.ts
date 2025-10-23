import { getUncachableGoogleSheetClient } from './google-services';
import { Voter, Representative, DashboardStats, RepresentativePerformance } from '@shared/schema';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const VOTERS_SHEET = 'Voters';
const REPS_SHEET = 'Representatives';

export async function initializeSheets() {
  try {
    if (!SHEET_ID) {
      throw new Error('GOOGLE_SHEET_ID environment variable is not set. Please create a Google Sheet and add its ID to your environment variables.');
    }

    const sheets = await getUncachableGoogleSheetClient();
    
    // Check if sheets exist, create if they don't
    let response;
    try {
      response = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
      });
    } catch (error: any) {
      if (error.code === 404) {
        throw new Error(
          `Google Sheet with ID "${SHEET_ID}" not found.\n\n` +
          'Please make sure:\n' +
          '1. The Google Sheet exists in your Google Drive\n' +
          '2. You have shared the sheet with the Google Sheets API\n' +
          '3. The GOOGLE_SHEET_ID in your environment is correct\n\n' +
          'Sheet ID should look like: 1abc123XYZ...'
        );
      }
      throw error;
    }

    const existingSheets = response.data.sheets?.map(s => s.properties?.title) || [];
    
    const requests = [];

    if (!existingSheets.includes(VOTERS_SHEET)) {
      requests.push({
        addSheet: {
          properties: { title: VOTERS_SHEET }
        }
      });
    }

    if (!existingSheets.includes(REPS_SHEET)) {
      requests.push({
        addSheet: {
          properties: { title: REPS_SHEET }
        }
      });
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests }
      });
    }

    // Initialize headers if sheets are empty
    const votersData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${VOTERS_SHEET}!A1:K1`,
    });

    if (!votersData.data.values || votersData.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${VOTERS_SHEET}!A1:K1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'ID', 'National ID', 'Full Name', 'Family Name', 'Phone Number',
            'Latitude', 'Longitude', 'Stance', 'ID Card Image URL',
            'Representative ID', 'Created At'
          ]]
        }
      });
    }

    const repsData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${REPS_SHEET}!A1:B1`,
    });

    if (!repsData.data.values || repsData.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${REPS_SHEET}!A1:B1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['user_id', 'name']]
        }
      });
    }

    console.log('✅ Google Sheets initialized successfully');
    console.log(`📊 Sheet ID: ${SHEET_ID}`);
    console.log(`📝 Sheets created/verified: ${VOTERS_SHEET}, ${REPS_SHEET}`);
  } catch (error: any) {
    console.error('❌ Error initializing sheets:', error.message || error);
    throw error;
  }
}

export async function getAuthorizedRepresentatives(): Promise<string[]> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${REPS_SHEET}!A2:A`,
    });

    const userIds = response.data.values?.map(row => row[0]) || [];
    return userIds.filter(id => id); // Remove empty values
  } catch (error) {
    console.error('Error getting authorized representatives:', error);
    return [];
  }
}

export async function addVoter(voter: Omit<Voter, 'createdAt'> & { createdAt?: Date }): Promise<void> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    const values = [[
      voter.id,
      voter.nationalId,
      voter.fullName,
      voter.familyName,
      voter.phoneNumber,
      voter.latitude?.toString() || '',
      voter.longitude?.toString() || '',
      voter.stance,
      voter.idCardImageUrl || '',
      voter.representativeId,
      voter.createdAt ? voter.createdAt.toISOString() : new Date().toISOString()
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${VOTERS_SHEET}!A:K`,
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    console.log('✅ Voter added to Google Sheets:', voter.nationalId);
  } catch (error) {
    console.error('❌ Error adding voter to sheets:', error);
    throw error;
  }
}

export async function getAllVoters(): Promise<Voter[]> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${VOTERS_SHEET}!A2:K`,
    });

    const rows = response.data.values || [];
    return rows.map(row => ({
      id: row[0] || '',
      nationalId: row[1] || '',
      fullName: row[2] || '',
      familyName: row[3] || '',
      phoneNumber: row[4] || '',
      latitude: row[5] ? parseFloat(row[5]) : null,
      longitude: row[6] ? parseFloat(row[6]) : null,
      stance: row[7] || 'neutral',
      idCardImageUrl: row[8] || null,
      representativeId: row[9] || '',
      representativeName: row[10] || null,
      createdAt: row[10] ? new Date(row[10]) : new Date(),
    }));
  } catch (error) {
    console.error('Error getting voters from sheets:', error);
    return [];
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const voters = await getAllVoters();
    const reps = await getAuthorizedRepresentatives();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      totalVoters: voters.length,
      supporters: voters.filter(v => v.stance === 'supporter').length,
      opponents: voters.filter(v => v.stance === 'opponent').length,
      neutral: voters.filter(v => v.stance === 'neutral').length,
      todayCount: voters.filter(v => new Date(v.createdAt) >= today).length,
      representativesCount: reps.length,
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return {
      totalVoters: 0,
      supporters: 0,
      opponents: 0,
      neutral: 0,
      todayCount: 0,
      representativesCount: 0,
    };
  }
}

export async function getRepresentativesPerformance(): Promise<RepresentativePerformance[]> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const repsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${REPS_SHEET}!A2:B`,
    });

    const voters = await getAllVoters();
    const reps = repsResponse.data.values || [];

    return reps.map(([userId, name]) => {
      const repVoters = voters.filter(v => v.representativeId === userId);
      return {
        userId,
        name: name || null,
        totalVoters: repVoters.length,
        lastActiveAt: repVoters.length > 0 
          ? new Date(Math.max(...repVoters.map(v => new Date(v.createdAt).getTime())))
          : null,
        votersCount: repVoters.length,
        supportersCount: repVoters.filter(v => v.stance === 'supporter').length,
        opponentsCount: repVoters.filter(v => v.stance === 'opponent').length,
        neutralCount: repVoters.filter(v => v.stance === 'neutral').length,
      };
    });
  } catch (error) {
    console.error('Error getting representatives performance:', error);
    return [];
  }
}
