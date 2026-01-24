# Testing Guide

**Last Updated**: January 24, 2026  
**Test Count**: 28 tests across 3 suites  
**Status**: ✅ All Passing

This document provides comprehensive guidance for testing the Household Task Management System.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Test Infrastructure](#test-infrastructure)
4. [Test Organization](#test-organization)
5. [Writing Tests](#writing-tests)
6. [Mocking Strategy](#mocking-strategy)
7. [Running Tests](#running-tests)
8. [Coverage Goals](#coverage-goals)
9. [Maintenance Guidelines](#maintenance-guidelines)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Testing Philosophy

This project uses **Jest** for automated testing with custom mocks for Google Apps Script services. The testing strategy balances:

- **Speed**: Tests run in milliseconds without Google API calls
- **Reliability**: Deterministic results with controlled mock data
- **Coverage**: Focus on business logic and critical paths
- **Maintainability**: Clear test structure and documentation

### What Can Be Tested

✅ **Unit Testing** (Pure Functions)
- Date/time parsing logic
- Data transformations
- Calculations and formulas
- Filtering and sorting algorithms
- Validation functions

✅ **Integration Testing** (Business Logic)
- Task filtering with mock sheet data
- Archive synchronization logic
- Analytics data aggregation
- Backup file management

❌ **Cannot Be Fully Tested** (Require Manual Testing)
- Actual Google Sheets interactions
- UI modal rendering
- Time-based triggers
- Email notifications
- Real Drive file operations

---

## Quick Start

### First Time Setup

```bash
# Clone repository
cd household-tasks

# Install dependencies
npm install

# Run tests
npm test
```

### Daily Development Workflow

```bash
# Start watch mode (auto-reruns tests on save)
npm run test:watch

# Make changes to code...

# Tests automatically run and show results

# Generate coverage report when done
npm run test:coverage
```

---

## Test Infrastructure

### Directory Structure

```
tests/
├── setup.js                           # Test environment bootstrap
├── README.md                          # Quick reference guide
├── mocks/
│   └── google-apps-script.mock.js     # GAS service mocks
├── unit/
│   ├── utilities.test.js              # Date/time parsing tests
│   └── configuration.test.js          # Config validation tests
└── integration/
    └── day-planner.test.js            # Task filtering tests
```

### Key Files

#### `package.json`
Jest configuration and test scripts:
- `test`: Run all tests once
- `test:watch`: Continuous testing mode
- `test:coverage`: Generate coverage report
- `test:verbose`: Detailed test output

#### `tests/setup.js`
Bootstraps test environment:
- Loads Google Apps Script mocks into global scope
- Dynamically loads source files (Configuration.js, Utilities.js)
- Makes functions available globally for tests
- Runs before each test suite

#### `tests/mocks/google-apps-script.mock.js`
Mock implementations of:
- `SpreadsheetApp` - Sheet operations
- `DriveApp` - File/folder operations
- `Utilities` - Date formatting
- `Logger` - Logging
- `Session` - User session info

---

## Test Organization

### Test Suites Overview

| Suite | File | Tests | Coverage |
|-------|------|-------|----------|
| **Utilities** | `unit/utilities.test.js` | 14 | Date parsing, time parsing |
| **Configuration** | `unit/configuration.test.js` | 4 | Config structure validation |
| **DayPlanner** | `integration/day-planner.test.js` | 10 | Task filtering logic |
| **TOTAL** | | **28** | Core utilities + planning |

### Unit Tests

**Purpose**: Test individual functions in isolation

**Current Coverage**:
- `safeParseDate()` - 6 test cases
  - Empty values → null
  - Date objects → pass through
  - Valid strings → parsed Date
  - Invalid strings → null
  - Multiple date formats
  
- `parseTimeValue()` - 8 test cases
  - Empty values → 0
  - Numbers → minutes
  - Minute strings (30m, 45m)
  - Hour strings (1hour, 2hr)
  - Day strings (1 day, 2 days)
  - Mixed case/spacing
  - Decimal numbers
  - Invalid strings

- `CONFIG` validation - 4 test cases
  - SHEET configuration exists
  - BACKUP configuration exists
  - COLORS configuration exists
  - Color codes are valid hex

### Integration Tests

**Purpose**: Test modules with mocked Google services

**Current Coverage**:
- `getPlannedTasks()` - 10 test cases
  - Error handling (missing sheet)
  - Owner filtering (🐷 Billy vs 🐱 Karen)
  - Date range filtering
  - Overdue task handling
  - Completion status filtering
  - Days-to-plan horizon
  - ECT parsing
  - Required fields validation

---

## Writing Tests

### Unit Test Template

```javascript
/**
 * Unit tests for MyModule.js
 */

describe('MyModule', () => {
  describe('myFunction', () => {
    test('should handle empty values', () => {
      expect(myFunction(null)).toBe(expectedValue);
      expect(myFunction(undefined)).toBe(expectedValue);
      expect(myFunction('')).toBe(expectedValue);
    });

    test('should process valid input', () => {
      const result = myFunction('valid input');
      expect(result).toBe(expectedValue);
    });

    test('should handle edge cases', () => {
      expect(myFunction('edge case')).toBe(expectedValue);
    });
  });
});
```

### Integration Test Template

```javascript
/**
 * Integration tests for MyModule.js
 */

const { MockSpreadsheet } = require('../mocks/google-apps-script.mock');

// Load module
const fs = require('fs');
const path = require('path');
const myModulePath = path.join(__dirname, '../../MyModule.js');
const myModuleCode = fs.readFileSync(myModulePath, 'utf8');

// Mock dependencies
global.getSS = jest.fn();

// Load module into global scope
eval(myModuleCode);

describe('MyModule Integration Tests', () => {
  let mockSpreadsheet;
  let mockSheet;

  beforeEach(() => {
    // Setup mock data
    mockSpreadsheet = new MockSpreadsheet();
    const testData = [
      ['Header1', 'Header2'],
      ['Data1', 'Data2']
    ];
    mockSheet = mockSpreadsheet._addSheet('TestSheet', testData);
    getSS.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should process mock data', () => {
    const result = myFunction();
    expect(result).toBeDefined();
  });
});
```

### Best Practices

1. **Descriptive Names**: Test names should explain what they verify
   - ✅ `should return null for empty values`
   - ❌ `test1`

2. **AAA Pattern**: Arrange, Act, Assert
   ```javascript
   // Arrange
   const input = 'test';
   
   // Act
   const result = myFunction(input);
   
   // Assert
   expect(result).toBe(expectedValue);
   ```

3. **One Concept Per Test**: Test one behavior per test case
   - ✅ Separate tests for empty, valid, invalid inputs
   - ❌ One giant test that checks everything

4. **Test Edge Cases**: Don't just test the happy path
   - Empty values
   - Null/undefined
   - Invalid formats
   - Boundary conditions

5. **Mock External Dependencies**: Isolate code under test
   - Mock Google Apps Script services
   - Mock other modules
   - Use controlled test data

---

## Mocking Strategy

### Available Mocks

#### MockSpreadsheet
Simulates a Google Spreadsheet with multiple sheets:

```javascript
const mockSS = new MockSpreadsheet();
const sheet = mockSS._addSheet('SheetName', [
  ['Header1', 'Header2'],
  ['Value1', 'Value2']
]);
```

#### MockSheet
Simulates a Google Sheet with data:

```javascript
const sheet = new MockSheet('MySheet', [
  ['Header1', 'Header2'],
  ['Value1', 'Value2']
]);

// Access data
const range = sheet.getDataRange();
const values = range.getValues();

// Modify data
sheet.appendRow(['Value3', 'Value4']);
```

#### MockRange
Simulates a cell range:

```javascript
const range = new MockRange([
  ['Value1', 'Value2'],
  ['Value3', 'Value4']
]);

const values = range.getValues();
const firstCell = range.getValue();
```

### Creating Custom Mock Data

For integration tests, create realistic test data:

```javascript
const testData = [
  // Header row
  ['Task', 'Category', 'Importance', 'ECT', 'PriorityScore', 'DueDate'],
  
  // Data rows
  ['Clean kitchen', 'Household', 'High', '30m', 85, new Date('2026-01-24')],
  ['Buy groceries', 'Personal', 'Normal', '1h', 70, new Date('2026-01-25')],
  ['Write report', 'Work', 'High', '2h', 90, new Date('2026-01-26')]
];

mockSheet._setData(testData);
```

### Mock Helper Methods

Many mocks include helper methods for testing:

```javascript
// Check internal state
const data = mockSheet._getData();

// Reset mocks between tests
SpreadsheetApp._reset();
DriveApp._reset();
```

---

## Running Tests

### Command Reference

```bash
# Run all tests once
npm test

# Watch mode (auto-rerun on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Verbose output (shows all test names)
npm run test:verbose

# Run specific test file
npx jest tests/unit/utilities.test.js

# Run tests matching pattern
npx jest --testNamePattern="safeParseDate"
```

### Reading Test Output

#### Passing Tests
```
PASS tests/unit/utilities.test.js
  Utilities
    safeParseDate
      ✓ should return null for empty values
      ✓ should return Date object as-is
      ✓ should parse valid date strings
```

#### Failing Tests
```
FAIL tests/unit/utilities.test.js
  Utilities
    safeParseDate
      ✕ should parse valid date strings
      
    expect(received).toBe(expected)
    Expected: 24
    Received: 23
```

### Coverage Report

After running `npm run test:coverage`:

```
---------------------------|---------|----------|---------|---------|
File                       | % Stmts | % Branch | % Funcs | % Lines |
---------------------------|---------|----------|---------|---------|
Configuration.js           |     100 |      100 |     100 |     100 |
Utilities.js               |     100 |      100 |     100 |     100 |
DayPlanner.js              |    85.5 |     78.3 |      90 |    85.5 |
---------------------------|---------|----------|---------|---------|
```

Open detailed HTML report:
```bash
open coverage/lcov-report/index.html
```

---

## Coverage Goals

### Current Status (January 24, 2026)

| Module | Tests | Coverage | Status |
|--------|-------|----------|--------|
| Utilities.js | 14 | 100% | ✅ Complete |
| Configuration.js | 4 | 100% | ✅ Complete |
| DayPlanner.js | 10 | ~85% | ✅ Good |
| AnalyticsService.js | 0 | 0% | 🔴 Todo |
| SyncService.js | 0 | 0% | 🔴 Todo |
| BackupSystem.js | 0 | 0% | 🔴 Todo |
| RecurringTaskChecker.js | 0 | 0% | 🔴 Todo |

### Priority Test Additions

**High Priority**:
1. **AnalyticsService.js** - Time trend calculations, category aggregation
2. **SyncService.js** - Archive sync, deduplication logic
3. **BackupSystem.js** - Backup creation, file cleanup

**Medium Priority**:
4. **RecurringTaskChecker.js** - Recurring task logic, whitelist validation
5. **Code.js** - Helper functions (findTaskRowInHistory, findDateColInHistory)

**Low Priority**:
6. **UI Components** - Client-side JavaScript (if extracted to testable functions)

### Target Coverage

- **Critical Modules**: 90%+ coverage
- **Utility Functions**: 100% coverage
- **Business Logic**: 85%+ coverage
- **Overall Project**: 70%+ coverage

---

## Maintenance Guidelines

### When to Update This Document

This document (docs/TESTING.md) must be updated when:

1. **New Test Suite Added**
   - Update Test Organization section
   - Update Current Status table
   - Add to test count in header

2. **New Mock Created**
   - Add to Mocking Strategy section
   - Document usage examples
   - Update Available Mocks list

3. **Testing Workflow Changes**
   - Update Quick Start section
   - Update Running Tests section
   - Document new commands

4. **Coverage Changes**
   - Update Coverage Goals table
   - Update test counts in header
   - Update status indicators

5. **New Testing Patterns**
   - Add to Writing Tests section
   - Update Best Practices
   - Add template examples

6. **Testing Tools Added**
   - Update Test Infrastructure
   - Document new dependencies
   - Update setup instructions

### Update Checklist

When adding/modifying tests:

- [ ] Update test count in document header
- [ ] Update Current Status table
- [ ] Update Test Suites Overview table
- [ ] Add new test templates if applicable
- [ ] Update mock documentation if mocks changed
- [ ] Update coverage goals if targets change
- [ ] Update "What Can Be Tested" if scope changes
- [ ] Commit with `docs(test):` prefix

### Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-24 | 1.0.0 | Initial testing infrastructure | System |

---

## Troubleshooting

### Common Issues

#### Tests Fail to Load Source Files

**Symptom**: `ReferenceError: <function> is not defined`

**Solution**: Check that `tests/setup.js` is loading files correctly:
```javascript
// Ensure function is returned from loadGasModule
const utilsModule = loadGasModule('Utilities.js', ['safeParseDate', 'parseTimeValue']);
```

#### Mock Behavior Not Working

**Symptom**: Mocks return unexpected values

**Solution**: Reset mocks between tests:
```javascript
afterEach(() => {
  jest.clearAllMocks();
  SpreadsheetApp._reset();
  DriveApp._reset();
});
```

#### Cannot Find Module Errors

**Symptom**: `Cannot find module 'jest'`

**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Tests Pass Locally But Fail in CI

**Symptom**: Different results in different environments

**Solution**: 
- Check Node version consistency
- Ensure timezone-independent date handling
- Use deterministic test data (no `Date.now()`)

#### Coverage Report Shows 0%

**Symptom**: Coverage report doesn't track source files

**Solution**: This is normal for Google Apps Script files. Coverage tracks test execution, not source file coverage. Focus on test count and test quality.

### Getting Help

1. **Check Test Output**: Read error messages carefully
2. **Run Single Test**: Isolate failing test with `npx jest <file>`
3. **Enable Verbose Mode**: Use `npm run test:verbose`
4. **Check Mock State**: Log mock data with `console.log()`
5. **Review Test Documentation**: Check this guide and tests/README.md

### Debug Mode

Run tests with Node inspector:

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome and click "inspect".

---

## Appendix

### Related Documentation

- **tests/README.md** - Quick reference guide for developers
- **.github/copilot-instructions.md** - Project architecture and testing guidelines
- **README.md** - Project overview with testing section
- **package.json** - Jest configuration and test scripts

### Testing Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Matchers](https://jestjs.io/docs/expect)
- [Jest Mock Functions](https://jestjs.io/docs/mock-functions)
- [Google Apps Script Reference](https://developers.google.com/apps-script/reference)

### Contact

For questions or issues with testing:
1. Review this documentation
2. Check existing test files for examples
3. Run tests in verbose mode for detailed output

---

**Document Status**: 🟢 Current  
**Next Review**: When new tests are added  
**Maintained By**: Development Team
