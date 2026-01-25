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

    // Edge case tests
    test('should handle negative values', () => {
      expect(parseTimeValue(-30)).toBe(-30);
      // Note: parseTimeValue strips minus sign from strings, converts to positive
      expect(parseTimeValue('-45m')).toBe(45);
      expect(parseTimeValue('-2 hours')).toBe(120);
    });

    test('should handle zero values', () => {
      expect(parseTimeValue(0)).toBe(0);
      expect(parseTimeValue('0m')).toBe(0);
      expect(parseTimeValue('0 hours')).toBe(0);
    });

    test('should handle very large numbers', () => {
      expect(parseTimeValue(999999)).toBe(999999);
      expect(parseTimeValue('10000 hours')).toBe(600000);
      expect(parseTimeValue('365 days')).toBe(175200);
    });

    test('should handle malformed time strings', () => {
      expect(parseTimeValue('m')).toBe(0);
      expect(parseTimeValue('hours')).toBe(0);
      expect(parseTimeValue('day')).toBe(0);
      expect(parseTimeValue('   ')).toBe(0);
    });

    test('should handle floating point edge cases', () => {
      expect(parseTimeValue('0.0001m')).toBe(0.0001);
      expect(parseTimeValue('999.999 hours')).toBe(59999.94);
      expect(parseTimeValue(0.1)).toBe(0.1);
    });
  });

  describe('safeParseDate - Edge Cases', () => {
    test('should handle whitespace strings', () => {
      expect(safeParseDate('   ')).toBeNull();
      expect(safeParseDate('\t\n')).toBeNull();
    });

    test('should handle numeric values', () => {
      // 0 is falsy, so safeParseDate returns null
      const result2 = safeParseDate(0);
      expect(result2).toBeNull();

      // Non-zero numbers get converted to Date via new Date(number) - epoch time
      const result = safeParseDate(12345);
      expect(result).toBeInstanceOf(Date);
      // Unix epoch 12345ms = 1970-01-01 + 12.345 seconds
    });

    test('should handle boolean values', () => {
      // true -> 1 -> Date(1) = epoch + 1ms
      const result1 = safeParseDate(true);
      expect(result1).toBeInstanceOf(Date);
      // Year depends on timezone (could be 1969 or 1970)
      expect([1969, 1970]).toContain(result1.getFullYear());

      // false is falsy, so returns null
      const result2 = safeParseDate(false);
      expect(result2).toBeNull();
    });

    test('should handle objects that are not Dates', () => {
      expect(safeParseDate({})).toBeNull();
      expect(safeParseDate([])).toBeNull();
      expect(safeParseDate({ date: '2026-01-24' })).toBeNull();
    });

    test('should handle edge date strings', () => {
      expect(safeParseDate('0000-00-00')).toBeNull();
      expect(safeParseDate('9999-99-99')).toBeNull();
      expect(safeParseDate('2026-13-45')).toBeNull(); // Invalid month/day
    });
  });
});
