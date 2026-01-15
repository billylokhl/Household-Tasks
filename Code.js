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
 * DATA BRIDGE: Incident Data
 * Logic: Checks red background or "INC" status + owner emojis in notes.
 */
function getIncidentTrendData() {
  const sheet = SS.getSheetByName("TaskHistory");
  if (!sheet) return { error: "TaskHistory sheet not found" };
  const range = sheet.getDataRange();
  const data = range.getValues();
  const backgrounds = range.getBackgrounds();
  const notes = range.getNotes();
  const headers = data[0];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const targetRed = "#ea9999";
  let res = { pig: [["Date", "Incidents"]], cat: [["Date", "Incidents"]], details: { pig: [], cat: [] } };
  let dailyRaw = [];

  for (let col = 2; col < headers.length; col++) {
    let pDay = 0, cDay = 0;
    let dateObj = headers[col];
    if (!(dateObj instanceof Date)) continue;
    let dateStr = (dateObj.getMonth() + 1) + "/" + dateObj.getDate() + " (" + dayNames[dateObj.getDay()] + ")";

    for (let r = 1; r < data.length; r++) {
      if (backgrounds[r][col] === targetRed || data[r][col] === "INC") {
        const ownerNote = notes[r][col] || "";
        const isBilly = ownerNote.includes("🐷");
        const isKaren = ownerNote.includes("🐱");
        let taskDetail = { date: dateStr, cat: data[r][0] || "Misc", task: data[r][1] || "Unnamed" };
        if (isBilly) { pDay++; res.details.pig.push(taskDetail); }
        if (isKaren) { cDay++; res.details.cat.push(taskDetail); }
      }
    }
    dailyRaw.push({ label: dateStr, p: pDay, c: cDay });
  }
  dailyRaw.reverse();
  for (let i = 0; i < dailyRaw.length; i++) {
    let pSum = 0, cSum = 0;
    let start = Math.max(0, i - 13);
    for (let j = start; j <= i; j++) { pSum += dailyRaw[j].p; cSum += dailyRaw[j].c; }
    res.pig.push([dailyRaw[i].label, pSum]);
    res.cat.push([dailyRaw[i].label, cSum]);
  }
  return res;
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
