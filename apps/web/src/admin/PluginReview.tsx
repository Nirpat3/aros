import { useState, useEffect, type FormEvent } from 'react';
import { listSubmissions, reviewSubmission, publishSubmission } from './admin-api';

// ── Types (mirrors marketplace/types.ts for browser) ─────────────

type PluginReviewStatus = 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'published';

interface PluginSubmission {
  id: string;
  nodeId: string;
  submitterId: string;
  submitterEmail: string;
  name: string;
  version: string;
  description: string;
  category: string;
  changelog?: string;
  packageName: string;
  sourceUrl?: string;
  screenshots?: string[];
  demoCredentials: {
    url: string;
    username: string;
    password: string;
    instructions?: string;
    environment: string;
  };
  status: PluginReviewStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  publishedAt?: string;
  revisionCount: number;
}

// ── Status badge colors ──────────────────────────────────────────

const STATUS_COLORS: Record<PluginReviewStatus, { bg: string; text: string }> = {
  draft:          { bg: '#374151', text: '#9CA3AF' },
  pending_review: { bg: '#92400E', text: '#FCD34D' },
  in_review:      { bg: '#1E40AF', text: '#93C5FD' },
  approved:       { bg: '#065F46', text: '#6EE7B7' },
  rejected:       { bg: '#991B1B', text: '#FCA5A5' },
  published:      { bg: '#064E3B', text: '#34D399' },
};

const STATUS_LABELS: Record<PluginReviewStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

const TABS: PluginReviewStatus[] = ['pending_review', 'in_review', 'approved', 'rejected', 'published'];

// ── Component ────────────────────────────────────────────────────

export function PluginReview() {
  const [submissions, setSubmissions] = useState<PluginSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<PluginReviewStatus>('pending_review');
  const [selected, setSelected] = useState<PluginSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setSubmissions(listSubmissions({ status: activeTab }) as PluginSubmission[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [activeTab]);

  const handleAction = (action: 'approve' | 'reject' | 'request_revision') => {
    if (!selected) return;
    try {
      reviewSubmission({
        submissionId: selected.id,
        action,
        notes: reviewNotes,
        rejectionReason: action === 'reject' ? reviewNotes : undefined,
      }, 'superadmin');
      setSelected(null);
      setReviewNotes('');
      refresh();
    } catch { /* ignore */ }
  };

  const handlePublish = (id: string) => {
    try {
      publishSubmission(id);
      refresh();
    } catch { /* ignore */ }
  };

  const font = '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif';

  return (
    <div style={{ padding: 32, fontFamily: font, color: '#ececf1', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>Plugin Review</h1>
      <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 24 }}>
        Review and approve plugin submissions before they go live in the marketplace.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelected(null); }}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: font,
              background: activeTab === tab ? 'rgba(99,141,255,0.14)' : 'transparent',
              color: activeTab === tab ? '#638dff' : '#a1a1aa',
              transition: 'all 150ms',
            }}
          >
            {STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* List */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: '#6b6b76', fontSize: 13, padding: 24 }}>Loading...</div>
          ) : submissions.length === 0 ? (
            <div style={{ color: '#6b6b76', fontSize: 13, padding: 24, textAlign: 'center' }}>
              No submissions in this category.
            </div>
          ) : (
            submissions.map((sub) => {
              const sc = STATUS_COLORS[sub.status];
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelected(sub)}
                  style={{
                    padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    background: selected?.id === sub.id ? 'rgba(99,141,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected?.id === sub.id ? 'rgba(99,141,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    marginBottom: 8, transition: 'all 150ms',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{sub.name}</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 2 }}>
                        v{sub.version} &middot; {sub.category} &middot; by {sub.submitterEmail}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.text,
                    }}>
                      {STATUS_LABELS[sub.status]}
                    </span>
                  </div>
                  {sub.revisionCount > 0 && (
                    <div style={{ fontSize: 11, color: '#6b6b76', marginTop: 4 }}>
                      Revision #{sub.revisionCount}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width: 380, flexShrink: 0, padding: 20, borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selected.name}</h2>
            <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 16 }}>
              v{selected.version} &middot; {selected.packageName}
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16, color: '#d1d1d6' }}>
              {selected.description}
            </div>

            {selected.changelog && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b6b76', textTransform: 'uppercase', marginBottom: 4 }}>Changelog</div>
                <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.4 }}>{selected.changelog}</div>
              </div>
            )}

            {/* Demo credentials */}
            <div style={{
              padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#638dff', textTransform: 'uppercase', marginBottom: 8 }}>
                Demo Credentials
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <div><span style={{ color: '#6b6b76' }}>URL:</span> <a href={selected.demoCredentials.url} target="_blank" rel="noopener noreferrer" style={{ color: '#638dff' }}>{selected.demoCredentials.url}</a></div>
                <div><span style={{ color: '#6b6b76' }}>User:</span> {selected.demoCredentials.username}</div>
                <div><span style={{ color: '#6b6b76' }}>Pass:</span> {selected.demoCredentials.password}</div>
                <div><span style={{ color: '#6b6b76' }}>Env:</span> {selected.demoCredentials.environment}</div>
                {selected.demoCredentials.instructions && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#a1a1aa', fontStyle: 'italic' }}>
                    {selected.demoCredentials.instructions}
                  </div>
                )}
              </div>
            </div>

            {/* Review actions */}
            {(selected.status === 'pending_review' || selected.status === 'in_review') && (
              <div>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Review notes..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ececf1', fontFamily: font, resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => handleAction('approve')}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#065F46', color: '#6EE7B7', fontSize: 13, fontWeight: 600, fontFamily: font,
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction('request_revision')}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#92400E', color: '#FCD34D', fontSize: 13, fontWeight: 600, fontFamily: font,
                    }}
                  >
                    Revise
                  </button>
                  <button
                    onClick={() => handleAction('reject')}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: '#991B1B', color: '#FCA5A5', fontSize: 13, fontWeight: 600, fontFamily: font,
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Publish button for approved */}
            {selected.status === 'approved' && (
              <button
                onClick={() => handlePublish(selected.id)}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: '#638dff', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: font,
                }}
              >
                Publish to Marketplace
              </button>
            )}

            {/* Previous review info */}
            {selected.reviewNotes && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: 11, color: '#6b6b76', marginBottom: 4 }}>Previous Review</div>
                <div style={{ fontSize: 13, color: '#a1a1aa' }}>{selected.reviewNotes}</div>
                {selected.rejectionReason && (
                  <div style={{ fontSize: 12, color: '#FCA5A5', marginTop: 4 }}>Reason: {selected.rejectionReason}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
