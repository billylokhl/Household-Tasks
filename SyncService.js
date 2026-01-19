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
    const syncedRowIndices = []; // Track which rows were synced
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
        syncedRowIndices.push(r); // Track this row index
      }
    }

    let statusMsg = `Scanned ${scannedCount} rows. Found ${rowsToAppend.length} completed tasks. `;

    if (rowsToAppend.length > 0) {
      archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
    }

    // Deduplicate archive
    const archiveResult = pruneArchiveDuplicatesSafe(archiveSheet);

    SpreadsheetApp.flush();

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

    // Parse Sync Date (first column) and get timestamp
    let currentSyncTime = 0;
    const syncVal = row[0];
    if (syncVal instanceof Date) {
      currentSyncTime = syncVal.getTime();
    } else if (syncVal) {
      const parsed = new Date(syncVal);
      currentSyncTime = !isNaN(parsed.getTime()) ? parsed.getTime() : 0;
    }

    // Keep the row with the most recent (latest) Sync Date
    // If this is the first occurrence OR this row has a newer Sync Date, keep it
    if (!uniqueMap.has(key) || currentSyncTime > uniqueMap.get(key).time) {
      uniqueMap.set(key, { time: currentSyncTime, data: row });
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
 * Daily cleanup function to be run on a time-based trigger.
 * Removes completed tasks from Prioritization based on TaskArchive.
 * Run this once daily after midnight.
 */
function runDailyCleanup() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const priSheet = ss.getSheetByName(CONFIG.SHEET.PRIORITIZATION);
    const archiveSheet = ss.getSheetByName(CONFIG.SHEET.ARCHIVE);

    if (!priSheet || !archiveSheet) {
      return "Error: Required sheets not found.";
    }

    const result = performPrioritizationCleanup(priSheet, archiveSheet, ss.getSpreadsheetTimeZone());
    Logger.log("Daily cleanup completed: " + result);
    return result;

  } catch (e) {
    Logger.log("Daily cleanup error: " + e.toString());
    return "Error: " + e.toString();
  }
}

/**
 * Handles cleanup on the Prioritization sheet.
 * Checks TaskArchive to see which completed tasks are already archived,
 * then removes non-recurring tasks or clears completion dates for recurring tasks.
 */
function performPrioritizationCleanup(priSheet, archiveSheet, tz) {
  // Read archive data to build lookup map
  const archiveData = archiveSheet.getDataRange().getValues();
  if (archiveData.length <= 1) return "Cleanup: No archive data to check against.";

  const archiveHeaders = archiveData[0];
  const findArchiveIdx = (term) => archiveHeaders.findIndex(h =>
    String(h).toLowerCase().replace(/\s/g, '').includes(term.toLowerCase().replace(/\s/g, ''))
  );

  const archTaskIdx = archiveHeaders.findIndex(h => String(h).toLowerCase() === "task");
  const archCompletionIdx = findArchiveIdx("completiondate");

  if (archTaskIdx === -1) return "Cleanup: Cannot find Task column in archive.";

  // Build set of archived task+completionDate keys
  const archivedKeys = new Set();
  for (let i = 1; i < archiveData.length; i++) {
    const taskName = String(archiveData[i][archTaskIdx]).trim().toLowerCase();
    let completionStr = "";
    if (archCompletionIdx !== -1) {
      let v = archiveData[i][archCompletionIdx];
      if (v instanceof Date) {
        completionStr = Utilities.formatDate(v, tz, "yyyy-MM-dd");
      } else {
        completionStr = String(v).trim();
      }
    }
    const key = taskName + "|" + completionStr;
    archivedKeys.add(key);
  }

  // Read Prioritization sheet
  const priData = priSheet.getDataRange().getValues();
  if (priData.length <= 1) return "Cleanup: Prioritization sheet is empty.";

  const priHeaders = priData[0];
  const findPriIdx = (term) => priHeaders.findIndex(h =>
    String(h).toLowerCase().replace(/\s/g, '').includes(term.toLowerCase().replace(/\s/g, ''))
  );

  const priTaskIdx = priHeaders.findIndex(h => String(h).toLowerCase() === "task");
  const priCompletionIdx = findPriIdx("completiondate");
  const priRecurrenceIdx = priHeaders.findIndex(h => String(h).toLowerCase() === "recurrence");
  const priIncidentIdx = priHeaders.findIndex(h => String(h).toLowerCase() === "incidentdate");
  const priCompletionCatIdx = findPriIdx("completiondate🐱");
  const priCompletionPigIdx = findPriIdx("completiondate🐷");

  if (priTaskIdx === -1) return "Cleanup: Cannot find Task column in Prioritization.";

  const rowsToDelete = [];
  const cellsToClear = [];

  // Iterate backwards for safe deletion
  for (let r = priData.length - 1; r >= 1; r--) {
    const taskName = String(priData[r][priTaskIdx]).trim().toLowerCase();
    if (!taskName) continue;

    // Get completion date
    let completionStr = "";
    if (priCompletionIdx !== -1) {
      let v = priData[r][priCompletionIdx];
      if (v instanceof Date) {
        completionStr = Utilities.formatDate(v, tz, "yyyy-MM-dd");
      } else {
        completionStr = String(v).trim();
      }
    }

    // Skip if not completed
    if (!completionStr) continue;

    // Check if this task+completion exists in archive
    const key = taskName + "|" + completionStr;
    if (!archivedKeys.has(key)) continue; // Not in archive, skip

    // This task is in archive, decide cleanup action
    const rowIndex = r + 1; // 1-based

    const recurrenceVal = priRecurrenceIdx !== -1 ? priData[r][priRecurrenceIdx] : "";
    const isRecurring = recurrenceVal && String(recurrenceVal).trim() !== "";

    const incidentVal = priIncidentIdx !== -1 ? priData[r][priIncidentIdx] : "";
    const hasIncident = incidentVal && String(incidentVal).trim() !== "";

    if (isRecurring) {
      // Recurring: Clear completion dates (col index is 0-based, need to add 1 for column number)
      if (priCompletionCatIdx !== -1) {
        cellsToClear.push(priSheet.getRange(rowIndex, priCompletionCatIdx + 1).getA1Notation());
      }
      if (priCompletionPigIdx !== -1) {
        cellsToClear.push(priSheet.getRange(rowIndex, priCompletionPigIdx + 1).getA1Notation());
      }
    } else if (!hasIncident) {
      // Non-recurring without incident: Delete
      rowsToDelete.push(rowIndex);
    }
    // Non-recurring with incident: Preserve
  }

  // Batch clear cells
  if (cellsToClear.length > 0) {
    priSheet.getRangeList(cellsToClear).clearContent();
  }

  // Delete rows - clear content first, then delete physical row
  // rowsToDelete is already sorted in descending order
  if (rowsToDelete.length > 0) {
    for (let i = 0; i < rowsToDelete.length; i++) {
      const rowIndex = rowsToDelete[i];
      try {
        // Clear row content first (removes content, formatting, and validation)
        priSheet.getRange(rowIndex, 1, 1, priSheet.getLastColumn()).clear();
        // Delete the physical row
        priSheet.deleteRow(rowIndex);
      } catch (e) {
        Logger.log(`ERROR deleting row ${rowIndex}: ${e.toString()}`);
      }
    }
  }

  SpreadsheetApp.flush();

  return `Cleanup: Cleared ${cellsToClear.length} field(s), deleted ${rowsToDelete.length} row(s).`;
}
