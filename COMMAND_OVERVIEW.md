# Discord Bot Command Overview

## Table of Contents
- [Administrative Commands (`/admin`)](#administrative-commands-admin)
- [Case Management Commands (`/case`)](#case-management-commands-case)
- [Feedback Commands (`/feedback`)](#feedback-commands-feedback)
- [Help Commands (`/help`)](#help-commands-help)
- [Job Management Commands (`/jobs`)](#job-management-commands-jobs)
- [Metrics Commands (`/metrics`)](#metrics-commands-metrics)
- [Reminder Commands (`/remind`)](#reminder-commands-remind)
- [Repair Commands (`/repair`)](#repair-commands-repair)
- [Retainer Commands (`/retainer`)](#retainer-commands-retainer)
- [Role Commands (`/role`)](#role-commands-role)
- [Staff Management Commands (`/staff`)](#staff-management-commands-staff)

---

## Administrative Commands (`/admin`)

**Permissions Required:** Admin permissions (guild owner or admin users/roles)

### `/admin add <user>`
**Purpose:** Grant admin privileges to a user

**User Flow:**
1. Admin user runs command with target user
2. Bot validates admin permissions of command user
3. Bot adds user to guild config admin users list
4. Bot confirms successful addition

**Database Changes:**
- Updates `guildConfig.adminUsers` array with new user ID

**Roles/Channels:**
- No Discord roles assigned
- No channels created

**Failure Cases:**
- Command user lacks admin management permissions
- Database update fails
- Command used outside server

---

### `/admin remove <user>`
**Purpose:** Revoke admin privileges from a user

**User Flow:**
1. Admin user runs command with target user
2. Bot validates admin permissions and prevents self-removal (unless guild owner)
3. Bot removes user from guild config admin users list
4. Bot confirms successful removal

**Database Changes:**
- Removes user ID from `guildConfig.adminUsers` array

**Failure Cases:**
- Non-guild-owner trying to remove themselves
- Target user not found in admin list
- Permission validation failure

---

### `/admin grantrole <role>`
**Purpose:** Grant admin privileges to a Discord role

**User Flow:**
1. Admin user runs command with target role
2. Bot validates admin permissions
3. Bot adds role to guild config admin roles list
4. Bot confirms successful addition

**Database Changes:**
- Updates `guildConfig.adminRoles` array with new role ID

**Failure Cases:**
- Command user lacks admin management permissions
- Role doesn't exist
- Database update fails

---

### `/admin revokerole <role>`
**Purpose:** Revoke admin privileges from a Discord role

**User Flow:**
1. Admin user runs command with target role
2. Bot validates admin permissions
3. Bot removes role from guild config admin roles list
4. Bot confirms successful removal

**Database Changes:**
- Removes role ID from `guildConfig.adminRoles` array

**Failure Cases:**
- Command user lacks admin management permissions
- Role not found in admin roles list

---

### `/admin admins`
**Purpose:** Display all current administrators

**User Flow:**
1. Admin user runs command
2. Bot validates admin permissions for viewing
3. Bot displays embed with admin users, admin roles, and guild owner

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Command user lacks admin permissions
- Guild configuration not found

---

### `/admin configure-permissions <action> <role>`
**Purpose:** Configure action-specific permissions for roles

**User Flow:**
1. Admin user runs command with action type and role
2. Bot validates admin permissions
3. Bot toggles role in specified permission action (adds if not present, removes if present)
4. Bot confirms permission change

**Database Changes:**
- Updates `guildConfig.permissions[action]` array

**Actions Available:** `admin`, `hr`, `case`, `config`, `retainer`, `repair`

**Failure Cases:**
- Invalid action type specified
- Command user lacks admin permissions

---

### `/admin debug_collection <collection>`
**Purpose:** View database collection contents for debugging

**User Flow:**
1. Admin user runs command with collection name
2. Bot validates admin permissions
3. Bot retrieves and displays collection data with preview and JSON dump
4. Shows first few records with metadata

**Database Changes:**
- None (read-only)

**Collections Available:** `staff`, `jobs`, `applications`, `cases`, `feedback`, `retainers`, `reminders`, `auditLogs`, `caseCounters`, `guildConfig`

**Failure Cases:**
- Invalid collection name
- Command user lacks admin permissions

---

### `/admin debug_wipe_collections`
**Purpose:** Emergency database wipe (DANGEROUS)

**User Flow:**
1. Admin user runs command
2. Bot shows modal requiring "I confirm" text input
3. Upon confirmation, bot wipes all collections except guildConfig
4. Bot reports results with collections wiped and any errors

**Database Changes:**
- **DESTRUCTIVE:** Deletes all records from multiple collections for the guild
- Preserves `guildConfig` collection

**Failure Cases:**
- Incorrect confirmation text
- Command user lacks admin permissions
- Database deletion errors

---

### `/admin setupserver`
**Purpose:** Complete server wipe and Anarchy & Associates setup (DESTROYS ALL)

**User Flow:**
1. Admin user runs command
2. Bot shows modal requiring "DELETE EVERYTHING" confirmation
3. Upon confirmation, bot completely wipes server and rebuilds with Anarchy setup
4. Bot creates predefined roles, channels, categories, and jobs

**Database Changes:**
- **DESTRUCTIVE:** Wipes multiple database collections
- Creates new job postings and configurations

**Roles/Channels:**
- **DESTROYS:** All existing channels and roles
- **CREATES:** Complete Anarchy & Associates server structure per configuration

**Failure Cases:**
- Incorrect confirmation text
- Bot lacks sufficient Discord permissions
- Database operations fail

---

## Case Management Commands (`/case`)

### `/case review <details>`
**Purpose:** Client-facing command to request legal case review

**Permissions:** Public (any user can use)

**User Flow:**
1. Client user runs command with case details
2. Bot validates case review category configuration
3. Bot creates new case in database with PENDING status
4. Bot creates private case channel with proper permissions
5. Bot sends case overview with accept/decline buttons to channel
6. Bot confirms to client with case number and channel info

**Database Changes:**
- Creates new `Case` record with status PENDING
- Creates new case counter entry if needed

**Roles/Channels:**
- Creates private case channel in case review category
- Sets permissions: client can view/send messages, public cannot view
- Staff permissions added based on role configuration

**Failure Cases:**
- Case review category not configured
- Case creation fails
- Channel creation fails
- User lacks proper permissions

---

### `/case assign <lawyer>`
**Purpose:** Assign a lawyer to a case (staff only)

**Permissions:** Case permission required

**User Flow:**
1. Staff member runs command in case channel
2. Bot identifies case from channel
3. Bot assigns lawyer as lead attorney or additional attorney
4. Bot updates case status and displays assignment confirmation

**Database Changes:**
- Updates `Case.assignedLawyerIds` array
- Updates `Case.leadAttorneyId` if first assignment
- Updates `Case.status` if appropriate

**Failure Cases:**
- Command not used in case channel
- Case not found
- User lacks case permissions
- Lawyer assignment fails

---

### `/case close <result> [notes]`
**Purpose:** Close a case with outcome

**Permissions:** Only client or lead counsel can close

**User Flow:**
1. Authorized user runs command with result and optional notes
2. Bot validates permissions (client or lead counsel only)
3. Bot updates case with closure information
4. Bot moves case channel to archive category
5. Bot updates case overview message to show closure

**Database Changes:**
- Updates `Case.status` to CLOSED
- Sets `Case.result`, `Case.resultNotes`, `Case.closedBy`, `Case.closedAt`

**Roles/Channels:**
- Moves case channel to archive category
- Removes interactive buttons from case overview

**Valid Results:** `win`, `loss`, `settlement`, `dismissed`, `withdrawn`

**Failure Cases:**
- User not client or lead counsel
- Invalid result value
- Case already closed
- Archive category not configured

---

### `/case list [status] [lawyer] [search] [page]`
**Purpose:** List cases with filtering options

**Permissions:** Public (filtered by user permissions)

**User Flow:**
1. User runs command with optional filters
2. Bot applies filters and pagination
3. Bot displays cases with status icons, client info, and metadata
4. Bot includes pagination controls if multiple pages

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Invalid status filter
- Database query fails

---

### `/case info [casenumber]`
**Purpose:** View detailed case information with tabbed interface

**Permissions:** Public (access controlled by case permissions)

**User Flow:**
1. User runs command with optional case number or in case channel
2. Bot displays case info with tab navigation (Overview, Documents, Notes, Timeline)
3. User can click tabs to view different aspects of case
4. Bot updates display based on tab selection

**Database Changes:**
- None (read-only)

**Interactive Elements:**
- Tab buttons for different views
- Detailed information panels
- Timeline of case events

**Failure Cases:**
- Case not found
- Invalid case number
- Command not in case channel when no case number provided

---

## Feedback Commands (`/feedback`)

### `/feedback submit <rating> <comment> [staff]`
**Purpose:** Submit feedback for staff or firm

**Permissions:** Public

**User Flow:**
1. User runs command with 1-5 star rating and comment
2. Bot validates rating and comment length
3. Bot saves feedback to database
4. Bot posts feedback to configured feedback channel
5. Bot sends DM notification to staff member if targeted feedback
6. Bot confirms submission to user

**Database Changes:**
- Creates new `Feedback` record with rating, comment, and metadata

**Roles/Channels:**
- Posts formatted feedback to feedback channel if configured

**Failure Cases:**
- Invalid rating (not 1-5)
- Comment too long (>1000 characters)
- Staff member not found
- Feedback channel misconfigured

---

### `/feedback view [staff]`
**Purpose:** View feedback and performance metrics

**Permissions:** Public

**User Flow:**
1. User runs command with optional staff member
2. Bot calculates performance metrics from feedback data
3. Bot displays comprehensive metrics including:
   - Overall rating and star display
   - Total feedback count
   - Rating distribution breakdown
   - Recent feedback samples (if individual staff)
   - Top performers (if firm-wide view)

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Staff member not found
- No feedback data available

---

## Help Commands (`/help`)

### `/help commands [command]`
**Purpose:** Get help with bot commands

**Permissions:** Public (filtered by user permissions)

**User Flow:**
1. User runs command with optional specific command name
2. Bot analyzes user permissions and filters available commands
3. Bot displays either:
   - General help overview with all command categories
   - Specific command help with detailed usage
   - Command group help for multiple related commands
4. Bot includes permission requirements and examples

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Command not found
- User lacks permissions to view any commands

---

## Job Management Commands (`/jobs`)

### `/jobs apply`
**Purpose:** Apply for available job positions

**Permissions:** Public (blocked for active staff members)

**User Flow:**
1. Non-staff user runs command
2. Bot displays job selection dropdown with open positions
3. User selects position from dropdown
4. Bot shows application modal with Roblox username field and job-specific questions
5. User submits application
6. Bot validates and saves application
7. Bot posts application for review in application channel
8. Bot confirms submission to applicant

**Database Changes:**
- Creates new `Application` record with answers and metadata
- Updates job application counts

**Roles/Channels:**
- Posts formatted application to application review channel
- Creates accept/decline buttons for HR staff

**Failure Cases:**
- No open jobs available
- User is active staff member
- Job no longer available
- Application validation fails
- Roblox username verification fails

---

### `/jobs list [status] [role] [search] [page]`
**Purpose:** List all jobs with filtering and pagination

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with optional filters
2. Bot applies filters and retrieves paginated results
3. Bot displays job listings with status indicators and metadata
4. Bot includes pagination buttons for navigation

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Invalid status or role filter
- User lacks HR permissions

---

### `/jobs add <title> <description> <role> <discord_role>`
**Purpose:** Create new job posting

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with job details
2. Bot validates role and Discord role
3. Bot creates job with default questions and specified parameters
4. Bot confirms creation with job details and ID

**Database Changes:**
- Creates new `Job` record with default and custom questions
- Increments job counters

**Failure Cases:**
- Invalid staff role
- Discord role not found
- Job creation fails
- User lacks HR permissions

---

### `/jobs edit <job_id> [title] [description] [role] [discord_role] [status]`
**Purpose:** Edit existing job posting

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with job ID and updates
2. Bot validates updates and applies changes
3. Bot confirms successful update with changed fields

**Database Changes:**
- Updates specified fields in `Job` record
- Logs changes in audit trail

**Failure Cases:**
- Job not found
- Invalid updates provided
- User lacks HR permissions

---

### `/jobs info <job_id>`
**Purpose:** View detailed job information

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with job ID
2. Bot retrieves and displays comprehensive job details including:
   - Basic job information
   - Application/hiring statistics
   - Question configuration
   - Closure information if applicable

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Job not found
- User lacks HR permissions

---

### `/jobs close <job_id>`
**Purpose:** Close job posting (keeps in database)

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with job ID
2. Bot closes job and updates statistics
3. Bot confirms closure with final statistics

**Database Changes:**
- Updates `Job.isOpen` to false
- Sets `Job.closedAt` and `Job.closedBy`

**Failure Cases:**
- Job not found
- Job already closed
- User lacks HR permissions

---

### `/jobs remove <job_id>`
**Purpose:** Permanently delete job posting

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with job ID
2. Bot retrieves job info for confirmation
3. Bot permanently deletes job from database
4. Bot confirms deletion

**Database Changes:**
- **DESTRUCTIVE:** Permanently deletes `Job` record

**Failure Cases:**
- Job not found
- User lacks HR permissions
- Database deletion fails

---

### `/jobs questions [category]`
**Purpose:** List available question templates

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with optional category filter
2. Bot displays available question templates grouped by category
3. Bot includes template IDs, descriptions, and default settings

**Database Changes:**
- None (read-only)

---

### `/jobs question-preview <template_id>`
**Purpose:** Preview specific question template

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with template ID
2. Bot displays detailed template preview with formatting
3. Bot shows how question will appear to applicants

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Template ID not found
- User lacks HR permissions

---

### `/jobs add-questions <job_id> <template_ids> [force_required]`
**Purpose:** Add custom questions to job using templates

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with job ID and comma-separated template IDs
2. Bot validates templates and checks for duplicates
3. Bot adds new questions to job configuration
4. Bot confirms addition with question count

**Database Changes:**
- Updates `Job.questions` array with new questions

**Failure Cases:**
- Job not found
- Invalid template IDs
- Questions already exist
- Validation fails

---

### `/jobs cleanup-roles [dry_run]`
**Purpose:** Clean up Discord roles for closed jobs

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with optional dry-run mode
2. Bot identifies roles associated with closed jobs
3. Bot removes Discord roles or shows preview
4. Bot reports cleanup results

**Database Changes:**
- None (only Discord role changes)

**Roles/Channels:**
- **DESTRUCTIVE:** Removes Discord roles for closed jobs

**Failure Cases:**
- Bot lacks role management permissions
- Roles in use by other systems

---

### `/jobs cleanup-report`
**Purpose:** Get cleanup report for jobs and roles

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command
2. Bot analyzes jobs and identifies cleanup opportunities
3. Bot displays comprehensive report with recommendations

**Database Changes:**
- None (read-only)

---

### `/jobs cleanup-expired [max_days] [dry_run]`
**Purpose:** Automatically close expired jobs

**Permissions:** HR permission required

**User Flow:**
1. HR staff runs command with optional max days and dry-run
2. Bot identifies jobs older than specified days (default 30)
3. Bot closes expired jobs or shows preview
4. Bot reports results

**Database Changes:**
- Updates multiple `Job` records to closed status

**Failure Cases:**
- Invalid max_days parameter
- Job closure fails

---

## Metrics Commands (`/metrics`)

### `/metrics overview`
**Purpose:** Display bot and server statistics

**Permissions:** Public

**User Flow:**
1. User runs command
2. Bot collects comprehensive system metrics including:
   - Bot uptime information
   - Database statistics (staff, cases, applications, etc.)
   - Discord server metrics (members, channels, roles)
   - Performance metrics (memory usage)
3. Bot displays formatted metrics embed

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Metrics collection fails
- Guild information unavailable

---

### `/metrics lawyer-stats [user]`
**Purpose:** View win/loss statistics for lawyers

**Permissions:** Public

**User Flow:**
1. User runs command with optional lawyer specification
2. Bot calculates performance statistics from case data
3. Bot displays either:
   - Individual lawyer stats with case results and ratings
   - Firm-wide stats with top performers and overall metrics
4. Bot includes win rate color coding and performance indicators

**Database Changes:**
- None (read-only)

**Failure Cases:**
- User not active staff member
- No case data available
- Metrics calculation fails

---

## Reminder Commands (`/remind`)

### `/remind set <time> <message>`
**Purpose:** Set a personal reminder

**Permissions:** Public

**User Flow:**
1. User runs command with time string and message
2. Bot validates time format (e.g., "30m", "2h", "1d")
3. Bot creates reminder with delivery location (channel or DM)
4. Bot confirms reminder creation with scheduled time

**Database Changes:**
- Creates new `Reminder` record with scheduled delivery time

**Time Formats:** Minutes (m), Hours (h), Days (d) - Maximum 7 days

**Failure Cases:**
- Invalid time format
- Message too long (>500 characters)
- Reminder creation fails

---

### `/remind list`
**Purpose:** List active reminders

**Permissions:** Public (user's own reminders)

**User Flow:**
1. User runs command
2. Bot retrieves user's active reminders
3. Bot displays reminders sorted by scheduled time
4. Bot includes reminder details and time until delivery

**Database Changes:**
- None (read-only)

**Failure Cases:**
- No active reminders
- Database query fails

---

### `/remind cancel <id>`
**Purpose:** Cancel a specific reminder

**Permissions:** Public (user can only cancel own reminders)

**User Flow:**
1. User runs command with reminder ID
2. Bot validates ownership and cancels reminder
3. Bot confirms successful cancellation

**Database Changes:**
- Updates `Reminder.status` to cancelled

**Failure Cases:**
- Reminder not found
- User doesn't own reminder
- Reminder already delivered

---

### `/remind case`
**Purpose:** View reminders for current case channel

**Permissions:** Public

**User Flow:**
1. User runs command in case channel
2. Bot retrieves all reminders associated with the channel
3. Bot displays case-specific reminders with details

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Command not used in channel
- No case reminders found

---

## Repair Commands (`/repair`)

**All repair commands require admin permissions**

### `/repair staff-roles [dry-run]`
**Purpose:** Synchronize staff roles between Discord and database

**User Flow:**
1. Admin runs command with optional dry-run
2. Bot analyzes Discord roles vs database records
3. Bot synchronizes discrepancies or shows preview
4. Bot reports changes made

**Database Changes:**
- Updates staff records to match Discord roles
- Creates missing staff records
- Marks terminated staff

**Failure Cases:**
- Bot lacks role permissions
- Database sync fails

---

### `/repair job-roles [dry-run]`
**Purpose:** Synchronize job roles between Discord and database

**User Flow:**
1. Admin runs command with optional dry-run
2. Bot validates job role assignments
3. Bot corrects mismatched roles or shows preview
4. Bot reports synchronization results

**Database Changes:**
- Updates job role assignments

**Roles/Channels:**
- Corrects Discord role assignments

---

### `/repair channels [dry-run]`
**Purpose:** Ensure all required channels and categories exist

**User Flow:**
1. Admin runs command with optional dry-run
2. Bot checks for required channels and categories
3. Bot creates missing channels or shows preview
4. Bot reports creation results

**Database Changes:**
- None (only Discord changes)

**Roles/Channels:**
- **CREATES:** Missing required channels and categories

---

### `/repair validate-config [dry-run]`
**Purpose:** Validate and fix configuration inconsistencies

**User Flow:**
1. Admin runs command with optional dry-run
2. Bot validates guild configuration settings
3. Bot fixes inconsistencies or shows preview
4. Bot reports validation results

**Database Changes:**
- Updates `guildConfig` with corrections

---

### `/repair orphaned [dry-run]`
**Purpose:** Find and clean orphaned database records

**User Flow:**
1. Admin runs command with optional dry-run
2. Bot identifies orphaned records (references to non-existent entities)
3. Bot removes orphaned records or shows preview
4. Bot reports cleanup results

**Database Changes:**
- **DESTRUCTIVE:** Removes orphaned records

---

### `/repair db-indexes [dry-run]`
**Purpose:** Ensure MongoDB indexes are correct

**User Flow:**
1. Admin runs command with optional dry-run
2. Bot validates database indexes
3. Bot creates missing indexes or shows preview
4. Bot reports index status

**Database Changes:**
- Creates missing database indexes

---

### `/repair all [dry-run]`
**Purpose:** Execute all repair routines

**User Flow:**
1. Admin runs command with optional dry-run
2. Bot executes all repair operations sequentially
3. Bot reports comprehensive results from all repairs

**Database Changes:**
- Combines all repair operations

---

### `/repair health`
**Purpose:** Comprehensive system health check

**User Flow:**
1. Admin runs command
2. Bot performs comprehensive system health analysis
3. Bot reports health status for all components
4. Bot lists any issues requiring attention

**Database Changes:**
- None (read-only)

---

## Retainer Commands (`/retainer`)

**Permissions Required:** Retainer permission

### `/retainer sign <client>`
**Purpose:** Send retainer agreement to client for signature

**User Flow:**
1. Lawyer runs command with client user
2. Bot validates client role configuration
3. Bot creates retainer agreement record
4. Bot sends DM to client with agreement and sign button
5. Bot confirms to lawyer that agreement was sent

**Database Changes:**
- Creates new `Retainer` record with PENDING status

**Failure Cases:**
- Client role not configured
- Unable to send DM to client
- Retainer creation fails

---

### `/retainer list`
**Purpose:** List all active retainer agreements

**User Flow:**
1. Staff member runs command
2. Bot retrieves active and pending retainers
3. Bot displays summary statistics and recent agreements
4. Bot shows signing status and metadata

**Database Changes:**
- None (read-only)

---

### **Retainer Signing Flow (Button/Modal Interactions)**

**Client Button Click:**
1. Client clicks "Sign Agreement" in DM
2. Bot shows signature modal with Roblox username and confirmation fields

**Client Modal Submission:**
1. Client submits signature modal with required information
2. Bot validates confirmation text ("I agree...")
3. Bot updates retainer with signature and Roblox username
4. Bot assigns client role to user
5. Bot archives signed agreement to retainer channel
6. Bot confirms successful signing to client

**Database Changes:**
- Updates `Retainer.status` to SIGNED
- Sets signature timestamp and Roblox username

**Roles/Channels:**
- Assigns client role to user
- Posts archived agreement to retainer channel

**Failure Cases:**
- Invalid confirmation text
- Roblox username validation fails
- Client role assignment fails
- Retainer channel not configured

---

## Role Commands (`/role`)

**Permissions Required:** Admin permissions

### `/role sync`
**Purpose:** Synchronize Discord roles with staff database

**User Flow:**
1. Admin runs command
2. Bot performs comprehensive role synchronization
3. Bot updates staff records to match Discord roles
4. Bot confirms synchronization completion

**Database Changes:**
- Updates staff records to match Discord role assignments
- Creates audit log entries for changes

**Failure Cases:**
- User lacks admin permissions
- Synchronization process fails

---

### `/role status`
**Purpose:** View role tracking system status

**User Flow:**
1. Admin runs command
2. Bot analyzes current role distribution and tracking status
3. Bot displays comprehensive role statistics and system information

**Database Changes:**
- None (read-only)

**Failure Cases:**
- User lacks admin permissions
- Unable to fetch member data

---

## Staff Management Commands (`/staff`)

**Permissions Required:** HR permissions (for management commands)

### `/staff hire <user> <role> <roblox_username> [reason]`
**Purpose:** Hire a new staff member

**User Flow:**
1. HR staff runs command with user details
2. Bot validates role and permission hierarchy
3. Bot creates staff record in database
4. Bot assigns Discord role to user
5. Bot confirms successful hiring

**Database Changes:**
- Creates new `Staff` record
- Creates audit log entry

**Roles/Channels:**
- Assigns staff Discord role to user

**Failure Cases:**
- Invalid role specified
- User already is staff
- Command user lacks permission to hire at specified level
- Role assignment fails

---

### `/staff fire <user> [reason]`
**Purpose:** Fire a staff member

**User Flow:**
1. HR staff runs command with user and optional reason
2. Bot validates target is staff and permission hierarchy
3. Bot updates staff record to terminated status
4. Bot removes all staff Discord roles
5. Bot confirms successful termination

**Database Changes:**
- Updates `Staff.status` to 'terminated'
- Creates audit log entry

**Roles/Channels:**
- Removes all staff Discord roles from user

**Failure Cases:**
- User not a staff member
- Command user lacks permission to fire target
- Self-firing not allowed (except guild owner)
- Role removal fails

---

### `/staff promote <user> <role> [reason]`
**Purpose:** Promote a staff member

**User Flow:**
1. HR staff runs command with user and new role
2. Bot validates current staff status and permission hierarchy
3. Bot updates staff record with new role
4. Bot updates Discord role assignment
5. Bot confirms successful promotion

**Database Changes:**
- Updates `Staff.role` and promotion history
- Creates audit log entry

**Roles/Channels:**
- Updates Discord role assignment

**Failure Cases:**
- User not a staff member
- Invalid role specified
- Command user lacks permission to promote to specified level
- Role change fails

---

### `/staff demote <user> <role> [reason]`
**Purpose:** Demote a staff member

**User Flow:**
1. HR staff runs command with user and new role
2. Bot validates current staff status and permission hierarchy
3. Bot updates staff record with lower role
4. Bot updates Discord role assignment
5. Bot confirms successful demotion

**Database Changes:**
- Updates `Staff.role` and promotion history
- Creates audit log entry

**Roles/Channels:**
- Updates Discord role assignment

**Failure Cases:**
- User not a staff member
- Command user lacks permission to demote target
- Role change fails

---

### `/staff list [role]`
**Purpose:** List all staff members

**Permissions:** Public

**User Flow:**
1. User runs command with optional role filter
2. Bot retrieves staff members and groups by role hierarchy
3. Bot displays organized staff list with role counts

**Database Changes:**
- None (read-only)

**Failure Cases:**
- Invalid role filter
- No staff members found

---

### `/staff info <user>`
**Purpose:** View detailed staff member information

**Permissions:** Public

**User Flow:**
1. User runs command with target user
2. Bot retrieves comprehensive staff information
3. Bot displays detailed profile including:
   - Current role and status
   - Hiring information
   - Promotion history
   - Role level and metadata

**Database Changes:**
- None (read-only)

**Failure Cases:**
- User not a staff member
- Staff record not found

---

## Common Failure Patterns

### Permission Failures
- **Insufficient Permissions:** User lacks required permission level
- **Guild Owner Override:** Guild owners bypass most permission checks
- **Self-Action Restrictions:** Users cannot perform certain actions on themselves

### Database Failures
- **Connection Issues:** MongoDB connection problems
- **Validation Errors:** Data validation failures
- **Orphaned Records:** References to non-existent entities
- **Concurrent Modifications:** Race conditions in data updates

### Discord API Failures
- **Rate Limiting:** Too many API requests
- **Missing Permissions:** Bot lacks required Discord permissions
- **Member Not Found:** User left server or doesn't exist
- **Channel/Role Issues:** Required channels or roles missing

### Input Validation Failures
- **Invalid Parameters:** Wrong data types or values
- **Length Restrictions:** Text inputs too long
- **Format Requirements:** Incorrect formatting (e.g., time strings)
- **Required Fields:** Missing required parameters

### Configuration Issues
- **Missing Setup:** Required channels/roles not configured
- **Invalid References:** Configuration points to non-existent entities
- **Permission Conflicts:** Conflicting permission settings

---

## System Architecture Notes

### Permission System
- **Hierarchical:** Role-based with level restrictions
- **Action-Based:** Specific permissions for different operations
- **Override Capable:** Guild owners can bypass restrictions

### Database Design
- **Guild Isolation:** All data segmented by guild ID
- **Audit Logging:** Complete audit trail for all changes
- **Referential Integrity:** Cross-collection references maintained

### Error Handling
- **Graceful Degradation:** Commands fail safely with user feedback
- **Logging:** Comprehensive error logging for debugging
- **User Communication:** Clear error messages for common issues

### Security Considerations
- **Input Sanitization:** All user inputs validated and sanitized
- **Permission Validation:** Every action checked against permissions
- **Audit Trails:** All significant actions logged with metadata