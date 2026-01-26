/**
 * Simple diagnostic test for Gemini API
 * Run this directly from Apps Script editor
 */
function testGeminiSimple() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    Logger.log('ERROR: No API key found');
    SpreadsheetApp.getUi().alert('No API key configured');
    return;
  }

  Logger.log('API Key found: ' + apiKey.substring(0, 10) + '...');

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;

  const payload = {
    contents: [{
      parts: [{
        text: 'For the food item "Milk", respond with ONLY this exact JSON and nothing else: {"storageMethod": "fridge", "fridgeSection": "2nd shelf"}'
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

    const fullResponse = response.getContentText();
    Logger.log('Full response: ' + fullResponse);

    if (responseCode === 200) {
      const result = JSON.parse(fullResponse);
      Logger.log('Parsed successfully');
      Logger.log('Candidates: ' + result.candidates.length);

      if (result.candidates && result.candidates.length > 0) {
        const parts = result.candidates[0].content.parts;
        Logger.log('Parts count: ' + parts.length);

        for (let i = 0; i < parts.length; i++) {
          Logger.log('Part ' + i + ': ' + parts[i].text);
        }
      }

      SpreadsheetApp.getUi().alert('Success! Check execution log for details.');
    } else {
      SpreadsheetApp.getUi().alert('Error ' + responseCode + ': ' + fullResponse);
    }

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
  }
}
