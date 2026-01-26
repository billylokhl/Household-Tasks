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
  Logger.log('=== Starting predictFoodStorage for: ' + foodItem + ' ===');

  // First, check if we've learned this food item before
  const learned = lookupLearnedStorage(foodItem);
  if (learned) {
    Logger.log('Found learned storage for: ' + foodItem);
    Logger.log('Using learned values: ' + JSON.stringify(learned));
    return {
      storageMethod: learned.storageMethod,
      fridgeSection: learned.fridgeSection,
      source: 'learned'
    };
  }

  Logger.log('No learned data found, querying Gemini...');

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please run setupGeminiAPI() first.');
  }

  Logger.log('API key found');

  // Build prompt with learned examples for few-shot learning
  const prompt = buildPromptWithLearning(foodItem);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    Logger.log('Calling Gemini API...');
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    Logger.log('Response code: ' + responseCode);

    if (responseCode !== 200) {
      const errorText = response.getContentText();
      Logger.log('API Error Response: ' + errorText);
      throw new Error(`Gemini API error (${responseCode}): ${errorText}`);
    }

    const fullResponseText = response.getContentText();
    Logger.log('Full API response length: ' + fullResponseText.length);

    const result = JSON.parse(fullResponseText);

    if (!result.candidates || result.candidates.length === 0) {
      Logger.log('No candidates in response');
      throw new Error('No response from Gemini API');
    }

    Logger.log('Number of candidates: ' + result.candidates.length);
    Logger.log('Number of parts: ' + result.candidates[0].content.parts.length);

    // Get text from all parts
    let textResponse = '';
    for (let i = 0; i < result.candidates[0].content.parts.length; i++) {
      const part = result.candidates[0].content.parts[i];
      if (part.text) {
        Logger.log('Part ' + i + ' text: ' + part.text);
        textResponse += part.text;
      }
    }

    textResponse = textResponse.trim();
    Logger.log('Combined text response: ' + textResponse);

    if (!textResponse) {
      throw new Error('Gemini returned empty text response');
    }

    // Extract JSON from response
    let cleanedResponse = textResponse;

    // Remove markdown if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }

    // Extract JSON object
    const jsonStartIndex = cleanedResponse.indexOf('{');
    const jsonEndIndex = cleanedResponse.lastIndexOf('}');

    if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
      cleanedResponse = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);
    }

    Logger.log('Cleaned response: ' + cleanedResponse);

    // Parse JSON
    let prediction;
    try {
      prediction = JSON.parse(cleanedResponse);
      Logger.log('Successfully parsed JSON');
    } catch (parseError) {
      Logger.log('JSON Parse Error: ' + parseError.toString());
      Logger.log('Attempted to parse: ' + cleanedResponse);
      throw new Error('Failed to parse Gemini response as JSON: ' + parseError.message + '\nResponse: ' + cleanedResponse);
    }

    // Validate
    const validStorageMethods = ['fridge', 'freezer', 'kitchen cabinet', 'food cabinet', 'cake stand'];
    const validFridgeSections = ['1st shelf', '2nd shelf', '3rd shelf', '4th shelf', 'veggie drawer', 'fruit drawer'];

    if (!validStorageMethods.includes(prediction.storageMethod)) {
      throw new Error(`Invalid storage method: ${prediction.storageMethod}`);
    }

    // Normalize fridgeSection
    if (!prediction.fridgeSection) {
      prediction.fridgeSection = '';
    }

    // Validate fridgeSection if provided
    if (prediction.fridgeSection && !validFridgeSections.includes(prediction.fridgeSection)) {
      throw new Error(`Invalid fridge section: ${prediction.fridgeSection}`);
    }

    // Ensure fridgeSection is empty if not fridge
    if (prediction.storageMethod !== 'fridge') {
      prediction.fridgeSection = '';
    }


    // Record this AI prediction as learned data (user can correct later)
    recordFoodLearning(foodItem, prediction.storageMethod, prediction.fridgeSection, 'ai-confirmed');

    Logger.log('=== Prediction successful: ' + JSON.stringify(prediction) + ' ===');
    return prediction;

  } catch (error) {
    Logger.log('=== ERROR in predictFoodStorage: ' + error.toString() + ' ===');
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
