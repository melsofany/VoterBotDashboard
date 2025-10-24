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
        .resize(2400, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .normalize()
        .linear(1.3, -(128 * 1.3) + 128)
        .sharpen({ sigma: 1.5 })
        .toBuffer()
    );
    
    variations.push(
      await sharp(imageBuffer)
        .resize(3000, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .normalize()
        .linear(1.8, -(128 * 1.8) + 128)
        .sharpen({ sigma: 2 })
        .threshold(120)
        .toBuffer()
    );
    
    variations.push(
      await sharp(imageBuffer)
        .resize(2800, null, { fit: 'inside', withoutEnlargement: false })
        .grayscale()
        .median(3)
        .normalize()
        .linear(1.5, -(128 * 1.5) + 128)
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
    console.log('🔍 Starting enhanced OCR processing for Egyptian ID...');
    
    let text = '';
    let bestText = '';
    let maxConfidence = 0;
    
    const hfText = await extractWithHuggingFace(imageBuffer);
    if (hfText && hfText.length > 20) {
      text = hfText;
      console.log('✅ Using Hugging Face OCR result');
    } else {
      console.log('🔄 Falling back to Tesseract OCR with multiple preprocessing variations...');
      
      const imageVariations = await preprocessImageForEgyptianID(imageBuffer);
      
      for (let i = 0; i < imageVariations.length; i++) {
        try {
          console.log(`🔄 Processing image variation ${i + 1}/${imageVariations.length}...`);
          
          const worker = await createWorker('ara+eng', 1, {
            logger: () => {}
          });
          
          await worker.setParameters({
            tessedit_pageseg_mode: '6',
            preserve_interword_spaces: '1',
            tessedit_char_whitelist: '0123456789٠١٢٣٤٥٦٧٨٩أبتثجحخدذرزسشصضطظعغفقكلمنهويىةآإؤئءةًٌٍَُِّْ '
          });
          
          const { data: { text: tesseractText, confidence } } = await worker.recognize(imageVariations[i]);
          
          await worker.terminate();
          
          console.log(`📊 Variation ${i + 1} confidence: ${confidence}%`);
          
          if (confidence > maxConfidence && tesseractText.length > 20) {
            maxConfidence = confidence;
            bestText = tesseractText;
          }
          
          if (i === 0 || text.length < tesseractText.length) {
            text += '\n' + tesseractText;
          }
        } catch (error) {
          console.log(`⚠️ Variation ${i + 1} failed:`, error);
        }
      }
      
      if (bestText && bestText.length > text.length / 2) {
        text = bestText;
        console.log(`✅ Using best variation with ${maxConfidence}% confidence`);
      }
    }
    
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

    const lines = text.split('\n').filter(line => line.trim());
    let fullName: string | null = null;
    let address: string | null = null;

    const namePatterns = [
      /([أ-ي\s]{6,})/g,
    ];
    
    const governorateKeywords = [
      'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحيرة', 'الفيوم', 
      'الغربية', 'الإسماعيلية', 'المنوفية', 'المنيا', 'القليوبية', 'الوادي الجديد',
      'الشرقية', 'السويس', 'أسوان', 'أسيوط', 'بني سويف', 'بورسعيد',
      'دمياط', 'الأقصر', 'قنا', 'كفر الشيخ', 'مطروح', 'الوادي الجديد',
      'شمال سيناء', 'جنوب سيناء', 'البحر الأحمر', 'سوهاج'
    ];

    for (const line of lines) {
      if (/[\u0600-\u06FF]/.test(line)) {
        if (!fullName) {
          for (const pattern of namePatterns) {
            const matches = line.match(pattern);
            if (matches) {
              for (const match of matches) {
                const cleanName = match.trim();
                const words = cleanName.split(/\s+/);
                
                if (words.length >= 2 && words.length <= 7 && 
                    cleanName.length >= 6 &&
                    !cleanName.includes('مصر') && 
                    !cleanName.includes('جمهورية') && 
                    !cleanName.includes('محافظة') &&
                    !cleanName.includes('بطاقة') &&
                    !cleanName.includes('العربية') &&
                    !cleanName.includes('العنوان') &&
                    !/\d/.test(cleanName)) {
                  fullName = cleanName;
                  console.log('✅ Found name:', fullName);
                  break;
                }
              }
              if (fullName) break;
            }
          }
        }
        
        if (!address) {
          for (const gov of governorateKeywords) {
            if (line.includes(gov)) {
              const addressLine = line.replace(/محافظة|العنوان|عنوان|:/g, '').trim();
              if (addressLine.length >= 4 && addressLine.length <= 100) {
                address = addressLine;
                console.log('✅ Found address:', address);
                break;
              }
            }
          }
        }
        
        if (fullName && address) break;
      }
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

    console.log('✅ OCR Results:', { nationalId, fullName, address, decodedInfo });

    return {
      nationalId,
      fullName,
      address,
      text: text.substring(0, 500),
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
