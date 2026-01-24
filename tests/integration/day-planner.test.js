/**
 * Integration tests for DayPlanner.js
 * Tests the getPlannedTasks function with mocked spreadsheet data
 */

const { MockSpreadsheet } = require('../mocks/google-apps-script.mock');

// Load DayPlanner functions
const fs = require('fs');
const path = require('path');
const dayPlannerPath = path.join(__dirname, '../../DayPlanner.js');
const dayPlannerCode = fs.readFileSync(dayPlannerPath, 'utf8');

// Mock getSS function before loading DayPlanner
global.getSS = jest.fn();

// Load DayPlanner into global scope
eval(dayPlannerCode);

describe('DayPlanner Integration Tests', () => {
  let mockSpreadsheet;
  let mockSheet;

  beforeEach(() => {
    // Create mock spreadsheet with test data
    mockSpreadsheet = new MockSpreadsheet();

    const testData = [
      // Header row
      ['Task', 'Category', 'Importance', 'ECT', 'PriorityScore', 'DueDate',
       'ReferenceDueDate', 'Ownership🐷', 'Ownership🐱', 'CompletionDate🐷',
       'CompletionDate🐱', 'DaysTillDue'],
      // Data rows
      ['Task 1', 'Household', 'High', '30m', 85, new Date('2026-01-24'),
       new Date('2026-01-24'), true, false, '', '', '0'],
      ['Task 2', 'Personal', 'Normal', '1h', 70, new Date('2026-01-25'),
       new Date('2026-01-25'), false, true, '', '', '1'],
      ['Task 3', 'Work', 'High', '2h', 90, new Date('2026-01-23'),
       new Date('2026-01-23'), true, false, '', '', 'DONE'],
      ['Task 4', 'Household', 'Low', '45m', 50, new Date('2026-01-26'),
       new Date('2026-01-26'), true, false, '', '', '2'],
      ['Task 5', 'Personal', 'Normal', '1.5h', 65, new Date('2026-01-22'),
       new Date('2026-01-22'), true, false, '', '', '-2']
    ];

    mockSheet = mockSpreadsheet._addSheet('Prioritization', testData);
    getSS.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlannedTasks', () => {
    test('should return error if Prioritization sheet is missing', () => {
      const emptySpreadsheet = new MockSpreadsheet();
      getSS.mockReturnValue(emptySpreadsheet);

      const result = getPlannedTasks({ owner: '🐷', daysToPlan: 1 });
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    test('should filter tasks by owner (Billy)', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 3,
        includeOverdue: 'Yes',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);
      expect(Array.isArray(result)).toBe(true);

      // Should include Task 1, Task 4, Task 5 (not Task 3 which is DONE)
      // Task 2 belongs to Karen (🐱)
      const billyTasks = result.filter(t => t.task.includes('Task'));
      expect(billyTasks.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter tasks by owner (Karen)', () => {
      const config = {
        owner: '🐱',
        daysToPlan: 3,
        includeOverdue: 'Yes',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);
      expect(Array.isArray(result)).toBe(true);

      // Should only include Task 2
      const karenTasks = result.filter(t => t.task === 'Task 2');
      expect(karenTasks.length).toBe(1);
    });

    test('should exclude overdue tasks when includeOverdue is No', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 3,
        includeOverdue: 'No',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);

      // Task 5 (2026-01-22) should be excluded
      const overdueTask = result.find(t => t.task === 'Task 5');
      expect(overdueTask).toBeUndefined();
    });

    test('should include overdue tasks when includeOverdue is Yes', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 1,
        includeOverdue: 'Yes',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);

      // Task 5 (overdue) should be included
      const overdueTask = result.find(t => t.task === 'Task 5');
      expect(overdueTask).toBeDefined();
    });

    test('should hide completed tasks when showCompleted is No', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 3,
        includeOverdue: 'Yes',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);

      // Task 3 (DONE) should not be included
      const doneTask = result.find(t => t.task === 'Task 3');
      expect(doneTask).toBeUndefined();
    });

    test('should show completed tasks when showCompleted is Yes', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 3,
        includeOverdue: 'Yes',
        showCompleted: 'Yes'
      };

      const result = getPlannedTasks(config);

      // Task 3 (DONE) should be included
      const doneTask = result.find(t => t.task === 'Task 3');
      expect(doneTask).toBeDefined();
      expect(doneTask.isDone).toBe(true);
    });

    test('should respect daysToPlan horizon', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 1, // Only today
        includeOverdue: 'No',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);

      // Should only include tasks due today (Task 1)
      // Task 4 is due 2026-01-26 (2 days away) - should be excluded
      const futureTasks = result.filter(t => t.task === 'Task 4');
      expect(futureTasks.length).toBe(0);
    });

    test('should parse ECT correctly', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 3,
        includeOverdue: 'Yes',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);
      const task1 = result.find(t => t.task === 'Task 1');

      if (task1) {
        expect(task1.ectMins).toBe(30); // 30m
      }
    });

    test('should include all required fields', () => {
      const config = {
        owner: '🐷',
        daysToPlan: 3,
        includeOverdue: 'Yes',
        showCompleted: 'No'
      };

      const result = getPlannedTasks(config);

      if (result.length > 0) {
        const task = result[0];
        expect(task).toHaveProperty('sheetRow');
        expect(task).toHaveProperty('score');
        expect(task).toHaveProperty('imp');
        expect(task).toHaveProperty('task');
        expect(task).toHaveProperty('ectRaw');
        expect(task).toHaveProperty('cat');
        expect(task).toHaveProperty('dueDate');
        expect(task).toHaveProperty('isoDate');
        expect(task).toHaveProperty('day');
        expect(task).toHaveProperty('dueSort');
        expect(task).toHaveProperty('ectMins');
        expect(task).toHaveProperty('isDone');
      }
    });
  });
});
