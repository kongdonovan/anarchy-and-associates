"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_RETAINER_TEMPLATE = exports.RetainerStatus = void 0;
var RetainerStatus;
(function (RetainerStatus) {
    RetainerStatus["PENDING"] = "pending";
    RetainerStatus["SIGNED"] = "signed";
    RetainerStatus["CANCELLED"] = "cancelled"; // Agreement was cancelled before signing
})(RetainerStatus || (exports.RetainerStatus = RetainerStatus = {}));
// Standard retainer agreement template
exports.STANDARD_RETAINER_TEMPLATE = `RETAINER AGREEMENT

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
//# sourceMappingURL=retainer.js.map