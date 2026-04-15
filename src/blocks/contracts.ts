/**
 * AROS Agent Block Contracts — declares what each agent owns, reads, and emits.
 *
 * This is the single source of truth for AROS state boundaries.
 * The BlockRegistry rejects overlapping ownership at registration time.
 * The StateMutationAuditor enforces ownership at runtime.
 *
 * State key naming convention:
 *   {domain}.{entity}     — e.g. "inventory.velocity", "pnl.daily_snapshot"
 *   {domain}.{entity}.{sub} — e.g. "fraud.void_baseline.cashier"
 *
 * Agents:
 *   ana    — Inventory Intelligence (reorder, velocity, shrinkage, dead stock)
 *   sammy  — Revenue & P&L Intelligence (margins, anomalies, cash flow)
 *   victor — Revenue Integrity / Fraud Detection (voids, comps, no-sale patterns)
 *   larry  — Labor & Scheduling Intelligence (costs, overtime, coverage)
 *   rita   — Reputation & Reviews Intelligence (sentiment, responses, themes)
 *   aros   — Orchestrator (config, activation, routing)
 */
// AgentBlockContract type from shre-sdk/contracts
export interface AgentBlockContract {
  blockId: string;
  version: string;
  owns: string[];
  reads: string[];
  emits: string[];
  maxTtlS: number;
  idempotent: boolean;
  rollback?: () => Promise<void>;
  tenantScope: 'single' | 'cross';
  priority: number;
  maxRetries: number;
}

// ── Ana 📦 — Inventory Intelligence ────────────────────────────────────────

export const ANA_CONTRACT: AgentBlockContract = {
  blockId: 'ana_inventory',
  version: '1.0.0',
  owns: [
    'inventory.velocity', // SKU-level velocity models (units/day, by hour/DOW)
    'inventory.velocity_baseline', // Rolling baseline for anomaly detection
    'inventory.reorder_drafts', // Generated reorder recommendations
    'inventory.dead_stock_flags', // Slow-moving / obsolete item flags
    'inventory.shrinkage_flags', // Inventory count anomalies (expected vs actual)
    'inventory.seasonal_factors', // Seasonal multipliers per category
    'inventory.supplier_scores', // Supplier reliability scores (lead time, fill rate)
    'inventory.stockout_predictions', // Predicted stockout dates per SKU
  ],
  reads: [
    // Own state
    'inventory.velocity',
    'inventory.velocity_baseline',
    'inventory.reorder_drafts',
    'inventory.dead_stock_flags',
    'inventory.shrinkage_flags',
    'inventory.seasonal_factors',
    'inventory.supplier_scores',
    'inventory.stockout_predictions',
    // Cross-reads (owned by others or external)
    'pos.item_scans', // Real-time scans from MobilePOS/Connexus
    'pos.transactions', // Completed sales for velocity calc
    'store.config', // Store settings (owned by aros)
    'pnl.cogs', // Cost data from Sammy for margin-aware reorder
  ],
  emits: [
    'ReorderDraftCreated',
    'StockoutAlert',
    'DeadStockFlagged',
    'ShrinkageDetected',
    'VelocityBaselineUpdated',
  ],
  maxTtlS: 60,
  idempotent: true,
  tenantScope: 'single',
  priority: 7,
  maxRetries: 2,
};

// ── Sammy 📈 — Revenue & P&L Intelligence ──────────────────────────────────

export const SAMMY_CONTRACT: AgentBlockContract = {
  blockId: 'sammy_revenue',
  version: '1.0.0',
  owns: [
    'pnl.daily_snapshot', // Daily P&L snapshots (revenue, COGS, labor, margin)
    'pnl.cogs', // Item-level cost × quantity calculations
    'pnl.margin_trends', // Rolling margin trend (7d, 30d, 90d)
    'pnl.revenue_anomalies', // Unusual revenue spikes/dips
    'pnl.channel_split', // Revenue by channel (in-store, delivery, pickup)
    'pnl.avg_ticket_trends', // Average ticket size tracking
  ],
  reads: [
    // Own state
    'pnl.daily_snapshot',
    'pnl.cogs',
    'pnl.margin_trends',
    'pnl.revenue_anomalies',
    'pnl.channel_split',
    'pnl.avg_ticket_trends',
    // Cross-reads
    'pos.transactions', // Sales data for revenue calc
    'pos.item_scans', // Item-level data for COGS
    'labor.cost_pct', // Labor cost from Larry for P&L
    'store.config', // Store settings
  ],
  emits: ['DailyPnlGenerated', 'MarginAlert', 'RevenueAnomaly', 'ChannelSplitUpdated'],
  maxTtlS: 45,
  idempotent: true,
  tenantScope: 'single',
  priority: 6,
  maxRetries: 2,
};

// ── Victor 🔎 — Revenue Integrity / Fraud Detection ───────────────────────

export const VICTOR_CONTRACT: AgentBlockContract = {
  blockId: 'victor_integrity',
  version: '1.0.0',
  owns: [
    'fraud.void_baseline', // Per-cashier void rate baselines
    'fraud.comp_baseline', // Per-manager comp rate baselines
    'fraud.nosale_baseline', // No-sale/drawer-open frequency baselines
    'fraud.suspicion_flags', // Active fraud suspicion records (confidential)
    'fraud.pattern_clusters', // Clustered anomaly patterns (time/cashier/item combos)
    'fraud.false_positive_tags', // Resolved false positives (learning feedback)
    'fraud.refund_patterns', // Refund frequency and amount patterns
    'fraud.price_override_log', // Unauthorized price override tracking
  ],
  reads: [
    // Own state
    'fraud.void_baseline',
    'fraud.comp_baseline',
    'fraud.nosale_baseline',
    'fraud.suspicion_flags',
    'fraud.pattern_clusters',
    'fraud.false_positive_tags',
    'fraud.refund_patterns',
    'fraud.price_override_log',
    // Cross-reads
    'pos.events', // Voids, returns, no-sale, price overrides from POS
    'pos.transactions', // Transaction context for pattern matching
    'pos.item_scans', // Item-level detail for sweep detection
    'labor.shift_schedule', // Who was on shift when (from Larry)
    'store.config', // Store settings
  ],
  emits: [
    'FraudSuspicion',
    'VoidAnomalyDetected',
    'SweepPatternDetected',
    'NoSaleAlert',
    'PriceOverrideAlert',
    'BaselineRecalculated',
  ],
  maxTtlS: 30,
  idempotent: true,
  tenantScope: 'single',
  priority: 9, // Highest — fraud detection is time-critical
  maxRetries: 1, // Don't retry fraud checks (stale data = wrong conclusions)
};

// ── Larry 👷 — Labor & Scheduling Intelligence ────────────────────────────

export const LARRY_CONTRACT: AgentBlockContract = {
  blockId: 'larry_labor',
  version: '1.0.0',
  owns: [
    'labor.cost_pct', // Labor cost as % of revenue (rolling)
    'labor.overtime_alerts', // Active overtime risk flags
    'labor.shift_schedule', // Current/upcoming shift schedule
    'labor.productivity_baselines', // Per-role productivity (covers/hour, sales/hour)
    'labor.coverage_gaps', // Predicted understaffing windows
    'labor.callout_patterns', // Historical call-out frequency by employee/day
  ],
  reads: [
    // Own state
    'labor.cost_pct',
    'labor.overtime_alerts',
    'labor.shift_schedule',
    'labor.productivity_baselines',
    'labor.coverage_gaps',
    'labor.callout_patterns',
    // Cross-reads
    'pos.transactions', // Sales volume for productivity calc
    'pnl.daily_snapshot', // Revenue for labor-cost-% calc
    'store.config', // Store hours, min coverage rules
  ],
  emits: [
    'OvertimeRisk',
    'CoverageGap',
    'ProductivityDrop',
    'LaborCostAlert',
    'ShiftScheduleUpdated',
  ],
  maxTtlS: 45,
  idempotent: true,
  tenantScope: 'single',
  priority: 5,
  maxRetries: 2,
};

// ── Rita ⭐ — Reputation & Reviews Intelligence ───────────────────────────

export const RITA_CONTRACT: AgentBlockContract = {
  blockId: 'rita_reputation',
  version: '1.0.0',
  owns: [
    'reputation.sentiment_trends', // Aggregated sentiment scores (7d, 30d rolling)
    'reputation.recurring_themes', // Themes mentioned ≥3 times (food quality, service, etc.)
    'reputation.response_drafts', // Drafted review responses pending operator approval
    'reputation.platform_ratings', // Per-platform star ratings (Google, Yelp, etc.)
    'reputation.voice_model', // Operator's writing style model for responses
    'reputation.review_velocity', // Review arrival rate tracking
  ],
  reads: [
    // Own state
    'reputation.sentiment_trends',
    'reputation.recurring_themes',
    'reputation.response_drafts',
    'reputation.platform_ratings',
    'reputation.voice_model',
    'reputation.review_velocity',
    // Cross-reads
    'store.config', // Store name, location for response context
    'pnl.daily_snapshot', // Revenue context for sentiment-revenue correlation
  ],
  emits: ['ReviewSpike', 'SentimentDrop', 'ResponseDrafted', 'ThemeEmerged', 'VoiceModelUpdated'],
  maxTtlS: 60,
  idempotent: true,
  tenantScope: 'single',
  priority: 4, // Lowest — reviews are important but not time-critical
  maxRetries: 2,
};

// ── AROS Orchestrator 🤖 — Platform Configuration ─────────────────────────

export const AROS_CONTRACT: AgentBlockContract = {
  blockId: 'aros_orchestrator',
  version: '1.0.0',
  owns: [
    'store.config', // Store-level AROS configuration (mode, thresholds)
    'store.agent_activation', // Which agents are active per store
    'store.tier_access', // License tier → feature access mapping
    'store.routing_rules', // Custom routing overrides
  ],
  reads: [
    // Own state
    'store.config',
    'store.agent_activation',
    'store.tier_access',
    'store.routing_rules',
    // Cross-reads (reads everything for orchestration decisions)
    'inventory.reorder_drafts',
    'inventory.shrinkage_flags',
    'inventory.dead_stock_flags',
    'pnl.daily_snapshot',
    'pnl.revenue_anomalies',
    'fraud.suspicion_flags',
    'labor.overtime_alerts',
    'labor.coverage_gaps',
    'reputation.response_drafts',
    'reputation.sentiment_trends',
    'pos.transactions',
    'pos.item_scans',
    'pos.events',
  ],
  emits: [
    'AgentActivated',
    'AgentDeactivated',
    'ConfigUpdated',
    'WaveExecutionStarted',
    'WaveExecutionCompleted',
  ],
  maxTtlS: 15,
  idempotent: true,
  tenantScope: 'single',
  priority: 10, // Orchestrator runs first
  maxRetries: 1,
};

// ── All contracts (ordered by priority) ────────────────────────────────────

export const ALL_CONTRACTS: AgentBlockContract[] = [
  AROS_CONTRACT, // P10 — orchestrator
  VICTOR_CONTRACT, // P9  — fraud (time-critical)
  ANA_CONTRACT, // P7  — inventory
  SAMMY_CONTRACT, // P6  — revenue
  LARRY_CONTRACT, // P5  — labor
  RITA_CONTRACT, // P4  — reputation
];

/** Map from agentId to contract for quick lookup */
export const AGENT_CONTRACT_MAP: Record<string, AgentBlockContract> = {
  aros: AROS_CONTRACT,
  'aros-agent': AROS_CONTRACT,
  ana: ANA_CONTRACT,
  sammy: SAMMY_CONTRACT,
  victor: VICTOR_CONTRACT,
  larry: LARRY_CONTRACT,
  rita: RITA_CONTRACT,
};
