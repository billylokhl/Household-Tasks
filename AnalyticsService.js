/**
 * FILE: AnalyticsService.gs
 * Description: Logic for Time Trends and Incident Trends.
 */

/**
 * TIME TREND ENGINE
 * Generates data for the Time Trend Chart.
 * @param {number} maWindow - Moving average window in days (default 30)
 * @param {boolean} weekendOnly - If true, MA only considers weekend days (default true)
 * @param {number} daysAhead - Days to look ahead for projected task times (default 0)
 */
function getTimeSpentData(maWindow, weekendOnly, daysAhead) {
  maWindow = maWindow || 28; // Default to 28 days if not provided
  weekendOnly = (weekendOnly === undefined || weekendOnly === null) ? true : weekendOnly;
  daysAhead = daysAhead || 0; // Default to 0 days ahead
  const debugLog = [];
  const log = (msg) => debugLog.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

  try {
    log(`Starting getTimeSpentData with MA window=${maWindow}, Weekend Only=${weekendOnly}, Days Ahead=${daysAhead}...`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const archive = ss.getSheetByName(CONFIG.SHEET.ARCHIVE);
    if (!archive) return { error: "Archive missing. Please run Sync first." };



    const data = archive.getDataRange().getValues();
    const headers = data[0];
    // Helper: Normalize header search (case-insensitive, ignore spaces but KEEP emojis/special chars)
    const normalize = (s) => String(s).toLowerCase().replace(/\s+/g, '');
    // Simple verification helper
    const getIdx = (t) => {
      const search = normalize(t);
      return headers.findIndex(hdr => normalize(hdr).includes(search));
    };

    log(`Raw Archive Headers: ${headers.join(" | ")}`);
    log(`Normalized Headers: ${headers.map(normalize).join(" | ")}`);

    let billyIdx = getIdx("OwnershipBilly");
    if (billyIdx === -1) billyIdx = getIdx("Ownership🐷");
    if (billyIdx === -1) billyIdx = getIdx("Billy");
    if (billyIdx === -1) billyIdx = getIdx("🐷");

    let karenIdx = getIdx("OwnershipKaren");
    if (karenIdx === -1) karenIdx = getIdx("OwnershipCat");
    if (karenIdx === -1) karenIdx = getIdx("Ownership🐱");
    if (karenIdx === -1) karenIdx = getIdx("Karen");
    if (karenIdx === -1) karenIdx = getIdx("Cat");
    if (karenIdx === -1) karenIdx = getIdx("🐱");

    let ectIdx = getIdx("ECT");
    if (ectIdx === -1) ectIdx = getIdx("TimeSpent");
    if (ectIdx === -1) ectIdx = getIdx("Minutes");
    if (ectIdx === -1) ectIdx = getIdx("Duration");

    const catIdx = getIdx("Category");

    let compIdx = getIdx("CompletionDate");
    if (compIdx === -1) compIdx = getIdx("Date");
    if (compIdx === -1) compIdx = getIdx("SyncDate");

    const taskIdx = getIdx("Task");

    log(`Calculated Indexes -> Billy:${billyIdx}, Karen:${karenIdx}, ECT:${ectIdx}, Cat:${catIdx}, Date:${compIdx}, Task:${taskIdx}`);

    // Detail missing columns for the log
    const missing = [];
    if (billyIdx === -1) missing.push("Billy Owner");
    if (karenIdx === -1) missing.push("Karen Owner");
    if (ectIdx === -1) missing.push("Time/ECT");
    if (catIdx === -1) missing.push("Category");
    if (compIdx === -1) missing.push("Date");

    if (missing.length > 0) {
      log("ERROR: Missing columns: " + missing.join(", "));
      return { error: "Missing columns: " + missing.join(", "), logs: debugLog };
    }
    // Debugging: If key columns missing, return error
    if (ectIdx === -1) return { error: "Missing 'ECT' or 'Time Spent' column.", logs: debugLog };
    if (catIdx === -1) return { error: "Missing 'Category' column.", logs: debugLog };
    if (compIdx === -1) return { error: "Missing Date column.", logs: debugLog };



    // 1. Calculate Totals for Top Categories from Archive
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
    const totalDays = 30 + daysAhead;
    const todayIndex = 29; // Index of today in the timeline (0-based)

    // 2. Initialize Last 30 Days + Future Days with weekend flag
    const timelineDates = []; // Store actual Date objects for weekend checking
    for (let i = 29; i >= 0; i--) {
      let d = new Date(); d.setDate(d.getDate() - i);
      timelineDates.push(d);
      let label = Utilities.formatDate(d, tz, "MM/dd (E)");
      timelineLabels.push(label);
      ["Billy", "Karen"].forEach(p => {
        timelineData[p][label] = { total: 0, catBreakdown: {}, taskDetails: {}, isFuture: false };
        finalCategories.forEach(c => {
           timelineData[p][label][c] = 0;
           timelineData[p][label].taskDetails[c] = [];
        });
      });
    }

    // Add future days if daysAhead > 0
    for (let i = 1; i <= daysAhead; i++) {
      let d = new Date(); d.setDate(d.getDate() + i);
      timelineDates.push(d);
      let label = Utilities.formatDate(d, tz, "MM/dd (E)");
      timelineLabels.push(label);
      ["Billy", "Karen"].forEach(p => {
        timelineData[p][label] = { total: 0, catBreakdown: {}, taskDetails: {}, isFuture: true };
        finalCategories.forEach(c => {
           timelineData[p][label][c] = 0;
           timelineData[p][label].taskDetails[c] = [];
        });
      });
    }

    log(`Timeline initialized. Range: ${timelineLabels[0]} to ${timelineLabels[timelineLabels.length-1]}`);

    // 3. Populate Data
    let processedCount = 0;
    let validDateCount = 0;
    let inRangeCount = 0;

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let compDate = row[compIdx];

        // Debug first 5 rows regardless of validity
        if (i <= 5) {
             const bRaw = row[billyIdx];
             const ectRaw = row[ectIdx];
             log(`DEBUG ROW #${i}: RawDate="${compDate}", RawBilly="${bRaw}", RawECT="${ectRaw}"`);
        }

        // Robust date parsing using Spreadsheet TimeZone
        if (typeof compDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(compDate)) {
            compDate = Utilities.parseDate(compDate, tz, "yyyy-MM-dd");
        } else {
            compDate = safeParseDate(compDate);
        }

        if (!compDate) {
             if (i <= 5) log(`-> Row #${i} Date Parse Failed`);
             continue;
        }
        validDateCount++;

        const label = Utilities.formatDate(compDate, tz, "MM/dd (E)");

        if (i <= 5) log(`-> Row #${i} ParsedDate=${label}`);

        if (!timelineData.Billy[label]) {
             if (i <= 5) log(`-> Row #${i} Date ${label} not in timeline`);
             continue;
        }

        inRangeCount++;

        processedCount++;

        // Looser ownership check to handle "TRUE", "Yes", "🐷", etc.
        const bRaw = row[billyIdx];
        const kRaw = row[karenIdx];

        const isBilly = (bRaw === true || String(bRaw).toUpperCase().includes("TRUE") || String(bRaw).includes("🐷") || String(bRaw).toLowerCase() === "yes");
        const isKaren = (kRaw === true || String(kRaw).toUpperCase().includes("TRUE") || String(kRaw).includes("🐱") || String(kRaw).toLowerCase() === "yes");

        // Detailed logging for first 5 hits to debug
        if (processedCount <= 5) {
            log(`Row #${i}: Date=${label}, BillyVal="${bRaw}"(Is:${isBilly}), KarenVal="${kRaw}"(Is:${isKaren}), ECT=${row[ectIdx]}`);
        }
      const mins = parseTimeValue(row[ectIdx]); // Use shared helper
      const rawCat = String(row[catIdx] || "Uncategorized").trim();
      const taskName = String(row[taskIdx] || "Unknown Task");
      let displayCat = topCats.includes(rawCat) ? rawCat : "Other";

      if (mins > 0) {
        if (isBilly) {
          timelineData.Billy[label][displayCat] += mins;
          timelineData.Billy[label].total += mins;
          timelineData.Billy[label].catBreakdown[rawCat] = (timelineData.Billy[label].catBreakdown[rawCat] || 0) + mins;

          if (!timelineData.Billy[label].taskDetails[displayCat]) timelineData.Billy[label].taskDetails[displayCat] = [];
          timelineData.Billy[label].taskDetails[displayCat].push({ task: taskName, mins: mins });
        }
        if (isKaren) {
          timelineData.Karen[label][displayCat] += mins;
          timelineData.Karen[label].total += mins;
          timelineData.Karen[label].catBreakdown[rawCat] = (timelineData.Karen[label].catBreakdown[rawCat] || 0) + mins;

          if (!timelineData.Karen[label].taskDetails[displayCat]) timelineData.Karen[label].taskDetails[displayCat] = [];
          timelineData.Karen[label].taskDetails[displayCat].push({ task: taskName, mins: mins });
        }
      }
    }

    // 5. Build Rows with Styles and Annotations
    const buildArray = (p) => {
      let header = ["Day"];
      finalCategories.forEach(c => {
        header.push({label: c, type: 'number'});
        header.push({ type: 'string', role: 'tooltip', p: {html: true} });
        header.push({ type: 'string', role: 'style' }); // Add style role for patterns
      });
      // Add moving average column
      header.push({label: `${maWindow}d MA`, type: 'number'});

      let arr = [header];
      let details = {};

      let hasData = false;

      // Calculate total time per day for moving average
      const dailyTotals = timelineLabels.map(lb => timelineData[p][lb].total);

      timelineLabels.forEach((lb, idx) => {
        const dayData = timelineData[p][lb];

        if (dayData.total > 0) hasData = true;

        let tooltip = `<div class="chart-tooltip"><table>`;
        Object.entries(dayData.catBreakdown).sort((a,b) => b[1] - a[1]).forEach(([c, m]) => {
            tooltip += `<tr><td>${c}:</td><td class="chart-val"><b>${m}m</b></td></tr>`;
        });
        tooltip += `<tr class="chart-total"><td class="chart-pt"><b>TOTAL:</b></td><td class="chart-val chart-pt"><b>${dayData.total}m</b></td></tr></table></div>`;

        // Add marker to today's date
        let dateLabel = lb;
        if (idx === todayIndex) {
          dateLabel = `▶ ${lb}`; // Add triangle marker before today's date
        }

        // Store details with the modified dateLabel so lookups work correctly
        details[dateLabel] = dayData.taskDetails;

        let row = [dateLabel];
        const isFuture = dayData.isFuture;

        finalCategories.forEach((c, catIdx) => {
          let v = dayData[c] || 0;
          row.push(v === 0 ? null : v);
          row.push(tooltip);
          // Use translucent fill for future data (Google Charts doesn't support patterns)
          const style = isFuture ? 'opacity: 0.5;' : null;
          row.push(style);
        });

        // Calculate moving average for this day
        let maSum = 0;
        let maCount = 0;
        for (let j = 0; j < maWindow && idx - j >= 0; j++) {
          const lookbackIdx = idx - j;
          const lookbackDate = timelineDates[lookbackIdx];
          const dayOfWeek = lookbackDate.getDay(); // 0=Sunday, 6=Saturday

          // Include day in MA if: not weekendOnly OR (weekendOnly AND is weekend)
          const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
          if (!weekendOnly || isWeekend) {
            maSum += dailyTotals[lookbackIdx];
            maCount++;
          }
        }
        const maValue = maCount > 0 ? (maSum / maCount) : null;
        row.push(maValue);


        arr.push(row);
      });

      if (!hasData) log(`WARNING: No data found for owner ${p} across all dates.`);

      return { array: arr, details: details, categories: finalCategories };
    };

    log(`Stats: Total Rows=${data.length}, Valid Dates=${validDateCount}, Inside 30-Day Window=${inRangeCount}`);

    // 3.5. Add TODAY's incomplete tasks from Prioritization Sheet
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayLabel = Utilities.formatDate(todayDate, tz, "MM/dd (E)");

    if (timelineData.Billy[todayLabel]) {
      const prioritization = ss.getSheetByName(CONFIG.SHEET.PRIORITIZATION);
      if (prioritization) {
        const prioData = prioritization.getDataRange().getValues();
        const prioHeaders = prioData[0];

        const prioGetIdx = (t) => {
          const search = normalize(t);
          return prioHeaders.findIndex(hdr => normalize(hdr).includes(search));
        };

        const prioTaskIdx = prioGetIdx("Task");
        const prioCatIdx = prioGetIdx("Category");
        const prioEctIdx = prioGetIdx("ECT");
        const prioDueDateIdx = prioGetIdx("DueDate");
        const prioCompBillyIdx = prioGetIdx("CompletionDate🐷");
        const prioCompKarenIdx = prioGetIdx("CompletionDate🐱");

        let prioBillyIdx = prioGetIdx("OwnershipBilly");
        if (prioBillyIdx === -1) prioBillyIdx = prioGetIdx("Ownership🐷");
        if (prioBillyIdx === -1) prioBillyIdx = prioGetIdx("Billy");
        if (prioBillyIdx === -1) prioBillyIdx = prioGetIdx("🐷");

        let prioKarenIdx = prioGetIdx("OwnershipKaren");
        if (prioKarenIdx === -1) prioKarenIdx = prioGetIdx("Ownership🐱");
        if (prioKarenIdx === -1) prioKarenIdx = prioGetIdx("Karen");
        if (prioKarenIdx === -1) prioKarenIdx = prioGetIdx("🐱");

        log(`Adding TODAY's incomplete tasks from Prioritization -> Task:${prioTaskIdx}, Cat:${prioCatIdx}, ECT:${prioEctIdx}, DueDate:${prioDueDateIdx}, Billy:${prioBillyIdx}, Karen:${prioKarenIdx}`);

        let todayIncompleteCount = 0;

        for (let i = 1; i < prioData.length; i++) {
          const row = prioData[i];
          let dueDate = row[prioDueDateIdx];

          if (typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            dueDate = Utilities.parseDate(dueDate, tz, "yyyy-MM-dd");
          } else {
            dueDate = safeParseDate(dueDate);
          }

          // Check if due date is today
          if (!dueDate || dueDate.getTime() !== todayDate.getTime()) continue;

          const bRaw = row[prioBillyIdx];
          const kRaw = row[prioKarenIdx];
          const isBilly = (bRaw === true || String(bRaw).toUpperCase().includes("TRUE") || String(bRaw).includes("🐷") || String(bRaw).toLowerCase() === "yes");
          const isKaren = (kRaw === true || String(kRaw).toUpperCase().includes("TRUE") || String(kRaw).includes("🐱") || String(kRaw).toLowerCase() === "yes");

          // Check if task is NOT completed (completion date is empty)
          const billyCompleted = row[prioCompBillyIdx] && String(row[prioCompBillyIdx]).trim() !== "";
          const karenCompleted = row[prioCompKarenIdx] && String(row[prioCompKarenIdx]).trim() !== "";

          const mins = parseTimeValue(row[prioEctIdx]);
          const rawCat = String(row[prioCatIdx] || "Uncategorized").trim();
          const taskName = String(row[prioTaskIdx] || "Unknown Task");
          let displayCat = topCats.includes(rawCat) ? rawCat : "Other";

          if (mins > 0) {
            // Add incomplete Billy tasks
            if (isBilly && !billyCompleted) {
              timelineData.Billy[todayLabel][displayCat] += mins;
              timelineData.Billy[todayLabel].total += mins;
              timelineData.Billy[todayLabel].catBreakdown[rawCat] = (timelineData.Billy[todayLabel].catBreakdown[rawCat] || 0) + mins;
              if (!timelineData.Billy[todayLabel].taskDetails[displayCat]) timelineData.Billy[todayLabel].taskDetails[displayCat] = [];
              timelineData.Billy[todayLabel].taskDetails[displayCat].push({ task: taskName, mins: mins });
              todayIncompleteCount++;
            }
            // Add incomplete Karen tasks
            if (isKaren && !karenCompleted) {
              timelineData.Karen[todayLabel][displayCat] += mins;
              timelineData.Karen[todayLabel].total += mins;
              timelineData.Karen[todayLabel].catBreakdown[rawCat] = (timelineData.Karen[todayLabel].catBreakdown[rawCat] || 0) + mins;
              if (!timelineData.Karen[todayLabel].taskDetails[displayCat]) timelineData.Karen[todayLabel].taskDetails[displayCat] = [];
              timelineData.Karen[todayLabel].taskDetails[displayCat].push({ task: taskName, mins: mins });
              todayIncompleteCount++;
            }
          }
        }

        log(`Added ${todayIncompleteCount} incomplete tasks for TODAY (${todayLabel})`);
      } else {
        log("WARNING: Prioritization sheet not found, skipping today's incomplete tasks");
      }
    }

    // 4. Populate Future Days from Prioritization Sheet
    if (daysAhead > 0) {
      const prioritization = ss.getSheetByName(CONFIG.SHEET.PRIORITIZATION);
      if (prioritization) {
        const prioData = prioritization.getDataRange().getValues();
        const prioHeaders = prioData[0];

        const prioGetIdx = (t) => {
          const search = normalize(t);
          return prioHeaders.findIndex(hdr => normalize(hdr).includes(search));
        };

        const prioTaskIdx = prioGetIdx("Task");
        const prioCatIdx = prioGetIdx("Category");
        const prioEctIdx = prioGetIdx("ECT");
        const prioDueDateIdx = prioGetIdx("DueDate");
        let prioBillyIdx = prioGetIdx("OwnershipBilly");
        if (prioBillyIdx === -1) prioBillyIdx = prioGetIdx("Ownership🐷");
        if (prioBillyIdx === -1) prioBillyIdx = prioGetIdx("Billy");
        if (prioBillyIdx === -1) prioBillyIdx = prioGetIdx("🐷");

        let prioKarenIdx = prioGetIdx("OwnershipKaren");
        if (prioKarenIdx === -1) prioKarenIdx = prioGetIdx("Ownership🐱");
        if (prioKarenIdx === -1) prioKarenIdx = prioGetIdx("Karen");
        if (prioKarenIdx === -1) prioKarenIdx = prioGetIdx("🐱");

        log(`Prioritization Indexes -> Task:${prioTaskIdx}, Cat:${prioCatIdx}, ECT:${prioEctIdx}, DueDate:${prioDueDateIdx}, Billy:${prioBillyIdx}, Karen:${prioKarenIdx}`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureEnd = new Date();
        futureEnd.setDate(futureEnd.getDate() + daysAhead);
        futureEnd.setHours(23, 59, 59, 999);

        for (let i = 1; i < prioData.length; i++) {
          const row = prioData[i];
          let dueDate = row[prioDueDateIdx];

          if (typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            dueDate = Utilities.parseDate(dueDate, tz, "yyyy-MM-dd");
          } else {
            dueDate = safeParseDate(dueDate);
          }

          if (!dueDate || dueDate <= today || dueDate > futureEnd) continue;

          const label = Utilities.formatDate(dueDate, tz, "MM/dd (E)");
          if (!timelineData.Billy[label]) continue;

          const bRaw = row[prioBillyIdx];
          const kRaw = row[prioKarenIdx];
          const isBilly = (bRaw === true || String(bRaw).toUpperCase().includes("TRUE") || String(bRaw).includes("🐷") || String(bRaw).toLowerCase() === "yes");
          const isKaren = (kRaw === true || String(kRaw).toUpperCase().includes("TRUE") || String(kRaw).includes("🐱") || String(kRaw).toLowerCase() === "yes");

          const mins = parseTimeValue(row[prioEctIdx]);
          const rawCat = String(row[prioCatIdx] || "Uncategorized").trim();
          const taskName = String(row[prioTaskIdx] || "Unknown Task");
          let displayCat = topCats.includes(rawCat) ? rawCat : "Other";

          if (mins > 0) {
            if (isBilly) {
              timelineData.Billy[label][displayCat] += mins;
              timelineData.Billy[label].total += mins;
              timelineData.Billy[label].catBreakdown[rawCat] = (timelineData.Billy[label].catBreakdown[rawCat] || 0) + mins;
              if (!timelineData.Billy[label].taskDetails[displayCat]) timelineData.Billy[label].taskDetails[displayCat] = [];
              timelineData.Billy[label].taskDetails[displayCat].push({ task: taskName, mins: mins });
            }
            if (isKaren) {
              timelineData.Karen[label][displayCat] += mins;
              timelineData.Karen[label].total += mins;
              timelineData.Karen[label].catBreakdown[rawCat] = (timelineData.Karen[label].catBreakdown[rawCat] || 0) + mins;
              if (!timelineData.Karen[label].taskDetails[displayCat]) timelineData.Karen[label].taskDetails[displayCat] = [];
              timelineData.Karen[label].taskDetails[displayCat].push({ task: taskName, mins: mins });
            }
          }
        }

        log(`Populated ${daysAhead} future days from Prioritization sheet`);
      } else {
        log("WARNING: Prioritization sheet not found, skipping future projections");
      }
    }

    return {
        ownerNames: ["🐷", "🐱"],
        dataA: buildArray("Billy").array,
        detailsA: buildArray("Billy").details,
        catsA: buildArray("Billy").categories,
        dataB: buildArray("Karen").array,
        detailsB: buildArray("Karen").details,
        catsB: buildArray("Karen").categories,
        todayIndex: todayIndex,
        logs: debugLog
    };
  } catch (e) { return { error: e.toString(), logs: debugLog }; }
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
