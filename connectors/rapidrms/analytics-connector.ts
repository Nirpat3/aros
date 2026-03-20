// ── RapidRMS Analytics Connector ──────────────────────────────────
// Queries CortexDB materialized views in `rapidrms_analytics` schema.
// Wires AROS skills to the pre-computed analytics data lake.
//
// Materialized views (24):
//   Sales:     daily_sales, weekly_sales, monthly_sales
//   Items:     item_performance, item_ranking, item_sales_history, item_lifecycle, item_profile
//   Inventory: inventory_health, department_performance, price_margin, abc_xyz_classification
//   Food:      food_beverage_catalog, perishable_risk, drink_inventory
//   Cost:      vendor_cost_analysis
//   Staff:     cashier_performance
//   Payments:  payment_profile, card_activity_log, rfm_segmentation
//   Customer:  customer_profile, customer_activity, customer_segmentation
//   Discount:  discount_analysis
//
// Raw tables in `rapidrms` schema (fallback):
//   invoice_report, invoice_line_item, item, department, vendor, shift_report, store

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createDecipheriv } from 'node:crypto';
import type {
  DataConnector,
  DateRange,
  InvoiceRow,
  InvoiceItemRow,
  InventoryRow,
  VendorPriceRow,
  EmployeeRow,
  RegisterReadingRow,
  ReviewRow,
  ChecklistItem,
  ChecklistCompletion,
  TimecardRow,
  InventoryAdjustmentRow,
  WasteLogRow,
  BankDepositRow,
} from '../../skills/src/types.js';

const { Pool } = pg;

// ── Vault credential loader ─────────────────────────────────────

interface CortexCreds {
  host: string;
  port: number;
  user: string;
  password: string;
  db: string;
}

/** Read and decrypt a vault file. Handles ENC: prefix transparently. */
function readVaultFile(filename: string): string {
  const vaultDir = join(homedir(), '.shre', 'vault');
  const content = readFileSync(join(vaultDir, filename), 'utf-8').trim();
  if (!content.startsWith('ENC:')) return content;
  const [, algo, iv, ...dataParts] = content.split(':');
  const data = dataParts.join(':');
  const keyFile = join(homedir(), '.shre', '.vault-key');
  const encKey = readFileSync(keyFile, 'utf-8').trim().split(':')[1];
  const decipher = createDecipheriv(algo!, Buffer.from(encKey!, 'hex'), Buffer.from(iv!, 'hex'));
  return decipher.update(data, 'base64', 'utf-8') + decipher.final('utf-8');
}

function loadCortexCreds(): CortexCreds {
  return JSON.parse(readVaultFile('cortexdb.json')) as CortexCreds;
}

// ── Schema constants ────────────────────────────────────────────

const ANALYTICS = 'rapidrms_analytics';
const RAW = 'rapidrms';

// ── Analytics Connector ─────────────────────────────────────────

export class AnalyticsConnector implements DataConnector {
  readonly id = 'rapidrms-analytics';
  private pool: pg.Pool;
  private storeId: string | undefined;

  constructor(pool: pg.Pool, storeId?: string) {
    this.pool = pool;
    this.storeId = storeId;
  }

  /** Optional store filter clause for multi-store deployments */
  private storeFilter(alias?: string): string {
    if (!this.storeId) return '';
    const col = alias ? `${alias}.store_id` : 'store_id';
    return `AND ${col} = '${this.storeId}'`;
  }

  // ── Sales ───────────────────────────────────────────────────────

  async getInvoices(dateRange: DateRange): Promise<InvoiceRow[]> {
    // daily_sales view provides aggregate data; for row-level invoices we
    // query the raw invoice_report table in the rapidrms schema.
    const { rows } = await this.pool.query<InvoiceRow>(
      `SELECT
        ir.invoice_no::text                         AS invoice_no,
        ir.invoice_date::text                       AS invoice_date,
        COALESCE(ir.cashier_name, 'Unknown')        AS cashier_name,
        COALESCE(ir.bill_amount, 0)::numeric        AS bill_amount,
        COALESCE(ir.tax_amount, 0)::numeric         AS tax_amount,
        COALESCE(ir.discount_amount, 0)::numeric    AS discount_amount,
        COALESCE(ir.payment_method, 'cash')         AS payment_method,
        COALESCE(ir.is_void, false)                 AS is_void,
        COALESCE(ir.is_refund, false)               AS is_refund,
        COALESCE(ir.register_id::text, '1')         AS register_id,
        COALESCE(ir.shift, 'day')                   AS shift,
        COALESCE(ir.customer_count, 1)::int         AS customer_count
      FROM ${RAW}.invoice_report ir
      WHERE ir.invoice_date >= $1
        AND ir.invoice_date < $2
        ${this.storeFilter('ir')}
      ORDER BY ir.invoice_date`,
      [dateRange.start, dateRange.end],
    );
    return rows;
  }

  async getInvoiceItems(dateRange: DateRange): Promise<InvoiceItemRow[]> {
    const { rows } = await this.pool.query<InvoiceItemRow>(
      `SELECT
        li.invoice_no::text                          AS invoice_no,
        li.item_code                                 AS item_code,
        COALESCE(li.item_desc, '')                   AS item_desc,
        COALESCE(li.item_qty, 0)::numeric            AS item_qty,
        COALESCE(li.unit_price, 0)::numeric          AS unit_price,
        COALESCE(li.cost_price, 0)::numeric          AS cost_price,
        COALESCE(li.total_amount, 0)::numeric        AS total_amount,
        COALESCE(li.category, 'Uncategorized')       AS category,
        COALESCE(li.department, 'General')            AS department,
        COALESCE(li.is_void, false)                  AS is_void,
        COALESCE(li.discount_amount, 0)::numeric     AS discount_amount
      FROM ${RAW}.invoice_line_item li
      JOIN ${RAW}.invoice_report ir ON li.invoice_no = ir.invoice_no
      WHERE ir.invoice_date >= $1
        AND ir.invoice_date < $2
        ${this.storeFilter('ir')}
      ORDER BY li.invoice_no`,
      [dateRange.start, dateRange.end],
    );
    return rows;
  }

  async getInvoiceItemsByInvoice(invoiceNos: string[]): Promise<InvoiceItemRow[]> {
    if (invoiceNos.length === 0) return [];
    // Build parameterized IN clause: $1, $2, $3...
    const placeholders = invoiceNos.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await this.pool.query<InvoiceItemRow>(
      `SELECT
        li.invoice_no::text                          AS invoice_no,
        li.item_code                                 AS item_code,
        COALESCE(li.item_desc, '')                   AS item_desc,
        COALESCE(li.item_qty, 0)::numeric            AS item_qty,
        COALESCE(li.unit_price, 0)::numeric          AS unit_price,
        COALESCE(li.cost_price, 0)::numeric          AS cost_price,
        COALESCE(li.total_amount, 0)::numeric        AS total_amount,
        COALESCE(li.category, 'Uncategorized')       AS category,
        COALESCE(li.department, 'General')            AS department,
        COALESCE(li.is_void, false)                  AS is_void,
        COALESCE(li.discount_amount, 0)::numeric     AS discount_amount
      FROM ${RAW}.invoice_line_item li
      WHERE li.invoice_no::text IN (${placeholders})
      ORDER BY li.invoice_no`,
      invoiceNos,
    );
    return rows;
  }

  // ── Inventory ─────────────────────────────────────────────────

  async getInventory(): Promise<InventoryRow[]> {
    // Combines inventory_health (analytics) with raw item table for full InventoryRow shape
    const { rows } = await this.pool.query<InventoryRow>(
      `SELECT
        i.item_code                                   AS item_code,
        COALESCE(i.item_desc, i.item_code)            AS item_desc,
        COALESCE(i.category, 'Uncategorized')         AS category,
        COALESCE(ih.qty_on_hand, 0)::numeric          AS qty_on_hand,
        COALESCE(i.qty_on_order, 0)::numeric          AS qty_on_order,
        COALESCE(i.reorder_point, 0)::numeric         AS reorder_point,
        COALESCE(i.reorder_qty, 0)::numeric           AS reorder_qty,
        COALESCE(i.unit_cost, 0)::numeric             AS unit_cost,
        COALESCE(i.retail_price, 0)::numeric          AS retail_price,
        COALESCE(i.last_received_date::text, '')      AS last_received_date,
        COALESCE(ih.last_sold_date::text, '')          AS last_sold_date,
        COALESCE(i.vendor_id, '')                     AS vendor_id,
        COALESCE(i.lead_time_days, 3)::int            AS lead_time_days
      FROM ${RAW}.item i
      LEFT JOIN ${ANALYTICS}.inventory_health ih ON i.item_code = ih.item_code
      ${this.storeId ? `WHERE i.store_id = '${this.storeId}'` : ''}
      ORDER BY i.item_desc`,
    );
    return rows;
  }

  async getInventoryByCategory(category: string): Promise<InventoryRow[]> {
    const { rows } = await this.pool.query<InventoryRow>(
      `SELECT
        i.item_code                                   AS item_code,
        COALESCE(i.item_desc, i.item_code)            AS item_desc,
        COALESCE(i.category, 'Uncategorized')         AS category,
        COALESCE(ih.qty_on_hand, 0)::numeric          AS qty_on_hand,
        COALESCE(i.qty_on_order, 0)::numeric          AS qty_on_order,
        COALESCE(i.reorder_point, 0)::numeric         AS reorder_point,
        COALESCE(i.reorder_qty, 0)::numeric           AS reorder_qty,
        COALESCE(i.unit_cost, 0)::numeric             AS unit_cost,
        COALESCE(i.retail_price, 0)::numeric          AS retail_price,
        COALESCE(i.last_received_date::text, '')      AS last_received_date,
        COALESCE(ih.last_sold_date::text, '')          AS last_sold_date,
        COALESCE(i.vendor_id, '')                     AS vendor_id,
        COALESCE(i.lead_time_days, 3)::int            AS lead_time_days
      FROM ${RAW}.item i
      LEFT JOIN ${ANALYTICS}.inventory_health ih ON i.item_code = ih.item_code
      WHERE i.category = $1
        ${this.storeFilter('i')}
      ORDER BY i.item_desc`,
      [category],
    );
    return rows;
  }

  // ── Vendor / Procurement ──────────────────────────────────────

  async getVendorPrices(itemCodes?: string[]): Promise<VendorPriceRow[]> {
    // vendor_cost_analysis view has cost trend data; raw vendor table for pricing
    let whereClause = '';
    const params: string[] = [];

    if (itemCodes && itemCodes.length > 0) {
      const placeholders = itemCodes.map((_, i) => `$${i + 1}`).join(', ');
      whereClause = `WHERE vca.item_code IN (${placeholders})`;
      params.push(...itemCodes);
    }

    const { rows } = await this.pool.query<VendorPriceRow>(
      `SELECT
        COALESCE(vca.vendor_id, '')                   AS vendor_id,
        COALESCE(v.vendor_name, vca.vendor_id, '')    AS vendor_name,
        vca.item_code                                 AS item_code,
        COALESCE(vca.item_desc, '')                   AS item_desc,
        COALESCE(vca.unit_cost, 0)::numeric           AS unit_cost,
        COALESCE(vca.case_cost, 0)::numeric           AS case_cost,
        COALESCE(vca.case_qty, 1)::int                AS case_qty,
        vca.promo_price::numeric                      AS promo_price,
        vca.promo_start::text                         AS promo_start,
        vca.promo_end::text                           AS promo_end,
        COALESCE(vca.min_order_qty, 1)::int           AS min_order_qty
      FROM ${ANALYTICS}.vendor_cost_analysis vca
      LEFT JOIN ${RAW}.vendor v ON vca.vendor_id = v.vendor_id
      ${whereClause}
      ORDER BY vca.item_code, vca.unit_cost`,
      params,
    );
    return rows;
  }

  // ── Workforce ─────────────────────────────────────────────────

  async getEmployees(date: string): Promise<EmployeeRow[]> {
    // cashier_performance view has per-cashier metrics; map to EmployeeRow
    const { rows } = await this.pool.query<EmployeeRow>(
      `SELECT
        COALESCE(cp.cashier_id::text, cp.cashier_name) AS employee_id,
        cp.cashier_name                                AS employee_name,
        COALESCE(cp.role, 'cashier')                   AS role,
        COALESCE(cp.hourly_rate, 0)::numeric           AS hourly_rate,
        COALESCE(cp.scheduled_hours, 0)::numeric       AS scheduled_hours,
        COALESCE(cp.actual_hours, 0)::numeric          AS actual_hours,
        COALESCE(cp.shift, 'day')                      AS shift
      FROM ${ANALYTICS}.cashier_performance cp
      WHERE cp.work_date = $1::date
        ${this.storeFilter('cp')}
      ORDER BY cp.cashier_name`,
      [date],
    );
    return rows;
  }

  async getRegisterReadings(date: string): Promise<RegisterReadingRow[]> {
    // No analytics view for register readings; query raw shift_report
    const { rows } = await this.pool.query<RegisterReadingRow>(
      `SELECT
        COALESCE(sr.register_id::text, '1')            AS register_id,
        COALESCE(sr.shift, 'day')                      AS shift,
        COALESCE(sr.cashier_name, 'Unknown')           AS cashier_name,
        COALESCE(sr.expected_cash, 0)::numeric         AS expected_cash,
        COALESCE(sr.actual_cash, 0)::numeric           AS actual_cash,
        COALESCE(sr.card_total, 0)::numeric            AS card_total,
        COALESCE(sr.other_tender_total, 0)::numeric    AS other_tender_total,
        sr.reading_time::text                          AS reading_time
      FROM ${RAW}.shift_report sr
      WHERE sr.reading_time::date = $1::date
        ${this.storeFilter('sr')}
      ORDER BY sr.reading_time`,
      [date],
    );
    return rows;
  }

  // ── Reviews / Marketing ───────────────────────────────────────

  async getReviews(dateRange: DateRange): Promise<ReviewRow[]> {
    // No analytics view for reviews; query raw table if it exists.
    // Reviews are typically stored externally — return empty for now.
    try {
      const { rows } = await this.pool.query<ReviewRow>(
        `SELECT
          COALESCE(platform, 'other')     AS platform,
          review_id::text                 AS review_id,
          COALESCE(rating, 0)::int        AS rating,
          COALESCE(text, '')              AS text,
          COALESCE(author, 'Anonymous')   AS author,
          date::text                      AS date,
          COALESCE(replied, false)        AS replied,
          reply_text
        FROM ${RAW}.reviews
        WHERE date >= $1::date
          AND date < $2::date
          ${this.storeFilter()}
        ORDER BY date DESC`,
        [dateRange.start, dateRange.end],
      );
      return rows;
    } catch {
      // Table may not exist yet
      return [];
    }
  }

  // ── Checklists ────────────────────────────────────────────────

  async getChecklistTemplate(): Promise<ChecklistItem[]> {
    // Checklists are not in the analytics layer yet — query raw if available
    try {
      const { rows } = await this.pool.query<ChecklistItem>(
        `SELECT id, label, category, required, notes
        FROM ${RAW}.checklist_templates
        ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
        ORDER BY category, id`,
      );
      return rows;
    } catch {
      // Table not provisioned yet
      return [];
    }
  }

  async getChecklistCompletions(date: string): Promise<ChecklistCompletion[]> {
    try {
      const { rows } = await this.pool.query<ChecklistCompletion>(
        `SELECT
          checklist_item_id,
          completed,
          completed_by,
          completed_at::text AS completed_at,
          notes
        FROM ${RAW}.checklist_completions
        WHERE completed_at::date = $1::date
          ${this.storeFilter()}`,
        [date],
      );
      return rows;
    } catch {
      return [];
    }
  }

  async saveChecklistCompletion(completion: ChecklistCompletion): Promise<void> {
    await this.pool.query(
      `INSERT INTO ${RAW}.checklist_completions
        (checklist_item_id, completed, completed_by, completed_at, notes${this.storeId ? ', store_id' : ''})
      VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5${this.storeId ? ', $6' : ''})
      ON CONFLICT (checklist_item_id, (completed_at::date))
      DO UPDATE SET
        completed    = EXCLUDED.completed,
        completed_by = EXCLUDED.completed_by,
        notes        = EXCLUDED.notes`,
      this.storeId
        ? [completion.checklist_item_id, completion.completed, completion.completed_by, completion.completed_at, completion.notes, this.storeId]
        : [completion.checklist_item_id, completion.completed, completion.completed_by, completion.completed_at, completion.notes],
    );
  }

  // ── Timecards ─────────────────────────────────────────────────

  async getTimecards(dateRange: DateRange): Promise<TimecardRow[]> {
    // No analytics view for timecards; query raw table
    try {
      const { rows } = await this.pool.query<TimecardRow>(
        `SELECT
          employee_id::text                          AS employee_id,
          COALESCE(employee_name, '')                AS employee_name,
          clock_in::text                             AS clock_in,
          clock_out::text                            AS clock_out,
          COALESCE(shift, 'day')                     AS shift,
          COALESCE(break_minutes, 0)::int            AS break_minutes,
          COALESCE(total_hours, 0)::numeric          AS total_hours,
          COALESCE(overtime_hours, 0)::numeric       AS overtime_hours,
          COALESCE(status, 'complete')               AS status,
          approved_by
        FROM ${RAW}.timecards
        WHERE clock_in::date >= $1::date
          AND clock_in::date < $2::date
          ${this.storeFilter()}
        ORDER BY clock_in`,
        [dateRange.start, dateRange.end],
      );
      return rows;
    } catch {
      return [];
    }
  }

  // ── Inventory Adjustments ─────────────────────────────────────

  async getInventoryAdjustments(dateRange: DateRange): Promise<InventoryAdjustmentRow[]> {
    // No analytics view; query raw table
    try {
      const { rows } = await this.pool.query<InventoryAdjustmentRow>(
        `SELECT
          adjustment_id::text                        AS adjustment_id,
          item_code                                  AS item_code,
          COALESCE(item_desc, '')                    AS item_desc,
          COALESCE(category, 'Uncategorized')        AS category,
          COALESCE(adjustment_type, 'manual')        AS adjustment_type,
          COALESCE(qty_change, 0)::numeric           AS qty_change,
          COALESCE(reason_code, '')                  AS reason_code,
          COALESCE(reason_desc, '')                  AS reason_desc,
          COALESCE(adjusted_by, '')                  AS adjusted_by,
          adjusted_at::text                          AS adjusted_at,
          COALESCE(unit_cost, 0)::numeric            AS unit_cost,
          notes
        FROM ${RAW}.inventory_adjustments
        WHERE adjusted_at >= $1::timestamptz
          AND adjusted_at < $2::timestamptz
          ${this.storeFilter()}
        ORDER BY adjusted_at`,
        [dateRange.start, dateRange.end],
      );
      return rows;
    } catch {
      return [];
    }
  }

  // ── Waste ─────────────────────────────────────────────────────

  async getWasteLogs(dateRange: DateRange): Promise<WasteLogRow[]> {
    // No analytics view; query raw table
    try {
      const { rows } = await this.pool.query<WasteLogRow>(
        `SELECT
          waste_id::text                             AS waste_id,
          item_code                                  AS item_code,
          COALESCE(item_desc, '')                    AS item_desc,
          COALESCE(category, 'Uncategorized')        AS category,
          COALESCE(qty_wasted, 0)::numeric           AS qty_wasted,
          COALESCE(unit_cost, 0)::numeric            AS unit_cost,
          COALESCE(total_cost, 0)::numeric           AS total_cost,
          COALESCE(reason_code, 'other')             AS reason_code,
          COALESCE(reason_desc, '')                  AS reason_desc,
          COALESCE(logged_by, '')                    AS logged_by,
          logged_at::text                            AS logged_at,
          notes
        FROM ${RAW}.waste_logs
        WHERE logged_at >= $1::timestamptz
          AND logged_at < $2::timestamptz
          ${this.storeFilter()}
        ORDER BY logged_at`,
        [dateRange.start, dateRange.end],
      );
      return rows;
    } catch {
      return [];
    }
  }

  // ── Bank Deposits ─────────────────────────────────────────────

  async getBankDeposits(dateRange: DateRange): Promise<BankDepositRow[]> {
    // No analytics view; query raw table
    try {
      const { rows } = await this.pool.query<BankDepositRow>(
        `SELECT
          deposit_id::text                           AS deposit_id,
          deposit_date::text                         AS deposit_date,
          COALESCE(deposit_type, 'cash')             AS deposit_type,
          COALESCE(expected_amount, 0)::numeric      AS expected_amount,
          COALESCE(actual_amount, 0)::numeric        AS actual_amount,
          COALESCE(variance, 0)::numeric             AS variance,
          COALESCE(reference_no, '')                 AS reference_no,
          COALESCE(status, 'pending')                AS status,
          notes
        FROM ${RAW}.bank_deposits
        WHERE deposit_date >= $1::date
          AND deposit_date < $2::date
          ${this.storeFilter()}
        ORDER BY deposit_date`,
        [dateRange.start, dateRange.end],
      );
      return rows;
    } catch {
      return [];
    }
  }

  // ── Raw SQL (escape hatch) ────────────────────────────────────

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    // Set search_path so unqualified table names resolve to analytics schema first
    const { rows } = await this.pool.query<T>(
      `SET LOCAL search_path TO ${ANALYTICS}, ${RAW}, public; ${sql}`,
    );
    return rows;
  }

  // ── Analytics-specific helpers (bonus API) ────────────────────
  // These expose the materialized views directly for skills that
  // want pre-aggregated data instead of raw rows.

  /** Daily sales aggregates from the daily_sales materialized view */
  async getDailySales(dateRange: DateRange): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.daily_sales
      WHERE sale_date >= $1::date AND sale_date < $2::date
      ${this.storeFilter()}
      ORDER BY sale_date`,
      [dateRange.start, dateRange.end],
    );
    return rows;
  }

  /** Weekly sales rollup with week-over-week delta */
  async getWeeklySales(dateRange: DateRange): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.weekly_sales
      WHERE week_start >= $1::date AND week_start < $2::date
      ${this.storeFilter()}
      ORDER BY week_start`,
      [dateRange.start, dateRange.end],
    );
    return rows;
  }

  /** Monthly sales rollup with month-over-month delta */
  async getMonthlySales(dateRange: DateRange): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.monthly_sales
      WHERE month_start >= $1::date AND month_start < $2::date
      ${this.storeFilter()}
      ORDER BY month_start`,
      [dateRange.start, dateRange.end],
    );
    return rows;
  }

  /** Per-item performance metrics (revenue, qty, velocity) */
  async getItemPerformance(limit = 100): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.item_performance
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY total_revenue DESC NULLS LAST
      LIMIT $1`,
      [limit],
    );
    return rows;
  }

  /** Item ranking (top/bottom/dead/growth classification) */
  async getItemRanking(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.item_ranking
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY rank_position NULLS LAST`,
    );
    return rows;
  }

  /** Department-level performance rollup */
  async getDepartmentPerformance(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.department_performance
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY total_revenue DESC NULLS LAST`,
    );
    return rows;
  }

  /** Inventory health classification */
  async getInventoryHealth(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.inventory_health
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY health_status, item_code`,
    );
    return rows;
  }

  /** Price-margin analysis */
  async getPriceMargin(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.price_margin
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY margin_pct DESC NULLS LAST`,
    );
    return rows;
  }

  /** ABC-XYZ classification for inventory prioritization */
  async getAbcXyzClassification(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.abc_xyz_classification
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY abc_class, xyz_class`,
    );
    return rows;
  }

  /** RFM customer segmentation */
  async getRfmSegmentation(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.rfm_segmentation
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY rfm_score DESC NULLS LAST`,
    );
    return rows;
  }

  /** Discount analysis */
  async getDiscountAnalysis(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.discount_analysis
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY total_discount_amount DESC NULLS LAST`,
    );
    return rows;
  }

  /** Perishable risk items */
  async getPerishableRisk(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.perishable_risk
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY risk_level DESC NULLS LAST, days_until_expiry NULLS LAST`,
    );
    return rows;
  }

  /** Payment profile breakdown */
  async getPaymentProfile(): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.payment_profile
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}`,
    );
    return rows;
  }

  /** Customer profiles */
  async getCustomerProfiles(limit = 100): Promise<Record<string, unknown>[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${ANALYTICS}.customer_profile
      ${this.storeId ? `WHERE store_id = '${this.storeId}'` : ''}
      ORDER BY total_spend DESC NULLS LAST
      LIMIT $1`,
      [limit],
    );
    return rows;
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// ── Factory ─────────────────────────────────────────────────────

/** Shared pool instance — one per process */
let sharedPool: pg.Pool | null = null;

/**
 * Create an AnalyticsConnector backed by CortexDB.
 * Uses vault credentials from ~/.shre/vault/cortexdb.json.
 *
 * @param storeId - Optional store filter for multi-store deployments.
 *                  When set, all queries include a store_id WHERE clause.
 */
export function createAnalyticsConnector(storeId?: string): AnalyticsConnector {
  if (!sharedPool) {
    const creds = loadCortexCreds();
    sharedPool = new Pool({
      host: creds.host,
      port: creds.port,
      user: creds.user,
      password: creds.password,
      database: creds.db,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    // Prevent unhandled pool errors from crashing the process
    sharedPool.on('error', (err) => {
      console.error('[analytics-connector] Pool error:', err.message);
    });
  }

  return new AnalyticsConnector(sharedPool, storeId);
}
