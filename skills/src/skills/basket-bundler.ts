/**
 * Basket Bundler — Market Basket Analysis & Bundle Recommendations
 *
 * Identifies items frequently purchased together using co-occurrence
 * analysis (simplified association rules / Apriori-like logic).
 *
 * Use cases:
 * - Product placement: put chips next to the beer cooler
 * - Bundle pricing: "Combo: coffee + muffin for $4.99"
 * - Cross-sell: cashier prompts "Would you like ice with that?"
 *
 * Metrics per pair:
 * - Support: % of baskets containing both items
 * - Confidence: P(B | A) — if they buy A, how often do they also buy B
 * - Lift: how much more likely vs random (>1 = positive association)
 */

import type {
  ArosSkill,
  SkillContext,
  SkillOutput,
  InvoiceItemRow,
  Alert,
  Action,
} from '../types.js';

interface ItemPair {
  itemA: string;
  itemADesc: string;
  itemB: string;
  itemBDesc: string;
  coOccurrences: number;
  /** % of all baskets containing both */
  support: number;
  /** P(B | A): if they buy A, how often do they buy B */
  confidenceAB: number;
  /** P(A | B): if they buy B, how often do they buy A */
  confidenceBA: number;
  /** Lift: how much more likely than random */
  lift: number;
}

interface CategoryPair {
  categoryA: string;
  categoryB: string;
  coOccurrences: number;
  support: number;
  lift: number;
}

interface BasketBundlerData {
  topItemPairs: ItemPair[];
  topCategoryPairs: CategoryPair[];
  totalBaskets: number;
  avgItemsPerBasket: number;
  bundleRecommendations: Array<{
    items: string[];
    descriptions: string[];
    support: number;
    suggestedBundlePrice: number;
  }>;
}

/** Minimum support threshold (% of baskets) */
const MIN_SUPPORT = 1;
/** Minimum lift for a meaningful association */
const MIN_LIFT = 1.5;

export class BasketBundlerSkill implements ArosSkill {
  readonly id = 'basket-bundler';
  readonly name = 'Basket Bundler';
  readonly category = 'marketing' as const;
  readonly frequency = 'weekly' as const;
  readonly requiredData = ['invoice_items'];

  async execute(context: SkillContext): Promise<SkillOutput> {
    const { connector, dateRange } = context;
    const items = await connector.getInvoiceItems(dateRange);

    // Group items by invoice (basket)
    const baskets = new Map<string, InvoiceItemRow[]>();
    for (const item of items) {
      if (item.is_void) continue;
      const existing = baskets.get(item.invoice_no);
      if (existing) {
        existing.push(item);
      } else {
        baskets.set(item.invoice_no, [item]);
      }
    }

    const totalBaskets = baskets.size;
    if (totalBaskets === 0) {
      return {
        skillId: this.id,
        timestamp: new Date().toISOString(),
        summary: 'No basket data available for analysis.',
        alerts: [],
        actions: [],
        data: {},
      };
    }

    const totalItems = [...baskets.values()].reduce((s, b) => s + b.length, 0);
    const avgItemsPerBasket = totalItems / totalBaskets;

    // Count individual item frequency
    const itemFreq = new Map<
      string,
      { count: number; desc: string; avgPrice: number; totalPrice: number }
    >();
    // Count individual category frequency
    const catFreq = new Map<string, number>();

    for (const [, basketItems] of baskets) {
      const seenItems = new Set<string>();
      const seenCats = new Set<string>();
      for (const item of basketItems) {
        if (!seenItems.has(item.item_code)) {
          seenItems.add(item.item_code);
          const existing = itemFreq.get(item.item_code);
          if (existing) {
            existing.count++;
            existing.totalPrice += item.unit_price;
          } else {
            itemFreq.set(item.item_code, {
              count: 1,
              desc: item.item_desc,
              avgPrice: item.unit_price,
              totalPrice: item.unit_price,
            });
          }
        }
        if (!seenCats.has(item.category)) {
          seenCats.add(item.category);
          catFreq.set(item.category, (catFreq.get(item.category) ?? 0) + 1);
        }
      }
    }

    // Finalize avg prices
    for (const [, data] of itemFreq) {
      data.avgPrice = data.totalPrice / data.count;
    }

    // Item pair co-occurrence (only items that appear in >= 1% of baskets)
    const minCount = Math.max(2, Math.floor(totalBaskets * (MIN_SUPPORT / 100)));
    const frequentItems = [...itemFreq.entries()]
      .filter(([, d]) => d.count >= minCount)
      .map(([code]) => code);

    // Limit to top 100 frequent items to keep O(n²) manageable
    const topItems = frequentItems.slice(0, 100);

    const pairCounts = new Map<string, number>();
    for (const [, basketItems] of baskets) {
      const basketCodes = [...new Set(basketItems.map((i) => i.item_code))]
        .filter((c) => topItems.includes(c))
        .sort();

      for (let i = 0; i < basketCodes.length; i++) {
        for (let j = i + 1; j < basketCodes.length; j++) {
          const key = `${basketCodes[i]}|||${basketCodes[j]}`;
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    // Calculate item pair metrics
    const topItemPairs: ItemPair[] = [];
    for (const [key, count] of pairCounts) {
      const [codeA, codeB] = key.split('|||');
      if (!codeA || !codeB) continue;
      const freqA = itemFreq.get(codeA);
      const freqB = itemFreq.get(codeB);
      if (!freqA || !freqB) continue;

      const support = (count / totalBaskets) * 100;
      const confidenceAB = (count / freqA.count) * 100;
      const confidenceBA = (count / freqB.count) * 100;
      const pA = freqA.count / totalBaskets;
      const pB = freqB.count / totalBaskets;
      const lift = pA * pB > 0 ? count / totalBaskets / (pA * pB) : 0;

      if (support >= MIN_SUPPORT && lift >= MIN_LIFT) {
        topItemPairs.push({
          itemA: codeA,
          itemADesc: freqA.desc,
          itemB: codeB,
          itemBDesc: freqB.desc,
          coOccurrences: count,
          support,
          confidenceAB,
          confidenceBA,
          lift,
        });
      }
    }
    topItemPairs.sort((a, b) => b.lift - a.lift);

    // Category pair co-occurrence
    const catPairCounts = new Map<string, number>();
    for (const [, basketItems] of baskets) {
      const basketCats = [...new Set(basketItems.map((i) => i.category))].sort();
      for (let i = 0; i < basketCats.length; i++) {
        for (let j = i + 1; j < basketCats.length; j++) {
          const key = `${basketCats[i]}|||${basketCats[j]}`;
          catPairCounts.set(key, (catPairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    const topCategoryPairs: CategoryPair[] = [];
    for (const [key, count] of catPairCounts) {
      const [catA, catB] = key.split('|||');
      if (!catA || !catB) continue;
      const fA = catFreq.get(catA) ?? 0;
      const fB = catFreq.get(catB) ?? 0;
      const support = (count / totalBaskets) * 100;
      const pA = fA / totalBaskets;
      const pB = fB / totalBaskets;
      const lift = pA * pB > 0 ? count / totalBaskets / (pA * pB) : 0;

      if (support >= MIN_SUPPORT) {
        topCategoryPairs.push({
          categoryA: catA,
          categoryB: catB,
          coOccurrences: count,
          support,
          lift,
        });
      }
    }
    topCategoryPairs.sort((a, b) => b.lift - a.lift);

    // Bundle recommendations from top pairs
    const bundleRecommendations = topItemPairs.slice(0, 10).map((pair) => {
      const priceA = itemFreq.get(pair.itemA)?.avgPrice ?? 0;
      const priceB = itemFreq.get(pair.itemB)?.avgPrice ?? 0;
      const suggestedBundlePrice = Math.round((priceA + priceB) * 0.9 * 100) / 100; // 10% bundle discount
      return {
        items: [pair.itemA, pair.itemB],
        descriptions: [pair.itemADesc, pair.itemBDesc],
        support: pair.support,
        suggestedBundlePrice,
      };
    });

    const data: BasketBundlerData = {
      topItemPairs: topItemPairs.slice(0, 20),
      topCategoryPairs: topCategoryPairs.slice(0, 10),
      totalBaskets,
      avgItemsPerBasket,
      bundleRecommendations,
    };

    const alerts: Alert[] = [];
    const actions: Action[] = [];

    if (topItemPairs.length > 0) {
      const best = topItemPairs[0]!;
      alerts.push({
        severity: 'info',
        message: `Strongest association: ${best.itemADesc} + ${best.itemBDesc} (lift ${best.lift.toFixed(1)}x, ${best.support.toFixed(1)}% of baskets)`,
        code: 'STRONG_BASKET_ASSOCIATION',
      });
    }

    for (const bundle of bundleRecommendations.slice(0, 3)) {
      actions.push({
        description: `Create bundle: ${bundle.descriptions.join(' + ')} at $${bundle.suggestedBundlePrice.toFixed(2)} (found in ${bundle.support.toFixed(1)}% of baskets)`,
        priority: 3,
        automatable: false,
        payload: bundle,
      });
    }

    if (topCategoryPairs.length > 0) {
      const best = topCategoryPairs[0]!;
      actions.push({
        description: `Place ${best.categoryA} near ${best.categoryB} — bought together in ${best.support.toFixed(0)}% of baskets (${best.lift.toFixed(1)}x lift)`,
        priority: 4,
        automatable: false,
      });
    }

    const summary = `Analyzed ${totalBaskets} baskets (avg ${avgItemsPerBasket.toFixed(1)} items). Found ${topItemPairs.length} significant item pairs and ${topCategoryPairs.length} category pairs. ${bundleRecommendations.length} bundle opportunities.`;

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
