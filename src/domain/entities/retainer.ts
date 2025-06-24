import { BaseEntity } from './base';

export interface Retainer extends BaseEntity {
  guildId: string;
  clientId: string; // Discord user ID of the client
  clientRobloxUsername?: string; // Set when signed
  lawyerId: string; // Discord user ID of the lawyer who initiated
  status: RetainerStatus;
  agreementTemplate: string; // The legal agreement text
  signedAt?: Date;
  digitalSignature?: string; // Client's Roblox username used for signing
}

export enum RetainerStatus {
  PENDING = 'pending', // Sent to client, awaiting signature
  SIGNED = 'signed', // Client has signed the agreement
  CANCELLED = 'cancelled' // Agreement was cancelled before signing
}

export interface RetainerSignatureRequest {
  retainerId: string;
  clientRobloxUsername: string;
}

// Standard retainer agreement template
export const STANDARD_RETAINER_TEMPLATE = `RETAINER AGREEMENT

This retainer agreement is entered into between Anarchy & Associates and [CLIENT_NAME].

By signing below, the client agrees to retain Anarchy & Associates for legal representation and acknowledges understanding of the firm's terms of service.

The client agrees to:
- Provide accurate information regarding their legal matter
- Cooperate fully with assigned legal counsel
- Maintain confidentiality as required

Anarchy & Associates agrees to:
- Provide competent legal representation
- Maintain client confidentiality
- Act in the client's best interests within ethical bounds

This agreement remains in effect until terminated by either party.

Digital Signature: [SIGNATURE]
Date: [DATE]
Representing Attorney: [LAWYER_NAME]`;

export interface RetainerCreationRequest {
  guildId: string;
  clientId: string;
  lawyerId: string;
}

export interface FormattedRetainerAgreement {
  clientName: string;
  clientRobloxUsername: string;
  lawyerName: string;
  signedAt: Date;
  agreementText: string;
}