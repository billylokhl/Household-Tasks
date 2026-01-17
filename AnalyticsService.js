/**
 * FILE: AnalyticsService.gs
 * Description: Logic for Time Trends and Incident Trends.
 */

/**
 * TIME TREND ENGINE
 * Generates data for the Time Trend Chart.
 */
function getTimeSpentData(isDarkMode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archive = ss.getSheetByName(CONFIG.SHEET.ARCHIVE);
    if (!archive) return { error: "Archive missing. Please run Sync first." };

    const data = archive.getDataRange().getValues();
    const headers = data[0];
    const getIdx = (t) => headers.findIndex(h => String(h).toLowerCase() === t.toLowerCase());

    let billyIdx = getIdx("OwnershipBilly");
    if (billyIdx === -1) billyIdx = getIdx("Ownership🐷");

    let karenIdx = getIdx("OwnershipKaren");
    if (karenIdx === -1) karenIdx = getIdx("Ownership🐱");

    let ectIdx = getIdx("ECT");
    if (ectIdx === -1) ectIdx = getIdx("TimeSpent"); // Fallback

    const catIdx = getIdx("Category");
    let compIdx = getIdx("CompletionDate");
    if (compIdx === -1) compIdx = getIdx("Sync Date");
    if (compIdx === -1) compIdx = getIdx("SyncDate");

    // 1. Calculate Totals for Top Categories
    const catTotals = {};
    for (let i = 1; i < data.length; i++) {
      const c = String(data[i][catIdx] || "Uncategorized").trim();
      catTotals[c] = (catTotals[c] || 0) + parseTimeValue(data[i][ectIdx]);
    }
    const sortedCats = Object.keys(catTotals).sort((a,b) => catTotals[b] - catTotals[a]);
    const topCats = sortedCats.slice(0, 10);
    const finalCategories = sortedCats.length > 10 ? [...topCats, "Other"] : topCats;

    const tz = ss.getSpreadsheetTimeZone();
    const timelineLabels = [];
    const timelineData = { Billy: {}, Karen: {} };

    // 2. Initialize Last 30 Days
    for (let i = 29; i >= 0; i--) {
      let d = new Date(); d.setDate(d.getDate() - i);
      let label = Utilities.formatDate(d, tz, "MM/dd (E)");
      timelineLabels.push(label);
      ["Billy", "Karen"].forEach(p => {
        timelineData[p][label] = { total: 0, catBreakdown: {} };
        finalCategories.forEach(c => timelineData[p][label][c] = 0);
      });
    }

    // 3. Populate Data
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const compDate = safeParseDate(row[compIdx]);
      if (!compDate) continue; // Skip if no valid completion date

      const label = Utilities.formatDate(compDate, tz, "MM/dd (E)");
      if (!timelineData.Billy[label]) continue; // Skip if date matches outside 30-day window

      const isBilly = (row[billyIdx] === true || String(row[billyIdx]).toUpperCase() === "TRUE");
      const isKaren = (row[karenIdx] === true || String(row[karenIdx]).toUpperCase() === "TRUE");
      const mins = parseTimeValue(row[ectIdx]); // Use shared helper
      const rawCat = String(row[catIdx] || "Uncategorized").trim();
      let displayCat = topCats.includes(rawCat) ? rawCat : "Other";

      if (mins > 0) {
        if (isBilly) {
          timelineData.Billy[label][displayCat] += mins;
          timelineData.Billy[label].total += mins;
          timelineData.Billy[label].catBreakdown[rawCat] = (timelineData.Billy[label].catBreakdown[rawCat] || 0) + mins;
        }
        if (isKaren) {
          timelineData.Karen[label][displayCat] += mins;
          timelineData.Karen[label].total += mins;
          timelineData.Karen[label].catBreakdown[rawCat] = (timelineData.Karen[label].catBreakdown[rawCat] || 0) + mins;
        }
      }
    }

    // 4. Build Rows for Google Charts
    const buildArray = (p) => {
      let header = ["Day"];
      finalCategories.forEach(c => { header.push(c); header.push({ type: 'string', role: 'tooltip', p: {html: true} }); });
      let arr = [header];

      const ttBg = isDarkMode ? CONFIG.COLORS.DARK_MODE_BG : CONFIG.COLORS.LIGHT_MODE_BG;
      const ttText = isDarkMode ? CONFIG.COLORS.DARK_MODE_TEXT : CONFIG.COLORS.LIGHT_MODE_TEXT;
      const ttBorder = isDarkMode ? CONFIG.COLORS.DARK_MODE_BORDER : CONFIG.COLORS.LIGHT_MODE_BORDER;

      timelineLabels.forEach(lb => {
        const dayData = timelineData[p][lb];

        // Build HTML Tooltip
        let tooltip = `<div style="padding:12px; background:${ttBg}; color:${ttText}; border:1px solid ${ttBorder}; font-family:sans-serif; min-width:200px; border-radius:4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5);">` +
                      `<table style="width:100%; font-size:12px; border-collapse:collapse;">`;
        Object.entries(dayData.catBreakdown).sort((a,b) => b[1] - a[1]).forEach(([c, m]) => {
            tooltip += `<tr><td style="padding:2px 0;">${c}:</td><td style="text-align:right; padding:2px 0 2px 10px;"><b>${m}m</b></td></tr>`;
        });
        tooltip += `<tr style="border-top:1px solid ${ttBorder};"><td style="padding-top:8px;"><b>TOTAL:</b></td><td style="text-align:right; padding-top:8px;"><b>${dayData.total}m</b></td></tr></table></div>`;

        let row = [lb];
        finalCategories.forEach(c => { row.push(dayData[c] || 0); row.push(tooltip); });
        arr.push(row);
      });
      return arr;
    };

    return { ownerNames: ["🐷", "🐱"], dataA: buildArray("Billy"), dataB: buildArray("Karen") };
  } catch (e) { return { error: e.toString() }; }
}

/**
 * INCIDENT TREND ENGINE
 * Generates data for the Incident Trend Chart.
 */
function getIncidentTrendData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archive = ss.getSheetByName(CONFIG.SHEET.ARCHIVE);
    if (!archive) return { error: "Archive missing." };

    const data = archive.getDataRange().getValues();
    const headers = data[0];
    const getIdx = (t) => headers.findIndex(h => String(h).trim().toLowerCase() === t.toLowerCase());

    const taskIdx = getIdx("Task");
    const catIdx = getIdx("Category");
    const incDateIdx = getIdx("IncidentDate");
    const ownerIdx = getIdx("IncidentOwner");

    const tz = ss.getSpreadsheetTimeZone();
    const dailyMap = new Map();
    const dateArray = [];

    // Initialize last 60 days for sliding window calculation
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

    // Calculate Rolling Sums
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

    // Collect Details for Table
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
