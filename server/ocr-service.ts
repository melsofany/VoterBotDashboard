import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { decodeEgyptianID, type DecodedEgyptianID } from './egyptian-id-decoder';

const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;

const HUGGINGFACE_OCR_MODELS = [
  'https://api-inference.huggingface.co/models/facebook/nougat-base',
  'https://api-inference.huggingface.co/models/microsoft/trocr-base-printed',
  'https://api-inference.huggingface.co/models/microsoft/trocr-large-printed'
];

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

async function preprocessImageForEgyptianID(imageBuffer: Buffer): Promise<Buffer[]> {
  try {
    const baseImage = sharp(imageBuffer);
    const metadata = await baseImage.metadata();
    
    const variations: Buffer[] = [];
    
    variations.push(
      await sharp(imageBuffer)
        .resize(4500, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .normalize()
        .linear(1.8, -(128 * 1.8) + 128)
        .sharpen({ sigma: 2.5 })
        .toBuffer()
    );
    
    variations.push(
      await sharp(imageBuffer)
        .resize(5000, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .normalize()
        .linear(2.2, -(128 * 2.2) + 128)
        .sharpen({ sigma: 3 })
        .threshold(110)
        .toBuffer()
    );
    
    variations.push(
      await sharp(imageBuffer)
        .resize(4000, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .median(2)
        .normalize()
        .linear(2.0, -(128 * 2.0) + 128)
        .sharpen({ sigma: 2.8 })
        .toBuffer()
    );
    
    variations.push(
      await sharp(imageBuffer)
        .resize(4200, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .normalize()
        .clahe({ width: 8, height: 8, maxSlope: 3 })
        .sharpen({ sigma: 2.5 })
        .toBuffer()
    );
    
    variations.push(
      await sharp(imageBuffer)
        .resize(4800, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .normalize()
        .linear(1.9, -(128 * 1.9) + 128)
        .blur(0.3)
        .sharpen({ sigma: 3.5 })
        .toBuffer()
    );
    
    return variations;
  } catch (error) {
    console.log('⚠️ Enhanced preprocessing failed, using basic');
    return [await preprocessImage(imageBuffer)];
  }
}

async function extractWithHuggingFace(imageBuffer: Buffer): Promise<string | null> {
  if (!HUGGINGFACE_TOKEN) {
    console.log('⚠️ Hugging Face token not available, skipping HF OCR');
    return null;
  }

  for (const modelUrl of HUGGINGFACE_OCR_MODELS) {
    try {
      console.log(`🤖 Trying Hugging Face OCR with ${modelUrl.split('/').pop()}...`);
      
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
          'Content-Type': 'image/jpeg',
        },
        body: imageBuffer
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`⚠️ Model ${modelUrl.split('/').pop()} error ${response.status}:`, errorText);
        continue;
      }

      const result = await response.json();
      console.log('✅ Hugging Face OCR response:', result);
      
      let extractedText = null;
      if (typeof result === 'string') {
        extractedText = result;
      } else if (result && result[0] && result[0].generated_text) {
        extractedText = result[0].generated_text;
      } else if (Array.isArray(result) && result.length > 0) {
        extractedText = result.map(r => r.generated_text || '').join(' ');
      }
      
      if (extractedText && extractedText.length > 10) {
        console.log(`✅ Successfully extracted text using ${modelUrl.split('/').pop()}`);
        return extractedText;
      }
    } catch (error) {
      console.log(`❌ Model ${modelUrl.split('/').pop()} failed:`, error);
      continue;
    }
  }
  
  console.log('⚠️ All Hugging Face models failed');
  return null;
}

export async function extractDataFromIDCard(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    const startTime = Date.now();
    console.log('⚡ Starting FAST OCR processing for Egyptian ID...');
    
    const processedImage = await sharp(imageBuffer)
      .resize(2000, null, { fit: 'inside', withoutEnlargement: false })
      .grayscale()
      .normalize()
      .linear(1.8, -(128 * 1.8) + 128)
      .sharpen({ sigma: 2 })
      .toBuffer();
    
    console.log(`✅ Image preprocessed in ${Date.now() - startTime}ms`);
    
    const ocrStart = Date.now();
    const worker = await createWorker('ara+eng', 1, {
      logger: () => {}
    });
    
    await worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩أبتثجحخدذرزسشصضطظعغفقكلمنهويىةآإؤئءًٌٍَُِّْٓ /.-',
      tessedit_ocr_engine_mode: '1'
    });
    
    const { data: { text: tesseractText } } = await worker.recognize(processedImage);
    await worker.terminate();
    
    console.log(`✅ OCR completed in ${Date.now() - ocrStart}ms`);
    
    const combinedText = tesseractText;
    console.log('📄 Combined OCR Text:', combinedText.substring(0, 600));

    const normalizedText = convertArabicNumeralsToLatin(combinedText);

    let nationalId: string | null = null;
    
    const allDigits = normalizedText.replace(/[^\d]/g, '');
    console.log('🔢 All digits extracted:', allDigits);
    
    const allNumberSequences = normalizedText.match(/[\d\s\.\-\/]{14,30}/g) || [];
    const candidates: string[] = [];
    
    for (const seq of allNumberSequences) {
      const cleaned = seq.replace(/[^\d]/g, '');
      if (cleaned.length >= 14) {
        for (let i = 0; i <= cleaned.length - 14; i++) {
          candidates.push(cleaned.substring(i, i + 14));
        }
      }
    }
    
    if (allDigits.length >= 14) {
      for (let i = 0; i <= allDigits.length - 14; i++) {
        candidates.push(allDigits.substring(i, i + 14));
      }
    }
    
    console.log('🔍 National ID candidates:', candidates.slice(0, 10));
    
    for (const candidate of candidates) {
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
          console.log('✅ Found valid national ID:', nationalId);
          break;
        }
      }
    }

    const lines = combinedText.split('\n').filter(line => line.trim());
    let fullName: string | null = null;
    let address: string | null = null;

    const commonWords = [
      'مصر', 'جمهورية', 'محافظة', 'بطاقة', 'العربية', 'العنوان', 'الرقم', 
      'القومي', 'الاسم', 'تاريخ', 'الميلاد', 'الجنس', 'الديانة',
      'المهنة', 'الحالة', 'الاجتماعية', 'وزارة', 'الداخلية', 'مصلحة', 
      'الاحوال', 'المدنية', 'شخصية', 'قومية', 'بطاقه'
    ];
    
    const governorateKeywords = [
      'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحيرة', 'الفيوم', 
      'الغربية', 'الإسماعيلية', 'المنوفية', 'المنيا', 'القليوبية', 'الوادي الجديد',
      'الشرقية', 'السويس', 'أسوان', 'أسيوط', 'بني سويف', 'بورسعيد',
      'دمياط', 'الأقصر', 'قنا', 'كفر الشيخ', 'مطروح',
      'شمال سيناء', 'جنوب سيناء', 'البحر الأحمر', 'سوهاج', 'مطروح'
    ];

    const arabicLines = lines
      .filter(line => /[\u0600-\u06FF]/.test(line))
      .map(line => line.replace(/[^\u0600-\u06FF\s]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(line => line.length >= 4);
    
    console.log('📝 Arabic lines found:', arabicLines.length);
    arabicLines.forEach((line, i) => console.log(`  Line ${i}: "${line}"`));
    
    const nameCandidates: { text: string; score: number }[] = [];
    
    for (const line of arabicLines) {
      const words = line.split(/\s+/);
      
      if (words.length < 2 || words.length > 6) continue;
      
      const hasCommonWord = commonWords.some(word => line.includes(word));
      const hasGovernorate = governorateKeywords.some(gov => line.includes(gov));
      
      if (hasCommonWord || hasGovernorate) continue;
      
      const validWords = words.filter(word => word.length >= 2);
      
      if (validWords.length >= 2) {
        let score = validWords.length;
        
        if (validWords.length === 3) score += 2;
        if (validWords.length === 4) score += 3;
        
        if (line.length > 10 && line.length < 50) score += 1;
        
        nameCandidates.push({
          text: validWords.join(' '),
          score
        });
      }
    }
    
    nameCandidates.sort((a, b) => b.score - a.score);
    
    console.log('👤 Name candidates:', nameCandidates.slice(0, 5));
    
    if (nameCandidates.length > 0) {
      fullName = nameCandidates[0].text;
      console.log('✅ Selected name:', fullName);
    }
    
    for (const line of lines) {
      for (const gov of governorateKeywords) {
        if (line.includes(gov)) {
          const addressLine = line
            .replace(/محافظة|العنوان|عنوان|:/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (addressLine.length >= 4 && addressLine.length <= 100) {
            address = addressLine;
            console.log('✅ Found address:', address);
            break;
          }
        }
      }
      if (address) break;
    }

    let decodedInfo: DecodedEgyptianID | null = null;
    if (nationalId) {
      decodedInfo = decodeEgyptianID(nationalId);
      if (decodedInfo.isValid) {
        console.log('✅ Decoded ID Info:', {
          birthDate: decodedInfo.birthDate,
          governorate: decodedInfo.governorate,
          gender: decodedInfo.gender
        });
      } else {
        console.log('⚠️ National ID could not be decoded or is invalid');
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`⚡ TOTAL OCR TIME: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
    console.log('✅ Final OCR Results:', { nationalId, fullName, address });

    return {
      nationalId,
      fullName,
      address,
      text: combinedText.substring(0, 500),
      decodedInfo
    };
  } catch (error) {
    console.error('❌ OCR Error:', error);
    return {
      nationalId: null,
      fullName: null,
      address: null,
      text: '',
      decodedInfo: null
    };
  }
}
