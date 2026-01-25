/**
 * Integration tests for AnalyticsService.js
 * Tests time trend and incident trend generation
 */

const { MockSpreadsheet } = require('../mocks/google-apps-script.mock');
const fs = require('fs');
const path = require('path');

// Load AnalyticsService code
const analyticsPath = path.join(__dirname, '../../AnalyticsService.js');
const analyticsCode = fs.readFileSync(analyticsPath, 'utf8');

// Mock global functions
global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn()
};
global.Utilities = {
  formatDate: jest.fn((date, tz, format) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    return `${month}/${day} (${dayName})`;
  }),
  parseDate: jest.fn((dateStr, tz, format) => new Date(dateStr))
};

// Load AnalyticsService into global scope
eval(analyticsCode);

describe('AnalyticsService Integration Tests', () => {
  let mockSpreadsheet;
  let archiveSheet;
  let prioritizationSheet;

  beforeEach(() => {
    mockSpreadsheet = new MockSpreadsheet();
    mockSpreadsheet._setTimeZone('America/New_York');

    // Create archive data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const archiveData = [
      ['Sync Date', 'Task', 'Category', 'ECT', 'Ownership🐷', 'Ownership🐱',
       'CompletionDate', 'IncidentDate', 'IncidentOwner', 'DueDate'],
      [new Date(), 'Task 1', 'Household', '30', true, false, yesterday, '', '', yesterday],
      [new Date(), 'Task 2', 'Work', '60', false, true, yesterday, '', '', yesterday],
      [new Date(), 'Task 3', 'Personal', '45', true, false, today, '', '', today],
      [new Date(), 'Incident Task', 'Household', '90', true, false, yesterday, yesterday, '🐷', yesterday],
      [new Date(), 'Karen Incident', 'Work', '120', false, true, yesterday, yesterday, '🐱', yesterday]
    ];

    // Create prioritization data for today's incomplete tasks
    const prioritizationData = [
      ['Task', 'Category', 'ECT', 'DueDate', 'Ownership🐷', 'Ownership🐱',
       'CompletionDate🐷', 'CompletionDate🐱'],
      ['Task 3', 'Personal', '45', today, true, false, today, ''], // Completed
      ['Incomplete Task', 'Household', '30', today, true, false, '', ''], // Not completed
      ['Task 3 Duplicate', 'Personal', '45', today, false, true, '', ''], // Karen's incomplete version
    ];

    archiveSheet = mockSpreadsheet._addSheet('TaskArchive', archiveData);
    prioritizationSheet = mockSpreadsheet._addSheet('Prioritization', prioritizationData);

    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTimeSpentData', () => {
    test('should return error if archive sheet is missing', () => {
      const emptySpreadsheet = new MockSpreadsheet();
      SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(emptySpreadsheet);

      const result = getTimeSpentData();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Archive missing');
    });

    test('should process archive data and return time trend structure', () => {
      const result = getTimeSpentData(7, false, 0);

      expect(result.error).toBeUndefined();
      expect(result.ownerNames).toEqual(['🐷', '🐱']);
      expect(result.dataA).toBeDefined();
      expect(result.dataB).toBeDefined();
      expect(result.detailsA).toBeDefined();
      expect(result.detailsB).toBeDefined();
      expect(result.catsA).toBeDefined();
      expect(result.catsB).toBeDefined();
    });

    test('should filter data by owner correctly', () => {
      const result = getTimeSpentData(7, false, 0);

      // Check that data arrays have headers
      expect(result.dataA[0]).toBeDefined();
      expect(result.dataB[0]).toBeDefined();

      // Should have 30 days of data + header
      expect(result.dataA.length).toBe(31); // 30 days + header
      expect(result.dataB.length).toBe(31);
    });

    test('should handle weekend-only moving average', () => {
      const result = getTimeSpentData(14, true, 0);

      expect(result.error).toBeUndefined();
      expect(result.dataA).toBeDefined();

      // Check that MA column exists
      const header = result.dataA[0];
      expect(header.some(col =>
        typeof col === 'object' && col.label && col.label.includes('MA')
      )).toBe(true);
    });

    test('should handle future projections with daysAhead', () => {
      const result = getTimeSpentData(7, false, 5);

      expect(result.error).toBeUndefined();

      // Should have 30 past days + 5 future days + header = 36 rows
      expect(result.dataA.length).toBe(36);
      expect(result.dataB.length).toBe(36);
    });

    test('should prevent duplicate tasks for today (completed vs incomplete)', () => {
      const result = getTimeSpentData(7, false, 0);

      expect(result.error).toBeUndefined();

      // Check today's details - should not have duplicate "Task 3"
      const todayLabel = Utilities.formatDate(new Date(), 'America/New_York', 'MM/dd (E)');
      const billyTodayDetails = result.detailsA[`▶ ${todayLabel}`];

      if (billyTodayDetails) {
        // Count how many times "Task 3" appears
        let task3Count = 0;
        Object.values(billyTodayDetails).forEach(tasks => {
          tasks.forEach(t => {
            if (t.task === 'Task 3') task3Count++;
          });
        });

        // Should only appear once (the completed version)
        expect(task3Count).toBeLessThanOrEqual(1);
      }
    });

    test('should calculate categories and group "Other"', () => {
      const result = getTimeSpentData(7, false, 0);

      expect(result.catsA).toBeDefined();
      expect(result.catsB).toBeDefined();
      expect(Array.isArray(result.catsA)).toBe(true);
      expect(Array.isArray(result.catsB)).toBe(true);
    });

    test('should include logs for debugging', () => {
      const result = getTimeSpentData(7, false, 0);

      expect(result.logs).toBeDefined();
      expect(Array.isArray(result.logs)).toBe(true);
      expect(result.logs.length).toBeGreaterThan(0);
    });
  });

  describe('getIncidentTrendData', () => {
    test('should return error if archive sheet is missing', () => {
      const emptySpreadsheet = new MockSpreadsheet();
      SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(emptySpreadsheet);

      const result = getIncidentTrendData();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Archive missing');
    });

    test('should process incident data and return trend structure', () => {
      const result = getIncidentTrendData();

      expect(result.error).toBeUndefined();
      expect(result.pig).toBeDefined();
      expect(result.cat).toBeDefined();
      expect(result.details).toBeDefined();
      expect(result.details.pig).toBeDefined();
      expect(result.details.cat).toBeDefined();
    });

    test('should calculate 14-day rolling sums', () => {
      const result = getIncidentTrendData();

      expect(result.pig.length).toBeGreaterThan(1); // Header + data
      expect(result.cat.length).toBeGreaterThan(1);

      // Check header format
      expect(result.pig[0]).toEqual(['Date', 'Sum']);
      expect(result.cat[0]).toEqual(['Date', 'Sum']);
    });

    test('should separate incidents by owner', () => {
      const result = getIncidentTrendData();

      // Should have at least one incident for each owner
      expect(result.details.pig.length).toBeGreaterThanOrEqual(1);
      expect(result.details.cat.length).toBeGreaterThanOrEqual(1);
    });

    test('should sort incident details by date descending', () => {
      const result = getIncidentTrendData();

      if (result.details.pig.length > 1) {
        for (let i = 0; i < result.details.pig.length - 1; i++) {
          expect(result.details.pig[i].rawDate).toBeGreaterThanOrEqual(
            result.details.pig[i + 1].rawDate
          );
        }
      }
    });
  });
});
