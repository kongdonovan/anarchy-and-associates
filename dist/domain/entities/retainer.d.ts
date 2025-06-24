import { BaseEntity } from './base';
export interface Retainer extends BaseEntity {
    guildId: string;
    clientId: string;
    clientRobloxUsername?: string;
    lawyerId: string;
    status: RetainerStatus;
    agreementTemplate: string;
    signedAt?: Date;
    digitalSignature?: string;
}
export declare enum RetainerStatus {
    PENDING = "pending",// Sent to client, awaiting signature
    SIGNED = "signed",// Client has signed the agreement
    CANCELLED = "cancelled"
}
export interface RetainerSignatureRequest {
    retainerId: string;
    clientRobloxUsername: string;
}
export declare const STANDARD_RETAINER_TEMPLATE = "RETAINER AGREEMENT\n\nThis retainer agreement is entered into between Anarchy & Associates and [CLIENT_NAME].\n\nBy signing below, the client agrees to retain Anarchy & Associates for legal representation and acknowledges understanding of the firm's terms of service.\n\nThe client agrees to:\n- Provide accurate information regarding their legal matter\n- Cooperate fully with assigned legal counsel\n- Maintain confidentiality as required\n\nAnarchy & Associates agrees to:\n- Provide competent legal representation\n- Maintain client confidentiality\n- Act in the client's best interests within ethical bounds\n\nThis agreement remains in effect until terminated by either party.\n\nDigital Signature: [SIGNATURE]\nDate: [DATE]\nRepresenting Attorney: [LAWYER_NAME]";
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
//# sourceMappingURL=retainer.d.ts.map