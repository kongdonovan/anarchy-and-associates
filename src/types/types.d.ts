/**
 * Application domain model
 * @property _id MongoDB ObjectId as string
 * @property discordId Discord user ID
 * @property status Application status
 * @property rejectionReason Reason for rejection (if any)
 * @property createdAt Creation date
 * @property updatedAt Last update date
 * @property responses All answers to application questions (dynamic)
 * @property username Roblox or Discord username (legacy, for compatibility)
 * @property reason Application reason (legacy, for compatibility)
 * @property experience Application experience (legacy, for compatibility)
 */
export interface Application {
  readonly _id?: string;
  readonly discordId: string;
  readonly status: "pending" | "accepted" | "rejected";
  readonly rejectionReason?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly responses: Record<string, string>;
  readonly username?: string;
  readonly reason?: string;
  readonly experience?: string;
  readonly jobId?: string; // Job ID the user applied for
}

/**
 * Staff domain model
 * @property _id MongoDB ObjectId as string
 * @property userId Discord user ID
 * @property username Discord username
 * @property role Staff role
 * @property createdAt Creation date
 * @property updatedAt Last update date
 */
export interface Staff {
  readonly _id?: string;
  readonly userId: string;
  readonly username: string;
  readonly role: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * JobQuestion domain model
 * @property id Unique question ID
 * @property label Question label
 * @property type Question type (short, paragraph, number, etc.)
 * @property required Is the question required?
 */
export interface JobQuestion {
  readonly id: string;
  readonly label: string;
  readonly type: "short" | "paragraph" | "number" | "choice";
  readonly required: boolean;
  readonly options?: string[]; // for choice type
}

/**
 * Job domain model (extended)
 * @property _id MongoDB ObjectId as string
 * @property title Job title
 * @property description Optional job description
 * @property limit Optional limit on number of open positions
 * @property questions Array of JobQuestion objects
 * @property open Whether the job is open for applications
 * @property statusHistory Array of status change events
 * @property createdAt Creation date
 * @property updatedAt Last update date
 */
export interface Job {
  readonly _id?: string;
  readonly title: string;
  readonly description?: string;
  readonly limit?: number;
  readonly questions: JobQuestion[];
  readonly open: boolean;
  readonly statusHistory?: Array<{ status: string; at: Date; by?: string }>;

  readonly roleId?: string; // Discord role ID for this job
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * GuildConfig domain model (extended, per-action permissions, and channel/category config)
 * @property actionRoles Map of action name to array of role IDs allowed for that action
 * @property feedbackChannelId Discord channel ID for feedback
 * @property retainerChannelId Discord channel ID for retainers
 * @property caseReviewCategoryId Discord category ID for case reviews
 * @property modlogChannelId Discord channel ID for modlog
 * @property applicationChannelId Discord channel ID for application reviews
 */
export interface GuildConfig {
  readonly _id?: string;
  readonly guildId: string;
  readonly privilegedRoles: string[];
  readonly caseChannelId?: string;
  readonly admins?: string[];
  readonly adminRoles?: string[];
  readonly actionRoles?: Record<string, string[]>;
  readonly feedbackChannelId?: string;
  readonly retainerChannelId?: string;
  readonly caseReviewCategoryId?: string;
  readonly modlogChannelId?: string;
  readonly clientRoleId?: string; // Discord role ID for the client
  readonly applicationChannelId?: string; // Discord channel ID for application reviews
  readonly caseCounter?: number; // For sequential case numbers
  readonly caseArchiveCategoryId?: string; // Discord category ID for case archiving
}

/**
 * Case domain model
 * @property _id MongoDB ObjectId as string
 * @property clientId Discord user ID of client
 * @property assignedTo Array of Discord user IDs of assigned lawyers
 * @property leadAttorney Discord user ID of the lead attorney
 * @property details Case details/description
 * @property documents Array of document URLs or names
 * @property status open|closed|review_requested
 * @property result win|loss|null
 * @property feedback Optional feedback
 * @property openedAt Date opened
 * @property closedAt Date closed
 * @property acceptedAt Date/time case was accepted
 * @property acceptedBy Discord user ID of staff who accepted
 * @property deniedAt Date/time case was denied
 * @property deniedBy Discord user ID of staff who denied
 * @property notes Array of notes (by, at, note)
 */
export interface Case {
  readonly _id?: string;
  readonly caseNumber: string; // Sequential case number, e.g. 2025-0001
  readonly clientId: string;
  readonly assignedTo?: string[]; // Array of Discord user IDs
  readonly leadAttorney?: string; // Discord user ID of the lead attorney
  readonly details: string;
  readonly documents: string[];
  readonly status: "open" | "closed" | "review_requested";
  readonly result?: string; // Allow any string as result
  readonly feedback?: string;
  readonly openedAt: Date;
  readonly closedAt?: Date;
  readonly acceptedAt?: Date;
  readonly acceptedBy?: string;
  readonly deniedAt?: Date;
  readonly deniedBy?: string;
  readonly notes?: Array<{ by: string; at: Date; note: string }>;
  readonly channelId?: string; // Discord channel ID for the case channel
  readonly courtDates?: Array<{ date: Date; time?: string; description: string; createdBy: string }>;
  readonly caseMsgId?: string; // L7-perf: Discord message ID for the original case message
}

/**
 * Retainer domain model
 * @property _id MongoDB ObjectId as string
 * @property clientId Discord user ID of client
 * @property lawyerId Discord user ID of lawyer
 * @property agreement Agreement text
 * @property signedAt Date signed
 * @property accepted Whether the agreement was accepted
 * @property robloxUsername Roblox username of the client
 */
export interface Retainer {
  readonly _id?: string;
  readonly clientId: string;
  readonly lawyerId: string;
  readonly agreement: string;
  readonly signedAt: Date;
  readonly accepted: boolean;
  readonly robloxUsername?: string;
}

/**
 * Feedback domain model
 * @property _id MongoDB ObjectId as string
 * @property userId Discord user ID of submitter
 * @property username Discord username of submitter
 * @property message Feedback message
 * @property createdAt Date feedback was submitted
 * @property pingedUserId Optional Discord user ID that was pinged
 * @property stars Star rating from 1 to 5
 */
export interface Feedback {
  readonly _id?: string;
  readonly userId: string;
  readonly username: string;
  readonly message: string;
  readonly createdAt: Date;
  readonly pingedUserId?: string;
  readonly stars: number; // 1-5 star rating
}

declare global {
  // MongoDB client singletons
   
  var _mongoClient: import("mongodb").MongoClient | undefined;
   
  var _mongoClientPromise: Promise<import("mongodb").MongoClient> | undefined;
}

export {};