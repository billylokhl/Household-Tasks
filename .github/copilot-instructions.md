# Project Architecture and Functional Requirements

This Google Apps Script project is a household task management system with prioritization, time tracking, analytics, and automated archival capabilities.

## Core Module Specifications

### 1. Code.js - Main Entry Point & Menu System
**Purpose**: Central hub providing menu access and helper functions

**Critical Functions**:
- `onOpen()`: MUST restore custom menu "🚀 Task Tools" with items: Planner, View Incident Trend, View Task Time Trend, Sync Task Database, Daily Cleanup, Manual Backup
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
  4. **Archive to Prioritization Sync**: Writes new completed tasks to archive
  5. **Deduplication**: Runs `pruneArchiveDuplicatesSafe` to keep most recent version based on Sync Date
  6. **Note**: Does NOT clean up Prioritization (that's handled by `runDailyCleanup`)

- `runDailyCleanup()`: Scheduled daily cleanup function (run after midnight via time-based trigger)
  - Calls `performPrioritizationCleanup` to process completed tasks
  - Should be set up as a daily time-based trigger in Apps Script

- `performPrioritizationCleanup(priSheet, archiveSheet, tz)`:
  - Reads TaskArchive to identify all completed tasks (task name + completion date)
  - Scans Prioritization sheet for tasks that exist in archive
  - **Non-recurring tasks without incidents**: Delete entirely from Prioritization (uses `.clear()` then `deleteRow()`)
  - **Recurring tasks**: Keep row, clear only CompletionDate🐱 and CompletionDate🐷 fields
  - **Tasks with IncidentDate**: NEVER delete (preserve for incident tracking)
  - Process rows in reverse order to handle deletions safely

- `pruneArchiveDuplicatesSafe(sheet)`:
  - Deduplication key: Task name (lowercase) + CompletionDate (yyyy-MM-dd format)
  - Keep row with most recent Sync Date timestamp
  - Robust sync date parsing (handles Date objects and strings)

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
- `getTimeSpentData(maWindow, weekendOnly, daysAhead)`: Time trend over last 30 days
  - **Parameters**:
    - `maWindow` (number, default 28): Moving average window in days
    - `weekendOnly` (boolean, default true): If true, MA only considers weekend days
    - `daysAhead` (number, default 0): Days to look ahead for projected task times
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

## Documentation Maintenance

### PRD Updates Required

**CRITICAL**: The Product Requirements Document (docs/PRD.md) must be updated whenever features are added, removed, or significantly modified.

**When to Update the PRD**:
1. **New Feature Added** - Add to "Core Features" section with full specification
2. **Feature Removed** - Remove from PRD or move to "Deprecated Features" appendix
3. **Feature Modified** - Update affected sections (requirements, workflows, UI specs)
4. **Data Model Changes** - Update schema documentation when columns/sheets change
5. **UI Changes** - Update UI specifications when modals/interfaces are modified
6. **API/Function Signature Changes** - Update technical specifications
7. **Workflow Changes** - Update relevant workflow documentation

**Sections That May Need Updates**:
- Core Features (when features change)
- Functional Requirements (when behavior changes)
- Data Model (when schema changes)
- User Interface (when UI changes)
- Workflows (when processes change)
- Technical Specifications (when architecture changes)

**AI Assistant Workflow**:
1. After implementing a feature change, ask: "Should I update the PRD to reflect this change?"
2. If yes, identify affected sections
3. Update PRD with precise changes (use multi_replace_string_in_file for efficiency)
4. Commit PRD updates separately with `docs(prd):` prefix
5. Ensure PRD stays in sync with implementation

**Example PRD Update Commit**:
```
docs(prd): update recurring tasks feature specification

Add WeekdayOK whitelist column to data model section.
Update Functional Requirements FR-8 with whitelist behavior.
Add whitelist workflow to Recurring Task Monitoring section.
```

### Test Documentation Updates Required

**CRITICAL**: The Test Documentation (tests/README.md) must be updated whenever test infrastructure, test cases, or testing workflows change.

**When to Update Test Documentation**:
1. **New Test Suite Added** - Add to test structure section with description
2. **New Mock Created** - Document mock classes and their usage
3. **Test Helper Functions** - Document reusable test utilities
4. **Coverage Changes** - Update coverage statistics and goals
5. **Testing Workflow Changes** - Update instructions for running tests
6. **New Testing Tools** - Document new dependencies or frameworks
7. **Testing Best Practices** - Add new patterns or conventions

**Sections That May Need Updates**:
- Test Structure (when new test files added)
- Test Types (when new test categories created)
- Writing New Tests (when patterns change)
- Mocking Google Apps Script (when mocks updated)
- Coverage (when test coverage changes)
- Limitations (when new testing constraints discovered)
- Best Practices (when new patterns established)

**AI Assistant Workflow**:
1. After adding/modifying tests, ask: "Should I update tests/README.md?"
2. If yes, identify affected sections
3. Update test documentation with precise changes
4. Include updated test counts and coverage stats
5. Commit test doc updates with `docs(test):` prefix
6. Keep test documentation in sync with actual test code

**Example Test Doc Update Commit**:
```
docs(test): add SyncService integration test documentation

Document new test suite for archive synchronization.
Update test count from 28 to 45 tests.
Add deduplication testing section.
Document mock archive data setup patterns.
```

**Test Documentation Checklist**:
- [ ] Updated test count in coverage section
- [ ] Documented new test files in structure section
- [ ] Added examples for new testing patterns
- [ ] Updated mock usage if mocks changed
- [ ] Refreshed "What Can Be Tested" sections
- [ ] Added troubleshooting for new test types

---

# Git Commit Best Practices

When working with Git, follow these software engineering best practices to maintain a clean, readable, and useful commit history.

## Core Principles

### 1. **Commit Early, Commit Often**
- Make small, frequent commits rather than large, infrequent ones
- Each commit should represent a logical unit of work
- Easier to review, revert, and understand changes

### 2. **Atomic Commits**
- One commit = one logical change
- If a commit is reverted, it shouldn't break unrelated functionality
- Helps with bisecting, cherry-picking, and code review

### 3. **Write for Others (and Future You)**
- Commit messages are permanent documentation
- Explain the "why", not just the "what"
- Assume readers have context about the codebase but not about your specific decisions

---

## Conventional Commits Specification

Follow the **Conventional Commits** standard for consistent, parseable commit messages.

### Commit Message Format

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

### Line Length Rules

- **Header**: Maximum 72 characters (ideally 50)
- **Body**: Wrap at 72 characters
- **Footer**: Wrap at 72 characters

**Why these limits?**
- 50 chars: Displays fully in GitHub UI, git log --oneline
- 72 chars: Readable in terminal without wrapping

## Atomic Commits

**CRITICAL**: Always create focused, atomic commits. This is MANDATORY, not optional.

### Working with AI Assistant - Atomic Commit Strategy

Since interactive hunk staging (`git add -p`) requires manual user input and isn't practical with AI assistance, follow this workflow:

1. **One logical change per session** - Complete one feature/fix, then commit before starting another
2. **Commit before switching topics** - When unstaged changes exist and a new unrelated request comes in, **STOP and suggest committing first**
3. **Organize by files when possible** - Group changes so related files can be staged together

### When to Suggest Committing First

**CRITICAL**: If the user requests a new feature/change that is unrelated to current unstaged changes, respond with:

```
"Before we proceed, I notice we have uncommitted changes for [describe current changes].
Should we commit these first to keep our commits atomic? I can help create an appropriate commit message."
```

**Examples of when to suggest committing:**
- Current changes: UI styling → New request: Server-side logic
- Current changes: Feature implementation → New request: Bug fix
- Current changes: Analytics feature A → New request: Analytics feature B (different functionality)
- Current changes: Configuration updates → New request: New feature

**When to proceed without committing:**
- The new request is a direct continuation/completion of current work
- The new request fixes/improves what was just implemented
- The new request adjusts parameters/defaults of the current feature

### When to Create Separate Commits

1. **Different features** - Each new feature should be its own commit
2. **Different subsystems** - UI changes vs server logic vs configuration
3. **Bug fixes vs features** - Never mix bug fixes with new features
4. **Refactoring vs functionality** - Keep refactoring separate from functional changes
5. **Different aspects of same feature** - If a feature has distinct parts (e.g., calculation logic, UI controls, data retrieval), consider separate commits

### Commit Workflow

1. **Check for uncommitted changes**: `git status`
2. **Review changes**: `git diff`
3. **Stage related files**: `git add file1.js file2.js`
4. **Commit with focused message**: `git commit -m "type(scope): description"`
5. **Repeat for next logical group** (if multiple unrelated changes exist)

### Examples of Proper Atomic Commits

**GOOD - Separate commits in separate sessions:**
```
Session 1: feat(analytics): add moving average calculation to time trend
Session 2: feat(analytics): add weekend-only filter for moving average
Session 3: feat(analytics): add days-ahead projection for future tasks
Session 4: style(analytics): change default MA window to 28 days
```

**BAD - One large commit mixing multiple features:**
```
feat(analytics): add moving average, weekend filter, projections, and change defaults
```

### Rule of Thumb

- If your commit message needs "and" or has multiple bullet points for different features, the commit should be split
- Each commit should tell one clear story
- If you can't describe the commit in one sentence without "and", it's too large

## Header

The **header** is mandatory. The scope of the header is optional.

---

## Commit Message Structure

### Header (Required)

**Format**: `<type>(<scope>): <subject>`

#### Type (Required)

Must be one of the following:

| Type | Description | When to Use |
|------|-------------|-------------|
| **feat** | A new feature | Adding new functionality users can interact with |
| **fix** | A bug fix | Fixing incorrect behavior |
| **docs** | Documentation only | README, comments, doc files (no code changes) |
| **style** | Code style changes | Formatting, whitespace, semicolons (no logic change) |
| **refactor** | Code restructuring | Neither fixes bug nor adds feature, improves structure |
| **perf** | Performance improvement | Makes code faster or more efficient |
| **test** | Test changes | Adding or modifying tests |
| **build** | Build system changes | Dependencies, build scripts, tooling |
| **ci** | CI/CD changes | GitHub Actions, deployment scripts |
| **chore** | Maintenance tasks | Configuration, tooling, no production code change |
| **revert** | Revert previous commit | Reverting a specific commit |

#### Scope (Optional but Recommended)

The scope indicates which part of the codebase is affected.

**For this project, use:**
- `sync` - SyncService, archive operations
- `planner` - DayPlanner functionality
- `analytics` - AnalyticsService, charts, trends
- `backup` - BackupSystem operations
- `ui` - HTML UI components
- `config` - Configuration changes
- `utils` - Utility functions
- `menu` - Code.js menu system
- `recurring` - RecurringTaskChecker
- `deps` - Dependencies, external libraries
- `docs` - Documentation files

**Examples:**
- `feat(planner): add weekend-only filter`
- `fix(sync): prevent duplicate archive entries`
- `docs(readme): update installation instructions`

#### Subject (Required)

Succinct description of the change (max 50 chars for header total).

**Rules:**
- Use imperative mood: "add" not "added" or "adds"
- Don't capitalize first letter
- No period at the end
- Complete the sentence: "This commit will..."

**Good Examples:**
- `add user authentication`
- `fix null pointer in sync service`
- `update moving average calculation`
- `remove deprecated backup function`

**Bad Examples:**
- ❌ `Added user authentication` (past tense)
- ❌ `Fix bug` (too vague)
- ❌ `Updated the moving average calculation.` (capital + period)
- ❌ `Add user auth and fix sync bug and update docs` (multiple changes)

---

### Body (Optional but Encouraged)

Explain the motivation and context for the change.

**Include:**
- **Why** the change was needed
- **What** problem it solves
- **How** it differs from previous behavior
- Any side effects or implications

**Format:**
- Use imperative, present tense
- Wrap at 72 characters
- Separate paragraphs with blank lines
- Use bullet points if helpful

**Example:**
```
feat(analytics): add weekend-only moving average filter

The previous moving average included all days, which made it
difficult to analyze weekend workload patterns separately.

Add a new toggle that calculates MA using only Saturday and
Sunday data points. This helps identify if weekends are
consistently overloaded.

- Add weekendOnly parameter to getTimeSpentData()
- Update TimeTrendUI.html with toggle control
- Filter MA calculation to weekend days only when enabled
```

---

### Footer (Optional)

Reference issues, breaking changes, or related work.

**Breaking Changes:**
```
BREAKING CHANGE: The config object structure has changed.
Users must update their CONFIG.BACKUP.FOLDER_ID references.
```

**Issue References:**
```
Closes #42
Fixes #123
Related to #456
```

**Co-authors:**
```
Co-authored-by: Name <email@example.com>
```

---

## Examples

### Simple Feature
```
feat(planner): add task commit checkbox

Allow users to mark tasks as "committed" for the day.
Shows total committed time at bottom of planner.
```

### Bug Fix
```
fix(sync): prevent duplicate archive entries

The deduplication logic was comparing dates incorrectly,
allowing duplicate task+date combinations.

Update pruneArchiveDuplicatesSafe to use lowercase task
names and normalized date format for comparison.

Fixes #89
```

### Refactoring
```
refactor(utils): extract date parsing to separate function

The safeParseDate logic was duplicated across multiple
files. Extract to Utilities.js for reuse.

No functional changes.
```

### Documentation
```
docs(prd): add future enhancements section

Document planned Phase 2 and Phase 3 features including
mobile app, AI insights, and multi-household support.
```

### Breaking Change
```
feat(config): centralize all constants in Configuration.js

BREAKING CHANGE: BACKUP_FOLDER_ID moved from Code.js to
CONFIG.BACKUP.FOLDER_ID. Update all references accordingly.

Provides single source of truth for all configuration values.
Reduces magic strings throughout codebase.
```

### Multiple Related Changes
```
feat(analytics): add configurable moving average window

Add slider controls to adjust MA window from 1-30 days.
Store user preference in localStorage.

- Add maWindow parameter to getTimeSpentData()
- Update TimeTrendUI.html with slider control
- Add localStorage persistence for MA window setting
- Update chart to reflect new MA calculations

This allows users to smooth trends over different time
periods based on their analysis needs.
```

---

## Additional Best Practices

### When to Commit

**✅ Good Times to Commit:**
- Feature is complete and tested
- Bug fix is verified working
- After refactoring that maintains functionality
- Before switching to different task
- At natural stopping points (end of day, break)

**❌ Bad Times to Commit:**
- Code doesn't compile/run
- Tests are failing
- Work is half-finished (unless explicitly WIP)
- Before reviewing your own changes

### Pre-Commit Checklist

Before committing, ask yourself:

1. ✅ Does the code work? (test it!)
2. ✅ Are tests passing?
3. ✅ Did I review my own changes? (`git diff`)
4. ✅ Is this commit focused on one thing?
5. ✅ Did I remove debug code/console.logs?
6. ✅ Is my commit message clear and descriptive?
7. ✅ Did I stage only the files related to this change?

### Avoid These Common Mistakes

1. **"Fix typo"** commits - Squash with the original commit if possible
2. **"WIP"** commits in main branch - Use feature branches for WIP
3. **Mixing formatting with logic changes** - Separate commits
4. **Committing commented-out code** - Delete it (Git remembers)
5. **Committing secrets/credentials** - Use environment variables
6. **Vague messages** - "update stuff", "fix bug", "changes"

### Commit Message Formatting for Terminal Safety

**CRITICAL**: Avoid heredoc syntax (`cat > file << 'EOF'`) in automated terminal commands as it often causes the terminal to get stuck in heredoc mode, especially when run through tool automation.

**Recommended Approaches (in order of preference)**:

1. **Multiple `-m` Flags** (Best for AI automation):
   ```bash
   git commit \
     -m "feat(scope): subject line" \
     -m "Body paragraph 1 with detailed explanation." \
     -m "Body paragraph 2 with more context." \
     -m "- Bullet point 1" \
     -m "- Bullet point 2" \
     -m "Closes #123"
   ```
   **Advantages**: No heredoc, no file I/O, reliable in automated contexts

2. **Simple Single-Line Messages**:
   ```bash
   git commit -m "feat(scope): brief description"
   ```
   **Advantages**: Clean, fast, works everywhere

3. **Echo to File** (if multi-line with special chars needed):
   ```bash
   echo "feat(scope): subject" > .commit-msg-temp && \
   echo "" >> .commit-msg-temp && \
   echo "Body text here." >> .commit-msg-temp && \
   git commit -F .commit-msg-temp && \
   rm .commit-msg-temp
   ```
   **Advantages**: Avoids heredoc, handles special characters

4. **Git Editor** (manual/interactive only):
   ```bash
   git commit
   # Opens your default editor (vim, nano, etc.)
   ```

**NEVER Use in Automated Commands**:
- ❌ Heredoc syntax: `cat > file << 'EOF' ... EOF`
- ❌ Multi-line strings directly in `-m` without proper escaping
- ❌ Unescaped quotes or special characters in shell strings

**Recovery from Stuck Heredoc**:
- Press `Ctrl+C` to cancel
- Type `EOF` alone on a line and press Enter
- Close and restart terminal if unresponsive

**For AI Assistants Creating Commits**:
1. **ALWAYS use multiple `-m` flags** for commits with body text
2. **Keep each `-m` argument as a single line** (max 72 chars)
3. **Use separate `-m` flags** for subject, body paragraphs, and footer
4. **NEVER use heredoc** (`<< 'EOF'`) in terminal commands
5. **Test simple patterns** that work reliably in automated contexts

### Git Commands Reference

```bash
# Check what's changed
git status
git diff
git diff --staged

# Stage changes
git add file.js              # Stage specific file
git add .                     # Stage all changes (use carefully!)
git add -p                    # Interactive staging (review each chunk)

# Commit
git commit -m "feat(scope): message"                    # Simple commit
git commit                                               # Opens editor for body
git commit --amend                                       # Modify last commit
git commit --amend --no-edit                            # Add to last commit, keep message

# Review history
git log
git log --oneline
git log --graph --oneline --all
git show <commit-hash>

# Undo changes
git restore file.js                                     # Discard unstaged changes
git restore --staged file.js                            # Unstage file
git reset HEAD~1                                        # Undo last commit, keep changes
git reset --hard HEAD~1                                 # Undo last commit, discard changes
git revert <commit-hash>                                # Create new commit undoing a commit
```

---

## Project-Specific Scopes

For this Household Task Management System, use these scopes:

| Scope | Files Affected | Example |
|-------|----------------|---------|
| `sync` | SyncService.js | `fix(sync): handle missing completion date` |
| `planner` | DayPlanner.js, DayPlannerUI.html | `feat(planner): add overdue toggle` |
| `analytics` | AnalyticsService.js | `perf(analytics): optimize date parsing` |
| `ui` | Any .html file | `style(ui): update dark mode colors` |
| `config` | Configuration.js | `feat(config): add timezone constant` |
| `backup` | BackupSystem.js | `fix(backup): correct retention period` |
| `utils` | Utilities.js | `refactor(utils): simplify time parsing` |
| `menu` | Code.js (menu section) | `feat(menu): add recurring tasks menu item` |
| `recurring` | RecurringTaskChecker.js | `feat(recurring): add whitelist support` |
| `docs` | README, PRD, any .md | `docs(prd): update data model section` |

---

## Commit Message Templates

### For AI Assistant Context

When suggesting commits, use this format:

```
"I recommend committing these changes:

git add [files]
git commit -m "type(scope): description"

This commit [explain what and why]. Would you like me to help
create a more detailed commit message with a body?"
```

### Detailed Commit Template

```
<type>(<scope>): <subject line max 50 chars>

<body: wrap at 72 chars>
Explain the motivation for this change. What problem does it solve?
How does it differ from previous behavior?

<additional paragraphs if needed>

<footer: references, breaking changes>
Closes #123
```

---

## When AI Should Suggest Committing

**CRITICAL RULES:**

1. **Before switching contexts** - If user requests unrelated work
2. **After completing feature** - When logical unit is done
3. **When files from different subsystems are staged** - Suggest splitting

**Response Template:**
```
"Before we proceed, I notice uncommitted changes for [describe changes].
Should we commit these first to keep commits atomic?

Suggested commit:
feat(scope): description

This would capture [what was completed]."
```
