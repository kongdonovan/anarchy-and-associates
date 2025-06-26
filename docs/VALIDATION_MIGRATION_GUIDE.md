# Command Validation System Migration Guide

This guide explains how to migrate existing commands to use the new validation system in the Anarchy & Associates bot.

## Overview

The new validation system provides:
- Centralized validation logic
- Decorator-based validation
- Automatic bypass workflows for guild owners
- Comprehensive error handling
- Performance optimization through caching
- Non-breaking progressive adoption

## Migration Steps

### 1. Update Command Class to Extend BaseCommand

**Before:**
```typescript
@Discord()
@SlashGroup({ name: 'staff', description: 'Staff management commands' })
export class StaffCommands {
  constructor() {
    // Initialize repositories and services
  }
}
```

**After:**
```typescript
import { BaseCommand } from './base-command';
import { CommandValidationService } from '../../application/services/command-validation-service';
import { CrossEntityValidationService } from '../../application/services/cross-entity-validation-service';

@Discord()
@SlashGroup({ name: 'staff', description: 'Staff management commands' })
export class StaffCommands extends BaseCommand {
  private crossEntityValidationService: CrossEntityValidationService;

  constructor() {
    super();
    // Initialize repositories and services
    
    // Initialize validation services
    this.commandValidationService = new CommandValidationService(
      this.businessRuleValidationService,
      this.crossEntityValidationService
    );
    
    // Initialize base class validation services
    this.initializeValidationServices(
      this.commandValidationService,
      this.businessRuleValidationService,
      this.crossEntityValidationService,
      this.permissionService
    );
  }
}
```

### 2. Add Validation Decorators to Commands

**Before:**
```typescript
@Slash({ name: 'hire', description: 'Hire a new staff member' })
async hireStaff(
  @SlashOption({ name: 'user', type: ApplicationCommandOptionType.User, required: true })
  user: User,
  @SlashOption({ name: 'role', type: ApplicationCommandOptionType.String, required: true })
  role: string,
  interaction: CommandInteraction
): Promise<void> {
  // Manual permission check
  const context = await this.getPermissionContext(interaction);
  const hasPermission = await this.permissionService.hasSeniorStaffPermissionWithContext(context);
  
  if (!hasPermission) {
    await interaction.reply({
      embeds: [this.createErrorEmbed('You do not have permission to hire staff members.')],
      ephemeral: true,
    });
    return;
  }

  // Manual role limit validation
  const roleLimitValidation = await this.businessRuleValidationService.validateRoleLimit(
    context,
    role as StaffRole
  );

  if (!roleLimitValidation.valid) {
    // Complex bypass logic here...
  }

  // Rest of the command...
}
```

**After:**
```typescript
import { ValidatePermissions, ValidateBusinessRules } from '../decorators/validation-decorators';

@Slash({ name: 'hire', description: 'Hire a new staff member' })
@ValidatePermissions('senior-staff')
@ValidateBusinessRules('role_limit')
async hireStaff(
  @SlashOption({ name: 'user', type: ApplicationCommandOptionType.User, required: true })
  user: User,
  @SlashOption({ name: 'role', type: ApplicationCommandOptionType.String, required: true })
  role: string,
  interaction: CommandInteraction
): Promise<void> {
  // Validation is handled by decorators
  // Command logic starts here
  
  // Validate role format (custom validation)
  if (!RoleUtils.isValidRole(role)) {
    const validRoles = RoleUtils.getAllRoles().join(', ');
    await interaction.reply({
      embeds: [this.createErrorEmbed(`Invalid role. Valid roles are: ${validRoles}`)],
      ephemeral: true,
    });
    return;
  }

  // Proceed with hiring logic
  await this.performStaffHiring(interaction, user, role as StaffRole, robloxUsername, reason, context);
}
```

### 3. Available Validation Decorators

#### @ValidateCommand(options?)
General command validation with custom options:
```typescript
@ValidateCommand({
  skipPermissionCheck: false,
  skipBusinessRules: false,
  skipEntityValidation: false,
})
async myCommand(interaction: CommandInteraction) { }
```

#### @ValidatePermissions(permission, bypassable?)
Validate user has required permissions:
```typescript
@ValidatePermissions('admin', true) // bypassable by guild owner
@ValidatePermissions('hr', false)   // not bypassable
async myCommand(interaction: CommandInteraction) { }
```

#### @ValidateBusinessRules(...rules)
Validate specific business rules:
```typescript
@ValidateBusinessRules('role_limit', 'staff_member')
async myCommand(interaction: CommandInteraction) { }
```

Supported rules:
- `'role_limit'` - Check staff role limits
- `'client_case_limit'` - Check client case limits
- `'staff_member'` - Validate target is staff member

#### @ValidateEntity(entityType, operation)
Validate entity operations:
```typescript
@ValidateEntity('staff', 'delete')  // Validate before deleting staff
@ValidateEntity('case', 'update')   // Validate before updating case
async myCommand(interaction: CommandInteraction) { }
```

### 4. Custom Validation Rules

Add custom validation rules for specific commands:

```typescript
import { addCustomValidationRule, CommandValidationRule } from '../decorators/validation-decorators';

// In constructor or initialization
const customRule: CommandValidationRule = {
  name: 'custom_check',
  priority: 3,
  bypassable: true,
  validate: async (context) => {
    // Custom validation logic
    if (someCondition) {
      return {
        valid: false,
        errors: ['Custom validation failed'],
        warnings: [],
        bypassAvailable: true,
        bypassType: 'guild-owner',
      };
    }
    return { valid: true, errors: [], warnings: [], bypassAvailable: false };
  }
};

addCustomValidationRule(this, 'myCommand', customRule);
```

### 5. Manual Validation (Advanced)

For complex scenarios, use manual validation:

```typescript
async myCommand(interaction: CommandInteraction) {
  // Manual validation with custom options
  const validationResult = await this.validateCommand(interaction, {
    customRules: [{
      name: 'special_check',
      validate: async (ctx) => {
        // Special validation logic
        return { valid: true, errors: [], warnings: [], bypassAvailable: false };
      }
    }]
  });

  if (!await this.handleValidationResult(interaction, validationResult)) {
    return; // Validation failed
  }

  // Command logic continues...
}
```

## Bypass Workflow

The validation system automatically handles bypass workflows for guild owners:

1. Validation fails with `bypassAvailable: true`
2. If user is guild owner, a modal is shown
3. Owner provides reason and confirms with "OVERRIDE"
4. Command proceeds with bypass logged

### Handling Bypass Confirmation

The system handles bypass confirmation automatically, but you can customize the modal:

```typescript
// In a button interaction handler
@ButtonComponent({ id: 'validation_bypass_confirm' })
async handleBypassConfirm(interaction: ButtonInteraction) {
  const success = await this.handleValidationBypass(interaction);
  if (success) {
    // Continue with original command
  }
}
```

## Error Handling

The validation system provides comprehensive error handling:

```typescript
import { ValidationErrorHandler } from '../utils/validation-error-handler';

// Create detailed error embeds
const errorEmbed = ValidationErrorHandler.createValidationErrorEmbed(
  validationResult,
  'staff',
  'hire'
);

// Create bypass confirmation embeds
const confirmEmbed = ValidationErrorHandler.createBypassConfirmationEmbed(
  validationResult.bypassRequests
);

// Create action buttons
const buttons = ValidationErrorHandler.createValidationActionButtons(
  validationResult,
  context.isGuildOwner
);
```

## Performance Optimization

The validation system includes automatic caching:

```typescript
// Clear cache when needed
this.commandValidationService.clearValidationCache();

// Clear specific command cache
const context = await this.commandValidationService.extractValidationContext(
  interaction,
  permissionContext
);
this.commandValidationService.clearValidationCache(context);
```

## Testing

Test commands with validation:

```typescript
describe('MyCommand', () => {
  it('should validate permissions', async () => {
    const command = new MyCommands();
    
    // Mock validation failure
    command.businessRuleValidationService.validatePermission = jest.fn()
      .mockResolvedValue({
        valid: false,
        errors: ['Missing permission'],
        warnings: [],
        bypassAvailable: false,
      });

    await command.myCommand(mockInteraction);
    
    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        ephemeral: true,
      })
    );
  });
});
```

## Best Practices

1. **Use decorators for common validations** - Reduces boilerplate
2. **Keep custom validation logic minimal** - Use decorators when possible
3. **Always extend BaseCommand** - Provides consistent error handling
4. **Test validation scenarios** - Ensure proper error messages
5. **Document bypass conditions** - Make it clear when bypasses are available
6. **Use appropriate bypass settings** - Not all validations should be bypassable

## Troubleshooting

### Validation not running
- Ensure command class extends `BaseCommand`
- Check that validation services are initialized
- Verify decorator order (decorators run bottom-up)

### Bypass not offered
- Check `isGuildOwner` in permission context
- Ensure validation returns `bypassAvailable: true`
- Verify `requiresConfirmation` is set

### Cache issues
- Clear cache after data changes
- Check cache TTL settings
- Monitor cache size

## Migration Checklist

- [ ] Extend BaseCommand in command class
- [ ] Initialize validation services in constructor
- [ ] Add appropriate validation decorators
- [ ] Remove manual validation code
- [ ] Test validation scenarios
- [ ] Test bypass workflows
- [ ] Update error messages
- [ ] Document any custom validations