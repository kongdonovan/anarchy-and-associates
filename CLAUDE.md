# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Development
```bash
# Build the project
npm run build

# Start production bot
npm start

# Development with hot reload
npm run dev

# Type checking without compilation
npm run type-check
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern="staff-service.test.ts"

# Run tests matching pattern
npm test -- --testNamePattern="should create staff member"
```

### Code Quality
```bash
# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

## Architecture Overview

This is an **enterprise-grade Discord bot for Anarchy & Associates legal firm** built with TypeScript, following Domain-Driven Design (DDD) and Clean Architecture principles. The bot manages comprehensive legal firm operations including staff management, case tracking, job applications, retainer agreements, and client feedback.

### Core Architecture Layers

1. **Domain Layer** (`src/domain/`): 12 business entities and core domain logic
2. **Application Layer** (`src/application/`): 16 business services implementing use cases 
3. **Infrastructure Layer** (`src/infrastructure/`): 11 repositories, MongoDB integration, external services
4. **Presentation Layer** (`src/presentation/`): 11 command files with 77+ Discord slash commands

### Key Technologies & Scale
- **Discord.js v14** with **discordx** decorators for slash commands
- **MongoDB** with custom repository pattern and 11 specialized repositories
- **TypeScript** with strict mode and decorators
- **Winston** for structured logging
- **Jest** with 31 test files and 95%+ code coverage
- **31 test files** covering unit, integration, E2E, performance, and security testing

## Critical Architecture Patterns

### 1. Discord Command Structure
Commands use discordx decorators and are grouped by functionality:

```typescript
@Discord()
@SlashGroup({ name: 'staff', description: 'Staff management commands' })
@SlashGroup('staff')
export class StaffCommands {
  @Slash({ name: 'hire', description: 'Hire a new staff member' })
  async hireStaff(/* ... */) { /* ... */ }
}
```

### 2. Permission System
The bot implements a sophisticated permission system with:
- **Guild owners**: Always have all permissions
- **Admin users/roles**: Configured per guild  
- **Action-based permissions**: `admin`, `hr`, `case`, `config`, `retainer`, `repair`

Check permissions in commands:
```typescript
const context = await this.getPermissionContext(interaction);
const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
```

### 3. Repository Pattern
All data access uses MongoDB repositories extending `BaseMongoRepository`:

```typescript
export class StaffRepository extends BaseMongoRepository<Staff> {
  constructor() {
    super('staff'); // Collection name
  }
  
  // Domain-specific query methods
  public async findByGuildId(guildId: string): Promise<Staff[]> {
    return await this.findByFilters({ guildId, status: 'active' });
  }
}
```

### 4. Role Hierarchy System
Staff roles have a numerical hierarchy (level 1-6) with promotion/demotion logic:
- **Managing Partner** (Level 6) - 1 max
- **Senior Partner** (Level 5) - 3 max  
- **Junior Partner** (Level 4) - 5 max
- **Senior Associate** (Level 3) - 10 max
- **Junior Associate** (Level 2) - 10 max
- **Paralegal** (Level 1) - 10 max

### 5. Automatic Role Tracking
The bot monitors Discord role changes and automatically updates the staff database:
- **Hiring**: User gains first staff role
- **Firing**: User loses all staff roles
- **Promotion**: User gains higher-level role
- **Demotion**: User gets lower-level role

## Server Setup System

The bot can completely rebuild Discord servers using `ANARCHY_SERVER_CONFIG`:

### Configuration Structure
```typescript
// Categories with channels and permissions
const INFORMATION_CATEGORY = {
  name: "Information",
  channels: [
    { name: "welcome", type: ChannelType.GuildText },
    { name: "rules", type: ChannelType.GuildText }
  ]
};

// Roles with hierarchy, permissions, and limits
const ROLES = [
  { 
    name: "Managing Partner", 
    color: "DarkRed", 
    permissions: [PermissionFlagsBits.Administrator],
    maxCount: 1
  }
];
```

### Critical Server Setup Commands
- `/admin setupserver` - **COMPLETELY WIPES AND REBUILDS SERVER**
- Requires confirmation: "DELETE EVERYTHING"
- Creates roles, channels, categories, and jobs per configuration

## System Architecture & Services

### Core Business Services (16 Services)

#### 🏢 Staff Management Services
- **StaffService**: Complete staff lifecycle management with role hierarchy enforcement
- **RoleTrackingService**: Automatic Discord role synchronization with database
- **DiscordRoleSyncService**: Bidirectional role synchronization and management

#### 💼 Job & Application Management Services  
- **JobService**: Job posting management with role-based creation and custom questions
- **ApplicationService**: Job application processing with validation and review workflows
- **JobQuestionService**: Dynamic job application questions with template system
- **JobCleanupService**: Automated cleanup of expired jobs and Discord roles

#### ⚖️ Case Management Services
- **CaseService**: Comprehensive legal case management from creation to closure
  - Sequential case numbering system
  - Automatic Discord channel creation for cases
  - Lead attorney and team assignment
  - Document and note management
  - Case status workflow (pending → in progress → closed)

#### 📋 Client & Retainer Services
- **RetainerService**: Legal retainer agreements with digital signature workflow
- **FeedbackService**: Client feedback collection and staff performance metrics

#### ⏰ Automation Services
- **ReminderService**: Scheduled reminders with Discord integration and natural language parsing

#### 🔧 System Management Services
- **PermissionService**: Sophisticated role-based access control with action-based permissions
- **RepairService**: System integrity maintenance and health checks
- **MetricsService**: Comprehensive system metrics and performance analytics
- **AnarchyServerSetupService**: Complete Discord server setup and configuration
- **HelpService**: Contextual help system with permission-aware filtering

### Database Entities & Relationships

#### Core Entities (12 Entities)
- **Staff**: User employment records with 6-level role hierarchy
- **Job**: Position postings with application workflows and custom questions
- **Application**: Job applications with validation and review processes
- **Case**: Legal case management with sequential numbering and channel creation
- **Feedback**: Client feedback collection with performance metrics
- **Retainer**: Legal retainer agreements with digital signatures
- **Reminder**: Automated reminder system with natural language parsing
- **AuditLog**: Complete audit trail of all system actions
- **GuildConfig**: Per-guild configuration and settings
- **CaseCounter**: Sequential case numbering system
- **Base**: Common entity fields and patterns
- **Permission**: Advanced permission management

#### Entity Relationships
- Staff ↔ Applications (many-to-many via applications)
- Staff ↔ Cases (one-to-many as case assignee with lead attorney designation)
- Jobs ↔ Applications (one-to-many with custom questions)
- Cases ↔ Feedback (one-to-many with performance tracking)
- Cases ↔ Reminders (one-to-many for case-related reminders)
- All entities include `guildId` for multi-server support
- Comprehensive audit logging across all entities

## Environment Configuration

### Required Environment Variables
```bash
# Discord
DISCORD_BOT_TOKEN=your_discord_bot_token

# MongoDB
MONGODB_URI=mongodb://localhost:27017/anarchy-associates
MONGODB_DB_NAME=anarchy-associates

# Roblox Integration (optional)
ROBLOX_COOKIE=optional_roblox_cookie
```

### Bot Permissions Required
The bot needs these Discord intents and permissions:
- `GuildMembers` - For role tracking
- `Guilds` - For guild information
- `GuildMessages` - For message handling
- `MessageContent` - For message content access

## Development Patterns

### Error Handling
Always wrap interactions in try-catch with proper error embeds:

```typescript
try {
  // Command logic
  await interaction.reply({ embeds: [successEmbed] });
} catch (error) {
  logger.error('Error in command:', error);
  await interaction.reply({ 
    embeds: [this.createErrorEmbed('Command failed')], 
    ephemeral: true 
  });
}
```

### Embed Patterns
Use `EmbedUtils` for consistent styling:

```typescript
// Legal firm branded embed
const embed = EmbedUtils.createAALegalEmbed({
  title: 'Staff Information',
  description: 'Member details'
});

// Simple error/success embeds
const errorEmbed = EmbedUtils.createErrorEmbed('Error', 'Something went wrong');
const successEmbed = EmbedUtils.createSuccessEmbed('Success', 'Operation completed');
```

### Permission Checking Pattern
Standard permission check in all admin commands:

```typescript
private async getPermissionContext(interaction: CommandInteraction): Promise<PermissionContext> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  return {
    guildId: interaction.guildId!,
    userId: interaction.user.id,
    userRoles: member?.roles.cache.map(role => role.id) || [],
    isGuildOwner: interaction.guild?.ownerId === interaction.user.id,
  };
}
```

### Service Initialization
Services are initialized in `Bot.initializeServices()` after database connection:

```typescript
private initializeServices(): void {
  this.reminderService = new ReminderService(reminderRepository, caseRepository, staffRepository);
  this.roleTrackingService = new RoleTrackingService();
  // Services are automatically integrated with Discord client in ready event
}
```

## Comprehensive Discord Command System

### Slash Commands by Category (77+ Commands)

#### Admin Commands (`/admin`)
- `setupserver` - Complete server rebuild (DESTRUCTIVE - requires "DELETE EVERYTHING" confirmation)
- `cleardata` - Database cleanup operations with safety checks
- `config` - Guild configuration management (roles, channels, permissions)
- `repair` - System integrity checks and repairs
- `metrics` - System performance and usage analytics

#### Staff Management Commands (`/staff`)
- `hire` - Hire new staff members with role hierarchy validation
- `fire` - Terminate staff members with audit trail
- `promote` - Promote staff to higher roles with limit enforcement
- `demote` - Demote staff to lower roles
- `list` - View all staff members with filtering and pagination
- `info` - View detailed individual staff information
- `hierarchy` - Display staff hierarchy and role counts
- `sync` - Manual role synchronization between Discord and database

#### Case Management Commands (`/case`)
- `create` - Create new legal cases with automatic channel creation
- `assign` - Assign cases to staff members
- `reassign` - Transfer case ownership between staff
- `close` - Close completed cases with outcome tracking
- `list` - View active cases with filtering
- `info` - View detailed case information
- `accept` - Accept pending cases
- `decline` - Decline cases with reasons
- `addnote` - Add notes to cases (internal/client-visible)
- `adddocument` - Attach documents to cases
- `setlead` - Designate lead attorney for cases

#### Job & Application Commands (`/job`)
- `post` - Create job postings with custom questions
- `list` - View available positions with filtering
- `applications` - View job applications with review status
- `close` - Close job postings
- `questions` - Manage job application questions
- `apply` - Submit job applications (user-facing)
- `review` - Review and process applications
- `stats` - Job posting and application statistics

#### Retainer Management Commands (`/retainer`)
- `create` - Create new retainer agreements
- `sign` - Process digital signatures
- `cancel` - Cancel pending retainers
- `list` - View retainer agreements
- `stats` - Retainer statistics and metrics

#### Feedback System Commands (`/feedback`)
- `submit` - Submit client feedback (client-only)
- `list` - View feedback with filtering
- `stats` - Staff and firm performance metrics
- `performance` - Individual staff performance analytics

#### Reminder System Commands (`/reminder`)
- `create` - Create scheduled reminders with natural language
- `list` - View user reminders
- `cancel` - Cancel scheduled reminders
- `case` - View case-related reminders

#### Role Management Commands (`/role`)
- `assign` - Assign Discord roles
- `remove` - Remove Discord roles
- `sync` - Synchronize roles with database
- `cleanup` - Clean up orphaned roles

#### System Commands (`/repair`, `/metrics`, `/help`)
- Comprehensive system maintenance
- Performance analytics and monitoring
- Contextual help with permission-aware filtering

### Command Architecture Features
- **Permission-based access**: All commands check appropriate permissions
- **Audit trail**: All actions logged with full context
- **Error handling**: Comprehensive error recovery and user feedback
- **Guild isolation**: Multi-server support with data separation
- **Rate limiting**: Abuse prevention and performance optimization

## Testing Strategy & Coverage

### Comprehensive Test Suite (31 Test Files, 95%+ Coverage)

#### Test Categories
- **Application Tests** (8 files): Service layer business logic testing
- **Domain Tests** (6 files): Entity and domain logic validation
- **Infrastructure Tests** (7 files): Repository and database integration testing
- **Integration Tests** (4 files): End-to-end workflow testing
- **E2E Tests** (2 files): Complete Discord command workflow testing
- **Performance Tests** (1 file): Load testing and performance validation
- **Security Tests** (1 file): Permission boundary and access control testing
- **Concurrency Tests** (1 file): Race condition and concurrent operation testing
- **Error Handling Tests** (1 file): Rollback scenarios and error recovery

#### Testing Infrastructure
- **MongoDB Memory Server**: Isolated database testing environment
- **Jest** with custom test sequencer for ordered execution
- **Global setup/teardown**: Automated database lifecycle management
- **Test helpers**: Reusable utilities for common testing operations
- **Coverage reporting**: Detailed code coverage analysis
- **Mock services**: Comprehensive mocking for external dependencies

#### Testing Patterns

##### Repository Testing
```typescript
describe('StaffRepository', () => {
  beforeEach(async () => {
    await mongoClient.connect();
    repository = new StaffRepository();
  });
  
  afterEach(async () => {
    await mongoClient.clearDatabase();
  });
  
  // Integration tests with real database
});
```

##### Service Testing
```typescript
const mockStaffRepo = {
  findByUserId: jest.fn(),
  add: jest.fn(),
  update: jest.fn()
} as jest.Mocked<Partial<StaffRepository>>;

// Unit tests with mocked dependencies
```

##### Command Testing
```typescript
// E2E command testing with Discord interaction mocking
const mockInteraction = {
  guildId: 'test-guild',
  user: { id: 'test-user' },
  reply: jest.fn()
};
```

#### Test Quality Metrics
- **95%+ code coverage** across all layers
- **Boundary testing** for all permission checks
- **Error scenario coverage** for graceful failure handling
- **Performance benchmarks** for critical operations
- **Security validation** for all access controls

## File Structure Conventions

### Command Files
- Group related commands in single files (e.g., `staff-commands.ts`)
- Use `@SlashGroup` decorators for command organization
- Each command file handles one domain area

### Service Files  
- Business logic services in `src/application/services/`
- Infrastructure services in `src/infrastructure/`
- Services follow single responsibility principle

### Entity Files
- Domain entities in `src/domain/entities/`
- Each entity includes its related interfaces and enums
- Base entity provides common fields (`_id`, `createdAt`, `updatedAt`)

## Critical Security Considerations

### Permission Validation
ALWAYS validate permissions before sensitive operations:
- Server setup commands require admin permissions
- Role management requires specific action permissions
- User data access requires proper authorization

### Data Validation
Use proper input validation for:
- User IDs (Discord snowflakes)
- Guild IDs (Discord snowflakes)  
- Enum values (StaffRole, AuditAction)
- String lengths and formats

### Audit Logging
All significant actions are logged to `AuditLog` collection:
- Staff changes (hire/fire/promote/demote)
- Permission modifications
- Configuration changes
- Administrative actions

## Bot Lifecycle Management

### Graceful Shutdown
The bot handles process signals and shuts down gracefully:
- Closes Discord connection
- Closes MongoDB connection  
- Logs shutdown completion

### Service Integration
Services are lifecycle-aware:
- `ReminderService` integrates with Discord client when ready
- `RoleTrackingService` registers event handlers on initialization
- Database connections are established before service initialization

This architecture ensures scalability, maintainability, and proper separation of concerns while providing comprehensive legal firm management capabilities through Discord.