/**
 * Admin API client — browser-side fetch wrappers.
 *
 * These call the AROS backend server (when one exists) or can be pointed
 * at any API endpoint via AROS_API_URL env var / window.__AROS_API_URL__.
 *
 * For now, the admin pages use localStorage as a client-side store
 * so the review workflow is functional without a server. When a real
 * backend is wired, swap the storage calls for fetch() calls.
 */

import type { PluginSubmission, PluginReviewStatus, SubmissionCreateInput, ReviewAction, DemoCredentials } from '../../../../marketplace/types.js';

// ── Local storage fallback (no server required) ──────────────────

const SUBMISSIONS_KEY = 'aros-plugin-submissions';

function generateId(): string {
  return `psub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadSubmissions(): Record<string, PluginSubmission> {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSubmissions(data: Record<string, PluginSubmission>): void {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(data));
}

// ── CRUD ─────────────────────────────────────────────────────────

export function createSubmission(
  input: SubmissionCreateInput,
  submitterId: string,
  submitterEmail: string,
): PluginSubmission {
  const subs = loadSubmissions();
  const id = generateId();
  const now = new Date().toISOString();

  const submission: PluginSubmission = {
    id,
    nodeId: `node_${input.packageName.replace(/[^a-z0-9]/gi, '_')}`,
    submitterId,
    submitterEmail,
    name: input.name,
    version: input.version,
    description: input.description,
    category: input.category,
    changelog: input.changelog,
    packageName: input.packageName,
    sourceUrl: input.sourceUrl,
    screenshots: input.screenshots,
    demoCredentials: input.demoCredentials,
    status: 'pending_review', // auto-submit on creation from UI
    submittedAt: now,
    revisionCount: 0,
  };

  subs[id] = submission;
  saveSubmissions(subs);
  return submission;
}

export function listSubmissions(filters?: {
  status?: PluginReviewStatus;
  submitterId?: string;
}): PluginSubmission[] {
  const all = Object.values(loadSubmissions());
  return all.filter((sub) => {
    if (filters?.status && sub.status !== filters.status) return false;
    if (filters?.submitterId && sub.submitterId !== filters.submitterId) return false;
    return true;
  }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export function reviewSubmission(action: ReviewAction, reviewerId: string): PluginSubmission {
  const subs = loadSubmissions();
  const sub = subs[action.submissionId];
  if (!sub) throw new Error('Submission not found');

  const now = new Date().toISOString();
  sub.reviewedAt = now;
  sub.reviewedBy = reviewerId;
  sub.reviewNotes = action.notes;

  switch (action.action) {
    case 'approve':
      sub.status = 'approved';
      break;
    case 'reject':
      sub.status = 'rejected';
      sub.rejectionReason = action.rejectionReason ?? action.notes;
      break;
    case 'request_revision':
      sub.status = 'draft';
      sub.revisionCount += 1;
      break;
  }

  subs[action.submissionId] = sub;
  saveSubmissions(subs);
  return sub;
}

export function publishSubmission(submissionId: string): PluginSubmission {
  const subs = loadSubmissions();
  const sub = subs[submissionId];
  if (!sub) throw new Error('Submission not found');
  if (sub.status !== 'approved') throw new Error('Can only publish approved submissions');

  sub.status = 'published';
  sub.publishedAt = new Date().toISOString();
  subs[submissionId] = sub;
  saveSubmissions(subs);
  return sub;
}

export function countByStatus(): Record<PluginReviewStatus, number> {
  const all = Object.values(loadSubmissions());
  const counts: Record<string, number> = {
    draft: 0, pending_review: 0, in_review: 0, approved: 0, rejected: 0, published: 0,
  };
  for (const sub of all) {
    counts[sub.status] = (counts[sub.status] ?? 0) + 1;
  }
  return counts as Record<PluginReviewStatus, number>;
}
