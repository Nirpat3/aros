/**
 * Reputation Manager — Online Review Monitoring & Response
 *
 * Monitors Google and Yelp reviews, categorizes sentiment,
 * drafts responses to negative reviews, and identifies
 * opportunities to solicit reviews from satisfied customers.
 *
 * Response strategy:
 * - 1-2 stars: Immediate apology + resolution offer (draft for owner approval)
 * - 3 stars: Thank + acknowledge feedback + improvement commitment
 * - 4-5 stars: Thank + encourage return visit
 */

import type { ArosSkill, SkillContext, SkillOutput, ReviewRow, Alert, Action } from '../types.js';

interface ReviewAnalysis {
  review: ReviewRow;
  sentiment: 'positive' | 'neutral' | 'negative';
  needsResponse: boolean;
  draftResponse: string | null;
  urgency: 'high' | 'medium' | 'low';
  daysSincePosted: number;
}

interface ReputationData {
  totalReviews: number;
  avgRating: number;
  ratingDistribution: Record<number, number>;
  unrepliedCount: number;
  negativeCount: number;
  positiveCount: number;
  reviewAnalyses: ReviewAnalysis[];
  platformBreakdown: Record<string, { count: number; avgRating: number }>;
  ratingTrend: 'improving' | 'declining' | 'stable' | 'insufficient-data';
}

/** Generate a response draft based on rating and review text */
function draftResponse(review: ReviewRow, storeName: string): string {
  const firstName = review.author.split(' ')[0] ?? 'there';

  if (review.rating <= 2) {
    return `Hi ${firstName}, thank you for taking the time to share your experience at ${storeName}. We're sorry to hear it didn't meet your expectations. We take all feedback seriously and would love the chance to make this right. Please reach out to us directly so we can address your concerns. — ${storeName} Management`;
  }

  if (review.rating === 3) {
    return `Hi ${firstName}, thanks for your feedback about ${storeName}. We appreciate you sharing both the positives and areas where we can improve. We're always working to make your experience better and hope to see you again soon!`;
  }

  // 4-5 stars
  return `Thank you so much, ${firstName}! We're glad you enjoyed your visit to ${storeName}. We look forward to seeing you again soon! 😊`;
}

export class ReputationManagerSkill implements ArosSkill {
  readonly id = 'reputation-manager';
  readonly name = 'Reputation Manager';
  readonly category = 'marketing' as const;
  readonly frequency = 'daily' as const;
  readonly requiredData = ['reviews'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange, store, today } = context;
    const reviews = await connector.getReviews(dateRange);

    const reviewAnalyses: ReviewAnalysis[] = reviews.map((review) => {
      const sentiment: ReviewAnalysis['sentiment'] =
        review.rating >= 4 ? 'positive' : review.rating >= 3 ? 'neutral' : 'negative';

      const needsResponse = !review.replied;
      const daysSincePosted = Math.max(
        0,
        Math.floor(
          (new Date(today).getTime() - new Date(review.date).getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      let urgency: ReviewAnalysis['urgency'] = 'low';
      if (review.rating <= 2 && !review.replied) urgency = 'high';
      else if (!review.replied && daysSincePosted <= 2) urgency = 'medium';

      const draft = needsResponse ? draftResponse(review, store.storeName) : null;

      return {
        review,
        sentiment,
        needsResponse,
        draftResponse: draft,
        urgency,
        daysSincePosted,
      };
    });

    // Rating distribution
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] ?? 0) + 1;
    }

    // Platform breakdown
    const platformMap = new Map<string, { count: number; totalRating: number }>();
    for (const r of reviews) {
      const existing = platformMap.get(r.platform);
      if (existing) {
        existing.count++;
        existing.totalRating += r.rating;
      } else {
        platformMap.set(r.platform, { count: 1, totalRating: r.rating });
      }
    }
    const platformBreakdown: Record<string, { count: number; avgRating: number }> = {};
    for (const [platform, data] of platformMap) {
      platformBreakdown[platform] = {
        count: data.count,
        avgRating: data.count > 0 ? data.totalRating / data.count : 0,
      };
    }

    const totalReviews = reviews.length;
    const avgRating =
      totalReviews > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews : 0;
    const unrepliedCount = reviews.filter((r) => !r.replied).length;
    const negativeCount = reviewAnalyses.filter((a) => a.sentiment === 'negative').length;
    const positiveCount = reviewAnalyses.filter((a) => a.sentiment === 'positive').length;

    // Simple trend: compare first half vs second half of period
    let ratingTrend: ReputationData['ratingTrend'] = 'insufficient-data';
    if (reviews.length >= 4) {
      const sorted = [...reviews].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      const mid = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, mid);
      const secondHalf = sorted.slice(mid);
      const firstAvg = firstHalf.reduce((s, r) => s + r.rating, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, r) => s + r.rating, 0) / secondHalf.length;
      if (secondAvg - firstAvg > 0.3) ratingTrend = 'improving';
      else if (firstAvg - secondAvg > 0.3) ratingTrend = 'declining';
      else ratingTrend = 'stable';
    }

    const data: ReputationData = {
      totalReviews,
      avgRating,
      ratingDistribution,
      unrepliedCount,
      negativeCount,
      positiveCount,
      reviewAnalyses,
      platformBreakdown,
      ratingTrend,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    // Urgent: unreplied negative reviews
    const urgentReviews = reviewAnalyses.filter((a) => a.urgency === 'high' && a.needsResponse);
    for (const ur of urgentReviews.slice(0, 5)) {
      alerts.push({
        severity: 'critical',
        message: `${ur.review.rating}-star review from ${ur.review.author} on ${ur.review.platform} needs response (${ur.daysSincePosted}d old)`,
        code: 'NEGATIVE_REVIEW_UNREPLIED',
        entity: ur.review.review_id,
        value: ur.review.rating,
      });
      actions.push({
        description: `Respond to ${ur.review.author}'s ${ur.review.rating}-star ${ur.review.platform} review`,
        priority: 1,
        automatable: true,
        payload: {
          reviewId: ur.review.review_id,
          platform: ur.review.platform,
          draftResponse: ur.draftResponse,
        },
      });
    }

    if (ratingTrend === 'declining') {
      alerts.push({
        severity: 'warning',
        message: `Review ratings trending DOWN — recent avg lower than earlier period`,
        code: 'RATING_DECLINING',
      });
    }

    if (unrepliedCount > 5) {
      actions.push({
        description: `Respond to ${unrepliedCount} unreplied reviews across platforms`,
        priority: 2,
        automatable: false,
      });
    }

    const summary = `${totalReviews} reviews (avg ${avgRating.toFixed(1)}⭐). ${unrepliedCount} need responses, ${negativeCount} negative. Trend: ${ratingTrend}.`;

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
