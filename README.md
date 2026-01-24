# Household Task Management System

A Google Apps Script project for household task management with prioritization, time tracking, analytics, and automated archival capabilities.

## Overview

This system provides:
- **Task Prioritization**: Calculate priority scores based on importance, ECT, and due dates
- **Day Planner**: Filter and plan tasks by owner, date range, and completion status
- **Time Trend Analytics**: Track time spent on tasks with moving averages and projections
- **Incident Tracking**: Monitor incidents with rolling 14-day trends
- **Automated Sync**: Archive completed tasks while preserving incident data
- **Automated Backups**: Hourly snapshots with 7-day retention

## Project Structure

```
.
├── Code.js                  # Main entry point & menu system
├── Configuration.js         # Centralized constants
├── Utilities.js             # Shared helper functions
├── SyncService.js           # Archive synchronization engine
├── DayPlanner.js            # Task planning interface
├── AnalyticsService.js      # Time & incident analytics
├── BackupSystem.js          # Automated backup & retention
├── DayPlannerUI.html        # Task planner modal interface
├── StatusSidebar.html       # Sync status display
├── IncidentTrendUI.html     # Incident trend visualization
├── TimeTrendUI.html         # Time trend visualization
├── .github/
│   └── copilot-instructions.md  # Project spec & documentation
├── docs/
│   └── GIT_SETUP.md         # Git configuration guide
└── scripts/
    ├── check-spec.sh        # Spec update helper
    └── README.md            # Script documentation
```

## Development Workflow

### Before Committing Code Changes

A pre-commit hook automatically ensures the project spec stays up to date:

1. **Make your code changes** in any `.js` files
2. **Stage your changes**: `git add <files>`
3. **Try to commit**: `git commit -m "your message"`
4. **Hook activates** if `.js` files are staged:
   - Lists modified files
   - Prompts: "Have you updated the spec if needed?"
   - Aborts commit if you answer 'n'
5. **Update spec if needed**: Edit [.github/copilot-instructions.md](.github/copilot-instructions.md)
6. **Stage spec**: `git add .github/copilot-instructions.md`
7. **Commit again**: Hook will proceed

### Helper Commands

```bash
# Check if spec needs updating
./scripts/check-spec.sh

# View detailed changes
git diff <filename>

# View staged changes
git diff --cached <filename>
```

## Documentation

- **Project Architecture**: [.github/copilot-instructions.md](.github/copilot-instructions.md)
- **Product Requirements**: [docs/PRD.md](docs/PRD.md)
- **Git Setup Guide**: [docs/GIT_SETUP.md](docs/GIT_SETUP.md)
- **Scripts Documentation**: [scripts/README.md](scripts/README.md)
- **Testing Guide**: [tests/README.md](tests/README.md)

## Testing

This project includes automated testing infrastructure using Jest with Google Apps Script mocks.

### Quick Start

```bash
# Install dependencies (first time only)
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Structure

- **Unit Tests** (`tests/unit/`): Test individual functions in isolation
  - `utilities.test.js` - Date and time parsing functions
  - `configuration.test.js` - Configuration validation
- **Integration Tests** (`tests/integration/`): Test modules with mocked Google services
  - `day-planner.test.js` - Task filtering and planning logic
- **Mocks** (`tests/mocks/`): Mock implementations of Google Apps Script services

### Current Test Coverage

✅ **28 tests passing**
- Utilities: Date parsing, time value conversion
- Configuration: Constants validation
- DayPlanner: Task filtering, owner separation, date ranges, completion status

For detailed testing documentation, see [tests/README.md](tests/README.md).
