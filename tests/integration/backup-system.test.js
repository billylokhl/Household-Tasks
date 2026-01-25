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
  openById: jest.fn(),
  getUi: jest.fn(() => ({
    alert: jest.fn(),
    createMenu: jest.fn().mockReturnThis(),
    addItem: jest.fn().mockReturnThis(),
    addToUi: jest.fn()
  }))
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

// Mock getSS function used by BackupSystem
global.getSS = jest.fn();

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
    getSS.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createHourlySnapshot', () => {
    test('should be defined as a function', () => {
      expect(typeof createHourlySnapshot).toBe('function');
    });

    test('should handle errors gracefully', () => {
      // Mock getSS to throw an error
      getSS.mockImplementation(() => {
        throw new Error('Test error');
      });

      // Should not throw when error occurs
      expect(() => createHourlySnapshot()).not.toThrow();
    });

    test('should use BACKUP_FOLDER_ID from CONFIG', () => {
      // Verify the constant is defined and accessible
      expect(BACKUP_FOLDER_ID).toBeDefined();
      expect(typeof BACKUP_FOLDER_ID).toBe('string');
      expect(BACKUP_FOLDER_ID).toBe(CONFIG.BACKUP.FOLDER_ID);
    });
  });
});
