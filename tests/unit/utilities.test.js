/**
 * Unit tests for Utilities.js
 */

describe('Utilities', () => {
  describe('safeParseDate', () => {
    test('should return null for empty values', () => {
      expect(safeParseDate(null)).toBeNull();
      expect(safeParseDate(undefined)).toBeNull();
      expect(safeParseDate('')).toBeNull();
    });

    test('should return Date object as-is', () => {
      const date = new Date('2026-01-24');
      expect(safeParseDate(date)).toBe(date);
    });

    test('should parse valid date strings', () => {
      const result = safeParseDate('2026-01-24');
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0); // January is 0
      // Note: getDate() may vary by timezone, so we check it's close
      expect(result.getDate()).toBeGreaterThanOrEqual(23);
      expect(result.getDate()).toBeLessThanOrEqual(24);
    });

    test('should return null for invalid date strings', () => {
      expect(safeParseDate('invalid-date')).toBeNull();
      expect(safeParseDate('not a date')).toBeNull();
    });

    test('should parse various date formats', () => {
      const formats = [
        '2026-01-24',
        '01/24/2026',
        'January 24, 2026',
        '2026/01/24'
      ];

      formats.forEach(format => {
        const result = safeParseDate(format);
        expect(result).toBeInstanceOf(Date);
        expect(result.getFullYear()).toBe(2026);
      });
    });
  });

  describe('parseTimeValue', () => {
    test('should return 0 for empty values', () => {
      expect(parseTimeValue(null)).toBe(0);
      expect(parseTimeValue(undefined)).toBe(0);
      expect(parseTimeValue('')).toBe(0);
    });

    test('should return number as-is (minutes)', () => {
      expect(parseTimeValue(30)).toBe(30);
      expect(parseTimeValue(60)).toBe(60);
      expect(parseTimeValue(120)).toBe(120);
    });

    test('should parse minute strings', () => {
      expect(parseTimeValue('30')).toBe(30);
      expect(parseTimeValue('45m')).toBe(45);
      expect(parseTimeValue('30 m')).toBe(30);
      expect(parseTimeValue('90 mins')).toBe(90);
    });

    test('should parse hour strings', () => {
      expect(parseTimeValue('1hour')).toBe(60);
      expect(parseTimeValue('2hours')).toBe(120);
      expect(parseTimeValue('1.5hour')).toBe(90);
      expect(parseTimeValue('2 hours')).toBe(120);
      expect(parseTimeValue('1 hr')).toBe(60);
    });

    test('should parse day strings', () => {
      expect(parseTimeValue('1 day')).toBe(480);
      expect(parseTimeValue('2 days')).toBe(960);
      expect(parseTimeValue('0.5 day')).toBe(240);
      expect(parseTimeValue('1day')).toBe(480);
    });

    test('should handle mixed case and spacing', () => {
      expect(parseTimeValue('30M')).toBe(30);
      expect(parseTimeValue('1 HR')).toBe(60);
      expect(parseTimeValue('2 DAYS')).toBe(960);
      expect(parseTimeValue('  30  m  ')).toBe(30);
    });

    test('should handle decimal numbers', () => {
      expect(parseTimeValue('1.5')).toBe(1.5);
      expect(parseTimeValue('2.5hours')).toBe(150);
      expect(parseTimeValue('0.5 day')).toBe(240);
    });

    test('should return number for strings without time units', () => {
      expect(parseTimeValue('invalid')).toBe(0);
      expect(parseTimeValue('abc')).toBe(0);
      expect(parseTimeValue('xyz123')).toBe(123); // Extracts number
    });

    test('should extract number from complex strings', () => {
      expect(parseTimeValue('approx 30m')).toBe(30);
      expect(parseTimeValue('~2hours')).toBe(120);
      expect(parseTimeValue('about 1 day')).toBe(480);
    });
  });
});
