/**
 * FILE: RecurringTaskChecker.js
 * Description: Tool to report recurring tasks with weekly+ recurrence that fall on weekdays
 */

/**
 * Opens the UI modal for Weekday Recurring Task Report
 */
function showWeekdayRecurringTasksModal() {
  const html = HtmlService.createHtmlOutputFromFile('WeekdayRecurringTasksUI')
    .setWidth(900)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Weekday Recurring Tasks Report');
}

/**
 * Retrieves recurring tasks with 1 week+ recurrence that fall on weekdays
 * @returns {Object} - Object containing flaggedTasks array and logs
 */
function getWeekdayRecurringTasks() {
  const sheet = getSS().getSheetByName(CONFIG.SHEET.PRIORITIZATION);
  if (!sheet) {
    return { error: "Prioritization sheet not found.", flaggedTasks: [], logs: [] };
  }

  const logs = [];
  logs.push("Starting weekday recurring task scan...");
  logs.push(`Checking sheet: ${CONFIG.SHEET.PRIORITIZATION} only`);

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1);

  // Find column indices
  const idx = {
    task: headers.indexOf("Task"),
    cat: headers.indexOf("Category"),
    due: headers.indexOf("DueDate"),
    recurrence: headers.indexOf("Recurrence"),
    ownP: headers.indexOf("Ownership🐷"),
    ownC: headers.indexOf("Ownership🐱"),
    weekdayOK: headers.indexOf("WeekdayOK")
  };

  logs.push(`Found columns - Task: ${idx.task}, DueDate: ${idx.due}, Recurrence: ${idx.recurrence}`);
  if (idx.weekdayOK !== -1) {
    logs.push(`Whitelist column found: WeekdayOK (tasks marked TRUE will be skipped)`);
  } else {
    logs.push(`No whitelist column found (add 'WeekdayOK' column to whitelist tasks)`);
  }

  if (idx.task === -1 || idx.due === -1 || idx.recurrence === -1) {
    logs.push("ERROR: Required columns not found");
    return { error: "Required columns (Task, DueDate, Recurrence) not found in Prioritization sheet.", flaggedTasks: [], logs };
  }

  const flaggedTasks = [];
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  rows.forEach((row, i) => {
    const taskName = row[idx.task];
    const recurrence = String(row[idx.recurrence] || "").trim();
    const dueDate = safeParseDate(row[idx.due]);

    // Skip if no task name or no recurrence
    if (!taskName || !recurrence) return;

    // Skip if whitelisted (WeekdayOK = TRUE)
    if (idx.weekdayOK !== -1 && row[idx.weekdayOK] === true) {
      return;
    }

    // Check if recurrence is 1 week or longer
    const recLower = recurrence.toLowerCase();
    let isWeeklyOrLonger = false;
    let recurrenceDays = 0;

    // Parse recurrence to determine if it's weekly or longer
    if (recLower.includes('week')) {
      const numMatch = recLower.match(/(\d+)\s*week/);
      const weeks = numMatch ? parseInt(numMatch[1]) : 1;
      recurrenceDays = weeks * 7;
      isWeeklyOrLonger = true;
    } else if (recLower.includes('month')) {
      const numMatch = recLower.match(/(\d+)\s*month/);
      const months = numMatch ? parseInt(numMatch[1]) : 1;
      recurrenceDays = months * 30; // Approximate
      isWeeklyOrLonger = true;
    } else if (recLower.includes('year')) {
      const numMatch = recLower.match(/(\d+)\s*year/);
      const years = numMatch ? parseInt(numMatch[1]) : 1;
      recurrenceDays = years * 365; // Approximate
      isWeeklyOrLonger = true;
    } else if (recLower.includes('day')) {
      const numMatch = recLower.match(/(\d+)\s*day/);
      const days = numMatch ? parseInt(numMatch[1]) : 1;
      recurrenceDays = days;
      if (days >= 7) {
        isWeeklyOrLonger = true;
      }
    }

    // Skip if not weekly or longer
    if (!isWeeklyOrLonger) return;

    // Check if DueDate falls on a weekday
    if (dueDate) {
      const dayOfWeek = dueDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday-Friday

      if (isWeekday) {
        // Determine owner
        let owner = "";
        if (row[idx.ownP] === true && row[idx.ownC] === true) {
          owner = "🐷🐱";
        } else if (row[idx.ownP] === true) {
          owner = "🐷";
        } else if (row[idx.ownC] === true) {
          owner = "🐱";
        } else {
          owner = "-";
        }

        flaggedTasks.push({
          rowNumber: i + 2, // +2 because of header row and 1-indexed
          task: taskName,
          category: row[idx.cat] || "None",
          dueDate: Utilities.formatDate(dueDate, Session.getScriptTimeZone(), "yyyy-MM-dd (E)"),
          dayOfWeek: daysOfWeek[dayOfWeek],
          recurrence: recurrence,
          recurrenceDays: recurrenceDays,
          owner: owner
        });
      }
    }
  });

  logs.push(`Scan complete. Found ${flaggedTasks.length} tasks with weekly+ recurrence on weekdays.`);

  // Sort by due date
  flaggedTasks.sort((a, b) => {
    if (a.dueDate < b.dueDate) return -1;
    if (a.dueDate > b.dueDate) return 1;
    return 0;
  });

  return { flaggedTasks, logs };
}
