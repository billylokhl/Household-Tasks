# Food AI - Quick Reference

## 🚀 Quick Start (3 Steps)

1. **Get API Key**: https://aistudio.google.com/app/apikey
2. **Add to Sheet**: 🍎 Food AI → Setup Gemini API
3. **Predict**: Select food items → Predict Selected Items

---

## 📋 Menu Options

### 🍎 Food AI Menu

| Option | When to Use |
|--------|-------------|
| **Predict Selected Items** | Select cells in Column A, then run |
| **Predict All Empty Items** | Bulk predict all items without storage |
| **Setup Gemini API** | First-time setup or change API key |
| **Test API Connection** | Verify your API key works |

---

## 🗂️ Storage Options

### Column D: Storage Method
- `fridge` - Refrigerated items
- `freezer` - Frozen items
- `kitchen cabinet` - Pantry items
- `food cabinet` - Dry goods
- `cake stand` - Display baked goods

### Column E: Fridge Section (only if D = "fridge")
- `1st shelf` - Top shelf (ready-to-eat)
- `2nd shelf` - Dairy, eggs
- `3rd shelf` - Cooked foods
- `4th shelf` - Raw meat, fish
- `veggie drawer` - Vegetables, herbs
- `fruit drawer` - Fruits

---

## 💡 Examples

```
Milk          → fridge, 2nd shelf
Carrots       → fridge, veggie drawer
Ice cream     → freezer, (empty)
Olive oil     → kitchen cabinet, (empty)
Ground beef   → fridge, 4th shelf
```

---

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| No menu | Run `onOpen()` in Apps Script |
| API error | Re-enter API key via Setup menu |
| Wrong predictions | Manually override in spreadsheet |
| Rate limit | Wait 24 hours (1,500 free/day) |

---

## 📞 Need Help?

See full guide: [FOOD_AI_SETUP.md](FOOD_AI_SETUP.md)
