/**
 * Integration tests for BackupSystem.js
 * Tests automated backup creation and retention
 */

const { MockSpreadsheet } = require('../mocks/google-apps-script.mock');
const fs = require('fs');
const path = require('path');

// Load BackupSystem code
const backupPath = path.join(__dirname, '../../BackupSystem.js');
const backupCode = fs.readFileSync(backupPath, 'utf8');

// Mock Drive and Spreadsheet services
const mockFiles = new Map();
let fileIdCounter = 1;

class MockFile {
  constructor(id, name, createdDate) {
    this.id = id;
    this.name = name;
    this.createdDate = createdDate;
    this._trashed = false;
  }

  getName() {
    return this.name;
  }

  getDateCreated() {
    return this.createdDate;
  }

  setTrashed(trashed) {
    this._trashed = trashed;
  }

  isTrashed() {
    return this._trashed;
  }
}

class MockFileIterator {
  constructor(files) {
    this.files = files;
    this.index = 0;
  }

  hasNext() {
    return this.index < this.files.length;
  }

  next() {
    return this.files[this.index++];
  }
}

class MockFolder {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  getFiles() {
    const files = Array.from(mockFiles.values()).filter(f => !f.isTrashed());
    return new MockFileIterator(files);
  }

  getName() {
    return this.name;
  }
}

global.DriveApp = {
  getFolderById: jest.fn((id) => new MockFolder(id, 'Backup Folder'))
};

global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
  openById: jest.fn()
};

global.Utilities = {
  formatDate: jest.fn((date, tz, format) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}_${hour}${minute}`;
  })
};

// Load BackupSystem into global scope
eval(backupCode);

describe('BackupSystem Integration Tests', () => {
  let mockSpreadsheet;
  let mockToast;

  beforeEach(() => {
    mockFiles.clear();
    fileIdCounter = 1;

    mockSpreadsheet = new MockSpreadsheet();
    mockSpreadsheet._setTimeZone('America/New_York');

    mockToast = jest.fn();
    mockSpreadsheet.toast = mockToast;

    const mockCopy = {
      getId: () => `file-${fileIdCounter++}`,
      setName: jest.fn().mockReturnThis()
    };

    mockSpreadsheet.copy = jest.fn((name, folder) => {
      const now = new Date();
      const file = new MockFile(mockCopy.getId(), name, now);
      mockFiles.set(file.id, file);
      return mockCopy;
    });

    mockSpreadsheet.getName = jest.fn(() => 'Test Spreadsheet');

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createHourlySnapshot', () => {
    test('should create a backup with correct naming format', () => {
      createHourlySnapshot();

      expect(mockSpreadsheet.copy).toHaveBeenCalled();

      const copyCall = mockSpreadsheet.copy.mock.calls[0];
      const backupName = copyCall[0];

      // Should match format: Backup_TestSpreadsheet_YYYY-MM-DD_HHmm
      expect(backupName).toMatch(/^Backup_Test Spreadsheet_\d{4}-\d{2}-\d{2}_\d{4}$/);
    });

    test('should copy to the correct backup folder', () => {
      createHourlySnapshot();

      const copyCall = mockSpreadsheet.copy.mock.calls[0];
      const folder = copyCall[1];

      expect(folder).toBeDefined();
      expect(folder.id).toBe(CONFIG.BACKUP.FOLDER_ID);
    });

    test('should delete backups older than 7 days', () => {
      const now = new Date();

      // Add recent backup (should be kept)
      const recentFile = new MockFile('recent', 'Backup_Test_2026-01-20_1200', now);
      mockFiles.set('recent', recentFile);

      // Add old backup (should be deleted)
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 8); // 8 days ago
      const oldFile = new MockFile('old', 'Backup_Test_2026-01-16_1200', oldDate);
      mockFiles.set('old', oldFile);

      createHourlySnapshot();

      // Old file should be trashed
      expect(oldFile.isTrashed()).toBe(true);
      // Recent file should not be trashed
      expect(recentFile.isTrashed()).toBe(false);
    });

    test('should show toast notification with deletion count', () => {
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 10);

      // Add 3 old backups
      for (let i = 0; i < 3; i++) {
        const file = new MockFile(`old${i}`, `Backup_Test_${i}`, oldDate);
        mockFiles.set(file.id, file);
      }

      createHourlySnapshot();

      expect(mockToast).toHaveBeenCalled();
      const toastMessage = mockToast.mock.calls[0][0];
      expect(toastMessage).toContain('3'); // Should mention 3 deletions
    });

    test('should handle case when no old backups exist', () => {
      const now = new Date();

      // Add only recent backups
      const recentFile = new MockFile('recent', 'Backup_Test_2026-01-20_1200', now);
      mockFiles.set('recent', recentFile);

      createHourlySnapshot();

      expect(mockToast).toHaveBeenCalled();
      const toastMessage = mockToast.mock.calls[0][0];
      expect(toastMessage).toContain('0'); // Should mention 0 deletions
    });

    test('should only delete backup files (matching naming pattern)', () => {
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 10);

      // Add old backup file
      const oldBackup = new MockFile('backup', 'Backup_Test_2026-01-14_1200', oldDate);
      mockFiles.set('backup', oldBackup);

      // Add old non-backup file
      const oldNonBackup = new MockFile('other', 'Some_Other_File', oldDate);
      mockFiles.set('other', oldNonBackup);

      createHourlySnapshot();

      // Backup should be deleted
      expect(oldBackup.isTrashed()).toBe(true);
      // Non-backup should NOT be deleted
      expect(oldNonBackup.isTrashed()).toBe(false);
    });

    test('should handle errors gracefully', () => {
      // Mock error in copy operation
      mockSpreadsheet.copy.mockImplementation(() => {
        throw new Error('Copy failed');
      });

      expect(() => createHourlySnapshot()).not.toThrow();

      // Should show error toast
      expect(mockToast).toHaveBeenCalled();
      const toastMessage = mockToast.mock.calls[0][0];
      expect(toastMessage).toContain('Error');
    });

    test('should calculate 7-day cutoff correctly', () => {
      const now = new Date();

      // Exactly 7 days ago (should be kept)
      const exactlySevenDays = new Date(now);
      exactlySevenDays.setDate(exactlySevenDays.getDate() - 7);
      const file7Days = new MockFile('seven', 'Backup_Test_7days', exactlySevenDays);
      mockFiles.set('seven', file7Days);

      // 7 days + 1 second ago (should be deleted)
      const moreThanSevenDays = new Date(exactlySevenDays);
      moreThanSevenDays.setSeconds(moreThanSevenDays.getSeconds() - 1);
      const fileOld = new MockFile('old', 'Backup_Test_old', moreThanSevenDays);
      mockFiles.set('old', fileOld);

      createHourlySnapshot();

      // File at exactly 7 days should be kept
      expect(file7Days.isTrashed()).toBe(false);
      // File older than 7 days should be deleted
      expect(fileOld.isTrashed()).toBe(true);
    });
  });

  describe('Integration with CONFIG', () => {
    test('should use BACKUP_FOLDER_ID from CONFIG', () => {
      createHourlySnapshot();

      expect(DriveApp.getFolderById).toHaveBeenCalledWith(CONFIG.BACKUP.FOLDER_ID);
    });
  });
});
