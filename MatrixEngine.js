/**
 * FILE: MatrixEngine.gs
 * Version: 77.0 (Force Tooltip Contrast)
 */

/*
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Task Tools')
      .addItem('Sync Task Database', 'runUnifiedSync')
      .addSeparator()
      .addItem('View Incident Trend', 'viewIncidentTrend')
      .addItem('View Task Time Trend', 'viewTimeTrend')
      .addSeparator()
      .addItem('Manual Archive Backup', 'manualBackup')
      .addToUi();
}
*/

/** MODAL TRIGGERS **/
function runUnifiedSync() {
  const html = HtmlService.createHtmlOutputFromFile('StatusSidebar').setWidth(350).setHeight(250);
  SpreadsheetApp.getUi().showModalDialog(html, 'Task Database Sync');
}

/** * MASTER SYNC ENGINE
 * Automatically picks up "CompletionDate" because it scans all Named Ranges.
 */
function executeFullServerSync() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Prioritization");
    const archiveSheet = ss.getSheetByName("TaskArchive") || ss.insertSheet("TaskArchive");

    const namedRanges = ss.getNamedRanges();
    const colMap = [];
    namedRanges.forEach(nr => {
      if (nr.getRange().getSheet().getName() === "Prioritization") {
        const rawName = nr.getName();
        let cleanName = rawName.split('!').pop().replace(/'/g, "");
        colMap.push({ name: cleanName, col: nr.getRange().getColumn() });
      }
    });

    // Explicitly scan headers to catch "CompletionDate" if it's missing from Named Ranges
    const headerRowValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const compDateIdx = headerRowValues.findIndex(h => String(h).toLowerCase().replace(/\s/g, '') === "completiondate");
    if (compDateIdx !== -1) {
       const existing = colMap.find(m => m.col === (compDateIdx + 1));
       if (!existing) {
          colMap.push({ name: "CompletionDate", col: compDateIdx + 1 });
       }
    }

    const taskMapping = colMap.find(m => m.name.toLowerCase() === "task");
    if (!taskMapping) return "Error: Could not find 'Task' Named Range.";

    // Ensure CompletionDate is captured if it exists as a Named Range
    // The previous loop already captures ALL named ranges on "Prioritization", including "CompletionDate".
    // So if "CompletionDate" is a Named Range, it is already in colMap.

    colMap.sort((a, b) => a.col - b.col);
    const sortedKeys = colMap.map(c => c.name);
    // The "Sync Date" is our internal primary key for the archive row
    const headers = ["Sync Date", ...sortedKeys];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return "Prioritization sheet is empty.";
    const fullData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();

    // Set headers in archive
    archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const syncTimestamp = new Date();
    const rowsToAppend = [];

    for (let r = 1; r < fullData.length; r++) {
      const taskVal = fullData[r][taskMapping.col - 1];
      if (taskVal && String(taskVal).trim() !== "") {
        const rowArr = [syncTimestamp];
        colMap.forEach(m => {
          let v = fullData[r][m.col - 1];
          // Format dates for consistency
          if (v instanceof Date) v = Utilities.formatDate(v, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
          rowArr.push(v);
        });
        rowsToAppend.push(rowArr);
      }
    }

    if (rowsToAppend.length > 0) {
      archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
      return pruneArchiveDuplicatesSafe(archiveSheet);
    }
    return "No rows found to sync.";
  } catch (e) {
    return "Error: " + e.toString();
  }
}

function pruneArchiveDuplicatesSafe(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "Sync complete.";
  const headers = data[0];
  const findIdx = (term) => headers.findIndex(h => String(h).toLowerCase().endsWith(term.toLowerCase()));
  const taskIdx = findIdx("task");
  const dueIdx = findIdx("duedate");

  const uniqueMap = new Map();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const key = String(row[taskIdx]).trim().toLowerCase() + "|" + String(row[dueIdx]).trim().toLowerCase();
    const currentSyncTime = row[0] instanceof Date ? row[0].getTime() : 0;
    if (!uniqueMap.has(key) || currentSyncTime > uniqueMap.get(key).time) {
      uniqueMap.set(key, { time: currentSyncTime, data: row });
    }
  }

  const finalRows = [headers, ...Array.from(uniqueMap.values()).map(item => item.data)];
  sheet.clearContents();
  sheet.getRange(1, 1, finalRows.length, headers.length).setValues(finalRows);
  return `Sync Complete. ${finalRows.length - 1} records maintained.`;
}

function viewIncidentTrend() {
  const html = HtmlService.createHtmlOutputFromFile('IncidentTrendUI').setWidth(1200).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Incident Trend Analysis');
}

function viewTimeTrend() {
  const html = HtmlService.createHtmlOutputFromFile('TimeTrendUI').setWidth(1000).setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, 'Task Time Trend');
}

function manualBackup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archive = ss.getSheetByName("TaskArchive");
    if (!archive) return;
    const backupName = "Backup_" + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd_HHmm");
    const backupSheet = ss.insertSheet(backupName);
    archive.getDataRange().copyTo(backupSheet.getRange(1, 1));
  } catch (e) { console.log(e); }
}

/** HELPERS **/
function safeParseDate(val) {
  if (!val || val === "") return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseTimeValue(val) {
  if (!val || val === "") return 0;
  if (typeof val === 'number') return val;
  const str = String(val).toLowerCase().replace(/\s+/g, '');
  const numMatch = str.match(/[\d\.]+/);
  if (!numMatch) return 0;
  const num = parseFloat(numMatch[0]);
  if (str.includes('day')) return num * 480;
  if (str.includes('hour') || str.includes('hr')) return num * 60;
  return num;
}

/** * UPDATED TIME TREND
 * Uses CompletionDate if available, otherwise fallback to Sync Date.
 */
function getTimeSpentData(isDarkMode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archive = ss.getSheetByName("TaskArchive");
    if (!archive) return { error: "No TaskArchive found. Run Sync first." };

    const data = archive.getDataRange().getValues();
    const headers = data[0];
    const getIdx = (t) => headers.findIndex(h => String(h).toLowerCase().split('!').pop().replace(/'/g, "") === t.toLowerCase());

    // Attempt to map new named-range style headers or fallback to old ones
    // Old: OwnershipBilly -> New: Owner contains 'pig' or check specific col?
    // Snippet had: const ownerIdx = getIdx("Owner");
    // Old: const billyIdx = getIdx("OwnershipBilly")

    // If we use the snippet logic strictly:
    let ownerIdx = getIdx("Owner");
    if (ownerIdx === -1) ownerIdx = getIdx("OwnershipBilly"); // Try fallback or maybe Ownership

    // Wait, the snippet "executeFullServerSync" creates headers based on Named Ranges in Prioritization.
    // So "TaskArchive" headers will be "Sync Date", then sorted Named Ranges.
    // If User has Named Range "Owner", then heading is "Owner".
    // If User has "OwnershipBilly" and "OwnershipKaren" separately, we need to handle that.

    // User said "Start from the following version...". The snippet implies we ARE using that version's logic.
    // So let's use the provided getTimeSpentData.

    const timeIdx = getIdx("TimeSpent") !== -1 ? getIdx("TimeSpent") : getIdx("ECT"); // Fallback
    const catIdx = getIdx("Category");
    const compIdx = getIdx("CompletionDate");
    const syncDateIdx = 0;

    let categorySet = new Set();
    for (let i = 1; i < data.length; i++) {
      let c = data[i][catIdx];
      if (c && String(c).trim() !== "") categorySet.add(String(c).trim());
    }
    const categories = Array.from(categorySet).sort();
    if (categories.length === 0) categories.push("Uncategorized");

    const tz = ss.getSpreadsheetTimeZone();
    const timelineLabels = [];
    const timelineData = { pig: {}, cat: {} };

    for (let i = 29; i >= 0; i--) {
      let d = new Date();
      d.setDate(d.getDate() - i);
      let label = Utilities.formatDate(d, tz, "M/d (E)");
      timelineLabels.push(label);
      timelineData.pig[label] = { total: 0 };
      timelineData.cat[label] = { total: 0 };
      categories.forEach(c => { timelineData.pig[label][c] = 0; timelineData.cat[label][c] = 0; });
    }

    let rowsProcessed = 0;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      let rawDate = row[compIdx] !== undefined ? row[compIdx] : row[syncDateIdx];
      let dateObj = (rawDate instanceof Date) ? rawDate : new Date(rawDate);

      if (isNaN(dateObj.getTime())) continue;
      const rowLabel = Utilities.formatDate(dateObj, tz, "M/d (E)");

      if (timelineData.pig[rowLabel]) {
        // Determine Owner.
        // Snippet logic: const ownerKey = String(row[ownerIdx] || "").toLowerCase().includes("cat") ? "cat" : "pig";
        // My Logic: Check available columns/values.

        let isPig = false, isCat = false;

        if (ownerIdx !== -1) {
           const val = String(row[ownerIdx] || "").toLowerCase();
           if (val.includes("cat") || val.includes("karen")) isCat = true;
           else isPig = true; // Default to pig if not cat? Or strict check? Snippet defaults to pig.
        } else {
           // Fallback for old column names
           const bIdx = getIdx("OwnershipBilly");
           const kIdx = getIdx("OwnershipKaren");
           if (bIdx !== -1 && (row[bIdx] === true || String(row[bIdx]).toUpperCase() === "TRUE")) isPig = true;
           if (kIdx !== -1 && (row[kIdx] === true || String(row[kIdx]).toUpperCase() === "TRUE")) isCat = true;
        }

        const cat = String(row[catIdx] || "Uncategorized").trim();
        const mins = parseTimeValue(row[timeIdx]);

        if (mins > 0) {
          if (isPig) {
              timelineData.pig[rowLabel][cat] = (timelineData.pig[rowLabel][cat] || 0) + mins;
              timelineData.pig[rowLabel].total += mins;
          }
           if (isCat) {
              timelineData.cat[rowLabel][cat] = (timelineData.cat[rowLabel][cat] || 0) + mins;
              timelineData.cat[rowLabel].total += mins;
          }
          if (isPig || isCat) rowsProcessed++;
        }
      }
    }

    const results = { pig: [], cat: [] };

    // Helper to build rows for Google Charts
    const buildRows = (ow) => {
        let headerRow = ["Day", ...categories, { type: 'string', role: 'tooltip', p: {html: true} }]; // Added tooltip role back
        let rows = [headerRow];

        const ttBg = isDarkMode ? "#1e293b" : "#ffffff";
        const ttText = isDarkMode ? "#f1f5f9" : "#334155";
        const ttBorder = isDarkMode ? "#334155" : "#cccccc";

        timelineLabels.forEach(label => {
            let chartRow = [label];
            categories.forEach(c => chartRow.push(timelineData[ow][label][c] || 0));

            // Re-create HTML tooltip since TimeTrendUI expects it (isHtml: true)
            let total = timelineData[ow][label].total;
            let tooltip = `<div style="padding:12px; background:${ttBg}; color:${ttText}; border:1px solid ${ttBorder}; font-family:sans-serif; min-width:200px; border-radius:4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);">` +
                          `<table style="width:100%; font-size:12px; border-collapse:collapse;">`;

            // Add breakdown
            categories.forEach(c => {
                 let val = timelineData[ow][label][c];
                 if (val > 0) {
                     tooltip += `<tr><td style="padding:2px 0;">${c}:</td><td style="text-align:right; padding:2px 0 2px 10px;"><b>${val}m</b></td></tr>`;
                 }
            });
            tooltip += `<tr style="border-top:1px solid ${ttBorder};"><td style="padding-top:8px;"><b>TOTAL:</b></td><td style="text-align:right; padding-top:8px;"><b>${total}m</b></td></tr></table></div>`;

            chartRow.push(tooltip);
            rows.push(chartRow);
        });
        return rows;
    };

    // Return format expected by TimeTrendUI.html: { dataA: ..., dataB: ... }
    return {
        dataA: buildRows('pig'),
        dataB: buildRows('cat'),
        ownerNames: ["🐷", "🐱"]
    };

  } catch (e) { return { error: e.toString() }; }
}

/** INCIDENT TREND ENGINE **/
function getIncidentTrendData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archive = ss.getSheetByName("TaskArchive");
    if (!archive) return { error: "Archive missing." };
    const data = archive.getDataRange().getValues();
    const headers = data[0];
    const getIdx = (t) => headers.findIndex(h => String(h).trim().toLowerCase() === t.toLowerCase());
    const taskIdx = getIdx("Task"), catIdx = getIdx("Category"), incDateIdx = getIdx("IncidentDate"), ownerIdx = getIdx("IncidentOwner");
    const tz = ss.getSpreadsheetTimeZone();
    const dailyMap = new Map();
    const dateArray = [];
    for (let i = 59; i >= 0; i--) {
      let d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const key = d.getTime();
      dateArray.push(key);
      dailyMap.set(key, { pig: 0, cat: 0 });
    }
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const incDateObj = safeParseDate(row[incDateIdx]);
      const ownerVal = String(row[ownerIdx] || "");
      if (!incDateObj) continue;
      incDateObj.setHours(0,0,0,0);
      const key = incDateObj.getTime();
      if (dailyMap.has(key)) {
        const bucket = dailyMap.get(key);
        if (ownerVal.includes("🐷")) bucket.pig++;
        else if (ownerVal.includes("🐱")) bucket.cat++;
      }
    }
    const result = { pig: [["Date", "Sum"]], cat: [["Date", "Sum"]], details: { pig: [], cat: [] } };
    for (let i = 30; i < dateArray.length; i++) {
      let rPig = 0, rCat = 0;
      for (let j = 0; j < 14; j++) {
        const b = dailyMap.get(dateArray[i - j]);
        if (b) { rPig += b.pig; rCat += b.cat; }
      }
      const dLabel = Utilities.formatDate(new Date(dateArray[i]), tz, "MM/dd (E)");
      result.pig.push([dLabel, rPig]);
      result.cat.push([dLabel, rCat]);
    }
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30); cutoff.setHours(0,0,0,0);
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const incD = safeParseDate(row[incDateIdx]);
      const ownerVal = String(row[ownerIdx] || "");
      if (incD && incD >= cutoff) {
        const entry = { date: Utilities.formatDate(incD, tz, "MM/dd (E)"), cat: String(row[catIdx] || "N/A"), task: String(row[taskIdx]), rawDate: incD.getTime() };
        if (ownerVal.includes("🐷")) result.details.pig.push(entry);
        if (ownerVal.includes("🐱")) result.details.cat.push(entry);
      }
    }
    result.details.pig.sort((a,b) => b.rawDate - a.rawDate);
    result.details.cat.sort((a,b) => b.rawDate - a.rawDate);
    return result;
  } catch (e) { return { error: e.toString() }; }
}

/** SYNC ENGINE **/
function executeFullServerSync() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Prioritization");
    const archiveSheet = ss.getSheetByName("TaskArchive") || ss.insertSheet("TaskArchive");
    const namedRanges = ss.getNamedRanges();
    const colMap = namedRanges.filter(nr => { try { return nr.getRange().getSheet().getName() === "Prioritization"; } catch(e) { return false; } })
      .map(nr => ({ name: nr.getName().split('!').pop().replace(/'/g, ""), col: nr.getRange().getColumn() }));
    const taskMapping = colMap.find(m => m.name.toLowerCase() === "task");
    colMap.sort((a, b) => a.col - b.col);
    const headers = ["Sync Date", ...colMap.map(c => c.name)];
    archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return "Sheet empty.";
    const fullData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const rowsToAppend = [];
    for (let r = 1; r < fullData.length; r++) {
      if (fullData[r][taskMapping.col - 1]) {
        const rowArr = [new Date()];
        colMap.forEach(m => {
          let v = fullData[r][m.col - 1];
          if (v instanceof Date) v = Utilities.formatDate(v, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
          rowArr.push(v);
        });
        rowsToAppend.push(rowArr);
      }
    }
    if (rowsToAppend.length > 0) {
      archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
      return pruneArchiveDuplicatesSafe(archiveSheet);
    }
    return "Synced.";
  } catch (e) { return "Error: " + e.toString(); }
}

function pruneArchiveDuplicatesSafe(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "Sync complete.";
  const headers = data[0];
  const taskIdx = headers.findIndex(h => String(h).toLowerCase().endsWith("task"));
  const uniqueMap = new Map();
  for (let i = 1; i < data.length; i++) {
    const key = String(data[i][taskIdx]).trim().toLowerCase();
    const time = (data[i][0] instanceof Date) ? data[i][0].getTime() : new Date(data[i][0]).getTime();
    if (!uniqueMap.has(key) || time > uniqueMap.get(key).time) uniqueMap.set(key, { time, data: data[i] });
  }
  const finalRows = [headers, ...Array.from(uniqueMap.values()).map(item => item.data)];
  sheet.clearContents().getRange(1, 1, finalRows.length, headers.length).setValues(finalRows);
  return "Sync Complete.";
}