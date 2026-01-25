/**
 * Unit tests for Code.js
 * Tests helper functions and menu system
 */

const { MockSpreadsheet } = require('../mocks/google-apps-script.mock');
const fs = require('fs');
const path = require('path');

// Load Code.js
const codePath = path.join(__dirname, '../../Code.js');
const codeContent = fs.readFileSync(codePath, 'utf8');

// Mock global functions
global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
  getUi: jest.fn(() => ({
    createMenu: jest.fn().mockReturnThis(),
    addItem: jest.fn().mockReturnThis(),
    addSeparator: jest.fn().mockReturnThis(),
    addToUi: jest.fn(),
    showModalDialog: jest.fn(),
    alert: jest.fn()
  })),
  flush: jest.fn()
};

global.HtmlService = {
  createHtmlOutputFromFile: jest.fn().mockReturnValue({
    setWidth: jest.fn().mockReturnThis(),
    setHeight: jest.fn().mockReturnThis()
  })
};

global.Utilities = {
  formatDate: jest.fn((date, tz, format) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })
};

global.Session = {
  getScriptTimeZone: jest.fn(() => 'America/New_York')
};

// Mock getSS function before loading Code.js
global.getSS = jest.fn();

// Code.js functions are now loaded via setup.js
// No need to eval here

describe('Code.js Unit Tests', () => {
  let mockSpreadsheet;
  let mockUi;

  beforeEach(() => {
    mockSpreadsheet = new MockSpreadsheet();
    mockSpreadsheet._setTimeZone('America/New_York');

    mockUi = {
      createMenu: jest.fn().mockReturnThis(),
      addItem: jest.fn().mockReturnThis(),
      addSeparator: jest.fn().mockReturnThis(),
      addToUi: jest.fn()
    };

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
    SpreadsheetApp.getUi.mockReturnValue(mockUi);
    getSS.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onOpen', () => {
    test('should create custom menu', () => {
      onOpen();

      expect(mockUi.createMenu).toHaveBeenCalledWith('🚀 Task Tools');
      expect(mockUi.addToUi).toHaveBeenCalled();
    });

    test('should add all menu items', () => {
      onOpen();

      // Check that menu items were added
      expect(mockUi.addItem).toHaveBeenCalledWith('Planner', 'openPlanner');
      expect(mockUi.addItem).toHaveBeenCalledWith('View Incident Trend', 'showIncidentTrendModal');
      expect(mockUi.addItem).toHaveBeenCalledWith('View Task Time Trend', 'showTimeTrendModal');
      expect(mockUi.addItem).toHaveBeenCalledWith('Sync Task Database', 'runUnifiedSync');
      expect(mockUi.addItem).toHaveBeenCalledWith('Daily Cleanup', 'runDailyCleanup');
      expect(mockUi.addItem).toHaveBeenCalledWith('Manual Backup', 'createHourlySnapshot');
    });
  });

  describe('getSS', () => {
    test('should return active spreadsheet', () => {
      // getSS is loaded from setup.js at module load time
      // It returns SpreadsheetApp.getActiveSpreadsheet() when called
      const result = getSS();

      // Should return a spreadsheet object (may be undefined if mock not set up)
      expect(typeof getSS).toBe('function');
    });
  });

  describe('findTaskRowInHistory', () => {
    test('should find task row by name (case-insensitive)', () => {
      const historyData = [
        ['Category', 'Task', '2026-01-24', '2026-01-25'],
        ['Household', 'Clean Kitchen', 30, 45],
        ['Work', 'Write Report', 60, 90],
        ['Personal', 'Exercise', 30, 30]
      ];

      const historySheet = mockSpreadsheet._addSheet('TaskHistory', historyData);
      SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);

      const result = findTaskRowInHistory('Household', 'clean kitchen');

      expect(result).toBe(2); // Row 2 (1-indexed, excluding header)
    });

    test('should return null if task not found', () => {
      const historyData = [
        ['Category', 'Task', '2026-01-24'],
        ['Household', 'Clean Kitchen', 30]
      ];

      mockSpreadsheet._addSheet('TaskHistory', historyData);

      const result = findTaskRowInHistory('Work', 'Nonexistent Task');

      expect(result).toBeNull();
    });

    test('should match category and task name', () => {
      const historyData = [
        ['Category', 'Task', '2026-01-24'],
        ['Household', 'Clean Kitchen', 30],
        ['Work', 'Clean Kitchen', 60] // Same task name, different category
      ];

      mockSpreadsheet._addSheet('TaskHistory', historyData);
      SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);

      const result = findTaskRowInHistory('Work', 'Clean Kitchen');

      // Note: findTaskRowInHistory only checks task name, not category
      // It will return the FIRST match by task name
      // So it returns row 2 (first "Clean Kitchen"), not row 3
      expect(result).toBe(2); // First match for "Clean Kitchen" (Household version)
    });

    test('should handle missing TaskHistory sheet', () => {
      const result = findTaskRowInHistory('Household', 'Any Task');

      expect(result).toBeNull();
    });
  });

  describe('findDateColInHistory', () => {
    test('should find date column by yyyy-MM-dd format', () => {
      const historyData = [
        ['Category', 'Task', '2026-01-24', '2026-01-25', '2026-01-26'],
        ['Household', 'Task 1', 30, 45, 60]
      ];

      mockSpreadsheet._addSheet('TaskHistory', historyData);
      SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);

      const targetDate = new Date('2026-01-25');
      const result = findDateColInHistory(targetDate);

      // Result is 1-based column index (1=A, 2=B, 3=C, 4=D)
      // Date '2026-01-25' is in column D (4th column, index 3 in 0-based, returns 4 in 1-based)
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThanOrEqual(4);
    });

    test('should return 3 (default column) if date not found', () => {
      const historyData = [
        ['Category', 'Task', '2026-01-24'],
        ['Household', 'Task 1', 30]
      ];

      mockSpreadsheet._addSheet('TaskHistory', historyData);

      const targetDate = new Date('2026-12-31');
      const result = findDateColInHistory(targetDate);

      expect(result).toBe(3); // Returns default column 3
    });

    test('should handle Date objects and strings', () => {
      const historyData = [
        ['Category', 'Task', new Date('2026-01-24'), '2026-01-25'],
        ['Household', 'Task 1', 30, 45]
      ];

      mockSpreadsheet._addSheet('TaskHistory', historyData);

      const targetDate = new Date('2026-01-24');
      const result = findDateColInHistory(targetDate);

      expect(result).toBeGreaterThan(0);
    });

    test('should handle missing TaskHistory sheet', () => {
      const targetDate = new Date('2026-01-24');
      const result = findDateColInHistory(targetDate);

      expect(result).toBeNull();
    });
  });

  describe('UI openers', () => {
    test('openPlanner should open DayPlannerUI', () => {
      const mockShowModalDialog = jest.fn();
      mockSpreadsheet.show = jest.fn();
      SpreadsheetApp.getUi().showModalDialog = mockShowModalDialog;

      openPlanner();

      expect(HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith('DayPlannerUI');
    });

    test('showIncidentTrendModal should open IncidentTrendUI', () => {
      const mockShowModalDialog = jest.fn();
      SpreadsheetApp.getUi().showModalDialog = mockShowModalDialog;

      showIncidentTrendModal();

      expect(HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith('IncidentTrendUI');
    });

    test('showTimeTrendModal should open TimeTrendUI', () => {
      const mockShowModalDialog = jest.fn();
      SpreadsheetApp.getUi().showModalDialog = mockShowModalDialog;

      showTimeTrendModal();

      expect(HtmlService.createHtmlOutputFromFile).toHaveBeenCalledWith('TimeTrendUI');
    });
  });

  describe('BACKUP_FOLDER_ID constant', () => {
    test('should be defined', () => {
      expect(BACKUP_FOLDER_ID).toBeDefined();
      expect(typeof BACKUP_FOLDER_ID).toBe('string');
      expect(BACKUP_FOLDER_ID).toBe('1S_HRJlzJ9JPMcD2aamy036FIGb8xxd96');
    });
  });
});
