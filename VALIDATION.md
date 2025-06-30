# Validation Guide

This guide documents the Zod runtime validation implementation across the Anarchy & Associates codebase.

## Overview

We use Zod for runtime type validation to ensure data integrity and prevent runtime errors. All validation schemas serve as the single source of truth for TypeScript types.

## Architecture

### Schema Organization

```
src/validation/
├── index.ts                    # Central export point
└── schemas/
    ├── shared/                 # Common schemas and utilities
    │   └── index.ts
    ├── domain/                 # Entity validation schemas
    │   ├── index.ts
    │   ├── staff.schema.ts
    │   ├── case.schema.ts
    │   ├── job.schema.ts
    │   ├── application.schema.ts
    │   └── guild-config.schema.ts
    ├── infrastructure/         # External service schemas
    │   ├── discord.schema.ts
    │   └── mongodb.schema.ts
    ├── application/            # Service layer schemas
    │   ├── permission.schema.ts
    │   └── service.schema.ts
    └── commands/               # Command input schemas
        └── command.schema.ts
```

### Validation Layers

1. **Presentation Layer (Commands)**: Validates Discord interaction inputs
2. **Application Layer (Services)**: Validates service method inputs/outputs
3. **Infrastructure Layer (Repositories)**: Validates database operations
4. **Domain Layer (Entities)**: Validates business entity structures

## Implementation Patterns

### Basic Schema Definition

```typescript
import { z } from 'zod';

// Define schema
export const StaffRoleSchema = z.enum([
  'Managing Partner',
  'Senior Partner',
  'Junior Partner',
  'Senior Associate',
  'Junior Associate',
  'Paralegal'
]);

// Infer TypeScript type
export type StaffRole = z.infer<typeof StaffRoleSchema>;
```

### Command Validation

```typescript
// In command handler
const validateHireCommand = validateCommand(
  StaffHireCommandSchema,
  async (data) => {
    // data is fully typed and validated
    await staffService.hire(data);
  }
);
```

### Service Method Validation

```typescript
// In service
async hire(request: unknown): Promise<Staff> {
  // Validate input
  const validated = ValidationHelpers.validateOrThrow(
    StaffHireRequestSchema,
    request,
    'Staff hire request'
  );
  
  // Business logic with validated data
  const staff = await this.staffRepository.create(validated);
  
  // Validate output
  return ValidationHelpers.validateOrThrow(
    StaffSchema,
    staff,
    'Staff entity'
  );
}
```

### Repository Validation

```typescript
// In repository
async findById(id: unknown): Promise<Staff | null> {
  const validatedId = MongoIdSchema.parse(id);
  const doc = await this.collection.findOne({ _id: validatedId });
  
  if (!doc) return null;
  
  return StaffSchema.parse(doc);
}
```

## Error Handling

### Validation Errors

All validation errors are immediately thrown with descriptive messages:

```typescript
try {
  const validated = schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Format error for Discord user
    const userMessage = ValidationHelpers.formatValidationError(error);
    await interaction.reply({
      embeds: [EmbedUtils.createErrorEmbed('Validation Error', userMessage)],
      ephemeral: true
    });
  }
}
```

### Error Message Format

Validation errors presented to Discord users include:
- Clear description of what failed
- Which fields had issues
- Expected format/values
- "Please contact the bot developer if this persists"

## Common Schemas

### Shared Utilities

- `MongoIdSchema`: Validates MongoDB ObjectIds
- `DiscordSnowflakeSchema`: Validates Discord IDs
- `FlexibleTimestampSchema`: Accepts various date formats
- `StaffRoleSchema`: Enum of valid staff roles
- `PermissionActionSchema`: Valid permission actions

### Validation Helpers

```typescript
// Validate and throw on error
ValidationHelpers.validateOrThrow(schema, data, context);

// Validate without throwing
ValidationHelpers.validateSafe(schema, data);

// Format error for display
ValidationHelpers.formatZodError(error);
```

## Migration Guide

### Step 1: Update Imports

Replace interface imports with schema types:

```typescript
// Before
import { Staff } from '../domain/entities/staff';

// After
import { Staff } from '../validation';
```

### Step 2: Add Input Validation

Wrap command handlers:

```typescript
// Before
async execute(interaction: CommandInteraction) {
  const user = interaction.options.getUser('user');
  await this.staffService.hire(user);
}

// After
async execute(interaction: CommandInteraction) {
  await validateCommand(StaffHireCommandSchema, async (data) => {
    await this.staffService.hire(data);
  })(interaction);
}
```

### Step 3: Add Service Validation

Validate at service boundaries:

```typescript
// Before
async hire(request: StaffHireRequest): Promise<Staff> {
  return this.repository.create(request);
}

// After
async hire(request: unknown): Promise<Staff> {
  const validated = ValidationHelpers.validateOrThrow(
    StaffHireRequestSchema,
    request
  );
  const result = await this.repository.create(validated);
  return ValidationHelpers.validateOrThrow(StaffSchema, result);
}
```

### Step 4: Update Tests

Tests should account for validation:

```typescript
it('should reject invalid staff role', async () => {
  const request = { role: 'InvalidRole' };
  
  await expect(service.hire(request))
    .rejects
    .toThrow('Validation failed');
});
```

## Best Practices

1. **Always validate at boundaries**: Commands, service methods, repository operations
2. **Use schemas as source of truth**: Generate types from schemas, not vice versa
3. **Fail fast**: Throw immediately on validation errors
4. **Provide clear errors**: Include context about what failed and why
5. **Document complex validations**: Use JSDoc to explain business rules
6. **Test validation paths**: Ensure both valid and invalid data are tested

## Backwards Compatibility

The validation system maintains backwards compatibility by:
- Preserving existing method signatures
- Supporting flexible input types (string/Date for timestamps)
- Gracefully handling MongoDB ObjectId instances
- Maintaining existing error handling patterns

## Future Enhancements

- [ ] Add schema versioning for API evolution
- [ ] Implement request/response logging with validation
- [ ] Add performance monitoring for validation overhead
- [ ] Create validation middleware for common patterns
- [ ] Add schema documentation generation