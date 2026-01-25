/**
 * Integration tests for SyncService.js
 * Tests archive synchronization, deduplication, and cleanup
 */

const { MockSpreadsheet } = require('../mocks/google-apps-script.mock');
const fs = require('fs');
const path = require('path');

// Load SyncService code
const syncPath = path.join(__dirname, '../../SyncService.js');
const syncCode = fs.readFileSync(syncPath, 'utf8');

// Mock global functions
global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
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

// Load SyncService into global scope
eval(syncCode);

describe('SyncService Integration Tests', () => {
  let mockSpreadsheet;
  let prioritizationSheet;
  let archiveSheet;

  beforeEach(() => {
    mockSpreadsheet = new MockSpreadsheet();
    mockSpreadsheet._setTimeZone('America/New_York');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prioritization data with completed and incomplete tasks
    const prioritizationData = [
      ['Task', 'Category', 'Importance', 'ECT', 'PriorityScore', 'DueDate',
       'ReferenceDueDate', 'Ownership🐷', 'Ownership🐱', 'CompletionDate🐷',
       'CompletionDate🐱', 'IncidentDate', 'Recurrence'],
      ['Completed Task', 'Household', 'High', '30', 85, today, today, true, false, today, '', '', ''],
      ['Incomplete Task', 'Work', 'Normal', '60', 70, today, today, false, true, '', '', '', ''],
      ['Recurring Task', 'Personal', 'High', '45', 90, today, today, true, false, today, '', '', 'Weekly'],
      ['Incident Task', 'Household', 'Low', '20', 50, today, today, true, false, today, '', today, '']
    ];

    // Archive data (initially empty or with some existing data)
    const archiveData = [
      ['Sync Date', 'Task', 'Category', 'Importance', 'ECT', 'PriorityScore',
       'DueDate', 'ReferenceDueDate', 'Ownership🐷', 'Ownership🐱',
       'CompletionDate🐷', 'CompletionDate🐱', 'IncidentDate', 'Recurrence']
    ];

    prioritizationSheet = mockSpreadsheet._addSheet('Prioritization', prioritizationData);
    archiveSheet = mockSpreadsheet._addSheet('TaskArchive', archiveData);

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeFullServerSync', () => {
    test('should sync completed tasks to archive', () => {
      const result = executeFullServerSync();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Check archive has new entries
      const archiveData = archiveSheet.getDataRange().getValues();
      expect(archiveData.length).toBeGreaterThan(1); // Header + at least one task
    });

    test('should not sync incomplete tasks without completion date', () => {
      executeFullServerSync();

      const archiveData = archiveSheet.getDataRange().getValues();

      // Check that "Incomplete Task" is not in archive
      const incompleteInArchive = archiveData.some(row => row[1] === 'Incomplete Task');
      expect(incompleteInArchive).toBe(false);
    });

    test('should handle schema migration when columns change', () => {
      // Add a task to archive first
      executeFullServerSync();

      // Simulate schema change by adding new column to Prioritization
      const prioData = prioritizationSheet.getDataRange().getValues();
      prioData[0].push('NewColumn');
      prioData.slice(1).forEach(row => row.push('NewValue'));

      // Re-sync should handle schema gracefully
      const result = executeFullServerSync();
      expect(result).not.toContain('ERROR');
    });

    test('should add Sync Date timestamp to archived tasks', () => {
      executeFullServerSync();

      const archiveData = archiveSheet.getDataRange().getValues();
      const headers = archiveData[0];
      const syncDateIdx = headers.indexOf('Sync Date');

      expect(syncDateIdx).toBe(0); // Sync Date should be first column

      // Check that synced tasks have timestamps
      if (archiveData.length > 1) {
        const firstSyncDate = archiveData[1][syncDateIdx];
        expect(firstSyncDate).toBeInstanceOf(Date);
      }
    });
  });

  describe('pruneArchiveDuplicatesSafe', () => {
    test('should remove duplicate tasks keeping most recent sync date', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Add duplicate tasks with different sync dates
      const archiveData = [
        ['Sync Date', 'Task', 'Category', 'ECT', 'CompletionDate🐷'],
        [yesterday, 'Task A', 'Household', '30', today],
        [today, 'Task A', 'Household', '30', today], // Most recent - should keep
        [yesterday, 'Task B', 'Work', '60', today]
      ];

      archiveSheet = mockSpreadsheet._addSheet('TaskArchive', archiveData);

      pruneArchiveDuplicatesSafe(archiveSheet);

      const resultData = archiveSheet.getDataRange().getValues();

      // Should have header + 2 unique tasks
      expect(resultData.length).toBe(3);

      // Task A should only appear once with most recent sync date
      const taskARows = resultData.filter(row => row[1] === 'Task A');
      expect(taskARows.length).toBe(1);
      expect(taskARows[0][0].getTime()).toBe(today.getTime());
    });

    test('should handle duplicate detection with case-insensitive task names', () => {
      const today = new Date();

      const archiveData = [
        ['Sync Date', 'Task', 'Category', 'ECT', 'CompletionDate🐷'],
        [today, 'task a', 'Household', '30', today],
        [today, 'Task A', 'Household', '30', today],
        [today, 'TASK A', 'Household', '30', today]
      ];

      archiveSheet = mockSpreadsheet._addSheet('TaskArchive', archiveData);

      pruneArchiveDuplicatesSafe(archiveSheet);

      const resultData = archiveSheet.getDataRange().getValues();

      // Should keep only one version
      expect(resultData.length).toBe(2); // Header + 1 task
    });
  });

  describe('performPrioritizationCleanup', () => {
    test('should delete non-recurring completed tasks without incidents', () => {
      // First sync to populate archive
      executeFullServerSync();

      // Now cleanup
      performPrioritizationCleanup(
        prioritizationSheet,
        archiveSheet,
        'America/New_York'
      );

      const prioData = prioritizationSheet.getDataRange().getValues();

      // "Completed Task" (non-recurring, no incident) should be deleted
      const completedTaskExists = prioData.some(row => row[0] === 'Completed Task');
      expect(completedTaskExists).toBe(false);
    });

    test('should keep recurring tasks but clear completion dates', () => {
      executeFullServerSync();

      performPrioritizationCleanup(
        prioritizationSheet,
        archiveSheet,
        'America/New_York'
      );

      const prioData = prioritizationSheet.getDataRange().getValues();

      // "Recurring Task" should still exist
      const recurringTask = prioData.find(row => row[0] === 'Recurring Task');
      expect(recurringTask).toBeDefined();

      // But completion dates should be cleared
      const compBillyIdx = prioData[0].indexOf('CompletionDate🐷');
      expect(recurringTask[compBillyIdx]).toBe('');
    });

    test('should never delete tasks with incident dates', () => {
      executeFullServerSync();

      performPrioritizationCleanup(
        prioritizationSheet,
        archiveSheet,
        'America/New_York'
      );

      const prioData = prioritizationSheet.getDataRange().getValues();

      // "Incident Task" should be preserved
      const incidentTask = prioData.find(row => row[0] === 'Incident Task');
      expect(incidentTask).toBeDefined();
    });

    test('should keep incomplete tasks untouched', () => {
      performPrioritizationCleanup(
        prioritizationSheet,
        archiveSheet,
        'America/New_York'
      );

      const prioData = prioritizationSheet.getDataRange().getValues();

      // "Incomplete Task" should remain unchanged
      const incompleteTask = prioData.find(row => row[0] === 'Incomplete Task');
      expect(incompleteTask).toBeDefined();
    });
  });

  describe('runDailyCleanup', () => {
    test('should execute cleanup without errors', () => {
      // Mock console methods
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();

      executeFullServerSync(); // Populate archive first

      expect(() => runDailyCleanup()).not.toThrow();

      consoleLog.mockRestore();
    });
  });
});
