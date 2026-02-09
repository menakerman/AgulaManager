import fs from 'fs';
import path from 'path';
import { getDatabase } from '../db/database';

class BackupService {
  private intervalId: NodeJS.Timeout | null = null;
  private backupDir: string;

  constructor() {
    this.backupDir = path.join(__dirname, '..', '..', 'data', 'backups');
  }

  start(intervalMinutes: number = 30): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // Backup immediately on start
    this.backup();

    // Then backup at interval
    this.intervalId = setInterval(() => {
      this.backup();
    }, intervalMinutes * 60 * 1000);

    console.log(`Backup service started (every ${intervalMinutes} min)`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  backup(): void {
    try {
      const db = getDatabase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `agula-backup-${timestamp}.db`);

      db.backup(backupPath).then(() => {
        console.log(`Database backed up to ${backupPath}`);
        this.cleanOldBackups();
      }).catch((err: Error) => {
        console.error('Backup failed:', err);
      });
    } catch (err) {
      console.error('Backup error:', err);
    }
  }

  private cleanOldBackups(): void {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('agula-backup-'))
        .sort()
        .reverse();

      // Keep last 10 backups
      const toDelete = files.slice(10);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(this.backupDir, file));
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  }
}

export const backupService = new BackupService();
