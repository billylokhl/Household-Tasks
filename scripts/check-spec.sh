#!/bin/bash
# Helper script to review code changes and guide spec updates

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Spec Update Assistant"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if there are unstaged or staged JS changes
if ! git diff --name-only | grep -q '\.js$' && ! git diff --cached --name-only | grep -q '\.js$'; then
    echo "✅ No JavaScript files modified."
    exit 0
fi

echo "Modified JavaScript files:"
echo ""
git diff --name-only | grep '\.js$' | sed 's/^/  📄 /'
git diff --cached --name-only | grep '\.js$' | sed 's/^/  📄 [staged] /'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Review Checklist for Spec Updates:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  ☐ New functions added?"
echo "  ☐ Function signatures changed (parameters added/removed)?"
echo "  ☐ Critical behavior logic modified?"
echo "  ☐ New constants or configuration values?"
echo "  ☐ Return value structure changed?"
echo "  ☐ New dependencies or sheet columns?"
echo "  ☐ Changes to data flow or processing?"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To view detailed changes, use:"
echo "  git diff [filename]          - View unstaged changes"
echo "  git diff --cached [filename] - View staged changes"
echo ""
echo "To edit the spec:"
echo "  code .github/copilot-instructions.md"
echo ""
