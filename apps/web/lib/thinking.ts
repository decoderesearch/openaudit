/**
 * Puts a blank line before each part of a thinking summary. A part starts with a bold title on its
 * own line ("**Title**\n"). Some providers join the parts with no break ("okay!**Title**\n").
 */
export const splitSummaryParts = (text: string) => text.replace(/(\S)(\*\*[^*\n]+\*\*\n)/g, '$1\n\n$2');
