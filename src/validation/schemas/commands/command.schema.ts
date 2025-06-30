/**
 * @module CommandSchemas
 * @description Zod schemas for Discord command validation
 * @category Commands/Validation
 */

import { z } from 'zod';
import { 
  DiscordSnowflakeSchema,
  StaffRoleSchema,
  ValidationHelpers
} from '../shared';
import { 
  CommandInteractionSchema,
  ButtonInteractionSchema,
  ModalSubmitInteractionSchema,
  DiscordUserSchema
} from '../infrastructure/discord.schema';

/**
 * Base command schemas for different interaction types
 */
export const BaseCommandSchema = z.object({
  permissionService: z.any(), // Would be z.instanceof(PermissionService) in real code
  crossEntityValidationService: z.any().optional(),
  businessRuleValidationService: z.any().optional(),
});

export type BaseCommand = z.infer<typeof BaseCommandSchema>;

/**
 * Staff command input schemas
 */
export const StaffHireCommandSchema = z.object({
  user: DiscordUserSchema,
  roleString: z.string().optional(),
  discordRole: z.object({
    id: DiscordSnowflakeSchema,
    name: z.string(),
  }).optional(),
  robloxUsername: z.string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/),
  reason: z.string().max(500).optional(),
  interaction: CommandInteractionSchema,
}).refine((data) => {
  // Ensure at least one role input is provided
  return Boolean(data.roleString || data.discordRole);
}, {
  message: 'Either role name or Discord role must be provided'
});

export type StaffHireCommand = z.infer<typeof StaffHireCommandSchema>;

export const StaffFireCommandSchema = z.object({
  user: DiscordUserSchema,
  reason: z.string().max(500).optional(),
  interaction: CommandInteractionSchema,
});

export type StaffFireCommand = z.infer<typeof StaffFireCommandSchema>;

export const StaffPromoteCommandSchema = z.object({
  user: DiscordUserSchema,
  role: StaffRoleSchema,
  reason: z.string().max(500).optional(),
  interaction: CommandInteractionSchema,
});

export type StaffPromoteCommand = z.infer<typeof StaffPromoteCommandSchema>;

export const StaffDemoteCommandSchema = z.object({
  user: DiscordUserSchema,
  role: StaffRoleSchema,
  reason: z.string().max(500).optional(),
  interaction: CommandInteractionSchema,
});

export type StaffDemoteCommand = z.infer<typeof StaffDemoteCommandSchema>;

export const StaffListCommandSchema = z.object({
  roleFilter: StaffRoleSchema.optional(),
  interaction: CommandInteractionSchema,
});

export type StaffListCommand = z.infer<typeof StaffListCommandSchema>;

export const StaffInfoCommandSchema = z.object({
  user: DiscordUserSchema,
  interaction: CommandInteractionSchema,
});

export type StaffInfoCommand = z.infer<typeof StaffInfoCommandSchema>;

/**
 * Case command input schemas
 */
export const CaseOpenCommandSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  interaction: CommandInteractionSchema,
});

export type CaseOpenCommand = z.infer<typeof CaseOpenCommandSchema>;

export const CaseAssignCommandSchema = z.object({
  caseNumber: z.string(),
  lawyer: DiscordUserSchema,
  leadAttorney: z.boolean().optional(),
  interaction: CommandInteractionSchema,
});

export type CaseAssignCommand = z.infer<typeof CaseAssignCommandSchema>;

export const CaseCloseCommandSchema = z.object({
  caseNumber: z.string(),
  result: z.enum(['win', 'loss', 'settlement', 'dismissed', 'withdrawn']),
  notes: z.string().max(2000).optional(),
  interaction: CommandInteractionSchema,
});

export type CaseCloseCommand = z.infer<typeof CaseCloseCommandSchema>;

/**
 * Job command input schemas
 */
export const JobPostCommandSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  role: z.union([StaffRoleSchema, z.string()]),
  interaction: CommandInteractionSchema,
});

export type JobPostCommand = z.infer<typeof JobPostCommandSchema>;

export const JobCloseCommandSchema = z.object({
  jobId: z.string(),
  reason: z.string().max(500).optional(),
  interaction: CommandInteractionSchema,
});

export type JobCloseCommand = z.infer<typeof JobCloseCommandSchema>;

/**
 * Application command input schemas
 */
export const JobApplyCommandSchema = z.object({
  interaction: CommandInteractionSchema,
});

export type JobApplyCommand = z.infer<typeof JobApplyCommandSchema>;

/**
 * Admin command input schemas
 */
export const AdminSetupServerCommandSchema = z.object({
  confirmation: z.literal('DELETE EVERYTHING'),
  interaction: CommandInteractionSchema,
});

export type AdminSetupServerCommand = z.infer<typeof AdminSetupServerCommandSchema>;

export const AdminConfigCommandSchema = z.object({
  setting: z.string(),
  value: z.string().optional(),
  interaction: CommandInteractionSchema,
});

export type AdminConfigCommand = z.infer<typeof AdminConfigCommandSchema>;

/**
 * Button interaction schemas
 */
export const JobApplicationButtonSchema = z.object({
  customId: z.string().regex(/^job_apply_/),
  jobId: z.string().transform(id => id.replace('job_apply_', '')),
  interaction: ButtonInteractionSchema,
});

export type JobApplicationButton = z.infer<typeof JobApplicationButtonSchema>;

export const ApplicationReviewButtonSchema = z.object({
  customId: z.string().regex(/^application_(accept|reject)_/),
  action: z.enum(['accept', 'reject']),
  applicationId: z.string(),
  interaction: ButtonInteractionSchema,
});

export type ApplicationReviewButton = z.infer<typeof ApplicationReviewButtonSchema>;

/**
 * Modal submit schemas
 */
export const JobApplicationModalSchema = z.object({
  customId: z.string().regex(/^job_application_/),
  jobId: z.string(),
  fields: z.object({
    robloxUsername: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
    answers: z.record(z.string(), z.string()),
  }),
  interaction: ModalSubmitInteractionSchema,
});

export type JobApplicationModal = z.infer<typeof JobApplicationModalSchema>;

/**
 * Command validation wrapper
 * @description Validates command inputs before execution
 */
export function validateCommand<T>(
  schema: z.ZodSchema<T>,
  handler: (data: T) => Promise<void>
): (data: unknown) => Promise<void> {
  return async (data: unknown) => {
    const validated = ValidationHelpers.validateOrThrow(schema, data, 'Command input');
    await handler(validated);
  };
}

/**
 * Interaction validation helpers
 */
export const CommandValidationHelpers = {
  /**
   * Validate command has required guild context
   */
  validateGuildCommand(interaction: unknown): asserts interaction is z.infer<typeof CommandInteractionSchema> & { guildId: string } {
    const validated = CommandInteractionSchema.parse(interaction);
    if (!validated.guildId) {
      throw new Error('This command can only be used in a server');
    }
  },

  /**
   * Extract role from string or Discord role
   */
  extractStaffRole(roleString?: string, discordRole?: { name: string }): string {
    if (roleString && StaffRoleSchema.safeParse(roleString).success) {
      return roleString;
    }
    
    if (discordRole) {
      const roleName = discordRole.name;
      if (StaffRoleSchema.safeParse(roleName).success) {
        return roleName;
      }
      
      // Try to extract from job-specific role (e.g., "Senior Associate - Legal")
      const parts = roleName.split(' - ');
      const firstPart = parts[0];
      if (firstPart) {
        const baseRoleName = firstPart.trim();
        if (StaffRoleSchema.safeParse(baseRoleName).success) {
          return baseRoleName;
        }
      }
    }
    
    throw new Error('Invalid staff role');
  },
};
