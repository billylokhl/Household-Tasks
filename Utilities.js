/**
 * FILE: Utilities.gs
 * Description: Shared helper functions.
 */

/**
 * Safely parses a value into a Date object.
 * Returns null if invalid or empty.
 */
function safeParseDate(val) {
  if (!val || val === "") return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parses various time formats (integers, "30m", "1h") into total minutes.
 */
function parseTimeValue(val) {
  if (!val || val === "") return 0;
  if (typeof val === 'number') return val;
  const str = String(val).toLowerCase().replace(/\s+/g, '');
  const numMatch = str.match(/[\d\.]+/);
  if (!numMatch) return 0;
  const num = parseFloat(numMatch[0]);
  if (str.includes('day')) return num * 480; // 8 hours
  if (str.includes('hour') || str.includes('hr')) return num * 60;
  return num;
}
