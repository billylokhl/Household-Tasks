/**
 * FILE: DayPlanner.gs
 */
function getPlannedTasks(config) {
  const sheet = getSS().getSheetByName("Prioritization");
  if (!sheet) return { error: "Prioritization sheet not found." };

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1).map((r, i) => ({ data: r, originalRow: i + 2 }));

  const idx = {
    task: headers.indexOf("Task"),
    cat: headers.indexOf("Category"),
    imp: headers.indexOf("Importance"),
    ect: headers.indexOf("ECT"),
    score: headers.indexOf("PriorityScore"),
    due: headers.indexOf("DueDate"),
    ownP: headers.indexOf("Ownership🐷"),
    ownC: headers.indexOf("Ownership🐱"),
    status: headers.indexOf("DaysTillDue")
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonDate = new Date(today);
  horizonDate.setDate(today.getDate() + (parseInt(config.daysToPlan) - 1));
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return rows.filter(item => {
    const row = item.data;
    const userIsOwner = (config.owner === '🐷' && row[idx.ownP] === true) ||
                        (config.owner === '🐱' && row[idx.ownC] === true);
    if (!userIsOwner) return false;

    const isDone = String(row[idx.status]).trim().toUpperCase() === "DONE";
    if (config.showCompleted === "No" && isDone) return false;

    if (!isDone) {
      const rawDue = row[idx.due];
      if (!rawDue) return false;
      const dueDate = new Date(rawDue);
      dueDate.setHours(0, 0, 0, 0);
      const isBeforeToday = dueDate < today;
      if (isBeforeToday && config.includeOverdue === "No") return false;
      if (!isBeforeToday && dueDate > horizonDate) return false;
    }
    return true;
  }).map(item => {
    const row = item.data;
    const d = new Date(row[idx.due]);
    const rawEct = String(row[idx.ect]).toLowerCase();
    const num = parseFloat(rawEct.replace(/[^\d.]/g, '')) || 0;
    const mins = rawEct.includes('h') ? num * 60 : num;

    return {
      sheetRow: item.originalRow,
      score: row[idx.score] || 0,
      imp: row[idx.imp] || "Normal",
      task: row[idx.task] || "Unnamed Task",
      ectRaw: row[idx.ect] || "0 mins",
      cat: row[idx.cat] || "None",
      dueDate: isNaN(d.getTime()) ? "N/A" : Utilities.formatDate(d, Session.getScriptTimeZone(), "M/d"),
      isoDate: isNaN(d.getTime()) ? "" : Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      day: isNaN(d.getTime()) ? "-" : daysOfWeek[d.getDay()],
      dueSort: isNaN(d.getTime()) ? 0 : d.getTime(),
      ectMins: Math.round(mins),
      isDone: String(row[idx.status]).trim().toUpperCase() === "DONE"
    };
  }).sort((a, b) => b.score - a.score);
}

function updatePlannerTask(rowId, field, value) {
  const sheet = getSS().getSheetByName("Prioritization");
  if (!sheet) return { error: "Sheet not found" };

  const headerMap = {
    'due': 'ReferenceDueDate',
    'ect': 'ECT',
    'imp': 'Importance',
    'cat': 'Category'
  };

  const targetHeader = headerMap[field];
  if (!targetHeader) return { error: "Invalid field" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const colIndex = headers.indexOf(targetHeader) + 1;

  if (colIndex < 1) return { error: "Column not found" };

  sheet.getRange(rowId, colIndex).setValue(value);
  return { success: true };
}