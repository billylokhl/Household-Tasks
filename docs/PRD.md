# Household Task Management System - Product Requirements Document

**Version:** 1.0
**Last Updated:** January 24, 2026
**Project Type:** Google Apps Script Application
**Target Users:** Household members (specifically Billy 🐷 and Karen 🐱)

---

## Executive Summary

The Household Task Management System is a Google Sheets-powered application designed to help household members track, prioritize, and complete tasks efficiently. Built entirely with Google Apps Script, it provides intelligent prioritization, time tracking analytics, incident monitoring, and automated data archival—all within a familiar spreadsheet interface.

The system eliminates manual task tracking overhead through automation, provides actionable insights through visual analytics, and maintains historical data integrity for long-term trend analysis.

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [User Personas](#user-personas)
3. [Core Features](#core-features)
4. [System Architecture](#system-architecture)
5. [Data Model](#data-model)
6. [User Interface](#user-interface)
7. [Functional Requirements](#functional-requirements)
8. [Non-Functional Requirements](#non-functional-requirements)
9. [Technical Specifications](#technical-specifications)
10. [Workflows](#workflows)
11. [Analytics & Insights](#analytics--insights)
12. [Security & Data Integrity](#security--data-integrity)
13. [Future Enhancements](#future-enhancements)

---

## Product Vision

### Mission Statement
Empower household members to efficiently manage shared responsibilities through intelligent prioritization, transparent workload visibility, and data-driven insights—reducing stress and improving household harmony.

### Success Metrics
- **Task Completion Rate**: % of tasks completed by due date
- **Time Estimation Accuracy**: Ratio of ECT vs actual time spent
- **Incident Reduction**: 14-day rolling incident trend decreasing over time
- **User Engagement**: Frequency of planner usage and sync operations
- **Data Integrity**: 100% successful archive sync rate with zero data loss

---

## User Personas

### Primary Users

#### Billy (🐷)
- **Role**: Household member
- **Tech Savviness**: High - comfortable with scripts and automation
- **Primary Goals**:
  - Track own tasks efficiently
  - Analyze time spent trends
  - Ensure fair workload distribution
- **Pain Points**:
  - Manual task tracking is time-consuming
  - Difficult to prioritize conflicting tasks
  - No visibility into historical completion patterns

#### Karen (🐱)
- **Role**: Household member
- **Tech Savviness**: Medium - prefers intuitive interfaces
- **Primary Goals**:
  - Quick daily task planning
  - Clear visibility into what's urgent
  - Simple completion tracking
- **Pain Points**:
  - Overwhelmed by too many tasks
  - Unclear which tasks are most important
  - Wants to avoid weekend overload

---

## Core Features

### 1. **Smart Task Prioritization**
**Purpose**: Automatically calculate priority scores based on importance, time investment, and deadline proximity

**Key Capabilities**:
- Formula-driven PriorityScore calculation
- Dynamic priority updates when due dates or importance changes
- Multi-factor prioritization (importance × ECT × deadline urgency)
- Real-time recalculation on data changes

### 2. **Day Planner Interface**
**Purpose**: Provide a focused, filterable view of upcoming tasks for daily planning

**Key Capabilities**:
- Filter by owner (🐷 or 🐱)
- Adjustable planning horizon (1-30 days)
- Toggle overdue tasks visibility
- Toggle completed tasks visibility
- Inline editing (due date, ECT, importance)
- Commit checkbox to track planned tasks
- Total time commitment calculation
- Sortable columns with inline search
- Visual distinction for completed tasks

### 3. **Time Trend Analytics**
**Purpose**: Visualize time spent patterns to optimize workload distribution

**Key Capabilities**:
- 30-day historical time tracking
- Top 10 categories by time spent (remainder grouped as "Other")
- Separate charts for each owner
- 28-day moving average with weekend-only option
- Future task projection (days ahead parameter)
- Category breakdown tooltips per day
- HTML detail tables with task-level information
- Dark mode Google Charts integration

### 4. **Incident Tracking & Trends**
**Purpose**: Monitor and reduce recurring issues or failures in task execution

**Key Capabilities**:
- 14-day rolling sum incident trends
- 30-day incident history view
- Separate tracking for each owner
- Incident date and incident owner attribution
- Visual trend charts
- Detailed incident list with dates and categories
- Integration with task archival (preserves incident data)

### 5. **Automated Archive Synchronization**
**Purpose**: Archive completed tasks while maintaining data integrity and preserving incident records

**Key Capabilities**:
- One-click sync via menu or scheduled trigger
- Dynamic column detection (emoji-tolerant)
- Automatic schema migration when columns change
- Completion-based filtering (only syncs completed tasks)
- Deduplication by task name + completion date
- Preserves most recent version based on Sync Date
- Status feedback via modal UI
- Non-destructive to Prioritization sheet

### 6. **Daily Cleanup Process**
**Purpose**: Remove completed tasks from active view while preserving critical data

**Key Capabilities**:
- Scheduled execution via time-based trigger (post-midnight)
- Smart deletion rules:
  - **Non-recurring tasks without incidents**: Delete entirely
  - **Recurring tasks**: Clear completion dates only (preserve row)
  - **Tasks with incidents**: Never delete (preserve for analytics)
- Archive verification before deletion
- Safe processing (reverse order, row deletion handling)

### 7. **Automated Backup System**
**Purpose**: Protect against accidental data loss with automated snapshots

**Key Capabilities**:
- Hourly snapshot creation
- Timestamp-based naming: `Backup_{SheetName}_yyyy-MM-dd_HHmm`
- 7-day retention policy
- Automatic purging of old backups
- Manual backup trigger via menu
- Toast notifications for success/failure
- Centralized backup folder in Google Drive

### 8. **Recurring Task Monitoring**
**Purpose**: Identify recurring tasks scheduled on weekdays for potential weekend rescheduling

**Key Capabilities**:
- Scans tasks with 1 week+ recurrence
- Filters for Monday-Friday due dates
- Whitelist support via "WeekdayOK" column
- Category and owner attribution
- Modal UI with detailed task list
- Sortable results table
- Helps optimize weekend vs. weekday workload

---

## System Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Google Sheets UI                        │
│  (Spreadsheet + Custom Menu "🚀 Task Tools")                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│                  Google Apps Script Layer                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Code.js (Entry Point & Menu System)                 │  │
│  │  - onOpen() menu restoration                         │  │
│  │  - UI modal launchers                                │  │
│  │  - Helper functions (findTaskRowInHistory, etc.)     │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                       │
│  ┌───────────────────┼───────────────────────────────────┐ │
│  │  Configuration.js │ Utilities.js                      │ │
│  │  - Constants      │ - Date parsing                    │ │
│  │  - Colors         │ - Time parsing                    │ │
│  └───────────────────┴───────────────────────────────────┘ │
│                      │                                       │
│  ┌──────────────────┴───────────────────────────────────┐  │
│  │              Service Modules                         │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ SyncService.js                                  │ │  │
│  │  │ - executeFullServerSync()                       │ │  │
│  │  │ - performPrioritizationCleanup()                │ │  │
│  │  │ - pruneArchiveDuplicatesSafe()                  │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ DayPlanner.js                                   │ │  │
│  │  │ - getPlannedTasks()                             │ │  │
│  │  │ - updatePlannerTask()                           │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ AnalyticsService.js                             │ │  │
│  │  │ - getTimeSpentData()                            │ │  │
│  │  │ - getIncidentTrendData()                        │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ BackupSystem.js                                 │ │  │
│  │  │ - createHourlySnapshot()                        │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ RecurringTaskChecker.js                         │ │  │
│  │  │ - getWeekdayRecurringTasks()                    │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘ │
│                      │                                       │
│  ┌──────────────────┴───────────────────────────────────┐  │
│  │              HTML UI Components                      │  │
│  │  - DayPlannerUI.html                                 │  │
│  │  - StatusSidebar.html                                │  │
│  │  - IncidentTrendUI.html                              │  │
│  │  - TimeTrendUI.html                                  │  │
│  │  - WeekdayRecurringTasksUI.html                     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│                  Data Storage Layer                          │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │  Prioritization      │  │  TaskArchive             │    │
│  │  (Active Tasks)      │  │  (Completed Tasks)       │    │
│  └──────────────────────┘  └──────────────────────────┘    │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │  TaskHistory         │  │  Google Drive            │    │
│  │  (Historical Matrix) │  │  (Backup Snapshots)      │    │
│  └──────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

#### Core Layer
- **Code.js**: Application entry point, menu system, UI launchers, bridge functions
- **Configuration.js**: Centralized constants (sheet names, colors, backup folder)
- **Utilities.js**: Shared helper functions (date/time parsing)

#### Service Layer
- **SyncService.js**: Archive synchronization, cleanup orchestration, deduplication
- **DayPlanner.js**: Task filtering, sorting, inline editing
- **AnalyticsService.js**: Time trend calculations, incident trend calculations
- **BackupSystem.js**: Snapshot creation, retention management
- **RecurringTaskChecker.js**: Weekday recurring task detection

#### UI Layer
- **DayPlannerUI.html**: Interactive task planner with filters and editing
- **StatusSidebar.html**: Sync progress and status display
- **IncidentTrendUI.html**: Incident visualization with Google Charts
- **TimeTrendUI.html**: Time spent visualization with moving averages
- **WeekdayRecurringTasksUI.html**: Recurring task report display

#### Data Layer
- **Prioritization Sheet**: Active task database
- **TaskArchive Sheet**: Completed task history
- **TaskHistory Sheet**: Daily completion matrix
- **Google Drive Folder**: Backup storage

---

## Data Model

### Prioritization Sheet Schema

Primary sheet for active task management with formula-driven prioritization.

| Column Name | Type | Description | Formula/Logic |
|------------|------|-------------|---------------|
| **Task** | Text | Task name/description | User input |
| **Category** | Text | Task category for analytics | User input, validation list |
| **Importance** | Text | Critical/High/Normal/Low | User input, validation list |
| **ECT** | Text | Estimated completion time (e.g., "30m", "2h", "1 day") | User input |
| **PriorityScore** | Number | Calculated priority score | Formula: importance weight × ECT × deadline urgency |
| **DueDate** | Date | Formula-calculated due date | Formula: =ReferenceDueDate + Recurrence calculation |
| **ReferenceDueDate** | Date | Base due date for recurrence | User input |
| **Ownership🐷** | Boolean | Billy's task ownership | User input, checkbox |
| **Ownership🐱** | Boolean | Karen's task ownership | User input, checkbox |
| **CompletionDate🐷** | Date | Billy's completion date | User input when complete |
| **CompletionDate🐱** | Date | Karen's completion date | User input when complete |
| **IncidentDate** | Date | Date of incident/failure | User input (optional) |
| **IncidentOwner** | Text | Owner responsible for incident | User input (🐷 or 🐱) |
| **Recurrence** | Text | Recurrence pattern (e.g., "1 week", "2 months") | User input |
| **DaysTillDue** | Text/Number | Days remaining or "DONE" status | Formula: IF(complete, "DONE", days_remaining) |
| **WeekdayOK** | Boolean | Whitelist for weekday recurring tasks | User input, checkbox (optional) |

### TaskArchive Sheet Schema

Historical record of all completed tasks with flexible schema migration support.

| Column Name | Type | Description |
|------------|------|-------------|
| **Sync Date** | Date/Time | Timestamp when task was archived |
| **[All Prioritization columns]** | Various | Dynamic mirror of Prioritization schema |

**Key Features**:
- First column is always "Sync Date" (sync timestamp)
- Remaining columns dynamically match Prioritization sheet
- Schema migration preserves existing data when columns change
- Deduplication key: Task name (lowercase) + CompletionDate

### TaskHistory Sheet Schema

Matrix-based daily completion tracking for recurring tasks.

| Column | Type | Description |
|--------|------|-------------|
| **Column 1: Category** | Text | Task category |
| **Column 2: Task** | Text | Task name |
| **Column 3+: Dates** | Date | Header = yyyy-MM-dd, Cell = completion mark |

**Structure**:
- Each row = one unique task (identified by category + task name)
- Each column (3+) = one date
- Cell values mark completions on that date

### Backup Folder Structure

Google Drive folder containing automated snapshots.

**Naming Convention**: `Backup_{SheetName}_{yyyy-MM-dd}_{HHmm}`

**Example**: `Backup_Household Tasks_2026-01-24_1430`

**Retention**: 7 days (older backups automatically purged)

---

## User Interface

### Custom Menu: "🚀 Task Tools"

Located in Google Sheets menu bar after running `onOpen()`.

**Menu Structure**:
```
🚀 Task Tools
├─ Planner
├─ ────────────────
├─ View Incident Trend
├─ View Task Time Trend
├─ Weekday Recurring Tasks
├─ ────────────────
├─ Sync Task Database
├─ Daily Cleanup
├─ ────────────────
└─ Manual Backup
```

### Modal Interfaces

#### 1. Day Planner (1000×750)

**Controls**:
- **Days Out** slider: 1-30 (planning horizon)
- **Owner** dropdown: 🐷 Billy / 🐱 Karen
- **Show Overdue** toggle: Yes / No
- **Show Completed** toggle: Yes / No
- **Refresh** button: Reload data
- **Reset Filter** button: Clear all inline filters

**Table Columns** (sortable, inline filterable):
- Due (M/d format)
- Day (Mon, Tue, etc.)
- Task
- ECT (time format)
- Imp (importance)
- Score (priority score)
- Cat (category)
- Commit (checkbox)

**Footer**:
- **Total Committed**: Sum of ECT for checked tasks

**Inline Editing**:
- Click Due date to edit ReferenceDueDate
- Click ECT to edit estimated time
- Click Imp to edit importance
- Changes save immediately and recalculate PriorityScore

#### 2. Status Sidebar (350×250)

**Terminal-style dark mode interface**

**Content**:
- Auto-runs `executeFullServerSync()` on open
- Displays multi-line sync status
- Shows row counts, completion counts, deduplication results
- **Retry** button after completion

#### 3. Incident Trend UI (1100×850)

**Charts** (2 stacked line charts):
- Billy (🐷) 14-day rolling incident sum
- Karen (🐱) 14-day rolling incident sum
- X-axis: Last 30 days
- Y-axis: Incident count

**Details Tables**:
- Separate tables for 🐷 and 🐱
- Columns: Date | Task | Category
- Sorted by date descending

#### 4. Time Trend UI (1200×850)

**Controls**:
- **MA Window** slider: 1-30 days (moving average window)
- **Weekend Only MA** toggle: True / False
- **Days Ahead** slider: 0-14 (future projection)
- **Refresh** button

**Charts** (2 stacked area charts):
- Billy (🐷) time spent by category
- Karen (🐱) time spent by category
- X-axis: Last 30 days + future days (MM/dd (E) format)
- Y-axis: Minutes spent
- Moving average line overlay

**Details Tables**:
- Per-day task breakdowns for each owner
- Columns: Date | Task | ECT | Category
- Color-coded tooltips on chart hover

#### 5. Weekday Recurring Tasks UI (900×600)

**Content**:
- Header: Instructions and filter criteria
- **Task Table**:
  - Columns: Task | Category | Due Date | Day | Recurrence | Owner
  - Sortable
  - Only shows tasks with:
    - 1 week+ recurrence
    - Monday-Friday due date
    - Not whitelisted (WeekdayOK ≠ TRUE)

---

## Functional Requirements

### FR-1: Task Prioritization

**ID**: FR-1
**Priority**: High
**Module**: Prioritization Sheet (formula-driven)

**Requirements**:
1. System MUST calculate PriorityScore based on:
   - Importance weight (Critical > High > Normal > Low)
   - Estimated completion time (ECT in minutes)
   - Days till due (urgency factor)
2. PriorityScore MUST recalculate automatically when any input changes
3. Formula MUST be preserved when new rows are added
4. System MUST handle missing values gracefully (default weights)

**Acceptance Criteria**:
- Tasks with "Critical" importance have higher scores than "High"
- Tasks closer to deadline have higher scores than distant tasks
- Tasks with longer ECT have higher scores (more work = higher priority)
- Score recalculates within 1 second of input change

---

### FR-2: Day Planner Filtering

**ID**: FR-2
**Priority**: High
**Module**: DayPlanner.js

**Requirements**:
1. System MUST filter tasks by ownership (🐷 or 🐱)
2. System MUST filter tasks by date range (today through today + daysToPlan - 1)
3. System MUST include overdue tasks only if `includeOverdue === "Yes"`
4. System MUST hide/show completed tasks based on `showCompleted` toggle
5. System MUST sort results by PriorityScore descending

**Acceptance Criteria**:
- Only tasks owned by selected user appear
- Tasks outside date range are excluded
- Overdue tasks disappear when toggle is "No"
- Completed tasks (DaysTillDue = "DONE") disappear when toggle is "No"
- Highest priority task appears first

---

### FR-3: Archive Synchronization

**ID**: FR-3
**Priority**: Critical
**Module**: SyncService.js

**Requirements**:
1. System MUST sync only completed tasks (CompletionDate not empty)
2. System MUST dynamically detect column positions (emoji-tolerant)
3. System MUST migrate archive schema when Prioritization columns change
4. System MUST preserve existing archive data during migration
5. System MUST add "Sync Date" as first column with current timestamp
6. System MUST deduplicate by (lowercase task name + completion date)
7. System MUST keep most recent record by Sync Date
8. System MUST NOT modify Prioritization sheet during sync

**Acceptance Criteria**:
- Archive contains all completed tasks from Prioritization
- No duplicate entries for same task + completion date
- Archive schema matches Prioritization schema + Sync Date column
- Sync completes within 30 seconds for 1000 tasks
- Status modal shows accurate row counts and results

---

### FR-4: Daily Cleanup

**ID**: FR-4
**Priority**: High
**Module**: SyncService.js → performPrioritizationCleanup

**Requirements**:
1. System MUST run automatically via time-based trigger (post-midnight)
2. System MUST delete completed non-recurring tasks WITHOUT incidents
3. System MUST clear CompletionDate fields for completed recurring tasks
4. System MUST preserve rows with IncidentDate (never delete)
5. System MUST verify task exists in archive before deletion
6. System MUST process rows in reverse order (safe deletion)

**Acceptance Criteria**:
- Completed one-time tasks disappear from Prioritization
- Recurring tasks remain but CompletionDate is cleared
- Tasks with incidents remain unchanged
- No data loss occurs (all tasks in archive first)
- Cleanup completes within 60 seconds

---

### FR-5: Time Trend Analytics

**ID**: FR-5
**Priority**: Medium
**Module**: AnalyticsService.js → getTimeSpentData

**Requirements**:
1. System MUST analyze TaskArchive data (last 30 days + future projection)
2. System MUST separate data by owner (🐷 and 🐱)
3. System MUST calculate moving average with configurable window
4. System MUST support weekend-only moving average option
5. System MUST show top 10 categories by total time (remainder as "Other")
6. System MUST format dates as MM/dd (E) for display
7. System MUST generate HTML tooltips with category breakdowns
8. System MUST project future task times when daysAhead > 0
9. System MUST mark today's date with triangle marker (▶) on x-axis
10. System MUST include BOTH completed and incomplete tasks for today:
    - Completed tasks from TaskArchive (historical data)
    - Incomplete tasks from Prioritization (tasks due today with empty CompletionDate)
11. System MUST maintain data key consistency:
    - Store details object with modified date labels (including ▶ marker)
    - UI must lookup using original date (with marker), strip marker only for display

**Acceptance Criteria**:
- Chart shows 30 days of historical data
- Moving average line overlays category bars
- Weekend-only MA excludes weekday data from calculation
- Top 10 categories are accurately ranked
- Tooltip shows per-day category breakdown
- Future projection appears when daysAhead > 0
- Today's date displays with ▶ prefix on x-axis
- Today's bars show all tasks due today (completed + incomplete)
- Clicking today's bars displays correct task details in table
- Details lookup uses consistent keys (date labels with triangle marker)

---

### FR-6: Incident Tracking

**ID**: FR-6
**Priority**: Medium
**Module**: AnalyticsService.js → getIncidentTrendData

**Requirements**:
1. System MUST calculate 14-day rolling sum of incidents
2. System MUST separate incidents by IncidentOwner (🐷 and 🐱)
3. System MUST display last 30 days of incident trends
4. System MUST show detail table with date, task, and category
5. System MUST sort detail table by date descending

**Acceptance Criteria**:
- Chart shows 14-day rolling sum line
- Separate charts for each owner
- Rolling sum accurately reflects 14-day window
- Detail table shows all incidents in last 30 days
- Most recent incidents appear first

---

### FR-7: Automated Backups

**ID**: FR-7
**Priority**: Medium
**Module**: BackupSystem.js

**Requirements**:
1. System MUST create hourly snapshots via time-based trigger
2. System MUST name backups: `Backup_{SheetName}_{yyyy-MM-dd}_{HHmm}`
3. System MUST store backups in folder ID: `1S_HRJlzJ9JPMcD2aamy036FIGb8xxd96`
4. System MUST delete backups older than 7 days
5. System MUST display toast notification with results
6. System MUST handle errors gracefully

**Acceptance Criteria**:
- Backup appears in Google Drive folder within 60 seconds
- Backup filename includes correct timestamp
- Backups older than 7 days are automatically deleted
- Toast shows success message or error details
- Manual backup via menu works identically

---

### FR-8: Recurring Task Monitoring

**ID**: FR-8
**Priority**: Low
**Module**: RecurringTaskChecker.js

**Requirements**:
1. System MUST identify tasks with 1 week+ recurrence
2. System MUST filter for tasks due Monday-Friday
3. System MUST respect "WeekdayOK" whitelist column
4. System MUST display results in sortable modal table
5. System MUST show task, category, due date, day, recurrence, and owner

**Acceptance Criteria**:
- Only tasks with 7+ day recurrence appear
- Only Monday-Friday due dates appear
- Whitelisted tasks (WeekdayOK = TRUE) are excluded
- Table is sortable by all columns
- Results refresh when modal reopens

---

## Non-Functional Requirements

### NFR-1: Performance

**Requirement**: System operations must complete within acceptable time limits

| Operation | Target Time | Maximum Time |
|-----------|-------------|--------------|
| Priority score recalculation | < 1 second | 2 seconds |
| Day planner load | < 2 seconds | 5 seconds |
| Full archive sync | < 15 seconds | 30 seconds |
| Daily cleanup | < 30 seconds | 60 seconds |
| Analytics chart render | < 3 seconds | 10 seconds |
| Backup creation | < 30 seconds | 60 seconds |

**Measurement**: User-perceived response time from action to completion

---

### NFR-2: Reliability

**Requirement**: System must maintain data integrity and recover from errors

**Metrics**:
- **Data Loss Rate**: 0% (no data loss acceptable)
- **Sync Success Rate**: > 99.5%
- **Backup Success Rate**: > 99%
- **Uptime**: 99.9% (dependent on Google Apps Script)

**Guarantees**:
- Archive sync never deletes Prioritization data
- Cleanup verifies archive before deletion
- Schema migration preserves all existing data
- Deduplication keeps most recent record
- Backups retained for 7 days minimum

---

### NFR-3: Usability

**Requirement**: Interfaces must be intuitive and responsive

**Standards**:
- **Learning Curve**: New users productive within 15 minutes
- **Click Efficiency**: Maximum 3 clicks to any feature
- **Visual Feedback**: All actions provide status confirmation
- **Error Messages**: Clear, actionable error descriptions
- **Mobile Compatibility**: Readable on tablet (Google Sheets native)

---

### NFR-4: Maintainability

**Requirement**: Codebase must support easy updates and debugging

**Standards**:
- **Modular Architecture**: Each .js file has single responsibility
- **Centralized Config**: All constants in Configuration.js
- **Flexible Column Detection**: No hardcoded column positions
- **Debug Logging**: Detailed logs in analytics functions
- **Schema Migration**: Automatic handling of column changes

---

### NFR-5: Security

**Requirement**: Data access limited to authorized users

**Measures**:
- **Access Control**: Google Sheets native sharing permissions
- **Backup Isolation**: Dedicated Google Drive folder
- **Script Permissions**: OAuth scope approval required
- **No External APIs**: All operations within Google ecosystem
- **Audit Trail**: Sync Date timestamps in archive

---

## Technical Specifications

### Development Environment

| Aspect | Specification |
|--------|--------------|
| **Platform** | Google Apps Script (V8 Runtime) |
| **Language** | JavaScript (ES6+) |
| **IDE** | Google Apps Script Web Editor or clasp CLI |
| **Version Control** | Git (local repository) |
| **Deployment** | Direct to Google Sheets container-bound script |

### Dependencies

| Dependency | Purpose | Version |
|-----------|---------|---------|
| **Google Sheets API** | Spreadsheet data access | Built-in |
| **Google Drive API** | Backup file management | Built-in |
| **Google Charts** | Visualization rendering | Loaded via CDN |
| **HtmlService** | Modal UI rendering | Built-in |

### Configuration

**File**: `appsscript.json`

```json
{
  "timeZone": "America/Los_Angeles",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

### Code Organization

**Modular Structure**:
- Each service in separate `.js` file
- UI templates in separate `.html` files
- Shared utilities in `Utilities.js`
- Constants in `Configuration.js`
- Entry point in `Code.js`

**Naming Conventions**:
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE` or `CONFIG.CATEGORY.NAME`
- Files: `PascalCase.js` or `PascalCaseUI.html`

---

## Workflows

### Workflow 1: Daily Task Planning

**Actor**: User (🐷 or 🐱)
**Trigger**: Morning planning session

**Steps**:
1. User opens Google Sheets
2. User clicks "🚀 Task Tools" → "Planner"
3. System opens Day Planner modal (1000×750)
4. User adjusts filters:
   - Owner: Selects own icon (🐷 or 🐱)
   - Days Out: Sets planning horizon (e.g., 3 days)
   - Show Overdue: Yes (to see missed tasks)
   - Show Completed: No (focus on pending)
5. System displays filtered, sorted task list
6. User reviews tasks and checks "Commit" for today's planned work
7. User sees "Total Committed" time at bottom
8. User adjusts due dates or ECT inline as needed
9. User closes modal
10. User works from Prioritization sheet throughout day

**Success Criteria**:
- User has clear daily task list in < 30 seconds
- Only relevant tasks visible
- Total committed time within available hours

---

### Workflow 2: Task Completion & Sync

**Actor**: User (🐷 or 🐱)
**Trigger**: Task completed

**Steps**:
1. User completes a task
2. User enters date in appropriate CompletionDate column (🐷 or 🐱)
3. User continues working (no immediate action needed)
4. **[Later]** User clicks "🚀 Task Tools" → "Sync Task Database"
5. System opens Status Sidebar modal (350×250)
6. System auto-runs `executeFullServerSync()`:
   - Scans Prioritization for completed tasks
   - Detects column positions dynamically
   - Checks TaskArchive schema
   - Migrates schema if columns changed
   - Writes completed tasks to archive
   - Deduplicates archive records
   - Displays status: "Scanned X rows. Found Y completed tasks. Deduplication removed Z duplicates."
7. User sees completion message
8. User clicks "Close" or "Retry" if needed

**Success Criteria**:
- All completed tasks appear in TaskArchive
- No duplicates in archive
- Sync completes within 30 seconds
- Status message confirms row counts

---

### Workflow 3: Daily Cleanup (Automated)

**Actor**: System (Time-based trigger)
**Trigger**: Daily at 1:00 AM (post-midnight)

**Steps**:
1. Time-based trigger fires `runDailyCleanup()`
2. System calls `performPrioritizationCleanup()`
3. System reads TaskArchive to build completion registry
4. System scans Prioritization sheet in reverse order
5. For each completed task:
   - **IF** non-recurring AND no incident:
     - Clear row contents
     - Delete row
   - **ELSE IF** recurring AND no incident:
     - Clear CompletionDate🐷 and CompletionDate🐱 fields only
   - **ELSE IF** incident exists:
     - Skip (preserve for analytics)
6. System logs cleanup results
7. System sends email summary (optional)

**Success Criteria**:
- Completed one-time tasks removed from Prioritization
- Recurring tasks reset for next occurrence
- Incident tasks preserved
- All completed tasks remain in TaskArchive

---

### Workflow 4: Analytics Review

**Actor**: User (🐷 or 🐱)
**Trigger**: Weekly review session

**Steps**:
1. User clicks "🚀 Task Tools" → "View Task Time Trend"
2. System opens Time Trend UI modal (1200×850)
3. User adjusts parameters:
   - MA Window: 28 days
   - Weekend Only MA: True
   - Days Ahead: 7 (project next week)
4. System generates charts:
   - Fetches last 30 days from TaskArchive
   - Queries Prioritization for incomplete tasks due today
   - Combines completed (Archive) + incomplete (Prioritization) for today only
   - Marks today's date with ▶ symbol on x-axis
   - Calculates moving average (weekend days only)
   - Projects future 7 days from Prioritization
   - Separates data by owner
   - Groups top 10 categories, remainder as "Other"
5. User hovers over chart to see tooltips with category breakdowns
6. User scrolls to detail tables for task-level information
7. User identifies patterns (e.g., "Weekends are overloaded")
8. User clicks "🚀 Task Tools" → "View Incident Trend"
9. System opens Incident Trend UI modal (1100×850)
10. User reviews 14-day rolling incident trends
11. User examines detail table for specific incidents
12. User identifies root causes for recurring incidents

**Success Criteria**:
- User identifies time allocation patterns
- User spots incident trends
- User makes data-driven decisions about task scheduling

---

### Workflow 5: Schema Migration (Automatic)

**Actor**: System
**Trigger**: User adds/removes/renames column in Prioritization sheet

**Steps**:
1. User modifies Prioritization sheet structure (e.g., adds "Tags" column)
2. User saves changes
3. **[Later]** User runs sync via "🚀 Task Tools" → "Sync Task Database"
4. System runs `executeFullServerSync()`
5. System scans Prioritization headers
6. System scans TaskArchive headers
7. System detects schema mismatch
8. System initiates migration:
   - Reads all existing archive data
   - Maps old columns to new columns by header name
   - Creates remapped data array
   - Clears archive sheet
   - Writes new headers
   - Writes remapped data
9. System continues normal sync process
10. User sees status: "Schema migrated. X columns added/removed."

**Success Criteria**:
- All existing archive data preserved
- New columns appear in archive with empty values for old records
- Removed columns disappear from archive
- Renamed columns handled correctly if exact match
- No data loss occurs

---

## Analytics & Insights

### Time Spent Analytics

**Purpose**: Understand time allocation patterns and optimize workload distribution

**Key Metrics**:
1. **Total Time per Category**: Stacked area chart showing daily breakdown
2. **Moving Average**: Trend line for smoothing daily variations
3. **Weekend vs. Weekday**: Weekend-only MA isolates weekend patterns
4. **Future Projection**: Visualize upcoming workload from pending tasks
5. **Owner Comparison**: Side-by-side charts for workload equity analysis

**Use Cases**:
- Identify overloaded weekends → reschedule to weekdays
- Spot underutilized categories → deprioritize or delegate
- Compare owner workloads → ensure fairness
- Plan upcoming weeks based on projected time

**Implementation Details**:
- **Data Source**:
  - Historical: TaskArchive (CompletionDate + ECT + Category + Owner)
  - Today's Incomplete: Prioritization (DueDate = today, CompletionDate empty)
- **Date Range**: Last 30 days + 0-14 days ahead
- **Today's Date Marker**: Triangle symbol (▶) prefixed to today's date label on x-axis
- **Category Grouping**: Top 10 + "Other"
- **MA Window**: 1-30 days (default 28)
- **Weekend Detection**: Saturday + Sunday only for MA calculation
- **Tooltips**: HTML table with per-category breakdown
- **Data Consistency**:
  - Details object keys include date labels WITH triangle marker
  - UI lookup must use original date (with ▶), strip marker only for display text
  - Prevents lookup mismatches when clicking chart bars

---

### Incident Trend Analytics

**Purpose**: Monitor task execution quality and reduce failure rates

**Key Metrics**:
1. **14-Day Rolling Sum**: Smoothed incident count to identify trends
2. **Per-Owner Trends**: Separate tracking for accountability
3. **Incident Details**: Date, task, category for root cause analysis
4. **Trend Direction**: Increasing vs. decreasing incident rates

**Use Cases**:
- Identify tasks prone to incidents → improve process or training
- Spot owner-specific patterns → targeted support
- Track improvement over time → validate process changes
- Prioritize incident-prone categories → allocate more time

**Implementation Details**:
- **Data Source**: TaskArchive (IncidentDate + IncidentOwner + Task + Category)
- **Date Range**: Last 30 days
- **Rolling Window**: 14 days (sum of incidents in trailing 14-day window)
- **Owner Attribution**: IncidentOwner field (🐷 or 🐱)
- **Details Table**: Sorted by date descending

---

## Security & Data Integrity

### Access Control

**Mechanism**: Google Sheets native sharing permissions

**Roles**:
- **Owner**: Full access (edit scripts, data, settings)
- **Editor**: Edit data, run scripts (no script modification)
- **Viewer**: Read-only (cannot run scripts)

**Best Practices**:
- Limit script editing to technical owner
- Grant editor access to household members
- Avoid public sharing links
- Review permissions quarterly

---

### Data Integrity Safeguards

**1. Archive Sync Safety**:
- Read-only operation on Prioritization during sync
- Verification before cleanup deletion
- Deduplication prevents duplicate records
- Schema migration preserves all data

**2. Backup Redundancy**:
- Hourly automated snapshots
- 7-day retention (168 backups maximum)
- Separate Google Drive folder
- Manual backup option always available

**3. Validation Rules**:
- TaskArchive validation function checks:
  - Required fields (Task, Category, CompletionDate)
  - Date validity (no future completion dates)
  - Ownership consistency
  - Incident data completeness

**4. Error Handling**:
- Try-catch blocks around all critical operations
- User-friendly error messages via toast/modal
- Detailed error logging for debugging
- Graceful degradation (partial success messages)

---

## Future Enhancements

### Phase 2: Advanced Features

1. **Smart Recurrence Engine**
   - Automatic due date recalculation on completion
   - Flexible recurrence patterns (every 2nd Monday, last day of month)
   - Holiday awareness (skip or adjust)

2. **Collaborative Planning**
   - Shared planner view for both owners
   - Task assignment requests
   - Workload balancing suggestions

3. **Mobile App**
   - React Native companion app
   - Push notifications for upcoming tasks
   - Quick completion marking
   - Offline sync

4. **AI-Powered Insights**
   - Time estimation accuracy improvement suggestions
   - Task clustering by similarity
   - Automatic category suggestions
   - Incident prediction

5. **Integrations**
   - Google Calendar sync (due dates → calendar events)
   - Gmail task creation (email → task)
   - Google Keep import
   - IFTTT/Zapier webhooks

### Phase 3: Multi-Household Support

1. **Tenant Architecture**
   - Separate sheets per household
   - Centralized script library
   - Template-based onboarding

2. **Community Features**
   - Task template sharing
   - Best practice guides
   - Aggregate anonymized analytics

3. **Premium Features**
   - Unlimited backups
   - Advanced reporting
   - Priority support
   - Custom integrations

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **ECT** | Estimated Completion Time - how long a task will take |
| **Priority Score** | Calculated value ranking task urgency and importance |
| **Sync** | Process of archiving completed tasks |
| **Cleanup** | Process of removing completed tasks from active view |
| **Deduplication** | Removing duplicate archive records |
| **Schema Migration** | Updating archive structure to match Prioritization changes |
| **Moving Average** | Statistical smoothing technique for trend visualization |
| **Rolling Sum** | Summing values within a sliding time window |
| **Incident** | Task failure or issue requiring rework |
| **Recurrence** | Repeating task pattern (e.g., weekly, monthly) |

### B. Column Header Variations

The system flexibly detects columns with these naming patterns:

| Canonical Name | Acceptable Variations |
|---------------|----------------------|
| Ownership🐷 | "Ownership Billy", "Billy", "🐷" |
| Ownership🐱 | "Ownership Karen", "Ownership Cat", "Karen", "Cat", "🐱" |
| CompletionDate | "Completion Date", "Completed Date", "Date" |
| ECT | "Time Spent", "Minutes", "Duration" |
| IncidentDate | "Incident Date" |
| IncidentOwner | "Incident Owner" |

### C. Time Format Parsing

| Input Format | Interpretation |
|-------------|----------------|
| `30` | 30 minutes |
| `30m` | 30 minutes |
| `1h` | 60 minutes |
| `1.5h` | 90 minutes |
| `1 hour` | 60 minutes |
| `1 day` | 480 minutes (8 hours) |
| `2 days` | 960 minutes (16 hours) |

### D. Formula Reference

**Priority Score Formula** (conceptual):
```
PriorityScore =
  ImportanceWeight ×
  ECT_minutes ×
  DaysUntilDue_factor

Where:
  ImportanceWeight: Critical=4, High=3, Normal=2, Low=1
  DaysUntilDue_factor: Exponential decay based on DaysTillDue
```

**Moving Average** (weekend-only option):
```
MA(day) =
  SUM(values in last N days where day is weekend) /
  COUNT(weekend days in last N days)
```

**14-Day Rolling Sum**:
```
RollingSum(day) =
  SUM(incidents from day-13 to day)
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-24 | System | Initial PRD creation |

---

**Document Owner**: Development Team
**Stakeholders**: Billy (🐷), Karen (🐱)
**Review Cycle**: Quarterly or upon major feature changes
