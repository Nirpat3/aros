/**
 * AROS Phase 1 — Core type definitions
 *
 * Every skill implements ArosSkill and returns SkillOutput.
 * Data access goes through DataConnector implementations.
 */

// ─── Store Configuration ────────────────────────────────────────────

/** Store vertical — determines which KPIs, thresholds, and SOPs apply */
export type StoreType = 'cstore' | 'qsr' | 'retail' | 'liquor';

/** Day-of-week shorthand */
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Operating hours for a single day */
export interface OperatingHours {
  open: string;   // HH:mm
  close: string;  // HH:mm
}

/** Store-level metadata used by every skill */
export interface StoreConfig {
  /** Unique store identifier */
  storeId: string;
  /** Human-readable store name */
  storeName: string;
  /** Store vertical */
  type: StoreType;
  /** IANA timezone, e.g. "America/New_York" */
  timezone: string;
  /** Street address */
  address: string;
  /** Currency code, e.g. "USD" */
  currency: string;
  /** Operating hours per day-of-week */
  hours: Partial<Record<DayOfWeek, OperatingHours>>;
  /** Target gross margin % (0-100) */
  targetMarginPct: number;
  /** Target labor cost % of revenue (0-100) */
  targetLaborPct: number;
  /** Acceptable cash variance threshold in currency units */
  cashVarianceThreshold: number;
  /** Google Business Profile ID (for marketing skills) */
  googleBusinessId?: string;
  /** Yelp Business ID (for marketing skills) */
  yelpBusinessId?: string;
}

// ─── Data Connector ─────────────────────────────────────────────────

/** A row from the POS invoices table */
export interface InvoiceRow {
  invoice_no: string;
  invoice_date: string;
  cashier_name: string;
  bill_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_method: string;
  is_void: boolean;
  is_refund: boolean;
  register_id: string;
  shift: string;
  customer_count: number;
}

/** A row from the POS invoice_items table */
export interface InvoiceItemRow {
  invoice_no: string;
  item_code: string;
  item_desc: string;
  item_qty: number;
  unit_price: number;
  cost_price: number;
  total_amount: number;
  category: string;
  department: string;
  is_void: boolean;
  discount_amount: number;
}

/** Inventory snapshot for a single SKU */
export interface InventoryRow {
  item_code: string;
  item_desc: string;
  category: string;
  qty_on_hand: number;
  qty_on_order: number;
  reorder_point: number;
  reorder_qty: number;
  unit_cost: number;
  retail_price: number;
  last_received_date: string;
  last_sold_date: string;
  vendor_id: string;
  lead_time_days: number;
}

/** Vendor pricing entry */
export interface VendorPriceRow {
  vendor_id: string;
  vendor_name: string;
  item_code: string;
  item_desc: string;
  unit_cost: number;
  case_cost: number;
  case_qty: number;
  promo_price: number | null;
  promo_start: string | null;
  promo_end: string | null;
  min_order_qty: number;
}

/** Employee / cashier record */
export interface EmployeeRow {
  employee_id: string;
  employee_name: string;
  role: string;
  hourly_rate: number;
  scheduled_hours: number;
  actual_hours: number;
  shift: string;
}

/** Cash register reading */
export interface RegisterReadingRow {
  register_id: string;
  shift: string;
  cashier_name: string;
  expected_cash: number;
  actual_cash: number;
  card_total: number;
  other_tender_total: number;
  reading_time: string;
}

/** Online review */
export interface ReviewRow {
  platform: 'google' | 'yelp' | 'other';
  review_id: string;
  rating: number;
  text: string;
  author: string;
  date: string;
  replied: boolean;
  reply_text: string | null;
}

/** Checklist template item */
export interface ChecklistItem {
  id: string;
  label: string;
  category: 'opening' | 'closing' | 'both';
  required: boolean;
  notes?: string;
}

/** Checklist completion record */
export interface ChecklistCompletion {
  checklist_item_id: string;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
}

/** Timecard / clock punch record */
export interface TimecardRow {
  employee_id: string;
  employee_name: string;
  clock_in: string;
  clock_out: string | null;
  shift: string;
  break_minutes: number;
  total_hours: number;
  overtime_hours: number;
  status: 'complete' | 'missed-punch' | 'active';
  approved_by: string | null;
}

/** Inventory adjustment (non-sales quantity changes) */
export interface InventoryAdjustmentRow {
  adjustment_id: string;
  item_code: string;
  item_desc: string;
  category: string;
  adjustment_type: 'manual' | 'receiving' | 'count' | 'waste' | 'damage' | 'return' | 'transfer';
  qty_change: number;
  reason_code: string;
  reason_desc: string;
  adjusted_by: string;
  adjusted_at: string;
  unit_cost: number;
  notes: string | null;
}

/** Waste / spoilage log entry */
export interface WasteLogRow {
  waste_id: string;
  item_code: string;
  item_desc: string;
  category: string;
  qty_wasted: number;
  unit_cost: number;
  total_cost: number;
  reason_code: 'expired' | 'damaged' | 'spoiled' | 'overcooked' | 'spill' | 'other';
  reason_desc: string;
  logged_by: string;
  logged_at: string;
  notes: string | null;
}

/** Bank deposit / settlement record */
export interface BankDepositRow {
  deposit_id: string;
  deposit_date: string;
  deposit_type: 'cash' | 'credit' | 'debit' | 'ebt' | 'other';
  expected_amount: number;
  actual_amount: number;
  variance: number;
  reference_no: string;
  status: 'matched' | 'discrepancy' | 'pending';
  notes: string | null;
}

/** Date range for queries */
export interface DateRange {
  start: string; // ISO date string
  end: string;   // ISO date string
}

/**
 * Abstract data connector — all data access goes through this interface.
 * Implementations: RapidRMS (Phase 1), Square, Clover, etc. (future).
 */
export interface DataConnector {
  /** Connector identifier, e.g. "rapidrms" */
  readonly id: string;

  // ── Sales ──
  getInvoices(dateRange: DateRange): Promise<InvoiceRow[]>;
  getInvoiceItems(dateRange: DateRange): Promise<InvoiceItemRow[]>;
  getInvoiceItemsByInvoice(invoiceNos: string[]): Promise<InvoiceItemRow[]>;

  // ── Inventory ──
  getInventory(): Promise<InventoryRow[]>;
  getInventoryByCategory(category: string): Promise<InventoryRow[]>;

  // ── Vendor / Procurement ──
  getVendorPrices(itemCodes?: string[]): Promise<VendorPriceRow[]>;

  // ── Workforce ──
  getEmployees(date: string): Promise<EmployeeRow[]>;
  getRegisterReadings(date: string): Promise<RegisterReadingRow[]>;

  // ── Reviews / Marketing ──
  getReviews(dateRange: DateRange): Promise<ReviewRow[]>;

  // ── Checklists ──
  getChecklistTemplate(): Promise<ChecklistItem[]>;
  getChecklistCompletions(date: string): Promise<ChecklistCompletion[]>;
  saveChecklistCompletion(completion: ChecklistCompletion): Promise<void>;

  // ── Timecards ──
  getTimecards(dateRange: DateRange): Promise<TimecardRow[]>;

  // ── Inventory Adjustments ──
  getInventoryAdjustments(dateRange: DateRange): Promise<InventoryAdjustmentRow[]>;

  // ── Waste ──
  getWasteLogs(dateRange: DateRange): Promise<WasteLogRow[]>;

  // ── Bank ──
  getBankDeposits(dateRange: DateRange): Promise<BankDepositRow[]>;

  // ── Raw SQL (escape hatch for ad-hoc queries) ──
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
}

// ─── Skill Output ───────────────────────────────────────────────────

/** Severity of an alert */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** A single alert produced by a skill */
export interface Alert {
  severity: AlertSeverity;
  message: string;
  /** Machine-readable code for downstream automation */
  code?: string;
  /** Related entity (SKU, employee, register, etc.) */
  entity?: string;
  /** Numeric value that triggered the alert */
  value?: number;
  /** Threshold that was exceeded */
  threshold?: number;
}

/** A recommended action */
export interface Action {
  /** What to do */
  description: string;
  /** Priority: 1 = do now, 5 = nice to have */
  priority: 1 | 2 | 3 | 4 | 5;
  /** Can this be auto-executed? */
  automatable: boolean;
  /** Payload for automation (e.g., PO draft, reply text) */
  payload?: Record<string, unknown>;
}

/** Structured output every skill returns */
export interface SkillOutput {
  /** Skill that produced this output */
  skillId: string;
  /** When the skill ran */
  timestamp: string;
  /** Human-readable summary (1-3 sentences) */
  summary: string;
  /** Alerts requiring attention */
  alerts: Alert[];
  /** Recommended actions */
  actions: Action[];
  /** Arbitrary structured data for rendering */
  data: Record<string, unknown>;
}

// ─── Skill Interface ────────────────────────────────────────────────

/** Skill category for grouping */
export type SkillCategory =
  | 'owner-intelligence'
  | 'sales-revenue'
  | 'inventory'
  | 'cash-financial'
  | 'workforce'
  | 'loss-prevention'
  | 'procurement'
  | 'marketing';

/** How often the skill should run */
export type SkillFrequency =
  | 'realtime'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'on-demand';

/** Runtime context passed to every skill */
export interface SkillContext {
  store: StoreConfig;
  dateRange: DateRange;
  connector: DataConnector;
  /** Current date in store timezone (ISO string) */
  today: string;
  /** Optional: other skills for composition */
  skills?: SkillRegistry;
}

/** The contract every AROS skill implements */
export interface ArosSkill {
  /** Unique skill identifier, e.g. "morning-briefing" */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Category for grouping */
  readonly category: SkillCategory;
  /** Suggested run frequency */
  readonly frequency: SkillFrequency;
  /** Data sources this skill requires */
  readonly requiredData: string[];
  /** Run the skill and return structured output */
  execute(context: SkillContext): Promise<SkillOutput>;
}

/** Registry of all available skills, keyed by id */
export type SkillRegistry = Map<string, ArosSkill>;
