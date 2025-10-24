export function calculateAge(birthDate: string | Date): number {
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

export function isElderly(birthDate: string | Date, ageThreshold: number = 60): boolean {
  return calculateAge(birthDate) >= ageThreshold;
}

export function getAgeGroup(birthDate: string | Date): string {
  const age = calculateAge(birthDate);
  
  if (age < 18) return 'أقل من 18';
  if (age < 30) return '18-29';
  if (age < 40) return '30-39';
  if (age < 50) return '40-49';
  if (age < 60) return '50-59';
  if (age < 70) return '60-69';
  if (age < 80) return '70-79';
  return '80+';
}
