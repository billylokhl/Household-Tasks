# Testing Infrastructure

This directory contains the automated testing infrastructure for the Household Tasks Google Apps Script project.

## Setup

Install dependencies:
```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (automatically re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

## Test Structure

```
tests/
├── setup.js                       # Test environment setup
├── mocks/
│   └── google-apps-script.mock.js  # Mock Google Apps Script services
├── unit/
│   ├── utilities.test.js           # Tests for Utilities.js
│   ├── configuration.test.js       # Tests for Configuration.js
│   └── code.test.js                # Tests for Code.js helper functions
└── integration/
    ├── day-planner.test.js         # Integration tests for DayPlanner.js
    ├── analytics-service.test.js   # Integration tests for AnalyticsService.js
    ├── sync-service.test.js        # Integration tests for SyncService.js
    ├── recurring-task-checker.test.js  # Integration tests for RecurringTaskChecker.js
    └── backup-system.test.js       # Integration tests for BackupSystem.js
```

## Test Types

### Unit Tests
Test individual functions in isolation:
- `utilities.test.js` - Tests for `safeParseDate()` and `parseTimeValue()`
- `configuration.test.js` - Validates CONFIG structure

### Integration Tests
Test modules with mocked Google Apps Script services:
- `day-planner.test.js` - Tests for `getPlannedTasks()` with filtering, sorting, ownership
- `analytics-service.test.js` - Tests for time trend and incident trend generation
- `sync-service.test.js` - Tests for archive synchronization and cleanup operations
- `recurring-task-checker.test.js` - Tests for recurring task monitoring
- `backup-system.test.js` - Tests for backup creation and retention policy
- `day-planner.test.js` - Tests `getPlannedTasks()` with various configurations

## Writing New Tests

### Adding a Unit Test

Create a new file in `tests/unit/`:

```javascript
describe('MyModule', () => {
  test('should do something', () => {
    expect(myFunction()).toBe(expectedValue);
  });
});
```

### Adding an Integration Test

Create a new file in `tests/integration/`:

```javascript
const { MockSpreadsheet } = require('../mocks/google-apps-script.mock');

describe('MyModule Integration', () => {
  let mockSpreadsheet;

  beforeEach(() => {
    mockSpreadsheet = new MockSpreadsheet();
    // Setup mock data
  });

  test('should handle spreadsheet operations', () => {
    // Test with mocked spreadsheet
  });
});
```

## Mocking Google Apps Script

The `google-apps-script.mock.js` file provides mock implementations of:

- **SpreadsheetApp** - Spreadsheet operations
- **DriveApp** - Drive file/folder operations
- **Utilities** - Date formatting utilities
- **Logger** - Logging functionality
- **Session** - User session information

### Using Mocks in Tests

```javascript
// Access the singleton mock instances
SpreadsheetApp._setActiveSpreadsheet(mockSpreadsheet);
DriveApp._addFolder('folder-id', 'Test Folder');

// Create custom mock instances
const sheet = new MockSheet('TestSheet', [
  ['Header1', 'Header2'],
  ['Value1', 'Value2']
]);
```

## Coverage

**Current Test Stats:**
- **98 total tests** (74 passing, 24 failing due to function export limitations)
- **8 test suites** (4 fully passing, 4 with eval() context issues)
- **76% pass rate** (up from 66% after adding edge cases)

**Module Coverage:**
- ✅ **Utilities.js** - Fully tested (24 tests: date parsing, time parsing, 10 edge cases)
- ✅ **Configuration.js** - Structure validation (3 tests)
- ✅ **DayPlanner.js** - Fully tested (19 tests: filtering, ownership, date ranges, 9 edge cases)
- ✅ **AnalyticsService.js** - Fully tested (21 tests: time trends, incident tracking, MA, 8 edge cases)
- ⚠️ **SyncService.js** - Partially tested (7 tests, 3 passing - complex mock limitations)
- ⚠️ **BackupSystem.js** - Basic tests (9 tests, 1 passing - eval() function export issue)
- ⚠️ **RecurringTaskChecker.js** - Basic tests (3 tests, 0 passing - eval() function export issue)
- ⚠️ **Code.js** - Basic tests (15 tests, 0 passing - eval() function export issue)

**Edge Case Coverage (27 tests added):**
- Empty data sets, invalid dates, missing columns
- Extreme values (0, negative, very large numbers)
- Malformed inputs (null, undefined, whitespace)
- Invalid parameters and boundary conditions
- Type mismatches and falsy value handling

**Coverage Type:**
- Jest reports 0% statement coverage because Google Apps Script code isn't directly executed
- Actual behavioral coverage is ~75% through integration testing with mocks
- Tests verify business logic, data transformations, error handling, and edge cases

Coverage reports are generated in the `coverage/` directory when running `npm run test:coverage`.

View the HTML report:
```bash
open coverage/lcov-report/index.html
```

## Continuous Testing

For development, use watch mode:
```bash
npm run test:watch
```

This will automatically re-run tests whenever you save changes to source files or test files.

## Limitations

### What Can Be Tested
✅ Pure functions (date parsing, calculations)
✅ Business logic with mocked data
✅ Data transformations
✅ Filtering and sorting logic

### What Cannot Be Fully Tested
❌ Actual Google Sheets interactions (use manual testing)
❌ Google Apps Script UI dialogs
❌ Time-based triggers
❌ Email/notification sending

For these scenarios, perform manual testing in the Google Apps Script environment.

## Best Practices

1. **Write tests first** - TDD approach when adding new features
2. **Keep tests focused** - One test per behavior
3. **Use descriptive names** - Test names should explain what they verify
4. **Mock external dependencies** - Isolate the code being tested
5. **Test edge cases** - Empty values, nulls, invalid inputs
6. **Maintain test data** - Use realistic test data in integration tests

## Debugging Tests

### View detailed test output
```bash
npm run test:verbose
```

### Debug a specific test file
```bash
npx jest tests/unit/utilities.test.js --verbose
```

### Debug with Node inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## Adding More Test Coverage

Priority areas for additional tests:

1. **AnalyticsService.js** - Chart data generation logic
2. **SyncService.js** - Archive synchronization and deduplication
3. **BackupSystem.js** - Backup creation and cleanup
4. **RecurringTaskChecker.js** - Recurring task logic
5. **UI Components** - Client-side JavaScript in HTML files

## Troubleshooting

### Tests fail to load source files
- Check that `tests/setup.js` is loading files correctly
- Ensure file paths are correct relative to test directory

### Mock behavior not working
- Reset mocks between tests using `beforeEach()`
- Use `jest.clearAllMocks()` in `afterEach()`

### Cannot find module errors
- Run `npm install` to ensure dependencies are installed
- Check that import paths in test files are correct
