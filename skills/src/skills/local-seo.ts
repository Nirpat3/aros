/**
 * Local SEO — Google Business Profile Optimization
 *
 * Monitors and optimizes the store's local search presence:
 * - Google Business Profile completeness
 * - Hours accuracy
 * - Photo freshness
 * - Post frequency
 * - Keyword optimization
 * - Review response rate (feeds from reputation-manager)
 *
 * Generates actionable recommendations to improve local search ranking.
 * Note: Phase 1 uses heuristics and checklists. Future phases will
 * integrate Google Business Profile API for real-time data.
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  ReviewRow,
  Alert,
  Action,
} from '../types.js';

interface SeoCheckItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  impact: 'high' | 'medium' | 'low';
  recommendation: string | null;
}

interface LocalSeoData {
  overallScore: number;
  checks: SeoCheckItem[];
  passCount: number;
  failCount: number;
  warningCount: number;
  reviewMetrics: {
    totalReviews: number;
    avgRating: number;
    responseRate: number;
    recentReviewCount: number;
  };
  recommendations: string[];
}

export class LocalSeoSkill implements ArosSkill {
  readonly id = 'local-seo';
  readonly name = 'Local SEO';
  readonly category = 'marketing' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['reviews'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, store } = context;
    const reviews = await connector.getReviews(dateRange);

    const checks: SeoCheckItem[] = [];

    // Check 1: Google Business Profile configured
    checks.push({
      id: 'gbp-configured',
      label: 'Google Business Profile ID configured',
      status: store.googleBusinessId ? 'pass' : 'fail',
      impact: 'high',
      recommendation: store.googleBusinessId
        ? null
        : 'Add your Google Business Profile ID to store configuration',
    });

    // Check 2: Business hours configured
    const hoursConfigured = Object.keys(store.hours).length >= 5;
    checks.push({
      id: 'hours-complete',
      label: 'Operating hours configured for all days',
      status: hoursConfigured ? 'pass' : Object.keys(store.hours).length > 0 ? 'warning' : 'fail',
      impact: 'high',
      recommendation: hoursConfigured
        ? null
        : `Only ${Object.keys(store.hours).length}/7 days configured — complete all days including holidays`,
    });

    // Check 3: Store address present
    checks.push({
      id: 'address-present',
      label: 'Store address configured',
      status: store.address ? 'pass' : 'fail',
      impact: 'high',
      recommendation: store.address ? null : 'Add store street address for accurate map placement',
    });

    // Check 4: Review volume
    const recentReviewCount = reviews.length;
    checks.push({
      id: 'review-volume',
      label: 'Sufficient recent reviews (10+ in period)',
      status: recentReviewCount >= 10 ? 'pass' : recentReviewCount >= 5 ? 'warning' : 'fail',
      impact: 'high',
      recommendation: recentReviewCount < 10
        ? `Only ${recentReviewCount} reviews in period — actively request reviews from satisfied customers`
        : null,
    });

    // Check 5: Review response rate
    const repliedCount = reviews.filter(r => r.replied).length;
    const responseRate = reviews.length > 0 ? (repliedCount / reviews.length) * 100 : 100;
    checks.push({
      id: 'review-response-rate',
      label: 'Review response rate above 80%',
      status: responseRate >= 80 ? 'pass' : responseRate >= 50 ? 'warning' : 'fail',
      impact: 'medium',
      recommendation: responseRate < 80
        ? `Response rate is ${responseRate.toFixed(0)}% — respond to all reviews, especially negative ones`
        : null,
    });

    // Check 6: Average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;
    checks.push({
      id: 'avg-rating',
      label: 'Average rating 4.0+ stars',
      status: avgRating >= 4.0 ? 'pass' : avgRating >= 3.5 ? 'warning' : 'fail',
      impact: 'high',
      recommendation: avgRating < 4.0
        ? `Average rating is ${avgRating.toFixed(1)} — address negative feedback themes to improve`
        : null,
    });

    // Check 7: Yelp presence
    checks.push({
      id: 'yelp-configured',
      label: 'Yelp Business ID configured',
      status: store.yelpBusinessId ? 'pass' : 'warning',
      impact: 'low',
      recommendation: store.yelpBusinessId
        ? null
        : 'Claim and configure your Yelp business listing for additional visibility',
    });

    // Check 8: Multi-platform reviews
    const platforms = new Set(reviews.map(r => r.platform));
    checks.push({
      id: 'multi-platform',
      label: 'Reviews on multiple platforms',
      status: platforms.size >= 2 ? 'pass' : 'warning',
      impact: 'medium',
      recommendation: platforms.size < 2
        ? 'Diversify review sources — encourage reviews on both Google and Yelp'
        : null,
    });

    // Calculate overall score
    const weights = { high: 3, medium: 2, low: 1 };
    let totalWeight = 0;
    let earnedWeight = 0;
    for (const check of checks) {
      const w = weights[check.impact];
      totalWeight += w;
      if (check.status === 'pass') earnedWeight += w;
      else if (check.status === 'warning') earnedWeight += w * 0.5;
    }
    const overallScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    const passCount = checks.filter(c => c.status === 'pass').length;
    const failCount = checks.filter(c => c.status === 'fail').length;
    const warningCount = checks.filter(c => c.status === 'warning').length;

    const recommendations = checks
      .filter(c => c.recommendation !== null)
      .sort((a, b) => {
        const impactOrder = { high: 0, medium: 1, low: 2 };
        return impactOrder[a.impact] - impactOrder[b.impact];
      })
      .map(c => c.recommendation!);

    const data: LocalSeoData = {
      overallScore,
      checks,
      passCount,
      failCount,
      warningCount,
      reviewMetrics: {
        totalReviews: reviews.length,
        avgRating,
        responseRate,
        recentReviewCount,
      },
      recommendations,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (overallScore < 50) {
      alerts.push({
        severity: 'critical',
        message: `Local SEO score: ${overallScore}/100 — significant visibility issues`,
        code: 'LOW_SEO_SCORE',
        value: overallScore,
        threshold: 50,
      });
    } else if (overallScore < 75) {
      alerts.push({
        severity: 'warning',
        message: `Local SEO score: ${overallScore}/100 — room for improvement`,
        code: 'MODERATE_SEO_SCORE',
        value: overallScore,
        threshold: 75,
      });
    }

    for (const rec of recommendations.slice(0, 5)) {
      actions.push({
        description: rec,
        priority: recommendations.indexOf(rec) < 2 ? 2 : 3,
        automatable: false,
      });
    }

    const summary = `Local SEO score: ${overallScore}/100. ${passCount} passing, ${warningCount} warnings, ${failCount} failing. Avg rating: ${avgRating.toFixed(1)}⭐, response rate: ${responseRate.toFixed(0)}%.`;

    return {
      skillId: this.id,
      timestamp: new Date().toISOString(),
      summary,
      alerts,
      actions,
      data: data as unknown as Record<string, unknown>,
    };
  }
}
