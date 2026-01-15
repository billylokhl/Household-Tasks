/**
 * FILE: Code.gs
 * Version: 30.29 (Menu & Bridge Restore)
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const BACKUP_FOLDER_ID = "1S_HRJlzJ9JPMcD2aamy036FIGb8xxd96";

/**
 * RESTORES MENU: Run this manually if the menu disappears.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚀 Task Tools')
    .addItem('Planner', 'openPlanner')
    .addSeparator()
    .addItem('View Incident Trend', 'showIncidentTrendModal')
    .addItem('View Task Time Trend', 'showTimeTrendModal')
    .addSeparator()
    .addItem('Sync Task Database', 'runUnifiedSync')
    .addSeparator()
    .addItem('Manual Backup', 'createHourlySnapshot')
    .addToUi();
}

/**
 * UI OPENERS
 */
function openPlanner() {
  const html = HtmlService.createHtmlOutputFromFile('DayPlannerUI').setWidth(1000).setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, 'Planner');
}

function showIncidentTrendModal() {
  const html = HtmlService.createHtmlOutputFromFile('IncidentTrendUI').setWidth(1100).setHeight(850);
  SpreadsheetApp.getUi().showModalDialog(html, 'Incident Trends');
}

function showTimeTrendModal() {
  const html = HtmlService.createHtmlOutputFromFile('TimeTrendUI').setWidth(1200).setHeight(850);
  SpreadsheetApp.getUi().showModalDialog(html, 'Task Time Trend');
}

/**
 * HELPERS: Row and Column Finders (Critical for MatrixEngine)
 */
function findTaskRowInHistory(category, taskName) {
  const sheet = SS.getSheetByName("TaskHistory");
  if (!sheet) return null;
  const data = sheet.getRange(1, 2, sheet.getLastRow(), 1).getValues();
  const cleanTask = String(taskName || "").trim().toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === cleanTask) return i + 1;
  }
  return null;
}

function findDateColInHistory(targetDate) {
  const sheet = SS.getSheetByName("TaskHistory");
  if (!sheet) return null;
  const lastCol = Math.max(sheet.getLastColumn(), 3);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const tz = Session.getScriptTimeZone();
  const targetStr = Utilities.formatDate(new Date(targetDate), tz, "yyyy-MM-dd");
  for (let i = 2; i < headers.length; i++) {
    if (headers[i] instanceof Date) {
      if (Utilities.formatDate(headers[i], tz, "yyyy-MM-dd") === targetStr) return i + 1;
    }
  }
  return 3;
}

/**
 * MAINTENANCE
 */
function createHourlySnapshot() {
  try {
    const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
    const fileName = SS.getName() + " [Backup] " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
    DriveApp.getFileById(SS.getId()).makeCopy(fileName, folder);
    SS.toast("Backup Created ✅");
  } catch (e) { SS.toast("Backup Failed"); }
}
