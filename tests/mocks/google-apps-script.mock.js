/**
 * Mock implementations for Google Apps Script services
 * Used for unit testing without actual Google Sheets access
 */

class MockRange {
  constructor(values = [[]]) {
    this._values = values;
  }

  getValues() {
    return this._values;
  }

  setValues(values) {
    this._values = values;
    return this;
  }

  setValue(value) {
    this._values = [[value]];
    return this;
  }

  getValue() {
    return this._values[0] ? this._values[0][0] : null;
  }

  clear() {
    this._values = [[]];
    return this;
  }

  getRow() {
    return 1;
  }

  getColumn() {
    return 1;
  }

  getNumRows() {
    return this._values.length;
  }

  getNumColumns() {
    return this._values[0] ? this._values[0].length : 0;
  }
}

class MockSheet {
  constructor(name, data = []) {
    this._name = name;
    this._data = data;
  }

  getName() {
    return this._name;
  }

  getDataRange() {
    return new MockRange(this._data);
  }

  getRange(row, col, numRows, numCols) {
    if (arguments.length === 1) {
      // A1 notation or named range
      return new MockRange([[]]);
    }

    numRows = numRows || 1;
    numCols = numCols || 1;

    const values = [];
    for (let r = row - 1; r < row - 1 + numRows; r++) {
      const rowData = [];
      for (let c = col - 1; c < col - 1 + numCols; c++) {
        rowData.push(this._data[r] ? this._data[r][c] : null);
      }
      values.push(rowData);
    }
    return new MockRange(values);
  }

  getLastRow() {
    return this._data.length;
  }

  getLastColumn() {
    return this._data[0] ? this._data[0].length : 0;
  }

  appendRow(rowData) {
    this._data.push(rowData);
    return this;
  }

  insertRowBefore(row) {
    this._data.splice(row - 1, 0, []);
    return this;
  }

  deleteRow(row) {
    this._data.splice(row - 1, 1);
    return this;
  }

  clear() {
    this._data = [];
    return this;
  }

  // Helper method for testing
  _setData(data) {
    this._data = data;
  }

  _getData() {
    return this._data;
  }
}

class MockSpreadsheet {
  constructor(sheets = {}) {
    this._sheets = sheets;
    this._timezone = 'America/Los_Angeles';
  }

  getSheetByName(name) {
    return this._sheets[name] || null;
  }

  getSheets() {
    return Object.values(this._sheets);
  }

  getSpreadsheetTimeZone() {
    return this._timezone;
  }

  getName() {
    return 'Test Spreadsheet';
  }

  getId() {
    return 'test-spreadsheet-id';
  }

  insertSheet(name) {
    const sheet = new MockSheet(name);
    this._sheets[name] = sheet;
    return sheet;
  }

  deleteSheet(sheet) {
    const name = sheet.getName();
    delete this._sheets[name];
  }

  // Helper method for testing
  _addSheet(name, data) {
    this._sheets[name] = new MockSheet(name, data);
    return this._sheets[name];
  }
}

class MockSpreadsheetApp {
  constructor() {
    this._activeSpreadsheet = null;
  }

  getActiveSpreadsheet() {
    if (!this._activeSpreadsheet) {
      this._activeSpreadsheet = new MockSpreadsheet();
    }
    return this._activeSpreadsheet;
  }

  openById(id) {
    return new MockSpreadsheet();
  }

  create(name) {
    return new MockSpreadsheet();
  }

  flush() {
    // No-op in mock
  }

  // Helper method for testing
  _setActiveSpreadsheet(spreadsheet) {
    this._activeSpreadsheet = spreadsheet;
  }

  _reset() {
    this._activeSpreadsheet = null;
  }
}

class MockFile {
  constructor(name, id, created) {
    this._name = name;
    this._id = id;
    this._created = created;
  }

  getName() {
    return this._name;
  }

  getId() {
    return this._id;
  }

  getDateCreated() {
    return this._created;
  }

  setTrashed(trashed) {
    this._trashed = trashed;
  }
}

class MockFolder {
  constructor(name, id) {
    this._name = name;
    this._id = id;
    this._files = [];
  }

  getName() {
    return this._name;
  }

  getId() {
    return this._id;
  }

  getFiles() {
    let index = 0;
    const files = this._files;
    return {
      hasNext: () => index < files.length,
      next: () => files[index++]
    };
  }

  createFile(blob) {
    const file = new MockFile('New File', 'file-' + Date.now(), new Date());
    this._files.push(file);
    return file;
  }

  // Helper method for testing
  _addFile(name, id, created) {
    const file = new MockFile(name, id, created);
    this._files.push(file);
    return file;
  }
}

class MockDriveApp {
  constructor() {
    this._folders = {};
  }

  getFolderById(id) {
    if (!this._folders[id]) {
      this._folders[id] = new MockFolder('Test Folder', id);
    }
    return this._folders[id];
  }

  // Helper method for testing
  _addFolder(id, name) {
    this._folders[id] = new MockFolder(name, id);
    return this._folders[id];
  }

  _reset() {
    this._folders = {};
  }
}

class MockUtilities {
  formatDate(date, timezone, format) {
    if (!date) return '';
    // Simple mock implementation
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    if (format === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
    if (format === 'yyyy-MM-dd_HHmm') return `${year}-${month}-${day}_${hours}${minutes}`;
    if (format.includes('MM/dd')) return `${month}/${day}`;

    return d.toISOString();
  }
}

class MockLogger {
  constructor() {
    this._logs = [];
  }

  log(message) {
    this._logs.push(message);
    console.log('[Logger]', message);
  }

  _getLogs() {
    return this._logs;
  }

  _clear() {
    this._logs = [];
  }
}

class MockSession {
  getActiveUser() {
    return {
      getEmail: () => 'test@example.com'
    };
  }

  getEffectiveUser() {
    return this.getActiveUser();
  }

  getScriptTimeZone() {
    return 'America/Los_Angeles';
  }
}

// Export singleton instances
module.exports = {
  SpreadsheetApp: new MockSpreadsheetApp(),
  DriveApp: new MockDriveApp(),
  Utilities: new MockUtilities(),
  Logger: new MockLogger(),
  Session: new MockSession(),

  // Export classes for creating custom instances in tests
  MockSpreadsheet,
  MockSheet,
  MockRange,
  MockFolder,
  MockFile
};
