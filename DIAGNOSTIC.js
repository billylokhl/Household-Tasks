/**
 * DIAGNOSTIC.js
 * Comprehensive diagnostic to find exactly where the prediction fails
 */

function diagnosticTestFull() {
  const ui = SpreadsheetApp.getUi();

  try {
    Logger.log('=== DIAGNOSTIC START ===');
    ui.alert('Diagnostic Started', 'Check execution log for details. This will take a moment...', ui.ButtonSet.OK);

    // Step 1: API Key
    Logger.log('Step 1: Checking API key...');
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('No API key found');
    }
    Logger.log('✓ API key found: ' + apiKey.substring(0, 10) + '...');

    // Step 2: Build prompt
    Logger.log('Step 2: Building prompt...');
    const foodItem = 'Milk';
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

If storage method is NOT "fridge", set fridgeSection to empty string.

IMPORTANT: Respond with ONLY a valid JSON object, nothing else. No explanations, no markdown. Just the JSON.
Format: {"storageMethod": "method", "fridgeSection": "section or empty string"}

Example responses:
{"storageMethod": "fridge", "fridgeSection": "2nd shelf"}
{"storageMethod": "freezer", "fridgeSection": ""}`;
    Logger.log('✓ Prompt built (length: ' + prompt.length + ')');

    // Step 3: Build request
    Logger.log('Step 3: Building API request...');
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
    Logger.log('✓ Request built');

    // Step 4: Make API call
    Logger.log('Step 4: Calling Gemini API...');
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    Logger.log('✓ API responded with code: ' + responseCode);

    if (responseCode !== 200) {
      const errorText = response.getContentText();
      Logger.log('✗ API Error: ' + errorText);
      throw new Error(`API error (${responseCode}): ${errorText}`);
    }

    // Step 5: Parse response
    Logger.log('Step 5: Parsing API response...');
    const fullResponse = response.getContentText();
    Logger.log('Response length: ' + fullResponse.length);
    Logger.log('First 200 chars: ' + fullResponse.substring(0, 200));

    const result = JSON.parse(fullResponse);
    Logger.log('✓ Response parsed as JSON');

    // Step 6: Extract text
    Logger.log('Step 6: Extracting text from response...');
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('No candidates in response');
    }
    Logger.log('Candidates: ' + result.candidates.length);
    Logger.log('Parts: ' + result.candidates[0].content.parts.length);

    let textResponse = '';
    for (let i = 0; i < result.candidates[0].content.parts.length; i++) {
      const part = result.candidates[0].content.parts[i];
      if (part.text) {
        Logger.log('Part ' + i + ': ' + part.text);
        textResponse += part.text;
      }
    }
    textResponse = textResponse.trim();
    Logger.log('✓ Combined text: ' + textResponse);

    if (!textResponse) {
      throw new Error('Empty text response');
    }

    // Step 7: Clean response
    Logger.log('Step 7: Cleaning response...');
    let cleaned = textResponse;

    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      Logger.log('Removed ```json wrapper');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
      Logger.log('Removed ``` wrapper');
    }

    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
      Logger.log('Extracted JSON from position ' + jsonStart + ' to ' + jsonEnd);
    }

    Logger.log('Cleaned response: ' + cleaned);
    Logger.log('✓ Response cleaned (length: ' + cleaned.length + ')');

    // Step 8: Parse JSON
    Logger.log('Step 8: Parsing prediction JSON...');
    let prediction;
    try {
      prediction = JSON.parse(cleaned);
      Logger.log('✓ Prediction parsed: ' + JSON.stringify(prediction));
    } catch (parseError) {
      Logger.log('✗ JSON parse failed: ' + parseError.toString());
      Logger.log('Attempted to parse: ' + cleaned);
      throw new Error('Parse error: ' + parseError.message + '\nResponse: ' + cleaned);
    }

    // Step 9: Validate
    Logger.log('Step 9: Validating prediction...');
    if (!prediction.storageMethod) {
      throw new Error('Missing storageMethod');
    }
    Logger.log('Storage method: ' + prediction.storageMethod);
    Logger.log('Fridge section: ' + (prediction.fridgeSection || '(none)'));

    Logger.log('=== DIAGNOSTIC COMPLETE - SUCCESS ===');
    ui.alert(
      'Diagnostic Successful! ✓',
      `All steps completed successfully!\n\nPrediction for "Milk":\n- Storage: ${prediction.storageMethod}\n- Section: ${prediction.fridgeSection || '(none)'}\n\nCheck execution log for detailed step-by-step results.`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    Logger.log('=== DIAGNOSTIC FAILED ===');
    Logger.log('Error: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'no stack'));

    ui.alert(
      'Diagnostic Failed',
      'Error: ' + error.message + '\n\nCheck execution log for full details.',
      ui.ButtonSet.OK
    );
  }
}
