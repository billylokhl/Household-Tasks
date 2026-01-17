/**
 * FILE: BackupSystem.gs
 * Purpose: Hourly/Manual backups and 7-day retention logic.
 */
function createHourlySnapshot() {
  try {
    const ss = getSS();
    const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
    const now = new Date();
    const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
    DriveApp.getFileById(ss.getId()).makeCopy(`Backup_${ss.getName()}_${timestamp}`, folder);

    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const files = folder.getFiles();
    let deleted = 0;

    while (files.hasNext()) {
      const file = files.next();
      if ((file.getName().indexOf("Backup_") === 0) && file.getDateCreated() < oneWeekAgo) {
        file.setTrashed(true);
        deleted++;
      }
    }
    ss.toast(`Backup saved. ${deleted > 0 ? deleted + " old backups purged." : ""}`, "📁 Backup System");
  } catch (e) { getSS().toast("Backup failed: " + e.toString(), "❌ Error"); }
}