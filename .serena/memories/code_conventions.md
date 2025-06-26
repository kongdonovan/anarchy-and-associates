# Code Style and Conventions

## TypeScript Conventions
- Use strict mode
- Use decorators for Discord commands with discordx
- Use interfaces for all data structures
- Use enums for constants (e.g., StaffRole, CaseStatus)
- Export everything that might be used elsewhere

## Naming Conventions
- Classes: PascalCase (e.g., `StaffService`, `CaseRepository`)
- Interfaces: PascalCase with descriptive names
- Methods: camelCase
- Files: kebab-case (e.g., `staff-service.ts`, `case-repository.ts`)
- MongoDB collections: lowercase (e.g., 'staff', 'cases')

## Architecture Patterns
- **Repository Pattern**: All data access through repositories extending `BaseMongoRepository`
- **Service Layer**: Business logic in service classes
- **Dependency Injection**: Services receive repositories in constructors
- **Error Handling**: Always wrap in try-catch with proper logging
- **Audit Trail**: Log all significant actions to AuditLog

## Discord Patterns
- Use `EmbedUtils` for consistent embed styling
- Permission checks before all sensitive operations
- Guild isolation for multi-server support
- Always handle edge cases (missing channels, disabled DMs, etc.)

## Testing Patterns
- Unit tests with mocked dependencies
- Integration tests with MongoDB Memory Server
- E2E tests for Discord command workflows
- Always clean up after tests