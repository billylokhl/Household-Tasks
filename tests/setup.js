/**
 * Jest Test Setup
 * Loads all source files and mocks into global scope
 */

// Load Google Apps Script mocks
global.SpreadsheetApp = require('./mocks/google-apps-script.mock').SpreadsheetApp;
global.DriveApp = require('./mocks/google-apps-script.mock').DriveApp;
global.Utilities = require('./mocks/google-apps-script.mock').Utilities;
global.Logger = require('./mocks/google-apps-script.mock').Logger;
global.Session = require('./mocks/google-apps-script.mock').Session;

// Load Configuration (must be loaded before other modules that depend on it)
const fs = require('fs');
const path = require('path');

// Helper to load and execute Google Apps Script files
function loadGasModule(filename, returnNames) {
  const filepath = path.join(__dirname, '..', filename);
  const content = fs.readFileSync(filepath, 'utf8');

  // Create a sandbox environment with necessary globals
  const sandbox = {
    console,
    Date,
    String,
    Number,
    parseFloat,
    parseInt,
    isNaN,
    Math,
    Object,
    Array
  };

  // Build return statement for requested names
  const returnStr = returnNames.length > 0
    ? `return { ${returnNames.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(', ')} };`
    : 'return {};';

  // Execute in sandbox
  const func = new Function(...Object.keys(sandbox), content + '\n' + returnStr);
  return func(...Object.values(sandbox));
}

// Load Configuration (only returns CONFIG)
const configModule = loadGasModule('Configuration.js', ['CONFIG']);
global.CONFIG = configModule.CONFIG;

// Load Utilities (returns safeParseDate and parseTimeValue)
const utilsModule = loadGasModule('Utilities.js', ['safeParseDate', 'parseTimeValue']);
global.safeParseDate = utilsModule.safeParseDate;
global.parseTimeValue = utilsModule.parseTimeValue;

// Load Code.js functions
const codeModule = loadGasModule('Code.js', ['getSS', 'onOpen', 'findTaskRowInHistory', 'findDateColInHistory',
  'openPlanner', 'showIncidentTrendModal', 'showTimeTrendModal', 'showWeekdayRecurringTasksModal', 'BACKUP_FOLDER_ID']);
Object.keys(codeModule).forEach(key => {
  if (codeModule[key]) global[key] = codeModule[key];
});

// Load BackupSystem functions
const backupModule = loadGasModule('BackupSystem.js', ['createHourlySnapshot']);
Object.keys(backupModule).forEach(key => {
  if (backupModule[key]) global[key] = backupModule[key];
});
