# Git Configuration for This Project

## Quick Setup

Add these helpful aliases to your git config:

```bash
# Check if spec needs updating
git config alias.spec '!bash scripts/check-spec.sh'

# View spec file
git config alias.view-spec '!code .github/copilot-instructions.md'
```

After setup, you can use:
- `git spec` - Run the spec check helper
- `git view-spec` - Open the spec in VS Code

## Pre-commit Hook

The pre-commit hook at `.git/hooks/pre-commit` automatically checks if JavaScript files are being committed and prompts you to update the spec.

### How it works:
1. You try to commit changes that include `.js` files
2. Hook lists the modified files
3. Prompts: "Have you updated the spec if needed?"
4. If you answer 'n', the commit is aborted
5. If you answer 'y', the commit proceeds

### To bypass the hook (not recommended):
```bash
git commit --no-verify
```

### To disable the hook:
```bash
chmod -x .git/hooks/pre-commit
```

### To re-enable the hook:
```bash
chmod +x .git/hooks/pre-commit
```
