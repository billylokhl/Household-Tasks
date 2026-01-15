/**
 * FILE: Automation.gs
 * Helper functions for text formatting.
 */

function handleTextFormatting(range, headerName, value) {
  if (!value) return;

  // 1. ECT AUTO-CONVERSION (e.g., "5h" -> "5 hours")
  if (headerName === "ECT") {
    const ectRegex = /^(\d*\.?\d+)\s*([a-z]*)$/i;
    const matches = value.toString().match(ectRegex);
    if (matches) {
      let num = parseFloat(matches[1]);
      let unit = matches[2].toLowerCase();
      if (unit === "") range.setValue(`${num} mins`);
      else {
        const unitMap = {"h":"hours","hr":"hours","hrs":"hours","m":"mins","min":"mins","mins":"mins"};
        if (unitMap[unit]) range.setValue(`${num} ${unitMap[unit]}`);
      }
    }
  }

  // 2. RECURRENCE AUTO-FORMATTING (e.g., "8" -> "8 week")
  if (headerName === "Recurrence") {
    let cleaned = value.toString().toLowerCase().trim();
    if (!isNaN(cleaned) && cleaned !== "") {
      range.setValue(`${cleaned} week`);
    } else {
      const recRegex = /^\d+\s*(day|week|month|year)s?$/i;
      if (!recRegex.test(cleaned)) range.setBackground("#f4cccc");
      else range.setBackground(null);
    }
  }
}