// Storage interface is not needed since we use Google Sheets
// This file is kept for compatibility with the template structure
export interface IStorage {}

export class MemStorage implements IStorage {
  constructor() {}
}

export const storage = new MemStorage();
