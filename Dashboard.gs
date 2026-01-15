/**
 * FILE: Dashboard.gs
 * Purpose: Sidebar and Modal UI handlers.
 */
function showStatusSidebar(title, func) {
  const html = HtmlService.createHtmlOutput(`
    <style>body { font-family: sans-serif; padding: 15px; background: #f4f7f9; } .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; } #bar-container { width: 100%; background: #eee; height: 10px; border-radius: 5px; margin: 10px 0; overflow: hidden; } #bar { width: 0%; height: 100%; background: #4285f4; transition: width 0.3s; }</style>
    <div class="card"><div id="status">Starting...</div><div id="bar-container"><div id="bar"></div></div><div id="log" style="font-size:10px; color:#666;">Initializing...</div></div>
    <script>window.onload = function() { google.script.run.${func}(); setInterval(() => { google.script.run.withSuccessHandler(d => { if(!d || d.msg==="Idle") return; document.getElementById('status').innerText = d.msg; document.getElementById('bar').style.width = d.percent+'%'; document.getElementById('log').innerText = d.log; }).getSyncProgress(); }, 1000); };</script>
  `).setTitle(title).setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showDashboardModal() {
  const html = HtmlService.createHtmlOutputFromFile('DashboardUI').setWidth(1100).setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, 'Incident Insights');
}

function getDashboardData() {
  const sheet = SS.getSheetByName("TaskHistory");
  if (!sheet || sheet.getLastRow() < 2) return { error: "No data" };
  const headers = sheet.getRange(1, 5, 1, 14).getValues()[0];
  const notes = sheet.getRange(2, 5, sheet.getLastRow() - 1, 14).getNotes();
  let rows = [];
  for (let c = 0; c < 14; c++) {
    let d = headers[c], p = 0, cat = 0;
    for (let r = 0; r < notes.length; r++) {
      if (notes[r][c].includes("🐷")) p++;
      if (notes[r][c].includes("🐱")) cat++;
    }
    rows.push([(d instanceof Date ? (d.getMonth()+1)+"/"+d.getDate() : "??"), p, cat]);
  }
  return { rows: rows.reverse(), totalP: rows.reduce((s,r)=>s+r[1],0), totalC: rows.reduce((s,r)=>s+r[2],0) };
}