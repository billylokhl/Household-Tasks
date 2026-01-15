/**
 * FILE: SyncService.gs
 * Description: Handles synchronization between Prioritization sheet and TaskArchive.
 */

/**
 * UI Trigger for the Sync Modal
 */
function runUnifiedSync() {
  const html = HtmlService.createHtmlOutputFromFile('StatusSidebar').setWidth(350).setHeight(250);
  SpreadsheetApp.getUi().showModalDialog(html, 'Task Database Sync');
}

/**
 * MASTER SYNC ENGINE
 * Scans Named Ranges to map columns and syncs completed tasks to Archive.
 */
function executeFullServerSync() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET.PRIORITIZATION);
    const archiveSheet = ss.getSheetByName(CONFIG.SHEET.ARCHIVE) || ss.insertSheet(CONFIG.SHEET.ARCHIVE);

    const colMap = [];

    // Scan table headers to identify columns
    const headerRowValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    headerRowValues.forEach((header, index) => {
      const hName = String(header).trim();
      if (hName !== "") {
        colMap.push({ name: hName, col: index + 1 });
      }
    });

    const taskMapping = colMap.find(m => m.name.toLowerCase() === "task");
    if (!taskMapping) return "Error: Could not find 'Task' column.";

    // Sort columns by position to ensure clean data read
    colMap.sort((a, b) => a.col - b.col);
    const sortedKeys = colMap.map(c => c.name);

    // The "Sync Date" is our internal primary key for the archive row
    const headers = ["Sync Date", ...sortedKeys];

    // --- SCHEMA MIGRATION: Auto-heal Archive Structure ---
    const archLastCol = archiveSheet.getLastColumn();
    const archLastRow = archiveSheet.getLastRow();

    if (archLastCol > 0) {
      const currentArchHeaders = archiveSheet.getRange(1, 1, 1, archLastCol).getValues()[0].map(h => String(h).trim());
      // Check if schema changed
      if (JSON.stringify(currentArchHeaders) !== JSON.stringify(headers)) {
         const oldHeaderMap = {};
         currentArchHeaders.forEach((h, i) => oldHeaderMap[h] = i);

         if (archLastRow > 1) {
            // Retrieve old data and remap to new columns
            const oldData = archiveSheet.getRange(2, 1, archLastRow - 1, archLastCol).getValues();
            const migratedData = oldData.map(row => {
              return headers.map(targetH => {
                const oldIdx = oldHeaderMap[targetH];
                return (oldIdx !== undefined && oldIdx < row.length) ? row[oldIdx] : "";
              });
            });

            // Write migrated data
            archiveSheet.clearContents();
            archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            if (migratedData.length > 0) {
              archiveSheet.getRange(2, 1, migratedData.length, headers.length).setValues(migratedData);
            }
         } else {
            // Only headers
            archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
         }
      }
    } else {
      // Initialize if empty
      archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    // --- END MIGRATION ---

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return "Prioritization sheet is empty.";

    const fullData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();

    const syncTimestamp = new Date();
    const rowsToAppend = [];

    for (let r = 1; r < fullData.length; r++) {
      const taskVal = fullData[r][taskMapping.col - 1];
      // Only sync rows where "Task" is not empty
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

/**
 * Removes duplicate entries from the Archive, keeping the most recent version.
 */
function pruneArchiveDuplicatesSafe(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "Sync complete.";

  const headers = data[0];
  const findIdx = (term) => headers.findIndex(h => String(h).toLowerCase().endsWith(term.toLowerCase()));
  const taskIdx = findIdx("task");
  const dueIdx = findIdx("duedate");

  if (taskIdx === -1) return "Sync Complete (Warning: 'Task' column not found for deduplication).";

  const uniqueMap = new Map();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Create a unique key based on Task Name + Due Date (if available)
    const taskName = String(row[taskIdx]).trim().toLowerCase();
    const dueDate = dueIdx !== -1 ? String(row[dueIdx]).trim().toLowerCase() : "";
    const key = taskName + "|" + dueDate;

    const currentSyncTime = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime(); // Handle SyncDate

    // Keep if new, or if this row has a newer Sync Date than what we have stored
    if (!uniqueMap.has(key) || currentSyncTime > uniqueMap.get(key).time) {
      uniqueMap.set(key, { time: currentSyncTime || 0, data: row });
    }
  }

  const finalRows = [headers, ...Array.from(uniqueMap.values()).map(item => item.data)];

  // Write back unique data
  sheet.clearContents();
  sheet.getRange(1, 1, finalRows.length, headers.length).setValues(finalRows);

  return `Sync Complete. ${finalRows.length - 1} records maintained.`;
}
