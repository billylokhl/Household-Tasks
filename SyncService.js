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

    // Find Completion Date column for filtering
    const completionMapping = colMap.find(m => {
      const n = m.name.toLowerCase().replace(/\s/g, '');
      return n === "completiondate" || n === "completeddate";
    });

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

      const completionVal = completionMapping ? fullData[r][completionMapping.col - 1] : "";
      const isCompleted = completionMapping ? (completionVal && String(completionVal).trim() !== "") : true;

      // Only sync rows where "Task" is not empty AND "CompletionDate" is not empty
      if (taskVal && String(taskVal).trim() !== "" && isCompleted) {
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

      // Perform cleanup on Prioritization sheet (delete non-recurring, clear fields on recurring)
      performPrioritizationCleanup(sheet, fullData, colMap, completionMapping, taskMapping);

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

  // Find Completion Date column for Archive cleanup
  const completionIdx = headers.findIndex(h => {
     const n = String(h).toLowerCase().replace(/\s/g, '');
     return n === "completiondate" || n === "completeddate";
  });

  if (taskIdx === -1) return "Sync Complete (Warning: 'Task' column not found for deduplication).";

  const uniqueMap = new Map();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Create a unique key based on Task Name + Due Date (if available)
    const taskName = String(row[taskIdx]).trim().toLowerCase();
    const dueDate = dueIdx !== -1 ? String(row[dueIdx]).trim().toLowerCase() : "";
    const key = taskName + "|" + dueDate;

    const currentSyncTime = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime(); // Handle SyncDate

    // Check completion date for Archive cleanup
    const hasCompletionDate = completionIdx !== -1 ? (row[completionIdx] && String(row[completionIdx]).trim() !== "") : true;

    // Keep if new, or if this row has a newer Sync Date than what we have stored
    // AND it has a completion date (if the column exists)
    if (hasCompletionDate && (!uniqueMap.has(key) || currentSyncTime > uniqueMap.get(key).time)) {
      uniqueMap.set(key, { time: currentSyncTime || 0, data: row });
    }
  }

  const finalRows = [headers, ...Array.from(uniqueMap.values()).map(item => item.data)];

  // Write back unique data
  sheet.clearContents();
  sheet.getRange(1, 1, finalRows.length, headers.length).setValues(finalRows);

  return `Sync Complete. ${finalRows.length - 1} records maintained.`;
}

/**
 * Handles post-sync cleanup on the Prioritization sheet.
 * - Clears Incident fields for all synced tasks.
 * - Deletes synced tasks if they are non-recurring.
 * - Clears specific completion dates (🐱/🐷) for recurring tasks.
 */
function performPrioritizationCleanup(sheet, fullData, colMap, completionMapping, taskMapping) {
  const getColIndex = (name) => {
    const m = colMap.find(c => c.name.toLowerCase() === name.toLowerCase());
    return m ? m.col : -1;
  };

  const incidentDateCol = getColIndex("IncidentDate");
  const incidentOwnerCol = getColIndex("IncidentOwner");
  const incidentDetailsCol = getColIndex("IncidentDetails");
  const recurrenceCol = getColIndex("Recurrence");
  const completionCatCol = getColIndex("CompletionDate🐱");
  const completionPigCol = getColIndex("CompletionDate🐷");

  const rowsToDelete = [];
  const cellsToClear = [];

  // Iterate backwards to safe-guard row indices for deletion
  for (let r = fullData.length - 1; r >= 1; r--) {
     const taskVal = fullData[r][taskMapping.col - 1];
     const completionVal = completionMapping ? fullData[r][completionMapping.col - 1] : "";
     const isCompleted = completionMapping ? (completionVal && String(completionVal).trim() !== "") : true;

     // Identify if this row was synced
     if (taskVal && String(taskVal).trim() !== "" && isCompleted) {
        const rowIndex = r + 1; // 1-based index

        const recurrenceVal = recurrenceCol !== -1 ? fullData[r][recurrenceCol - 1] : "";
        const isRecurring = recurrenceVal && String(recurrenceVal).trim() !== "";

        if (!isRecurring) {
           // Non-recurring: Delete row. No need to clear cells as the row is gone.
           rowsToDelete.push(rowIndex);
        } else {
           // Recurring: Keep row, but clear specific fields

           // 1. Clear Incident Fields
           [incidentDateCol, incidentOwnerCol, incidentDetailsCol].forEach(col => {
              if (col !== -1) cellsToClear.push(sheet.getRange(rowIndex, col).getA1Notation());
           });

           // 2. Clear specific completion dates
           [completionCatCol, completionPigCol].forEach(col => {
              if (col !== -1) cellsToClear.push(sheet.getRange(rowIndex, col).getA1Notation());
           });
        }
     }
  }

  // Batch clear cells
  if (cellsToClear.length > 0) {
     sheet.getRangeList(cellsToClear).clearContent();
  }

  // Delete rows (Delete from bottom up to avoid index shifts)
  // rowsToDelete was populated by iterating backwards, so it is already sorted Descending.
  rowsToDelete.forEach(rowIndex => {
     sheet.deleteRow(rowIndex);
  });
}
