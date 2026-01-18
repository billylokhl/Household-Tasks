# Project Architecture and Functional Requirements

This Google Apps Script project is a household task management system with prioritization, time tracking, analytics, and automated archival capabilities.

## Core Module Specifications

### 1. Code.js - Main Entry Point & Menu System
**Purpose**: Central hub providing menu access and helper functions

**Critical Functions**:
- `onOpen()`: MUST restore custom menu "🚀 Task Tools" with items: Planner, View Incident Trend, View Task Time Trend, Sync Task Database, Manual Backup
- `getSS()`: Returns active spreadsheet instance
- `findTaskRowInHistory(category, taskName)`: Locates task row in TaskHistory sheet by case-insensitive name match
- `findDateColInHistory(targetDate)`: Finds date column in TaskHistory sheet using yyyy-MM-dd format matching

**UI Openers**:
- `openPlanner()`: Opens DayPlannerUI.html modal (1000x750)
- `showIncidentTrendModal()`: Opens IncidentTrendUI.html modal (1100x850)
- `showTimeTrendModal()`: Opens TimeTrendUI.html modal (1200x850)

**Constants**:
- `BACKUP_FOLDER_ID`: "1S_HRJlzJ9JPMcD2aamy036FIGb8xxd96"

### 2. Configuration.js - Centralized Constants
**Purpose**: Single source of truth for all configuration values

**Must Include**:
```javascript
const CONFIG = {
  SHEET: {
    PRIORITIZATION: "Prioritization",
    ARCHIVE: "TaskArchive",
    HISTORY: "TaskHistory"
  },
  BACKUP: {
    FOLDER_ID: "1S_HRJlzJ9JPMcD2aamy036FIGb8xxd96"
  },
  COLORS: {
    DARK_MODE_BG: "#1e293b",
    DARK_MODE_TEXT: "#f1f5f9",
    DARK_MODE_BORDER: "#334155",
    LIGHT_MODE_BG: "#ffffff",
    LIGHT_MODE_TEXT: "#334155",
    LIGHT_MODE_BORDER: "#cccccc"
  }
};
```

### 3. Utilities.js - Shared Helper Functions
**Purpose**: Reusable utility functions for date/time parsing

**Required Functions**:
- `safeParseDate(val)`: Safely parses Date objects, returns null if invalid
- `parseTimeValue(val)`: Converts time strings ("30m", "1h", "2 days") and numbers to total minutes
  - Must handle: numbers (direct minutes), "day(s)" → 480 mins, "hour/hr" → 60 mins, default to minutes

### 4. SyncService.js - Archive Synchronization Engine
**Purpose**: Syncs completed tasks from Prioritization to TaskArchive with cleanup

**Critical Functions**:
- `runUnifiedSync()`: Opens StatusSidebar.html modal (350x250)
- `executeFullServerSync()`: Master sync engine with these responsibilities:
  1. **Dynamic Column Detection**: Scans headers to build column map
  2. **Schema Migration**: Auto-heals Archive structure when columns change, preserving existing data by remapping
  3. **Completion Filtering**: Only syncs tasks where CompletionDate is not empty
  4. **Deduplication**: Keeps most recent version based on Sync Date
  5. **Archive Structure**: First column is "Sync Date", followed by all Prioritization columns
  6. **Cleanup Workflow**: Calls `performPrioritizationCleanup` after archiving

- `performPrioritizationCleanup(sheet, fullData, colMap, completionMapping, taskMapping)`:
  - **CRITICAL**: NEVER delete tasks with IncidentDate (preserve for incident tracking)
  - **Non-recurring tasks**: Delete entirely from Prioritization
  - **Recurring tasks**: Keep row, clear only CompletionDate🐱 and CompletionDate🐷 fields
  - Process rows in reverse order to handle deletions safely

- `pruneArchiveDuplicatesSafe(sheet)`:
  - Deduplication key: Task name + CompletionDate
  - Keep row with most recent Sync Date
  - Filter out rows without CompletionDate

### 5. DayPlanner.js - Task Planning Interface
**Purpose**: Provides filtered view of upcoming tasks for daily planning

**Critical Functions**:
- `getPlannedTasks(config)`: Returns filtered task list with:
  - **Ownership Filter**: 🐷 (Billy) or 🐱 (Karen) based on Ownership columns
  - **Date Range**: Today through (Today + daysToPlan - 1)
  - **Overdue Handling**: Include tasks before today only if `includeOverdue === "Yes"`
  - **Completion Filter**: Show/hide DONE status tasks based on `showCompleted`
  - **Sorting**: By PriorityScore descending

**Return Fields**:
- sheetRow, score, imp, task, ectRaw, cat, dueDate, isoDate, day, dueSort, ectMins, isDone

- `updatePlannerTask(rowId, field, value)`: Updates ReferenceDueDate, ECT, or Importance
  - Must trigger SpreadsheetApp.flush() to recalculate formulas
  - Returns updated PriorityScore

### 6. AnalyticsService.js - Time & Incident Analytics
**Purpose**: Generates visualization data for time trends and incident tracking

**Critical Functions**:
- `getTimeSpentData()`: Time trend over last 30 days
  - **Data Source**: TaskArchive sheet
  - **Column Detection**: Flexible header matching for Ownership🐷/🐱, ECT, Category, CompletionDate
  - **Top Categories**: Top 10 by total time, remainder grouped as "Other"
  - **Timeline**: Last 30 days with MM/dd (E) format labels
  - **Owner Separation**: Separate datasets for Billy and Karen
  - **Tooltips**: HTML tooltips showing category breakdown per day
  - **Debug Logging**: Include detailed logs for troubleshooting
  - Returns: ownerNames, dataA/B (chart data), detailsA/B (task details), catsA/B (categories), logs

- `getIncidentTrendData()`: Incident trends with 14-day rolling sum
  - **Data Source**: TaskArchive sheet with IncidentDate column
  - **Rolling Window**: 14-day rolling sum displayed over last 30 days
  - **Owner Split**: Separate trends for 🐷 and 🐱 based on IncidentOwner
  - **Details Table**: Last 30 days of incidents sorted by date descending
  - Returns: pig/cat arrays ([["Date", "Sum"], ...]), details.pig/cat (sorted incident lists)

### 7. BackupSystem.js - Automated Backup & Retention
**Purpose**: Creates hourly snapshots with 7-day retention

**Critical Function**:
- `createHourlySnapshot()`:
  - Creates copy in backup folder with format: `Backup_{SheetName}_yyyy-MM-dd_HHmm`
  - Automatically deletes backups older than 7 days
  - Shows toast notification with deletion count
  - Error handling with toast on failure

### 8. UI Components

**DayPlannerUI.html**:
- Filters: Days Out, Show Overdue, Show Completed, Owner (🐷/🐱)
- Sortable table columns: Due, Day, Task, ECT, Imp, Score, Cat, Commit
- Inline column filtering (text inputs in headers)
- Total Committed display (sum of checked tasks)
- Commit checkbox to track planned tasks
- Done status visual styling (grayed out)
- Refresh and Reset Filter buttons

**StatusSidebar.html**:
- Terminal-style dark mode UI
- Auto-runs `executeFullServerSync()` on load
- Shows multi-line sync status with HTML breaks
- Retry button after completion

**IncidentTrendUI.html & TimeTrendUI.html**:
- Google Charts integration
- Dark mode styling
- Category/incident details tables
- Responsive chart sizing

## Data Flow Architecture

1. **Task Creation**: Tasks created in Prioritization sheet with ownership, due dates, categories
2. **Task Completion**: CompletionDate fields (🐱/🐷) marked when done
3. **Sync Trigger**: Manual sync via menu or automatic schedule
4. **Archive Process**: executeFullServerSync → performPrioritizationCleanup
5. **Analytics**: Archive data powers time trend and incident trend charts
6. **Backup**: Hourly snapshots with auto-cleanup

## Sheet Schemas

**Prioritization Sheet**:
- Task, Category, Importance, ECT, PriorityScore, DueDate, ReferenceDueDate
- Ownership🐷, Ownership🐱, CompletionDate🐷, CompletionDate🐱
- IncidentDate, IncidentOwner, Recurrence, DaysTillDue

**TaskArchive Sheet**:
- Sync Date (first column)
- All columns from Prioritization (dynamic)
- Must handle schema changes via migration

**TaskHistory Sheet**:
- Row-based: Category (col 1), Task (col 2)
- Column-based: Dates as headers from col 3 onwards (Date format yyyy-MM-dd)

## Critical Preservation Rules

1. **Never delete tasks with IncidentDate** - These are tracked separately for incident analytics
2. **Always use flexible column detection** - Headers may have emoji variations
3. **Preserve schema migration logic** - Critical for backward compatibility
4. **Maintain deduplication keys** - Task + CompletionDate uniqueness
5. **Keep backup folder ID consistent** - "1S_HRJlzJ9JPMcD2aamy036FIGb8xxd96"
6. **Respect ownership separation** - 🐷 (Billy) vs 🐱 (Karen) throughout system
7. **Time parsing consistency** - Always use parseTimeValue() helper
8. **Date formatting** - yyyy-MM-dd for storage, MM/dd (E) for display

---

# Git Commit Instructions

When generating git commit messages, follow the **Conventional Commits** specification. This provides a consistent and readable history for the project.

## Commit Message Format

Each commit message consists of a **header**, a **body**, and a **footer**. The header has a special format that includes a **type**, a **scope**, and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

## Line Length Rules

- The **header** line should ideally be **50 characters**, and must not exceed **72 characters**.
- The **body** and **footer** lines should be wrapped at **72 characters**.

## Atomic Commits

- Structure unstaged changes into a series of focused commits where sensible.
- Each commit should be suitably focused and avoid including too many unrelated changes.
- Stage specific hunks within the same file and commit them separately if they belong to different logical changes.

## Header

The **header** is mandatory. The scope of the header is optional.

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope

The scope should be the name of the section of the codebase affected (e.g., `deps`, `ui`, `api`, `auth`).

### Subject

The subject contains a succinct description of the change:

- Use the imperative, present tense: "change" not "changed" nor "changes".
- Don't capitalize the first letter.
- No dot (.) at the end.

## Body

The body should include the motivation for the change and contrast this with previous behavior.

- Use the imperative, present tense.
- Can consist of multiple paragraphs.

## Footer

The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit **Closes**.

- **Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

## Examples

**Feature commit:**
```
feat(auth): add login with google support
```

**Bug fix:**
```
fix(api): handle null response in user service
```

**Breaking change:**
```
feat(database): switch to new connection pool library

BREAKING CHANGE: The config object for database connection has changed structure.
```
