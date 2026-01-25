/**
 * FoodExpirationAI.js
 * AI-powered food storage prediction using Google Gemini
 */

/**
 * Gets AI predictions for storage method and fridge section based on food item
 * @param {string} foodItem - Name of the food item
 * @returns {Object} Object with storageMethod and fridgeSection properties
 */
function predictFoodStorage(foodItem) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please run setupGeminiAPI() first.');
  }

  const prompt = `You are a food storage expert. Given a food item, predict the best storage method and location.

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

If storage method is NOT "fridge", the section should be empty.

Respond ONLY with a JSON object in this exact format (no markdown, no explanation):
{"storageMethod": "chosen_method", "fridgeSection": "chosen_section_or_empty"}

Examples:
- Milk: {"storageMethod": "fridge", "fridgeSection": "2nd shelf"}
- Carrots: {"storageMethod": "fridge", "fridgeSection": "veggie drawer"}
- Bread: {"storageMethod": "kitchen cabinet", "fridgeSection": ""}
- Ice cream: {"storageMethod": "freezer", "fridgeSection": ""}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 100
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      Logger.log('API Error Response: ' + response.getContentText());
      throw new Error(`Gemini API error (${responseCode}): ${response.getContentText()}`);
    }

    const result = JSON.parse(response.getContentText());

    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    const textResponse = result.candidates[0].content.parts[0].text.trim();
    Logger.log('Raw Gemini response: ' + textResponse);

    // Parse the JSON response
    const prediction = JSON.parse(textResponse);

    // Validate the response
    const validStorageMethods = ['fridge', 'freezer', 'kitchen cabinet', 'food cabinet', 'cake stand'];
    const validFridgeSections = ['1st shelf', '2nd shelf', '3rd shelf', '4th shelf', 'veggie drawer', 'fruit drawer', ''];

    if (!validStorageMethods.includes(prediction.storageMethod)) {
      throw new Error(`Invalid storage method: ${prediction.storageMethod}`);
    }

    if (!validFridgeSections.includes(prediction.fridgeSection)) {
      throw new Error(`Invalid fridge section: ${prediction.fridgeSection}`);
    }

    // Ensure fridgeSection is empty if not fridge
    if (prediction.storageMethod !== 'fridge') {
      prediction.fridgeSection = '';
    }

    return prediction;

  } catch (error) {
    Logger.log('Error in predictFoodStorage: ' + error.toString());
    throw error;
  }
}

/**
 * Predicts storage for selected food items in the Food Expiration sheet
 * User should select cells in Column A (food items) before running this
 */
function predictSelectedFoodStorage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Food Expiration');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error', 'Sheet "Food Expiration" not found.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const selection = sheet.getActiveRange();
  const startRow = selection.getRow();
  const numRows = selection.getNumRows();

  // Check if API key is configured
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'API Key Required',
      'Gemini API key not configured. Would you like to set it up now?',
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      setupGeminiAPI();
    }
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  SpreadsheetApp.getUi().alert(
    'Processing',
    `Predicting storage for ${numRows} food item(s)...\nThis may take a few seconds.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    const foodItem = sheet.getRange(row, 1).getValue(); // Column A

    if (!foodItem || foodItem.toString().trim() === '') {
      continue; // Skip empty rows
    }

    try {
      const prediction = predictFoodStorage(foodItem.toString().trim());

      // Write predictions to columns D and E
      sheet.getRange(row, 4).setValue(prediction.storageMethod);      // Column D
      sheet.getRange(row, 5).setValue(prediction.fridgeSection);      // Column E

      successCount++;

      // Add a small delay to avoid rate limiting
      Utilities.sleep(500);

    } catch (error) {
      errorCount++;
      errors.push(`Row ${row} (${foodItem}): ${error.message}`);
      Logger.log(`Error processing row ${row}: ${error.toString()}`);
    }
  }

  // Show results
  let message = `Predictions complete!\n\nSuccess: ${successCount}\nErrors: ${errorCount}`;

  if (errors.length > 0) {
    message += '\n\nErrors:\n' + errors.slice(0, 5).join('\n');
    if (errors.length > 5) {
      message += `\n... and ${errors.length - 5} more errors (check logs)`;
    }
  }

  SpreadsheetApp.getUi().alert('Results', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Predicts storage for all food items in the sheet that have empty storage columns
 */
function predictAllEmptyFoodStorage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Food Expiration');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('Error', 'Sheet "Food Expiration" not found.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('No Data', 'No food items found in the sheet.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues(); // Skip header, get columns A-E
  const rowsToPredict = [];

  for (let i = 0; i < data.length; i++) {
    const foodItem = data[i][0]; // Column A
    const storageMethod = data[i][3]; // Column D

    if (foodItem && foodItem.toString().trim() !== '' &&
        (!storageMethod || storageMethod.toString().trim() === '')) {
      rowsToPredict.push({
        row: i + 2, // +2 because array is 0-indexed and we skipped header
        foodItem: foodItem.toString().trim()
      });
    }
  }

  if (rowsToPredict.length === 0) {
    SpreadsheetApp.getUi().alert('Nothing to Do', 'All food items already have storage predictions.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Confirm',
    `Found ${rowsToPredict.length} food item(s) without storage predictions.\n\nProceed with AI predictions?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const item of rowsToPredict) {
    try {
      const prediction = predictFoodStorage(item.foodItem);

      sheet.getRange(item.row, 4).setValue(prediction.storageMethod);
      sheet.getRange(item.row, 5).setValue(prediction.fridgeSection);

      successCount++;

      // Add delay to avoid rate limiting
      Utilities.sleep(500);

    } catch (error) {
      errorCount++;
      errors.push(`Row ${item.row} (${item.foodItem}): ${error.message}`);
      Logger.log(`Error processing row ${item.row}: ${error.toString()}`);
    }
  }

  let message = `Predictions complete!\n\nSuccess: ${successCount}\nErrors: ${errorCount}`;

  if (errors.length > 0) {
    message += '\n\nErrors:\n' + errors.slice(0, 5).join('\n');
    if (errors.length > 5) {
      message += `\n... and ${errors.length - 5} more errors (check logs)`;
    }
  }

  ui.alert('Results', message, ui.ButtonSet.OK);
}

/**
 * Interactive setup for Gemini API key
 */
function setupGeminiAPI() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    'Setup Gemini API',
    'Enter your Gemini API key:\n\n(Get one free at: https://aistudio.google.com/app/apikey)',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() === ui.Button.OK) {
    const apiKey = response.getResponseText().trim();

    if (apiKey) {
      PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
      ui.alert('Success', 'API key saved successfully!', ui.ButtonSet.OK);
    } else {
      ui.alert('Error', 'API key cannot be empty.', ui.ButtonSet.OK);
    }
  }
}

/**
 * Test function to verify Gemini API is working
 */
function testGeminiAPI() {
  try {
    const result = predictFoodStorage('Milk');
    Logger.log('Test successful! Prediction: ' + JSON.stringify(result));

    SpreadsheetApp.getUi().alert(
      'API Test Successful',
      `Gemini API is working!\n\nTest prediction for "Milk":\nStorage: ${result.storageMethod}\nSection: ${result.fridgeSection || '(none)'}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    Logger.log('Test failed: ' + error.toString());
    SpreadsheetApp.getUi().alert('API Test Failed', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
