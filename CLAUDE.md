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

This is a **Discord bot for Anarchy & Associates legal firm** built with TypeScript, following Domain-Driven Design (DDD) and Clean Architecture principles.

### Core Architecture Layers

1. **Domain Layer** (`src/domain/`): Business entities and core logic
2. **Application Layer** (`src/application/`): Use cases and business services 
3. **Infrastructure Layer** (`src/infrastructure/`): Database, Discord client, external services
4. **Presentation Layer** (`src/presentation/`): Discord slash commands and user interactions

### Key Technologies
- **Discord.js v14** with **discordx** decorators for slash commands
- **MongoDB** with custom repository pattern
- **TypeScript** with strict mode and decorators
- **Winston** for structured logging
- **Jest** for testing

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

## Database Entities & Relationships

### Core Entities
- **Staff**: User employment records with role hierarchy
- **Job**: Position postings with application workflows
- **Application**: Job applications with custom questions
- **Case**: Legal case management with client assignments
- **Feedback**: Client feedback collection
- **Retainer**: Legal retainer agreements
- **Reminder**: Automated reminder system
- **AuditLog**: Complete audit trail of all actions

### Entity Relationships
- Staff ↔ Applications (many-to-many via applications)
- Staff ↔ Cases (one-to-many as case assignee)
- Jobs ↔ Applications (one-to-many)
- Cases ↔ Feedback (one-to-many)
- All entities include `guildId` for multi-server support

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

## Testing Patterns

### Repository Testing
Use MongoDB Memory Server for integration tests:

```typescript
describe('StaffRepository', () => {
  beforeEach(async () => {
    await mongoClient.connect();
    repository = new StaffRepository();
  });
  
  afterEach(async () => {
    await mongoClient.clearDatabase();
  });
});
```

### Service Testing
Mock repositories and test business logic:

```typescript
const mockStaffRepo = {
  findByUserId: jest.fn(),
  add: jest.fn(),
  update: jest.fn()
} as jest.Mocked<Partial<StaffRepository>>;
```

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