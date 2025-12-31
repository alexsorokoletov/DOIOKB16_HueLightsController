const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_BACKUPS = 10;

class BackupManager {
  constructor() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  // Rotate old backups and save new one
  saveBackup(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `keymap-backup-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    const backup = {
      timestamp: new Date().toISOString(),
      ...data
    };

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    console.log(`Backup saved: ${filename}`);

    this.rotateBackups();
    return filepath;
  }

  rotateBackups() {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('keymap-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    while (files.length > MAX_BACKUPS) {
      const toDelete = files.pop();
      fs.unlinkSync(path.join(BACKUP_DIR, toDelete));
      console.log(`Rotated out old backup: ${toDelete}`);
    }
  }

  getLatestBackup() {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('keymap-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    const filepath = path.join(BACKUP_DIR, files[0]);
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  }

  // Session backup for current run
  saveSessionBackup(data) {
    const filepath = path.join(BACKUP_DIR, 'current-session.json');
    const backup = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    return filepath;
  }

  getSessionBackup() {
    const filepath = path.join(BACKUP_DIR, 'current-session.json');
    if (!fs.existsSync(filepath)) return null;
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  }

  clearSessionBackup() {
    const filepath = path.join(BACKUP_DIR, 'current-session.json');
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}

module.exports = { BackupManager };
