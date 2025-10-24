import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

export interface OCRResult {
  nationalId: string | null;
  fullName: string | null;
  text: string;
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

async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(imageBuffer)
      .resize(3000, null, { 
        fit: 'inside',
        withoutEnlargement: false
      })
      .grayscale()
      .normalize()
      .linear(1.5, -(128 * 1.5) + 128)
      .sharpen({ sigma: 2 })
      .threshold(128)
      .toBuffer();
  } catch (error) {
    console.log('⚠️ Image preprocessing failed, using original');
    return imageBuffer;
  }
}

export async function extractDataFromIDCard(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    console.log('🔍 Starting OCR processing...');
    
    const processedImage = await preprocessImage(imageBuffer);
    
    const worker = await createWorker('ara+eng', 1, {
      logger: () => {}
    });
    
    await worker.setParameters({
      tessedit_char_whitelist: '٠١٢٣٤٥٦٧٨٩0123456789 \nأبتثجحخدذرزسشصضطظعغفقكلمنهويءآإئؤةى',
    });
    
    const { data: { text } } = await worker.recognize(processedImage);
    
    await worker.terminate();
    
    console.log('📄 OCR Raw Text:', text);

    const normalizedText = convertArabicNumeralsToLatin(text);
    console.log('🔄 Text with converted numerals:', normalizedText);

    let nationalId: string | null = null;
    
    const allDigits = normalizedText.replace(/[^\d]/g, '');
    console.log('🔢 All digits extracted:', allDigits);
    
    if (allDigits.length >= 14) {
      for (let i = 0; i <= allDigits.length - 14; i++) {
        const candidate = allDigits.substring(i, i + 14);
        
        if (candidate.startsWith('1') || candidate.startsWith('2') || candidate.startsWith('3')) {
          const century = parseInt(candidate.substring(0, 1));
          const year = parseInt(candidate.substring(1, 3));
          const month = parseInt(candidate.substring(3, 5));
          const day = parseInt(candidate.substring(5, 7));
          
          if (century >= 1 && century <= 3 && 
              month >= 1 && month <= 12 && 
              day >= 1 && day <= 31 && 
              year >= 0 && year <= 99) {
            nationalId = candidate;
            console.log('✅ Found valid national ID pattern:', nationalId);
            break;
          }
        }
      }
    }
    
    if (!nationalId) {
      let normalizedMatch = normalizedText.match(/\b\d{14}\b/);
      nationalId = normalizedMatch ? normalizedMatch[0] : null;
    }
    
    if (!nationalId) {
      const patterns = normalizedText.match(/[\d\s\.\-]{17,30}/g);
      if (patterns) {
        for (const pattern of patterns) {
          const cleaned = pattern.replace(/[^\d]/g, '');
          if (cleaned.length >= 14) {
            nationalId = cleaned.substring(0, 14);
            break;
          }
        }
      }
    }

    const lines = normalizedText.split('\n').filter(line => line.trim());
    let fullName: string | null = null;

    for (const line of lines) {
      if (/[\u0600-\u06FF]/.test(line) && line.length > 5) {
        const arabicWords = line.match(/[\u0600-\u06FF\s]+/g);
        if (arabicWords && arabicWords[0].trim().length > 5) {
          const name = arabicWords[0].trim();
          if (!name.includes('مصر') && !name.includes('جمهورية') && !name.includes('محافظة')) {
            fullName = name;
            break;
          }
        }
      }
    }

    console.log('✅ OCR Results:', { nationalId, fullName });

    return {
      nationalId,
      fullName,
      text: text.substring(0, 500)
    };
  } catch (error) {
    console.error('❌ OCR Error:', error);
    return {
      nationalId: null,
      fullName: null,
      text: ''
    };
  }
}
