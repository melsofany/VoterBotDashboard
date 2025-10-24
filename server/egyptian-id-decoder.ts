export interface DecodedEgyptianID {
  birthDate: string | null;
  governorate: string | null;
  gender: 'male' | 'female' | null;
  isValid: boolean;
  century: string | null;
}

const GOVERNORATES: { [key: string]: string } = {
  '01': 'القاهرة',
  '02': 'الإسكندرية',
  '03': 'بورسعيد',
  '04': 'السويس',
  '11': 'دمياط',
  '12': 'الدقهلية',
  '13': 'الشرقية',
  '14': 'القليوبية',
  '15': 'كفر الشيخ',
  '16': 'الغربية',
  '17': 'المنوفية',
  '18': 'البحيرة',
  '19': 'الإسماعيلية',
  '21': 'الجيزة',
  '22': 'بني سويف',
  '23': 'الفيوم',
  '24': 'المنيا',
  '25': 'أسيوط',
  '26': 'سوهاج',
  '27': 'قنا',
  '28': 'أسوان',
  '29': 'الأقصر',
  '31': 'البحر الأحمر',
  '32': 'الوادي الجديد',
  '33': 'مطروح',
  '34': 'شمال سيناء',
  '35': 'جنوب سيناء',
  '88': 'خارج مصر'
};

export function decodeEgyptianID(nationalId: string): DecodedEgyptianID {
  const result: DecodedEgyptianID = {
    birthDate: null,
    governorate: null,
    gender: null,
    isValid: false,
    century: null
  };

  if (!nationalId || nationalId.length !== 14 || !/^\d{14}$/.test(nationalId)) {
    return result;
  }

  try {
    const centuryDigit = parseInt(nationalId[0]);
    const year = parseInt(nationalId.substring(1, 3));
    const month = parseInt(nationalId.substring(3, 5));
    const day = parseInt(nationalId.substring(5, 7));
    const governorateCode = nationalId.substring(7, 9);
    const genderCode = parseInt(nationalId[12]);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return result;
    }

    let fullYear: number;
    if (centuryDigit === 2) {
      result.century = '1900-1999';
      fullYear = 1900 + year;
    } else if (centuryDigit === 3) {
      result.century = '2000-2099';
      fullYear = 2000 + year;
    } else if (centuryDigit === 1) {
      result.century = '1800-1899';
      fullYear = 1800 + year;
    } else {
      return result;
    }

    const currentYear = new Date().getFullYear();
    if (fullYear < 1900 || fullYear > currentYear) {
      return result;
    }

    result.birthDate = `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    result.gender = genderCode % 2 === 0 ? 'female' : 'male';
    result.governorate = GOVERNORATES[governorateCode] || null;
    result.isValid = true;

    return result;
  } catch (error) {
    console.error('Error decoding Egyptian ID:', error);
    return result;
  }
}

export function getGovernorateFromCode(code: string): string | null {
  return GOVERNORATES[code] || null;
}

export function getAllGovernorates(): string[] {
  return Object.values(GOVERNORATES);
}
