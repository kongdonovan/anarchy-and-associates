/**
 * Case service helpers for case embed/message formatting.
 * @module services/cases
 */
import { EmbedBuilder } from "discord.js";

/**
 * Build embed for case assignment (multiple staff, always use this version).
 * @param caseId - Case ID
 * @param userIds - Array of Discord user IDs assigned
 * @param leadAttorney - Discord user ID of the lead attorney (optional)
 * @returns EmbedBuilder instance
 */
export function buildCaseAssignedEmbed(caseId: string, userIds: string[], leadAttorney?: string) {
  const assignedList = userIds.map(id => leadAttorney && id === leadAttorney ? `**<@${id}> (Lead Attorney)**` : `<@${id}>`).join(", ");
  return new EmbedBuilder()
    .setTitle("Case Assigned")
    .setDescription(
      `Case **#${caseId}** has been assigned to: ${assignedList}\n\nAll assigned attorneys will be notified to begin work on this matter.`
    );
}

/**
 * Build embed for case review request.
 * @param clientId - Discord user ID of client
 * @param details - Case details
 * @param caseNumber - Case number
 * @returns EmbedBuilder instance
 */
export function buildCaseReviewEmbed(clientId: string, details: string, caseNumber: string) {
  return new EmbedBuilder()
    .setTitle(`Case Review #${caseNumber}`)
    .setDescription(`A new case review has been requested by <@${clientId}>.`)
    .addFields(
      { name: "Case Number", value: caseNumber, inline: true },
      { name: "Client", value: `<@${clientId}>`, inline: true },
      { name: "Opened", value: new Date().toLocaleDateString(), inline: true },
      { name: "Status", value: "Review Requested", inline: true },
      { name: "Details", value: details, inline: false }
    );
}

/**
 * Build embed for case closure.
 * @param caseId - Case ID
 * @param result - Result string (optional)
 * @param notes - Notes string (optional)
 * @returns EmbedBuilder instance
 */
export function buildCaseClosedEmbed(caseId: string, result?: string, notes?: string) {
  return new EmbedBuilder()
    .setTitle("Case Closed")
    .setDescription(
      `Case **#${caseId}** has been closed.` +
      (result ? `\nResult: **${result.toUpperCase()}**` : "") +
      (notes ? `\nNotes: ${notes}` : "")
    );
}

/**
 * Build embed for case list/pagination.
 * @param cases - Array of case objects
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @returns EmbedBuilder instance
 */
export function buildCaseListEmbed(cases: any[], currentPage: number, totalPages: number) {
  return new EmbedBuilder()
    .setTitle("Case List")
    .setDescription(
      cases.length
        ? cases.map(c => `**Case #${c._id?.toString().slice(-6)}** — ${c.status.toUpperCase()}\n${c.details}\n👤 Client: <@${c.clientId}>${c.assignedTo && c.assignedTo.length ? `\n👨‍⚖️ Assigned: ${c.assignedTo.map((id: string) => c.leadAttorney && id === c.leadAttorney ? `**<@${id}> (Lead)**` : `<@${id}>`).join(", ")}` : ""}`)
            .join("\n\n")
        : "No cases found."
    )
    .setFooter({ text: `Anarchy & Associates — Legal Operations | Page ${currentPage} of ${totalPages}` });
}

/**
 * Build embed for case overview.
 * @param caseObj - Case object
 * @returns EmbedBuilder instance
 */
export function buildCaseOverviewEmbed(caseObj: any): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`Case Overview: #${caseObj.caseNumber || caseObj._id}`)
    .addFields(
      { name: "Status", value: caseObj.status, inline: true },
      { name: "Client", value: `<@${caseObj.clientId}>`, inline: true },
      { name: "Assigned To", value: Array.isArray(caseObj.assignedTo) ? (caseObj.assignedTo.length ? caseObj.assignedTo.map((id: string) => caseObj.leadAttorney && id === caseObj.leadAttorney ? `**<@${id}> (Lead Attorney)**` : `<@${id}>`).join(", ") : "Unassigned") : (caseObj.assignedTo ? `<@${caseObj.assignedTo}>` : "Unassigned"), inline: true },
      { name: "Opened", value: caseObj.openedAt ? new Date(caseObj.openedAt).toLocaleString() : "N/A", inline: true },
      { name: "Closed", value: caseObj.closedAt ? new Date(caseObj.closedAt).toLocaleString() : "N/A", inline: true }
    )
    .setDescription(caseObj.details || "No details provided.");
}

/**
 * Build embed for case documents.
 * @param caseObj - Case object
 * @returns EmbedBuilder instance
 */
export function buildCaseDocsEmbed(caseObj: any): EmbedBuilder {
  const docs = caseObj.documents || [];
  return new EmbedBuilder()
    .setTitle(`Case Documents: #${caseObj.caseNumber || caseObj._id}`)
    .setDescription(docs.length ? docs.map((d: string, i: number) => `**${i + 1}.** [Document](${d})`).join("\n") : "No documents submitted.");
}

/**
 * Build embed for case notes.
 * @param caseObj - Case object
 * @returns EmbedBuilder instance
 */
export function buildCaseNotesEmbed(caseObj: any): EmbedBuilder {
  const notes = caseObj.notes || [];
  return new EmbedBuilder()
    .setTitle(`Case Notes: #${caseObj.caseNumber || caseObj._id}`)
    .setDescription(notes.length ? notes.map((n: any, i: number) => `**${i + 1}.** ${n.note} _(by <@${n.by}> at ${new Date(n.at).toLocaleString()})_`).join("\n\n") : "No notes for this case.");
}
