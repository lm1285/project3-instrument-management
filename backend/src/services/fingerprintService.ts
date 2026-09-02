import dbConfig from '../config/dbConfig';

class FingerprintService {
  async getByFingerprint(fingerprint: string) {
    const db = dbConfig.getConnection();
    return await db.get('SELECT content FROM excel_fingerprints WHERE fingerprint = ?', [fingerprint]);
  }

  async saveFingerprint(fingerprint: string, content: string) {
    const db = dbConfig.getConnection();
    const now = new Date().toISOString();
    
    // Check if exists
    const existing = await this.getByFingerprint(fingerprint);
    
    if (existing) {
        await db.run('UPDATE excel_fingerprints SET content = ?, created_at = ? WHERE fingerprint = ?', 
            [content, now, fingerprint]);
    } else {
        await db.run('INSERT INTO excel_fingerprints (fingerprint, content, created_at) VALUES (?, ?, ?)', 
            [fingerprint, content, now]);
    }
    return { success: true };
  }
}

export default new FingerprintService();
