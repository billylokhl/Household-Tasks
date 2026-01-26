/**
 * FoodAILearning.js
 * Learning system that stores user corrections and uses them for future predictions
 */

/**
 * Gets or creates the hidden learning data sheet
 * @returns {Sheet} The learning sheet
 */
function getFoodLearningSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('FoodAI_Learning');

  if (!sheet) {
    sheet = ss.insertSheet('FoodAI_Learning');
    // Set headers
    sheet.getRange(1, 1, 1, 5).setValues([
      ['Food Item', 'Storage Method', 'Fridge Section', 'Last Updated', 'Source']
    ]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    sheet.setFrozenRows(1);

    // Hide the sheet from casual users
    sheet.hideSheet();
  }

  return sheet;
}

/**
 * Records a user correction to the learning database
 * @param {string} foodItem - Name of the food item
 * @param {string} storageMethod - Storage method
 * @param {string} fridgeSection - Fridge section (empty if not fridge)
 * @param {string} source - How this was learned ('manual' or 'ai-confirmed')
 */
function recordFoodLearning(foodItem, storageMethod, fridgeSection, source) {
  if (!foodItem || !storageMethod) return;

  const sheet = getFoodLearningSheet();
  const cleanItem = foodItem.toString().trim().toLowerCase();

  // Check if this food already exists
  const data = sheet.getDataRange().getValues();
  let existingRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim().toLowerCase() === cleanItem) {
      existingRow = i + 1; // +1 for 1-based indexing
      break;
    }
  }

  const timestamp = new Date();
  const rowData = [
    foodItem.toString().trim(),
    storageMethod,
    fridgeSection || '',
    timestamp,
    source
  ];

  if (existingRow > 0) {
    // Update existing entry
    sheet.getRange(existingRow, 1, 1, 5).setValues([rowData]);
  } else {
    // Add new entry
    sheet.appendRow(rowData);
  }
}

/**
 * Looks up learned storage for a food item
 * @param {string} foodItem - Name of the food item
 * @returns {Object|null} Object with storageMethod and fridgeSection, or null if not found
 */
function lookupLearnedStorage(foodItem) {
  if (!foodItem) return null;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FoodAI_Learning');

  if (!sheet) return null;

  const cleanItem = foodItem.toString().trim().toLowerCase();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim().toLowerCase() === cleanItem) {
      return {
        storageMethod: data[i][1],
        fridgeSection: data[i][2] || '',
        source: 'learned'
      };
    }
  }

  return null;
}

/**
 * Gets similar learned items to use as few-shot examples for Gemini
 * @param {number} maxExamples - Maximum number of examples to return
 * @returns {Array} Array of learned items
 */
function getSimilarLearnedItems(maxExamples) {
  maxExamples = maxExamples || 5;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FoodAI_Learning');

  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const examples = [];

  // Get most recent items (skip header)
  for (let i = data.length - 1; i >= 1 && examples.length < maxExamples; i--) {
    if (data[i][0] && data[i][1]) {
      examples.push({
        foodItem: data[i][0],
        storageMethod: data[i][1],
        fridgeSection: data[i][2] || ''
      });
    }
  }

  return examples;
}

/**
 * Builds a prompt with learned examples for few-shot learning
 * @param {string} foodItem - The food item to predict
 * @returns {string} The enhanced prompt with examples
 */
function buildPromptWithLearning(foodItem) {
  const basePrompt = `You are a food storage expert. Given a food item, predict the best storage method and location.

Food item: "${foodItem}"

Available storage methods:
- fridge
- freezer
- kitchen cabinet
- food cabinet
- cake stand

If storage method is "fridge", also specify the section from:
- 1st shelf (top shelf)
- 2nd shelf
- 3rd shelf
- 4th shelf
- veggie drawer
- fruit drawer

If storage method is NOT "fridge", set fridgeSection to empty string.`;

  // Add learned examples if available
  const examples = getSimilarLearnedItems(5);

  if (examples.length > 0) {
    let examplesText = '\n\nHere are some examples of correct storage from past experience:';
    for (const ex of examples) {
      examplesText += `\n- ${ex.foodItem}: {"storageMethod": "${ex.storageMethod}", "fridgeSection": "${ex.fridgeSection}"}`;
    }

    return basePrompt + examplesText + `

IMPORTANT: Respond with ONLY a valid JSON object, nothing else. No explanations, no markdown. Just the JSON.
Format: {"storageMethod": "method", "fridgeSection": "section or empty string"}`;
  }

  return basePrompt + `

IMPORTANT: Respond with ONLY a valid JSON object, nothing else. No explanations, no markdown. Just the JSON.
Format: {"storageMethod": "method", "fridgeSection": "section or empty string"}

Example responses:
{"storageMethod": "fridge", "fridgeSection": "2nd shelf"}
{"storageMethod": "freezer", "fridgeSection": ""}`;
}

/**
 * Clears all learned data (useful for testing or reset)
 */
function clearFoodLearning() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear Learning Data',
    'This will delete all learned food storage preferences. Are you sure?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FoodAI_Learning');

  if (sheet) {
    ss.deleteSheet(sheet);
    ui.alert('Success', 'Learning data cleared. The system will learn from future corrections.', ui.ButtonSet.OK);
  } else {
    ui.alert('Info', 'No learning data to clear.', ui.ButtonSet.OK);
  }
}

/**
 * Shows the learning data to the user (unhides the sheet temporarily)
 */
function viewFoodLearning() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('FoodAI_Learning');

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'No Learning Data',
      'The system has not learned any food storage preferences yet.\n\nManually edit predictions in columns D/E to teach the system.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  sheet.showSheet();
  ss.setActiveSheet(sheet);

  SpreadsheetApp.getUi().alert(
    'Learning Data',
    `Showing ${sheet.getLastRow() - 1} learned food items.\n\nYou can edit or delete rows here to modify what the system has learned.\n\nNote: This sheet will auto-hide when you switch to another sheet.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * OnEdit trigger to capture manual corrections
 * This should be installed as a simple trigger
 */
function onEditCaptureLearning(e) {
  if (!e) return;

  const sheet = e.source.getActiveSheet();

  // Only process edits on Food Expiration sheet
  if (sheet.getName() !== 'Food Expiration') return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Only process edits to columns D (4) or E (5)
  if (col !== 4 && col !== 5) return;

  // Skip header row
  if (row < 2) return;

  // Get the food item from column A
  const foodItem = sheet.getRange(row, 1).getValue();
  if (!foodItem || foodItem.toString().trim() === '') return;

  // Get current storage method and section
  const storageMethod = sheet.getRange(row, 4).getValue();
  const fridgeSection = sheet.getRange(row, 5).getValue();

  if (!storageMethod || storageMethod.toString().trim() === '') return;

  // Record this as a manual correction
  recordFoodLearning(
    foodItem.toString().trim(),
    storageMethod.toString().trim(),
    fridgeSection ? fridgeSection.toString().trim() : '',
    'manual'
  );

  Logger.log(`Learned from manual edit: ${foodItem} -> ${storageMethod} / ${fridgeSection}`);
}
