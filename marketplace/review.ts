import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  PluginSubmission,
  PluginReviewStatus,
  SubmissionCreateInput,
  ReviewAction,
} from './types.js';

// ── Storage ──────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), '.aros-data');
const SUBMISSIONS_FILE = join(DATA_DIR, 'plugin-submissions.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadSubmissions(): Record<string, PluginSubmission> {
  if (!existsSync(SUBMISSIONS_FILE)) return {};
  return JSON.parse(readFileSync(SUBMISSIONS_FILE, 'utf8'));
}

function saveSubmissions(data: Record<string, PluginSubmission>): void {
  ensureDataDir();
  writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateId(): string {
  return `psub_${randomBytes(12).toString('hex')}`;
}

// ── Submission lifecycle ─────────────────────────────────────────

/**
 * Create a new plugin submission (status: draft).
 */
export function createSubmission(
  input: SubmissionCreateInput,
  submitterId: string,
  submitterEmail: string,
): PluginSubmission {
  const submissions = loadSubmissions();
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
    status: 'draft',
    submittedAt: now,
    revisionCount: 0,
  };

  submissions[id] = submission;
  saveSubmissions(submissions);
  return submission;
}

/**
 * Submit a draft for review (draft → pending_review).
 */
export function submitForReview(submissionId: string): PluginSubmission {
  const submissions = loadSubmissions();
  const sub = submissions[submissionId];
  if (!sub) throw new Error('Submission not found');
  if (sub.status !== 'draft') throw new Error(`Cannot submit for review from status: ${sub.status}`);

  // Validate required fields
  if (!sub.demoCredentials?.url || !sub.demoCredentials?.username || !sub.demoCredentials?.password) {
    throw new Error('Demo credentials (url, username, password) are required for review');
  }

  sub.status = 'pending_review';
  sub.submittedAt = new Date().toISOString();
  submissions[submissionId] = sub;
  saveSubmissions(submissions);
  return sub;
}

/**
 * Reviewer picks up a submission (pending_review → in_review).
 */
export function startReview(submissionId: string, reviewerId: string): PluginSubmission {
  const submissions = loadSubmissions();
  const sub = submissions[submissionId];
  if (!sub) throw new Error('Submission not found');
  if (sub.status !== 'pending_review') throw new Error(`Cannot start review from status: ${sub.status}`);

  sub.status = 'in_review';
  sub.reviewedBy = reviewerId;
  submissions[submissionId] = sub;
  saveSubmissions(submissions);
  return sub;
}

/**
 * Complete review: approve, reject, or request revision.
 */
export function completeReview(action: ReviewAction, reviewerId: string): PluginSubmission {
  const submissions = loadSubmissions();
  const sub = submissions[action.submissionId];
  if (!sub) throw new Error('Submission not found');
  if (sub.status !== 'in_review') throw new Error(`Cannot review from status: ${sub.status}`);

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
      sub.status = 'draft'; // back to draft for submitter to revise
      sub.revisionCount += 1;
      break;
  }

  submissions[action.submissionId] = sub;
  saveSubmissions(submissions);
  return sub;
}

/**
 * Publish an approved submission (approved → published).
 */
export function publishSubmission(submissionId: string): PluginSubmission {
  const submissions = loadSubmissions();
  const sub = submissions[submissionId];
  if (!sub) throw new Error('Submission not found');
  if (sub.status !== 'approved') throw new Error(`Cannot publish from status: ${sub.status}`);

  sub.status = 'published';
  sub.publishedAt = new Date().toISOString();
  submissions[submissionId] = sub;
  saveSubmissions(submissions);
  return sub;
}

// ── Queries ──────────────────────────────────────────────────────

export function getSubmission(id: string): PluginSubmission | null {
  const submissions = loadSubmissions();
  return submissions[id] ?? null;
}

export function listSubmissions(filters?: {
  status?: PluginReviewStatus;
  submitterId?: string;
  category?: string;
}): PluginSubmission[] {
  const all = Object.values(loadSubmissions());
  return all.filter((sub) => {
    if (filters?.status && sub.status !== filters.status) return false;
    if (filters?.submitterId && sub.submitterId !== filters.submitterId) return false;
    if (filters?.category && sub.category !== filters.category) return false;
    return true;
  }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

/**
 * Count submissions by status (for dashboard badges).
 */
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
