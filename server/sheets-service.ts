import { getUncachableGoogleSheetClient } from './google-services';
import { Voter, Representative, DashboardStats, RepresentativePerformance } from '@shared/schema';
import { decodeEgyptianID } from './egyptian-id-decoder';
import { calculateAge, isElderly } from './age-calculator';

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

    // Check and migrate headers if needed
    const votersData = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${VOTERS_SHEET}!A1:L1`,
    });

    if (!votersData.data.values || votersData.data.values.length === 0) {
      // Sheet is empty, create new headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${VOTERS_SHEET}!A1:L1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'ID', 'National ID', 'Full Name', 'Family Name', 'Phone Number',
            'Latitude', 'Longitude', 'Address', 'Stance', 'ID Card Image URL',
            'Representative ID', 'Created At'
          ]]
        }
      });
    } else if (votersData.data.values[0].length === 11) {
      // Old format detected (11 columns), migrate to new format (12 columns)
      console.log('🔄 Migrating Google Sheets to include Address column...');
      
      // Get all existing data
      const allData = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${VOTERS_SHEET}!A:K`,
      });
      
      if (allData.data.values && allData.data.values.length > 0) {
        // Transform all rows to include empty address column at position 7 (index 7)
        const migratedRows = allData.data.values.map((row, index) => {
          if (index === 0) {
            // Update header row
            return [
              'ID', 'National ID', 'Full Name', 'Family Name', 'Phone Number',
              'Latitude', 'Longitude', 'Address', 'Stance', 'ID Card Image URL',
              'Representative ID', 'Created At'
            ];
          } else {
            // Insert empty address column for data rows
            const newRow = [...row];
            newRow.splice(7, 0, ''); // Insert empty string at position 7
            return newRow;
          }
        });
        
        // Clear old data and write migrated data
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SHEET_ID,
          range: `${VOTERS_SHEET}!A:K`,
        });
        
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${VOTERS_SHEET}!A1:L${migratedRows.length}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: migratedRows
          }
        });
        
        console.log(`✅ Migrated ${migratedRows.length - 1} voter rows to new format`);
      }
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
    
    const existingVoters = await getAllVoters();
    const duplicateNationalId = existingVoters.find(v => v.nationalId === voter.nationalId);
    if (duplicateNationalId) {
      throw new Error(`الرقم القومي ${voter.nationalId} موجود بالفعل في النظام`);
    }
    
    const duplicatePhone = existingVoters.find(v => v.phoneNumber === voter.phoneNumber);
    if (duplicatePhone) {
      throw new Error(`رقم الهاتف ${voter.phoneNumber} موجود بالفعل في النظام`);
    }
    
    const values = [[
      voter.id,
      voter.nationalId,
      voter.fullName,
      voter.familyName,
      voter.phoneNumber,
      voter.latitude?.toString() || '',
      voter.longitude?.toString() || '',
      voter.address || '',
      voter.stance,
      voter.idCardImageUrl || '',
      voter.representativeId,
      voter.createdAt ? voter.createdAt.toISOString() : new Date().toISOString()
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${VOTERS_SHEET}!A:L`,
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
      range: `${VOTERS_SHEET}!A2:L`,
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
      address: row[7] || null,
      stance: row[8] || 'neutral',
      idCardImageUrl: row[9] || null,
      representativeId: row[10] || '',
      representativeName: null, // Name is not stored in voters sheet
      createdAt: row[11] ? new Date(row[11]) : new Date(),
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

    let elderlyCount = 0;
    let elderlyMales = 0;
    let elderlyFemales = 0;
    let totalMales = 0;
    let totalFemales = 0;

    voters.forEach(voter => {
      const decoded = decodeEgyptianID(voter.nationalId);
      
      if (decoded.isValid) {
        if (decoded.gender === 'male') {
          totalMales++;
        } else if (decoded.gender === 'female') {
          totalFemales++;
        }

        if (decoded.birthDate && isElderly(decoded.birthDate)) {
          elderlyCount++;
          if (decoded.gender === 'male') {
            elderlyMales++;
          } else if (decoded.gender === 'female') {
            elderlyFemales++;
          }
        }
      }
    });

    return {
      totalVoters: voters.length,
      supporters: voters.filter(v => v.stance === 'supporter').length,
      opponents: voters.filter(v => v.stance === 'opponent').length,
      neutral: voters.filter(v => v.stance === 'neutral').length,
      todayCount: voters.filter(v => new Date(v.createdAt) >= today).length,
      representativesCount: reps.length,
      elderlyCount,
      elderlyMales,
      elderlyFemales,
      totalMales,
      totalFemales,
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
      elderlyCount: 0,
      elderlyMales: 0,
      elderlyFemales: 0,
      totalMales: 0,
      totalFemales: 0,
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
      
      let elderlyCount = 0;
      let elderlyMales = 0;
      let elderlyFemales = 0;
      let malesCount = 0;
      let femalesCount = 0;

      repVoters.forEach(voter => {
        const decoded = decodeEgyptianID(voter.nationalId);
        
        if (decoded.isValid) {
          if (decoded.gender === 'male') {
            malesCount++;
          } else if (decoded.gender === 'female') {
            femalesCount++;
          }

          if (decoded.birthDate && isElderly(decoded.birthDate)) {
            elderlyCount++;
            if (decoded.gender === 'male') {
              elderlyMales++;
            } else if (decoded.gender === 'female') {
              elderlyFemales++;
            }
          }
        }
      });

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
        elderlyCount,
        elderlyMales,
        elderlyFemales,
        malesCount,
        femalesCount,
      };
    });
  } catch (error) {
    console.error('Error getting representatives performance:', error);
    return [];
  }
}

export async function addRepresentative(userId: string, name?: string): Promise<void> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    const values = [[userId, name || '']];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${REPS_SHEET}!A:B`,
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    console.log('✅ Representative added to Google Sheets:', userId);
  } catch (error) {
    console.error('❌ Error adding representative to sheets:', error);
    throw error;
  }
}

export async function updateRepresentative(userId: string, name: string): Promise<void> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    // Get all representatives to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${REPS_SHEET}!A2:B`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Representative not found');
    }

    // Update the name (row index + 2 because we start from A2)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${REPS_SHEET}!B${rowIndex + 2}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[name]]
      }
    });

    console.log('✅ Representative updated in Google Sheets:', userId);
  } catch (error) {
    console.error('❌ Error updating representative in sheets:', error);
    throw error;
  }
}

export async function deleteRepresentative(userId: string): Promise<void> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    // Get all representatives to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${REPS_SHEET}!A2:B`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === userId);
    
    if (rowIndex === -1) {
      throw new Error('Representative not found');
    }

    // Delete the row (row index + 2 because we start from A2, and sheets are 1-indexed)
    const sheetId = await getSheetId(REPS_SHEET);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex + 1, // +1 because header is row 0
              endIndex: rowIndex + 2
            }
          }
        }]
      }
    });

    console.log('✅ Representative deleted from Google Sheets:', userId);
  } catch (error) {
    console.error('❌ Error deleting representative from sheets:', error);
    throw error;
  }
}

async function getSheetId(sheetName: string): Promise<number> {
  const sheets = await getUncachableGoogleSheetClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });
  
  const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
  if (!sheet || sheet.properties?.sheetId === undefined) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  
  return sheet.properties.sheetId;
}
