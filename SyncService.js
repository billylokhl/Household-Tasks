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

    // Initial Status Check
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return "Prioritization sheet is empty.";

    // Approximate progress message (limited by GAS client-server model)
    // GAS prevents streaming updates within a single function call easily.
    // However, we can return more descriptive summary at the end.

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

    if (lastRow < 2) return "Prioritization sheet is empty.";

    const fullData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();

    const syncTimestamp = new Date();
    const rowsToAppend = [];
    let scannedCount = 0;

    for (let r = 1; r < fullData.length; r++) {
      scannedCount++;
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

    let statusMsg = `Scanned ${scannedCount} rows. Found ${rowsToAppend.length} completed tasks. `;

    if (rowsToAppend.length > 0) {
      archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);

      // Perform cleanup on Prioritization sheet (delete non-recurring, clear fields on recurring)
      performPrioritizationCleanup(sheet, fullData, colMap, completionMapping, taskMapping);
    }

    const archiveResult = pruneArchiveDuplicatesSafe(archiveSheet);
    return statusMsg + "\n" + archiveResult;

  } catch (e) {
    return "Error: " + e.toString();
  }
}

/**
 * Comprehensive data integrity validation for archive records.
 * Returns an object with validation results.
 */
function validateArchiveRecord(row, headers, rowIndex, tz) {
  const issues = [];
  const findIdx = (term) => headers.findIndex(h => String(h).toLowerCase().replace(/\s/g, '').includes(term.toLowerCase().replace(/\s/g, '')));

  // Map column indices
  const taskIdx = findIdx("task");
  const categoryIdx = findIdx("category");
  const completionIdx = findIdx("completiondate");
  const incidentDateIdx = findIdx("incidentdate");
  const incidentOwnerIdx = findIdx("incidentowner");
  const ectIdx = findIdx("ect");
  const ownership1Idx = headers.findIndex(h => String(h).toLowerCase().includes("ownership") && h.includes("🐷"));
  const ownership2Idx = headers.findIndex(h => String(h).toLowerCase().includes("ownership") && h.includes("🐱"));

  // Helper to safely get cell value
  const getValue = (idx) => (idx !== -1 && idx < row.length) ? row[idx] : "";

  // Helper to parse date
  const parseDate = (val) => {
    if (val instanceof Date) return val;
    if (!val || String(val).trim() === "") return null;
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // 1. Task name required
  const taskName = String(getValue(taskIdx)).trim();
  if (!taskName) {
    issues.push("Missing task name");
  }

  // 2. Category required (critical for analytics)
  const category = String(getValue(categoryIdx)).trim();
  if (!category) {
    issues.push("Missing category");
  }

  // 3. CompletionDate required and valid
  const completionVal = getValue(completionIdx);
  const completionDate = parseDate(completionVal);
  if (!completionDate) {
    issues.push("Missing or invalid CompletionDate");
  } else {
    // 4. CompletionDate not in future
    const now = new Date();
    if (completionDate > now) {
      issues.push(`CompletionDate in future: ${Utilities.formatDate(completionDate, tz, "yyyy-MM-dd")}`);
    }
  }

  // 5. Sync Date integrity (first column)
  const syncDate = parseDate(row[0]);
  if (!syncDate) {
    issues.push("Invalid Sync Date");
  }

  // 6. IncidentDate validation (if present)
  const incidentVal = getValue(incidentDateIdx);
  if (incidentVal && String(incidentVal).trim() !== "") {
    const incidentDate = parseDate(incidentVal);
    if (!incidentDate) {
      issues.push("Invalid IncidentDate format");
    } else if (completionDate && incidentDate > completionDate) {
      issues.push("IncidentDate after CompletionDate");
    }

    // Must have IncidentOwner
    const incidentOwner = String(getValue(incidentOwnerIdx)).trim();
    if (!incidentOwner) {
      issues.push("IncidentDate present but missing IncidentOwner");
    }
  }

  // 7. Owner validation - at least one ownership should be "Yes" or TRUE
  const owner1Val = getValue(ownership1Idx);
  const owner2Val = getValue(ownership2Idx);
  const hasOwner1 = owner1Val === true || String(owner1Val).trim().toLowerCase() === "yes";
  const hasOwner2 = owner2Val === true || String(owner2Val).trim().toLowerCase() === "yes";
  if (!hasOwner1 && !hasOwner2) {
    issues.push("No owner assigned (neither 🐷 nor 🐱)");
  }

  // 8. ECT sanity check (if present)
  const ectVal = getValue(ectIdx);
  if (ectVal && String(ectVal).trim() !== "") {
    try {
      const ectMins = parseTimeValue(ectVal);
      if (ectMins < 0) {
        issues.push("Negative ECT value");
      }
    } catch (e) {
      issues.push(`Invalid ECT format: ${ectVal}`);
    }
  }

  return {
    isValid: issues.length === 0,
    issues: issues,
    taskName: taskName,
    rowIndex: rowIndex
  };
}

/**
 * Removes duplicate entries from the Archive, keeping the most recent version.
 * Includes comprehensive data integrity validation.
 */
function pruneArchiveDuplicatesSafe(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return "Sync complete.";

  const headers = data[0];
  const findIdx = (term) => headers.findIndex(h => String(h).toLowerCase().endsWith(term.toLowerCase()));
  const taskIdx = findIdx("task");

  // Find Completion Date column for Archive cleanup AND deduplication
  const completionIdx = headers.findIndex(h => {
     const n = String(h).toLowerCase().replace(/\s/g, '');
     return n === "completiondate" || n === "completeddate";
  });

  if (taskIdx === -1) return "Sync Complete (Warning: 'Task' column not found for deduplication).";

  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  // COMPREHENSIVE VALIDATION
  const validationIssues = [];
  const invalidRecords = [];

  for (let i = 1; i < data.length; i++) {
    const validation = validateArchiveRecord(data[i], headers, i + 1, tz);
    if (!validation.isValid) {
      invalidRecords.push(validation);
      validationIssues.push(`Row ${validation.rowIndex} [${validation.taskName || "NO TASK"}]: ${validation.issues.join("; ")}`);
    }
  }

  // Alert user if validation issues found (INFORMATIONAL ONLY - NO DELETION)
  let alertMsg = "";
  if (invalidRecords.length > 0) {
    const summary = `⚠️ DATA INTEGRITY ALERT: Found ${invalidRecords.length} record(s) with validation issues in TaskArchive.\n\nPLEASE REVIEW:\n\n${validationIssues.slice(0, 10).join("\n")}`;
    const fullMsg = validationIssues.length > 10 ? summary + `\n\n...and ${validationIssues.length - 10} more issues.` : summary;

    alertMsg = `🔍 Validation: ${invalidRecords.length} issue(s) found (records preserved).\n`;

    SpreadsheetApp.getUi().alert(
      "Archive Data Integrity Alert",
      fullMsg + "\n\nNOTE: Records have been preserved. Please review and fix manually if needed.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  const uniqueMap = new Map();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const taskName = String(row[taskIdx]).trim().toLowerCase();

    // Create a unique key based on Task + CompletionDate
    let completionStr = "";
    if (completionIdx !== -1) {
        let v = row[completionIdx];
        if (v instanceof Date) {
            completionStr = Utilities.formatDate(v, tz, "yyyy-MM-dd");
        } else {
            completionStr = String(v).trim();
        }
    }

    // Deduplication Key (Task + CompletionDate)
    const key = taskName + "|" + completionStr;

    const currentSyncTime = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime();

    // Keep if new, or if this row has a newer Sync Date than what we have stored
    if (!uniqueMap.has(key) || currentSyncTime > uniqueMap.get(key).time) {
      uniqueMap.set(key, { time: currentSyncTime || 0, data: row });
    }
  }

  const finalRows = [headers, ...Array.from(uniqueMap.values()).map(item => item.data)];

  // Write back deduplicated data
  sheet.clearContents();
  sheet.getRange(1, 1, finalRows.length, headers.length).setValues(finalRows);

  const dedupCount = data.length - 1 - (finalRows.length - 1);

  let statusMsg = alertMsg;
  if (dedupCount > 0) {
    statusMsg += `📋 Deduplication: ${dedupCount} duplicate(s) removed.\n`;
  }
  statusMsg += `✅ Sync Complete. ${finalRows.length - 1} records maintained.`;

  return statusMsg;
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

        // CRITICAL UPDATE: Never delete tasks that have an IncidentDate
        const incidentDateVal = incidentDateCol !== -1 ? fullData[r][incidentDateCol - 1] : "";
        const hasIncident = incidentDateVal && String(incidentDateVal).trim() !== "";

        if (hasIncident) {
           // Do nothing - preserve task completely
           continue;
        }

        if (isRecurring) {
           // Recurring: Keep row, strictly clear specific fields as requested
           // 1. Clear specific completion dates (🐱/🐷)
           [completionCatCol, completionPigCol].forEach(col => {
              if (col !== -1) cellsToClear.push(sheet.getRange(rowIndex, col).getA1Notation());
           });
        } else {
           // Non-recurring: Delete row.
           rowsToDelete.push(rowIndex);
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
