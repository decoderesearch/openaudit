import { prisma } from '@/lib/db';

/** The admin work that waits: run requests, card and panel drafts to review, card errors and new
 * submissions. */
export async function adminTodo() {
  const [requested, cardDrafts, panelDrafts, failedCards, newSubmissions] = await Promise.all([
    prisma.evalRun.count({ where: { status: 'requested' } }),
    prisma.openAuditCard.count({ where: { versions: { some: { status: 'draft' } } } }),
    prisma.deployPanel.count({ where: { status: 'draft' } }),
    prisma.openAuditCard.count({ where: { error: { not: null } } }),
    prisma.submission.count({ where: { status: 'received' } }),
  ]);
  return {
    requested,
    cardDrafts,
    panelDrafts,
    failedCards,
    newSubmissions,
    total: requested + cardDrafts + panelDrafts + failedCards + newSubmissions,
  };
}

/** Counts for the admin home page. */
export async function adminSummary() {
  const [todo, active, users, staff, panels, orgs, hiddenOrgs, proposedIssues, confirmedIssues, openSubmissions] =
    await Promise.all([
      adminTodo(),
      prisma.evalRun.count({ where: { status: { in: ['queued', 'running', 'importing'] } } }),
      prisma.user.count(),
      prisma.user.count({ where: { role: { in: ['admin', 'moderator'] } } }),
      prisma.deployPanel.count({ where: { status: 'published' } }),
      prisma.organization.count(),
      prisma.organization.count({ where: { hidden: true } }),
      prisma.evalSampleIssue.count({ where: { status: 'proposed' } }),
      prisma.evalSampleIssue.count({ where: { status: 'confirmed' } }),
      prisma.submission.count({ where: { status: { in: ['received', 'reviewing'] } } }),
    ]);
  return { ...todo, active, users, staff, panels, orgs, hiddenOrgs, proposedIssues, confirmedIssues, openSubmissions };
}
