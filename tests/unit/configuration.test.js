/**
 * Unit tests for Configuration.js
 */

describe('Configuration', () => {
  test('should have SHEET configuration', () => {
    expect(CONFIG.SHEET).toBeDefined();
    expect(CONFIG.SHEET.PRIORITIZATION).toBe('Prioritization');
    expect(CONFIG.SHEET.ARCHIVE).toBe('TaskArchive');
    expect(CONFIG.SHEET.HISTORY).toBe('TaskHistory');
  });

  test('should have BACKUP configuration', () => {
    expect(CONFIG.BACKUP).toBeDefined();
    expect(CONFIG.BACKUP.FOLDER_ID).toBe('1S_HRJlzJ9JPMcD2aamy036FIGb8xxd96');
  });

  test('should have COLORS configuration', () => {
    expect(CONFIG.COLORS).toBeDefined();
    expect(CONFIG.COLORS.DARK_MODE_BG).toBeDefined();
    expect(CONFIG.COLORS.DARK_MODE_TEXT).toBeDefined();
    expect(CONFIG.COLORS.LIGHT_MODE_BG).toBeDefined();
    expect(CONFIG.COLORS.LIGHT_MODE_TEXT).toBeDefined();
  });

  test('should have valid color codes', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    expect(CONFIG.COLORS.DARK_MODE_BG).toMatch(hexColorRegex);
    expect(CONFIG.COLORS.DARK_MODE_TEXT).toMatch(hexColorRegex);
    expect(CONFIG.COLORS.LIGHT_MODE_BG).toMatch(hexColorRegex);
    expect(CONFIG.COLORS.LIGHT_MODE_TEXT).toMatch(hexColorRegex);
  });
});
