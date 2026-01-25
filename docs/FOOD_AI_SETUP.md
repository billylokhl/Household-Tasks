# Food Expiration AI Setup Guide

## Overview

This guide will help you set up AI-powered storage predictions for your Food Expiration sheet using Google's Gemini AI.

---

## Prerequisites

1. **Google Sheets** with a sheet named "Food Expiration"
2. **Column Structure**:
   - Column A: Food item names
   - Column D: Storage method (will be predicted)
   - Column E: Fridge section (will be predicted)
3. **Google Apps Script** project with FoodExpirationAI.js added

---

## Step 1: Get a Gemini API Key (FREE)

1. **Visit Google AI Studio**:
   - Go to: https://aistudio.google.com/app/apikey

2. **Sign in** with your Google account

3. **Create API Key**:
   - Click **"Create API Key"**
   - Select your Google Cloud project (or create a new one)
   - Copy the API key that's generated

4. **Important Notes**:
   - The API key is **free** to use with Gemini 1.5 Flash
   - Free tier includes 1,500 requests per day
   - Keep your API key private (don't share it)

---

## Step 2: Add the Code to Your Google Sheets

### Option A: Via Apps Script Editor (Recommended)

1. **Open your Google Sheet** with "Food Expiration"

2. **Open Apps Script Editor**:
   - Click **Extensions** → **Apps Script**

3. **Add the FoodExpirationAI.js file**:
   - Click the **+** button next to "Files"
   - Select **Script**
   - Name it `FoodExpirationAI`
   - Copy and paste the entire contents of `FoodExpirationAI.js`
   - Click **Save** (disk icon)

4. **Update Code.js**:
   - Open `Code.js` (or Code.gs) in the Apps Script editor
   - Replace the `onOpen()` function with the updated version that includes the Food AI menu
   - Click **Save**

### Option B: Via clasp (For Advanced Users)

If you're already using clasp for deployment:

```bash
# Push the new files to your Google Apps Script project
clasp push
```

---

## Step 3: Configure the API Key

1. **Reload your Google Sheet**:
   - Close and reopen the sheet, OR
   - Refresh the page (⌘+R or Ctrl+R)

2. **You should see a new menu**: **🍎 Food AI**
   - If you don't see it, go to **Extensions** → **Apps Script** and run the `onOpen` function manually

3. **Set up your API key**:
   - Click **🍎 Food AI** → **Setup Gemini API**
   - Paste your API key from Step 1
   - Click **OK**

4. **Test the connection**:
   - Click **🍎 Food AI** → **Test API Connection**
   - You should see a success message with a test prediction for "Milk"

---

## Step 4: Using the AI Predictions

### Method 1: Predict Selected Items

**Best for**: Adding predictions one-by-one or for specific items

1. **Enter food item** in Column A (e.g., "Milk", "Carrots", "Bread")

2. **Select the cell(s)** in Column A that you want predictions for
   - You can select multiple cells at once (click and drag)

3. **Run prediction**:
   - Click **🍎 Food AI** → **Predict Selected Items**
   - Wait a few seconds (the AI processes each item)

4. **View results**:
   - Column D will show the predicted storage method
   - Column E will show the fridge section (if applicable)

### Method 2: Predict All Empty Items

**Best for**: Bulk processing all items without storage predictions

1. **Add food items** to Column A (as many as you want)

2. **Leave Columns D and E empty** for items you want predicted

3. **Run bulk prediction**:
   - Click **🍎 Food AI** → **Predict All Empty Items**
   - Confirm when prompted

4. **Wait for completion**:
   - The system will process all items automatically
   - You'll see a summary when it's done

---

## Understanding the Predictions

### Storage Methods (Column D)

The AI will choose from these options:
- **fridge** - For perishable items needing refrigeration
- **freezer** - For frozen items or long-term storage
- **kitchen cabinet** - For pantry items, oils, spices
- **food cabinet** - For dry goods, snacks, canned items
- **cake stand** - For baked goods displayed at room temperature

### Fridge Sections (Column E)

If storage method is "fridge", the AI will also predict:
- **1st shelf** - Top shelf (for ready-to-eat foods, leftovers)
- **2nd shelf** - Second shelf (for dairy, eggs)
- **3rd shelf** - Third shelf (for cooked foods, ready meals)
- **4th shelf** - Bottom shelf (for raw meat, fish)
- **veggie drawer** - For vegetables, herbs
- **fruit drawer** - For fruits

If storage is NOT "fridge", Column E will be empty.

---

## Examples

| Food Item | Predicted Storage (D) | Predicted Section (E) |
|-----------|----------------------|----------------------|
| Milk | fridge | 2nd shelf |
| Carrots | fridge | veggie drawer |
| Apples | fridge | fruit drawer |
| Ice cream | freezer | (empty) |
| Bread | kitchen cabinet | (empty) |
| Olive oil | kitchen cabinet | (empty) |
| Birthday cake | cake stand | (empty) |
| Ground beef | fridge | 4th shelf |

---

## Tips & Best Practices

### 1. **Be Specific with Food Names**
- ✅ Good: "Whole milk", "Baby carrots", "Sourdough bread"
- ❌ Less helpful: "Food", "Stuff", "Item"

### 2. **Process in Batches**
- For large datasets, process 20-30 items at a time
- This helps avoid rate limiting

### 3. **Review and Adjust**
- AI predictions are suggestions, not rules
- Feel free to override if you have different preferences
- The AI learns general best practices, but your needs may vary

### 4. **Rate Limiting**
- Free tier: 1,500 requests/day
- Function includes 500ms delay between requests
- Processing 100 items takes about 1 minute

### 5. **Error Handling**
- If you see errors, check the **View** → **Logs** in Apps Script
- Common issues:
  - API key not set or incorrect
  - Rate limit exceeded (wait 24 hours)
  - Network connectivity issues

---

## Troubleshooting

### Menu Doesn't Appear

**Solution**:
1. Go to **Extensions** → **Apps Script**
2. Click the **Run** button with `onOpen` selected
3. Authorize the script when prompted
4. Refresh your Google Sheet

### API Key Error

**Solution**:
1. Verify your API key is correct
2. Re-run **🍎 Food AI** → **Setup Gemini API**
3. Test with **Test API Connection**

### "Sheet Not Found" Error

**Solution**:
- Ensure your sheet is named exactly **"Food Expiration"** (case-sensitive)
- Check for extra spaces in the sheet name

### Predictions Seem Wrong

**Solution**:
- The AI makes educated guesses based on common practices
- You can always manually override the predictions
- Consider providing more specific food names

### Rate Limit Exceeded

**Solution**:
- Free tier allows 1,500 requests/day
- Wait 24 hours for the limit to reset
- Process in smaller batches

---

## Advanced Configuration

### Changing the AI Temperature

In `FoodExpirationAI.js`, find this section:

```javascript
generationConfig: {
  temperature: 0.2,  // Lower = more consistent, Higher = more creative
  maxOutputTokens: 100
}
```

- **Temperature 0.1-0.3**: More consistent, predictable responses
- **Temperature 0.5-1.0**: More varied, creative responses

### Customizing Storage Options

To add or change storage methods, update the prompt in the `predictFoodStorage()` function:

```javascript
Available storage methods:
- fridge
- freezer
- kitchen cabinet
- food cabinet
- cake stand
- wine rack        // Add your custom option
```

Also update the validation array:

```javascript
const validStorageMethods = ['fridge', 'freezer', 'kitchen cabinet', 'food cabinet', 'cake stand', 'wine rack'];
```

---

## Security & Privacy

### API Key Storage
- Your API key is stored in **Script Properties** (encrypted by Google)
- Not visible in the spreadsheet
- Only accessible by the script

### Data Privacy
- Food item names are sent to Google's Gemini API
- No other data from your spreadsheet is sent
- Google's privacy policy applies: https://policies.google.com/privacy

### Sharing Your Spreadsheet
- If you share your sheet, others will use YOUR API key
- Consider using a Google Cloud project with billing if sharing widely
- You can remove the API key: **🍎 Food AI** → **Setup Gemini API** → Delete the key

---

## Cost Information

### Free Tier
- **1,500 requests per day** (free)
- Gemini 1.5 Flash model
- Perfect for personal use

### Paid Tier
- If you exceed free limits, you'll need to enable billing in Google Cloud
- Pricing: Very low cost per request (fractions of a cent)
- See: https://ai.google.dev/pricing

---

## Support

### Check Logs
1. Go to **Extensions** → **Apps Script**
2. Click **View** → **Executions** to see recent runs
3. Check for error messages

### Test Individual Functions
In Apps Script editor:
1. Select a function (e.g., `testGeminiAPI`)
2. Click **Run**
3. View output in **Execution log**

---

## Changelog

**Version 1.0** (January 25, 2026)
- Initial release
- Gemini 1.5 Flash integration
- Batch prediction support
- Menu integration

---

**Enjoy AI-powered food storage predictions! 🍎🤖**
