import { createWorker } from 'tesseract.js';

export interface OCRResult {
  nationalId: string | null;
  fullName: string | null;
  text: string;
}

export async function extractDataFromIDCard(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    console.log('🔍 Starting OCR processing...');
    
    const worker = await createWorker('ara+eng');
    
    const { data: { text } } = await worker.recognize(imageBuffer);
    
    await worker.terminate();
    
    console.log('📄 OCR Raw Text:', text);

    // Extract National ID (14 digits)
    const nationalIdMatch = text.match(/\b\d{14}\b/);
    const nationalId = nationalIdMatch ? nationalIdMatch[0] : null;

    // Extract name - look for Arabic text patterns
    // This is a basic extraction, might need refinement based on actual ID card format
    const lines = text.split('\n').filter(line => line.trim());
    let fullName: string | null = null;

    // Look for lines with Arabic characters
    for (const line of lines) {
      if (/[\u0600-\u06FF]/.test(line) && line.length > 5) {
        // Skip lines that are mostly numbers or very short
        const arabicWords = line.match(/[\u0600-\u06FF\s]+/g);
        if (arabicWords && arabicWords[0].trim().length > 5) {
          fullName = arabicWords[0].trim();
          break;
        }
      }
    }

    console.log('✅ OCR Results:', { nationalId, fullName });

    return {
      nationalId,
      fullName,
      text: text.substring(0, 500) // Limit text length
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
