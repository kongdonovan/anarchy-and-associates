export interface RobloxUser {
    id: number;
    username: string;
    displayName: string;
    description?: string;
    isOnline: boolean;
    joinDate: Date;
    profileUrl: string;
    avatarUrl: string;
}
export interface RobloxApiError {
    message: string;
    code?: number;
    isNotFound?: boolean;
}
export declare class RobloxService {
    private static instance;
    private readonly rateLimitDelay;
    private lastRequestTime;
    private constructor();
    static getInstance(): RobloxService;
    private rateLimit;
    getUserByUsername(username: string): Promise<RobloxUser | null>;
    getUserById(userId: number): Promise<RobloxUser | null>;
    validateUsername(username: string): Promise<{
        isValid: boolean;
        user?: RobloxUser;
        error?: string;
    }>;
    getUsernameById(userId: number): Promise<string | null>;
    private isUserNotFoundError;
    private createRobloxError;
    formatUserForDisplay(user: RobloxUser): string;
    createProfileEmbed(user: RobloxUser): {
        title: string;
        url: string;
        thumbnail: {
            url: string;
        };
        fields: {
            name: string;
            value: string;
            inline: boolean;
        }[];
        color: number;
    };
}
//# sourceMappingURL=roblox-service.d.ts.map