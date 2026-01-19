# Development Scripts

## check-spec.sh

Helper script to review code changes and guide spec updates.

**Usage:**
```bash
./scripts/check-spec.sh
```

This script:
- Shows which JavaScript files have been modified
- Provides a checklist of what to review when updating specs
- Offers commands to view detailed changes

**When to run:**
- Before committing changes to .js files
- When the pre-commit hook prompts you to review the spec
- Any time you want to check if spec updates are needed

## Automated Spec Enforcement

A git pre-commit hook has been installed at `.git/hooks/pre-commit` that:
1. Detects when JavaScript files are being committed
2. Prompts you to confirm the spec has been reviewed/updated
3. Prevents commits if you haven't reviewed the spec

The hook will **not** modify files automatically - it only ensures you remember to review and update the spec manually when needed.
