import { GoogleGenAI } from "@google/genai";
import sharp from 'sharp';
import { decodeEgyptianID, type DecodedEgyptianID } from './egyptian-id-decoder';

// Using Gemini AI for OCR - Blueprint: javascript_gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface OCRResult {
  nationalId: string | null;
  fullName: string | null;
  address: string | null;
  text: string;
  decodedInfo: DecodedEgyptianID | null;
}

function convertArabicNumeralsToLatin(text: string): string {
  const arabicToLatinMap: { [key: string]: string } = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9'
  };
  
  return text.replace(/[٠-٩]/g, (match) => arabicToLatinMap[match] || match);
}

export async function extractDataFromIDCard(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not set');
      return {
        nationalId: null,
        fullName: null,
        address: null,
        text: 'GEMINI_API_KEY is required for OCR processing',
        decodedInfo: null
      };
    }

    const startTime = Date.now();
    console.log('⚡ Starting Gemini AI OCR processing...');
    
    // Preprocess image for better OCR results
    const processedImage = await sharp(imageBuffer)
      .resize(2000, null, { fit: 'inside', withoutEnlargement: false })
      .jpeg({ quality: 95 })
      .toBuffer();
    
    console.log(`✅ Image preprocessed in ${Date.now() - startTime}ms`);
    
    const ocrStart = Date.now();
    
    // Use Gemini Vision API to extract text from ID card
    const systemPrompt = `أنت خبير في قراءة وتحليل البطاقات الشخصية المصرية. 
مهمتك:
1. استخراج الرقم القومي (14 رقم فقط بدون أي فواصل أو مسافات)
2. استخراج الاسم الكامل (بالعربية)
3. استخراج العنوان (إن وجد)

قواعد مهمة:
- الرقم القومي يجب أن يكون 14 رقم بالضبط
- يجب تحويل الأرقام العربية (٠-٩) إلى لاتينية (0-9)
- الرد يجب أن يكون بصيغة JSON فقط
- لا تضف أي نص إضافي خارج JSON

مثال على البطاقة المصرية:
- الرقم القومي يبدأ بـ 2 أو 3 (القرن)
- يتبعه 6 أرقام (تاريخ الميلاد: سنة، شهر، يوم)
- ثم رقمان للمحافظة
- ثم 5 أرقام أخرى`;

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `اقرأ هذه الصورة واستخرج:
1. الرقم القومي (14 رقم فقط)
2. الاسم الكامل 
3. العنوان

الرد يجب أن يكون JSON فقط بهذا الشكل:
{
  "nationalId": "29501011234567",
  "fullName": "محمد أحمد علي حسن",
  "address": "القاهرة - مصر الجديدة"
}

ملاحظة: إذا لم تجد أي حقل، ضع null`
          },
          {
            inlineData: {
              data: processedImage.toString("base64"),
              mimeType: "image/jpeg",
            },
          },
        ]
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            nationalId: { type: "string", nullable: true },
            fullName: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
          },
          required: ["nationalId", "fullName", "address"],
        },
      },
    });

    console.log(`✅ Gemini OCR completed in ${Date.now() - ocrStart}ms`);
    
    // Get text from response (it's a method in @google/genai v1.28.0)
    const rawJson = typeof response.text === 'function' ? response.text() : response.text;
    console.log('📄 Gemini Response (first 200 chars):', rawJson ? rawJson.substring(0, 200) : rawJson);

    // Verify we received a valid string
    if (!rawJson || typeof rawJson !== 'string') {
      console.error('❌ Invalid response from Gemini - type:', typeof rawJson);
      console.error('❌ Full response object:', JSON.stringify(response, null, 2).substring(0, 500));
      return {
        nationalId: null,
        fullName: null,
        address: null,
        text: '',
        decodedInfo: null
      };
    }

    let extractedData: { nationalId: string | null; fullName: string | null; address: string | null };
    
    try {
      extractedData = JSON.parse(rawJson);
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response:', parseError);
      console.error('Raw response:', rawJson);
      return {
        nationalId: null,
        fullName: null,
        address: null,
        text: rawJson || '',
        decodedInfo: null
      };
    }

    // Convert Arabic numerals to Latin in national ID
    let nationalId = extractedData.nationalId;
    if (nationalId) {
      nationalId = convertArabicNumeralsToLatin(nationalId);
      // Remove any non-digit characters
      nationalId = nationalId.replace(/[^\d]/g, '');
      
      // Validate that it's exactly 14 digits
      if (nationalId.length !== 14) {
        console.log(`⚠️ Invalid national ID length: ${nationalId.length} (expected 14)`);
        
        // Try to find a 14-digit sequence in the extracted text
        const allDigits = nationalId;
        if (allDigits.length >= 14) {
          // Look for valid national ID patterns (starting with 1, 2, or 3)
          for (let i = 0; i <= allDigits.length - 14; i++) {
            const candidate = allDigits.substring(i, i + 14);
            if (candidate.startsWith('1') || candidate.startsWith('2') || candidate.startsWith('3')) {
              const century = parseInt(candidate.substring(0, 1));
              const month = parseInt(candidate.substring(3, 5));
              const day = parseInt(candidate.substring(5, 7));
              
              if (century >= 1 && century <= 3 && 
                  month >= 1 && month <= 12 && 
                  day >= 1 && day <= 31) {
                nationalId = candidate;
                console.log('✅ Found valid 14-digit national ID:', nationalId);
                break;
              }
            }
          }
        }
        
        // If still not 14 digits, set to null
        if (nationalId.length !== 14) {
          nationalId = null;
        }
      }
    }

    const fullName = extractedData.fullName;
    const address = extractedData.address;

    // Decode national ID if valid
    let decodedInfo: DecodedEgyptianID | null = null;
    if (nationalId) {
      decodedInfo = decodeEgyptianID(nationalId);
      if (decodedInfo.isValid) {
        console.log('✅ Decoded ID Info:', {
          birthDate: decodedInfo.birthDate,
          governorate: decodedInfo.governorate,
          gender: decodedInfo.gender,
          century: decodedInfo.century
        });
      } else {
        console.log('⚠️ National ID could not be decoded or is invalid');
        // If decoding failed, the national ID is probably invalid
        nationalId = null;
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`⚡ TOTAL OCR TIME: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log('✅ Final OCR Results:', { nationalId, fullName, address });

    return {
      nationalId,
      fullName,
      address,
      text: rawJson || '',
      decodedInfo
    };
  } catch (error) {
    console.error('❌ Gemini OCR Error:', error);
    return {
      nationalId: null,
      fullName: null,
      address: null,
      text: '',
      decodedInfo: null
    };
  }
}
