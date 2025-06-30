/**
 * @module CommandSchemas
 * @description Zod schemas for Discord command validation
 * @category Commands/Validation
 */
import { z } from 'zod';
import { CommandInteractionSchema } from '../infrastructure/discord.schema';
/**
 * Base command schemas for different interaction types
 */
export declare const BaseCommandSchema: z.ZodObject<{
    permissionService: z.ZodAny;
    crossEntityValidationService: z.ZodOptional<z.ZodAny>;
    businessRuleValidationService: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    permissionService?: any;
    crossEntityValidationService?: any;
    businessRuleValidationService?: any;
}, {
    permissionService?: any;
    crossEntityValidationService?: any;
    businessRuleValidationService?: any;
}>;
export type BaseCommand = z.infer<typeof BaseCommandSchema>;
/**
 * Staff command input schemas
 */
export declare const StaffHireCommandSchema: z.ZodEffects<z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    roleString: z.ZodOptional<z.ZodString>;
    discordRole: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
    }, {
        id: string;
        name: string;
    }>>;
    robloxUsername: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    robloxUsername: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
    roleString?: string | undefined;
    discordRole?: {
        id: string;
        name: string;
    } | undefined;
}, {
    robloxUsername: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
    roleString?: string | undefined;
    discordRole?: {
        id: string;
        name: string;
    } | undefined;
}>, {
    robloxUsername: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
    roleString?: string | undefined;
    discordRole?: {
        id: string;
        name: string;
    } | undefined;
}, {
    robloxUsername: string;
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
    roleString?: string | undefined;
    discordRole?: {
        id: string;
        name: string;
    } | undefined;
}>;
export type StaffHireCommand = z.infer<typeof StaffHireCommandSchema>;
export declare const StaffFireCommandSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    reason: z.ZodOptional<z.ZodString>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}, {
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}>;
export type StaffFireCommand = z.infer<typeof StaffFireCommandSchema>;
export declare const StaffPromoteCommandSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    role: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    reason: z.ZodOptional<z.ZodString>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}, {
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}>;
export type StaffPromoteCommand = z.infer<typeof StaffPromoteCommandSchema>;
export declare const StaffDemoteCommandSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    role: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    reason: z.ZodOptional<z.ZodString>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}, {
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}>;
export type StaffDemoteCommand = z.infer<typeof StaffDemoteCommandSchema>;
export declare const StaffListCommandSchema: z.ZodObject<{
    roleFilter: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    roleFilter?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
}, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    roleFilter?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
}>;
export type StaffListCommand = z.infer<typeof StaffListCommandSchema>;
export declare const StaffInfoCommandSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
}, {
    user: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
}>;
export type StaffInfoCommand = z.infer<typeof StaffInfoCommandSchema>;
/**
 * Case command input schemas
 */
export declare const CaseOpenCommandSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "urgent"]>>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
}, {
    title: string;
    description: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
}>;
export type CaseOpenCommand = z.infer<typeof CaseOpenCommandSchema>;
export declare const CaseAssignCommandSchema: z.ZodObject<{
    caseNumber: z.ZodString;
    lawyer: z.ZodObject<{
        id: z.ZodString;
        username: z.ZodString;
        discriminator: z.ZodString;
        displayName: z.ZodOptional<z.ZodString>;
        avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        bot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }, {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    }>;
    leadAttorney: z.ZodOptional<z.ZodBoolean>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    lawyer: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    caseNumber: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    leadAttorney?: boolean | undefined;
}, {
    lawyer: {
        id: string;
        username: string;
        discriminator: string;
        displayName?: string | undefined;
        avatar?: string | null | undefined;
        bot?: boolean | undefined;
    };
    caseNumber: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    leadAttorney?: boolean | undefined;
}>;
export type CaseAssignCommand = z.infer<typeof CaseAssignCommandSchema>;
export declare const CaseCloseCommandSchema: z.ZodObject<{
    caseNumber: z.ZodString;
    result: z.ZodEnum<["win", "loss", "settlement", "dismissed", "withdrawn"]>;
    notes: z.ZodOptional<z.ZodString>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    caseNumber: string;
    result: "withdrawn" | "win" | "loss" | "settlement" | "dismissed";
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    notes?: string | undefined;
}, {
    caseNumber: string;
    result: "withdrawn" | "win" | "loss" | "settlement" | "dismissed";
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    notes?: string | undefined;
}>;
export type CaseCloseCommand = z.infer<typeof CaseCloseCommandSchema>;
/**
 * Job command input schemas
 */
export declare const JobPostCommandSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    role: z.ZodUnion<[z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, z.ZodString]>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    role: string;
    title: string;
    description: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
}, {
    role: string;
    title: string;
    description: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
}>;
export type JobPostCommand = z.infer<typeof JobPostCommandSchema>;
export declare const JobCloseCommandSchema: z.ZodObject<{
    jobId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    jobId: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}, {
    jobId: string;
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    reason?: string | undefined;
}>;
export type JobCloseCommand = z.infer<typeof JobCloseCommandSchema>;
/**
 * Application command input schemas
 */
export declare const JobApplyCommandSchema: z.ZodObject<{
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
}, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
}>;
export type JobApplyCommand = z.infer<typeof JobApplyCommandSchema>;
/**
 * Admin command input schemas
 */
export declare const AdminSetupServerCommandSchema: z.ZodObject<{
    confirmation: z.ZodLiteral<"DELETE EVERYTHING">;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    confirmation: "DELETE EVERYTHING";
}, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    confirmation: "DELETE EVERYTHING";
}>;
export type AdminSetupServerCommand = z.infer<typeof AdminSetupServerCommandSchema>;
export declare const AdminConfigCommandSchema: z.ZodObject<{
    setting: z.ZodString;
    value: z.ZodOptional<z.ZodString>;
    interaction: z.ZodObject<{
        guildId: z.ZodString;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }, {
            id: string;
            username: string;
            displayName?: string | undefined;
        }>;
        member: z.ZodOptional<z.ZodObject<{
            roles: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            roles: string[];
        }, {
            roles: string[];
        }>>;
        guild: z.ZodAny;
        replied: z.ZodOptional<z.ZodBoolean>;
        deferred: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }, {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    setting: string;
    value?: string | undefined;
}, {
    interaction: {
        guildId: string;
        channelId: string;
        user: {
            id: string;
            username: string;
            displayName?: string | undefined;
        };
        guild?: any;
        member?: {
            roles: string[];
        } | undefined;
        replied?: boolean | undefined;
        deferred?: boolean | undefined;
    };
    setting: string;
    value?: string | undefined;
}>;
export type AdminConfigCommand = z.infer<typeof AdminConfigCommandSchema>;
/**
 * Button interaction schemas
 */
export declare const JobApplicationButtonSchema: z.ZodObject<{
    customId: z.ZodString;
    jobId: z.ZodEffects<z.ZodString, string, string>;
    interaction: z.ZodObject<{
        customId: z.ZodString;
        guildId: z.ZodNullable<z.ZodString>;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            discriminator: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
            avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            bot: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }>;
        message: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    }, {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    jobId: string;
    customId: string;
    interaction: {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    };
}, {
    jobId: string;
    customId: string;
    interaction: {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    };
}>;
export type JobApplicationButton = z.infer<typeof JobApplicationButtonSchema>;
export declare const ApplicationReviewButtonSchema: z.ZodObject<{
    customId: z.ZodString;
    action: z.ZodEnum<["accept", "reject"]>;
    applicationId: z.ZodString;
    interaction: z.ZodObject<{
        customId: z.ZodString;
        guildId: z.ZodNullable<z.ZodString>;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            discriminator: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
            avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            bot: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }>;
        message: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    }, {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    action: "accept" | "reject";
    applicationId: string;
    customId: string;
    interaction: {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    };
}, {
    action: "accept" | "reject";
    applicationId: string;
    customId: string;
    interaction: {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        message?: any;
    };
}>;
export type ApplicationReviewButton = z.infer<typeof ApplicationReviewButtonSchema>;
/**
 * Modal submit schemas
 */
export declare const JobApplicationModalSchema: z.ZodObject<{
    customId: z.ZodString;
    jobId: z.ZodString;
    fields: z.ZodObject<{
        robloxUsername: z.ZodString;
        answers: z.ZodRecord<z.ZodString, z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        robloxUsername: string;
        answers: Record<string, string>;
    }, {
        robloxUsername: string;
        answers: Record<string, string>;
    }>;
    interaction: z.ZodObject<{
        customId: z.ZodString;
        fields: z.ZodAny;
        guildId: z.ZodNullable<z.ZodString>;
        channelId: z.ZodString;
        user: z.ZodObject<{
            id: z.ZodString;
            username: z.ZodString;
            discriminator: z.ZodString;
            displayName: z.ZodOptional<z.ZodString>;
            avatar: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            bot: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }, {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        fields?: any;
    }, {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        fields?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    jobId: string;
    customId: string;
    fields: {
        robloxUsername: string;
        answers: Record<string, string>;
    };
    interaction: {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        fields?: any;
    };
}, {
    jobId: string;
    customId: string;
    fields: {
        robloxUsername: string;
        answers: Record<string, string>;
    };
    interaction: {
        guildId: string | null;
        channelId: string;
        user: {
            id: string;
            username: string;
            discriminator: string;
            displayName?: string | undefined;
            avatar?: string | null | undefined;
            bot?: boolean | undefined;
        };
        customId: string;
        fields?: any;
    };
}>;
export type JobApplicationModal = z.infer<typeof JobApplicationModalSchema>;
/**
 * Command validation wrapper
 * @description Validates command inputs before execution
 */
export declare function validateCommand<T>(schema: z.ZodSchema<T>, handler: (data: T) => Promise<void>): (data: unknown) => Promise<void>;
/**
 * Interaction validation helpers
 */
export declare const CommandValidationHelpers: {
    /**
     * Validate command has required guild context
     */
    validateGuildCommand(interaction: unknown): asserts interaction is z.infer<typeof CommandInteractionSchema> & {
        guildId: string;
    };
    /**
     * Extract role from string or Discord role
     */
    extractStaffRole(roleString?: string, discordRole?: {
        name: string;
    }): string;
};
//# sourceMappingURL=command.schema.d.ts.map