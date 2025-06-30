# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read the initial instructions and all saved serena memories.

## Quick Start

### Development Commands
```bash
# Build and run
npm run build          # Compile TypeScript
npm start             # Start production bot
npm run dev           # Development with hot reload
npm run type-check    # Type check without compilation

# Testing (prefer individual tests for speed)
npm test              # Run all tests
npm test -- --testPathPattern="staff-service.test.ts"  # Specific file
npm test -- --testNamePattern="should create staff"     # Pattern match

# Code quality
npm run lint          # Check code style
npm run lint:fix      # Auto-fix issues
npm run format        # Prettier formatting
```

## Architecture Overview

Enterprise Discord bot for Anarchy & Associates legal firm using Domain-Driven Design and Clean Architecture.

### 📚 Layer Documentation
**IMPORTANT**: Refer to detailed layer documentation for deep dives:
- **[Domain Layer](docs/DOMAIN_LAYER.md)**: Entities, business rules, domain logic
- **[Application Layer](docs/APPLICATION_LAYER.md)**: Services, use cases, workflows
- **[Infrastructure Layer](docs/INFRASTRUCTURE_LAYER.md)**: Database, Discord.js, external services
- **[Presentation Layer](docs/PRESENTATION_LAYER.md)**: Commands, interactions, UI

**When modifying code, update the corresponding layer documentation!**

### 🏗️ Quick Architecture Reference
```
src/
├── domain/         # Business entities & rules (no external deps)
├── application/    # Service orchestration & use cases
├── infrastructure/ # MongoDB, Discord.js, external integrations
└── presentation/   # Discord slash commands & interactions
```

## Critical Patterns & Conventions

### 🔐 Permission Checking (ALWAYS DO THIS)
```typescript
// In every command that modifies data:
const context = await this.getPermissionContext(interaction);
const hasPermission = await this.permissionService.hasActionPermission(context, 'admin');
if (!hasPermission) {
  await interaction.reply({ 
    embeds: [this.createErrorEmbed('Insufficient permissions')], 
    ephemeral: true 
  });
  return;
}
```

### 📝 Unified Validation System
```typescript
// Use for all business rule validation:
const validationResult = await this.validationService.validate(
  UnifiedValidationService.createContext({
    permissionContext: context,
    entityType: 'staff',
    operation: 'hire',
    data: { userId, role }
  })
);
```

### 🎨 Consistent Embed Styling
```typescript
// Always use EmbedUtils for consistency:
const embed = EmbedUtils.createAALegalEmbed({ title, description });
const error = EmbedUtils.createErrorEmbed('Error', message);
const success = EmbedUtils.createSuccessEmbed('Success', message);
```

### ⚠️ Critical Warnings

#### 🚨 DESTRUCTIVE COMMAND
`/admin setupserver` - **COMPLETELY WIPES AND REBUILDS THE SERVER**
- Requires confirmation: "DELETE EVERYTHING"
- Deletes ALL channels, roles, and categories
- Creates default information message in welcome channel
- Sets welcome channel as default information channel
- Use with extreme caution!

#### 🔒 Security Requirements
- ALWAYS validate permissions before operations
- ALWAYS use parameterized queries (repository pattern handles this)
- NEVER log sensitive data (tokens, passwords)
- ALWAYS audit log significant actions

## Common Development Tasks

### Adding a New Command
1. Add to appropriate command file in `src/presentation/commands/`
2. Use `@Slash` decorator with proper group
3. Implement permission checking
4. Add service method if needed
5. Update tests
6. Document in PRESENTATION_LAYER.md

### Adding a New Service
1. Create in `src/application/services/`
2. Follow constructor dependency injection pattern
3. Implement proper error handling
4. Add unit tests with mocked dependencies
5. Document in APPLICATION_LAYER.md

### Database Changes
1. Update entity in `src/domain/entities/`
2. Update repository if needed
3. Add migration logic if changing existing data
4. Update tests
5. Document in DOMAIN_LAYER.md

### Testing Requirements
- Minimum 95% code coverage
- Test all permission boundaries
- Test error scenarios
- Mock external dependencies
- Use MongoDB Memory Server for integration tests

## Environment Setup

### Required Environment Variables
```bash
DISCORD_BOT_TOKEN=your_bot_token
MONGODB_URI=mongodb://localhost:27017/anarchy-associates
MONGODB_DB_NAME=anarchy-associates
ROBLOX_COOKIE=optional_for_roblox_integration
```

### Discord Bot Permissions
Required intents: `GuildMembers`, `Guilds`, `GuildMessages`, `MessageContent`

## Key Business Rules

### Staff Role Hierarchy & Limits
- Managing Partner (1 max) → Senior Partner (3) → Junior Partner (5) → Senior Associate (10) → Junior Associate (10) → Paralegal (10)
- Promotions must follow hierarchy
- Guild owner can bypass limits

### Case Management
- Sequential numbering: `YYYY-NNNN-Username`
- Max 5 active cases per client
- Automatic Discord channel creation
- Closed cases archived, not deleted

### Permission System
- Guild owner: All permissions
- Admin roles/users: Configured per guild
- Action-based: `admin`, `hr`, `case`, `config`, `retainer`, `repair`
- Inherited permissions (e.g., admin inherits all)

### Information Channel Management
- `/info set` - Create/update information message in current channel
- `/info addfield` - Add fields to existing information message
- `/info remove` - Remove information message from channel
- `/info list` - List all information channels in server
- `/info sync` - Re-sync information message if deleted
- `/admin setdefaultinfo` - Set default information channel (auto-creates message if none exists)

## Performance Targets
- Command response: <100ms
- Bulk operations: <5s for 100 items
- Concurrent operations: Support 5+ simultaneous
- Database queries: Indexed and optimized

## Debugging Tips

### Common Issues
1. **Permission denied**: Check guild config and user roles
2. **Command not showing**: Restart bot and check decorators
3. **Database timeout**: Check MongoDB connection string
4. **Test failures**: Run with `--runInBand` for debugging

### Useful Debug Commands
```bash
npm run dev -- --inspect  # Node debugger
npm test -- --verbose     # Detailed test output
npm test -- --coverage    # Coverage report
```

## Important Notes

- **Always** update tests when changing code
- **Always** handle errors gracefully with user feedback
- **Always** use transactions for multi-step operations
- **Never** trust user input - validate everything
- **Never** modify audit logs after creation
- **Prefer** editing existing files over creating new ones
- **Document** significant changes in appropriate layer docs

Remember: This is a production system for a legal firm. Code quality, security, and reliability are paramount.