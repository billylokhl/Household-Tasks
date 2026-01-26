# Food AI Learning System

## Overview

The Food AI system now learns from your corrections! When Gemini misclassifies a food item, simply correct it manually, and the system will remember your preference for future predictions.

---

## How It Works

### 1. **Automatic Learning**
When you manually edit columns D (Storage Method) or E (Fridge Section), the system automatically records your correction.

### 2. **Instant Lookup**
Next time you predict the same food item:
- If we've seen it before → Use your learned value (no API call, instant!)
- If it's new → Ask Gemini, but include similar learned items as examples

### 3. **Continuous Improvement**
The more you use and correct the system, the smarter it gets.

---

## User Guide

### Making Corrections

1. **Run prediction** (via "Predict Selected Items" or "Predict All Empty Items")
2. **If wrong**, manually edit columns D/E with the correct values
3. **Done!** The system has learned from your correction

### Viewing Learning Data

**Menu**: `🍎 Food AI` → `📚 View Learning Data`

Shows all food items the system has learned, with timestamps and sources.

You can edit or delete rows to modify what the system knows.

### Clearing Learning Data

**Menu**: `🍎 Food AI` → `🗑️ Clear Learning Data`

Resets the system (useful for testing or starting fresh).

---

## Technical Details

### Data Storage

- **Sheet**: `FoodAI_Learning` (hidden by default)
- **Columns**:
  - Food Item (normalized lowercase for matching)
  - Storage Method
  - Fridge Section
  - Last Updated (timestamp)
  - Source ('manual' or 'ai-confirmed')

### Matching Logic

- **Exact match**: Case-insensitive food name match
- **Few-shot learning**: Up to 5 recent learned items included in Gemini prompt

### Source Types

- `manual` - User manually corrected a prediction
- `ai-confirmed` - Gemini's prediction was used (can be overridden by manual correction)

---

## Examples

### Example 1: Learning from Correction

**First time predicting "Greek Yogurt":**
```
Gemini says: kitchen cabinet → ❌ Wrong!
You correct it to: fridge, 2nd shelf
System learns: "Greek Yogurt" → fridge, 2nd shelf
```

**Next time:**
```
System instantly returns: fridge, 2nd shelf (no API call)
```

### Example 2: Few-Shot Learning

**System has learned:**
- Milk → fridge, 2nd shelf
- Cheddar Cheese → fridge, 2nd shelf
- Yogurt → fridge, 2nd shelf

**Predicting "Sour Cream" (new item):**

Gemini receives prompt with examples:
```
Here are some examples of correct storage from past experience:
- Yogurt: {"storageMethod": "fridge", "fridgeSection": "2nd shelf"}
- Cheddar Cheese: {"storageMethod": "fridge", "fridgeSection": "2nd shelf"}
- Milk: {"storageMethod": "fridge", "fridgeSection": "2nd shelf"}

Now predict for: "Sour Cream"
```

Gemini likely predicts correctly based on similar dairy products!

---

## Privacy & Data

- **All data stays in your Google Sheet** (hidden sheet)
- **No external storage** - everything is local to your spreadsheet
- **You control the data** - view, edit, or delete anytime

---

## Troubleshooting

### Learning not working?

1. Verify you're editing the "Food Expiration" sheet
2. Check that column A has the food item name
3. Ensure columns D/E have valid storage values
4. View learning data to confirm it was recorded

### Want to retrain an item?

Just manually edit columns D/E again - the system updates with the latest correction.

### Hidden sheet disappeared?

Run **"📚 View Learning Data"** from the menu to unhide it.

---

## Benefits

✅ **Faster predictions** - No API calls for known items
✅ **More accurate** - Learns your specific preferences
✅ **Cost effective** - Reduces API usage over time
✅ **Personalized** - Adapts to your household's storage habits
✅ **Zero maintenance** - Works automatically in the background
