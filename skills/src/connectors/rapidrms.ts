/**
 * RapidRMS Data Connector
 *
 * Queries CortexDB's `party_liquor` schema via psql inside Docker.
 * This is the Phase 1 connector — all POS data flows through here.
 *
 * Connection: docker exec cortex-relational psql -U cortex -d cortexdb -c "SQL"
 */

import { execSync } from 'node:child_process';
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
} from '../types.js';

/** Configuration for the RapidRMS connector */
export interface RapidRmsConfig {
  /** Docker container name running PostgreSQL */
  containerName: string;
  /** PostgreSQL user */
  dbUser: string;
  /** PostgreSQL database */
  dbName: string;
  /** Schema name, e.g. "party_liquor" */
  schema: string;
}

/** Default config for the Party Liquor test store */
export const DEFAULT_RAPIDRMS_CONFIG: RapidRmsConfig = {
  containerName: 'cortex-relational',
  dbUser: 'cortex',
  dbName: 'cortexdb',
  schema: 'party_liquor',
};

/**
 * Execute a SQL query against CortexDB and return parsed JSON rows.
 * Uses psql's `-t -A -F` flags plus JSON output for reliable parsing.
 */
function execSql<T>(config: RapidRmsConfig, sql: string): T[] {
  const escapedSql = sql.replace(/"/g, '\\"');
  const cmd = `docker exec ${config.containerName} psql -U ${config.dbUser} -d ${config.dbName} -t -A --csv -c "${escapedSql}"`;

  let output: string;
  try {
    output = execSync(cmd, { encoding: 'utf-8', timeout: 30_000 }).trim();
  } catch {
    return [];
  }

  if (!output) return [];

  const lines = output.split('\n');
  const headerLine = lines[0];
  if (!headerLine) return [];

  const headers = headerLine.split(',');
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = parseCsvLine(line);
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (header) {
        row[header] = coerce(values[j]);
      }
    }
    rows.push(row as T);
  }

  return rows;
}

/** Simple CSV line parser (handles quoted fields) */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Coerce string values to appropriate JS types */
function coerce(value: string | undefined): unknown {
  if (value === undefined || value === '') return null;
  if (value === 't' || value === 'true') return true;
  if (value === 'f' || value === 'false') return false;
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== '') return num;
  return value;
}

/**
 * RapidRMS connector — queries the CortexDB party_liquor schema.
 *
 * Phase 1: invoices and invoice_items are the primary tables.
 * Other methods (inventory, vendors, employees, reviews) return empty
 * arrays until those tables are populated in CortexDB.
 */
export class RapidRmsConnector implements DataConnector {
  readonly id = 'rapidrms';
  private config: RapidRmsConfig;

  constructor(config: RapidRmsConfig = DEFAULT_RAPIDRMS_CONFIG) {
    this.config = config;
  }

  private get schema(): string {
    return this.config.schema;
  }

  async getInvoices(dateRange: DateRange): Promise<InvoiceRow[]> {
    const sql = `
      SELECT
        invoice_no,
        invoice_date::text,
        COALESCE(cashier_name, 'Unknown') as cashier_name,
        COALESCE(bill_amount, 0) as bill_amount,
        COALESCE(tax_amount, 0) as tax_amount,
        COALESCE(discount_amount, 0) as discount_amount,
        COALESCE(payment_method, 'cash') as payment_method,
        COALESCE(is_void, false) as is_void,
        COALESCE(is_refund, false) as is_refund,
        COALESCE(register_id, '1') as register_id,
        COALESCE(shift, 'day') as shift,
        COALESCE(customer_count, 1) as customer_count
      FROM ${this.schema}.invoices
      WHERE invoice_date >= '${dateRange.start}'
        AND invoice_date < '${dateRange.end}'
      ORDER BY invoice_date
    `;
    return execSql<InvoiceRow>(this.config, sql);
  }

  async getInvoiceItems(dateRange: DateRange): Promise<InvoiceItemRow[]> {
    const sql = `
      SELECT
        ii.invoice_no,
        ii.item_code,
        ii.item_desc,
        COALESCE(ii.item_qty, 0) as item_qty,
        COALESCE(ii.unit_price, 0) as unit_price,
        COALESCE(ii.cost_price, 0) as cost_price,
        COALESCE(ii.total_amount, 0) as total_amount,
        COALESCE(ii.category, 'Uncategorized') as category,
        COALESCE(ii.department, 'General') as department,
        COALESCE(ii.is_void, false) as is_void,
        COALESCE(ii.discount_amount, 0) as discount_amount
      FROM ${this.schema}.invoice_items ii
      JOIN ${this.schema}.invoices i ON ii.invoice_no = i.invoice_no
      WHERE i.invoice_date >= '${dateRange.start}'
        AND i.invoice_date < '${dateRange.end}'
      ORDER BY ii.invoice_no
    `;
    return execSql<InvoiceItemRow>(this.config, sql);
  }

  async getInvoiceItemsByInvoice(invoiceNos: string[]): Promise<InvoiceItemRow[]> {
    if (invoiceNos.length === 0) return [];
    const inClause = invoiceNos.map((n) => `'${n}'`).join(',');
    const sql = `
      SELECT
        invoice_no, item_code, item_desc,
        COALESCE(item_qty, 0) as item_qty,
        COALESCE(unit_price, 0) as unit_price,
        COALESCE(cost_price, 0) as cost_price,
        COALESCE(total_amount, 0) as total_amount,
        COALESCE(category, 'Uncategorized') as category,
        COALESCE(department, 'General') as department,
        COALESCE(is_void, false) as is_void,
        COALESCE(discount_amount, 0) as discount_amount
      FROM ${this.schema}.invoice_items
      WHERE invoice_no IN (${inClause})
    `;
    return execSql<InvoiceItemRow>(this.config, sql);
  }

  async getInventory(): Promise<InventoryRow[]> {
    const sql = `
      SELECT
        item_code, item_desc, category,
        COALESCE(qty_on_hand, 0) as qty_on_hand,
        COALESCE(qty_on_order, 0) as qty_on_order,
        COALESCE(reorder_point, 0) as reorder_point,
        COALESCE(reorder_qty, 0) as reorder_qty,
        COALESCE(unit_cost, 0) as unit_cost,
        COALESCE(retail_price, 0) as retail_price,
        COALESCE(last_received_date::text, '') as last_received_date,
        COALESCE(last_sold_date::text, '') as last_sold_date,
        COALESCE(vendor_id, '') as vendor_id,
        COALESCE(lead_time_days, 3) as lead_time_days
      FROM ${this.schema}.inventory
      ORDER BY item_desc
    `;
    return execSql<InventoryRow>(this.config, sql);
  }

  async getInventoryByCategory(category: string): Promise<InventoryRow[]> {
    const all = await this.getInventory();
    return all.filter((row) => row.category === category);
  }

  async getVendorPrices(itemCodes?: string[]): Promise<VendorPriceRow[]> {
    let where = '';
    if (itemCodes && itemCodes.length > 0) {
      const inClause = itemCodes.map((c) => `'${c}'`).join(',');
      where = `WHERE item_code IN (${inClause})`;
    }
    const sql = `
      SELECT
        vendor_id, vendor_name, item_code, item_desc,
        COALESCE(unit_cost, 0) as unit_cost,
        COALESCE(case_cost, 0) as case_cost,
        COALESCE(case_qty, 1) as case_qty,
        promo_price, promo_start::text, promo_end::text,
        COALESCE(min_order_qty, 1) as min_order_qty
      FROM ${this.schema}.vendor_prices
      ${where}
      ORDER BY item_code, unit_cost
    `;
    return execSql<VendorPriceRow>(this.config, sql);
  }

  async getEmployees(date: string): Promise<EmployeeRow[]> {
    const sql = `
      SELECT
        employee_id, employee_name, role,
        COALESCE(hourly_rate, 0) as hourly_rate,
        COALESCE(scheduled_hours, 0) as scheduled_hours,
        COALESCE(actual_hours, 0) as actual_hours,
        COALESCE(shift, 'day') as shift
      FROM ${this.schema}.employees
      WHERE schedule_date = '${date}'
      ORDER BY employee_name
    `;
    return execSql<EmployeeRow>(this.config, sql);
  }

  async getRegisterReadings(date: string): Promise<RegisterReadingRow[]> {
    const sql = `
      SELECT
        register_id, shift, cashier_name,
        COALESCE(expected_cash, 0) as expected_cash,
        COALESCE(actual_cash, 0) as actual_cash,
        COALESCE(card_total, 0) as card_total,
        COALESCE(other_tender_total, 0) as other_tender_total,
        reading_time::text
      FROM ${this.schema}.register_readings
      WHERE reading_time::date = '${date}'
      ORDER BY reading_time
    `;
    return execSql<RegisterReadingRow>(this.config, sql);
  }

  async getReviews(dateRange: DateRange): Promise<ReviewRow[]> {
    const sql = `
      SELECT
        platform, review_id, rating, text, author,
        date::text, COALESCE(replied, false) as replied, reply_text
      FROM ${this.schema}.reviews
      WHERE date >= '${dateRange.start}' AND date < '${dateRange.end}'
      ORDER BY date DESC
    `;
    return execSql<ReviewRow>(this.config, sql);
  }

  async getChecklistTemplate(): Promise<ChecklistItem[]> {
    const sql = `
      SELECT id, label, category, required, notes
      FROM ${this.schema}.checklist_templates
      ORDER BY category, id
    `;
    return execSql<ChecklistItem>(this.config, sql);
  }

  async getChecklistCompletions(date: string): Promise<ChecklistCompletion[]> {
    const sql = `
      SELECT
        checklist_item_id, completed, completed_by,
        completed_at::text, notes
      FROM ${this.schema}.checklist_completions
      WHERE completed_at::date = '${date}'
    `;
    return execSql<ChecklistCompletion>(this.config, sql);
  }

  async saveChecklistCompletion(completion: ChecklistCompletion): Promise<void> {
    const sql = `
      INSERT INTO ${this.schema}.checklist_completions
        (checklist_item_id, completed, completed_by, completed_at, notes)
      VALUES
        ('${completion.checklist_item_id}', ${completion.completed},
         ${completion.completed_by ? `'${completion.completed_by}'` : 'NULL'},
         ${completion.completed_at ? `'${completion.completed_at}'` : 'NOW()'},
         ${completion.notes ? `'${completion.notes}'` : 'NULL'})
      ON CONFLICT (checklist_item_id, completed_at::date)
      DO UPDATE SET completed = EXCLUDED.completed,
                    completed_by = EXCLUDED.completed_by,
                    notes = EXCLUDED.notes
    `;
    execSql(this.config, sql);
  }

  async getTimecards(dateRange: DateRange): Promise<TimecardRow[]> {
    const sql = `
      SELECT
        employee_id, employee_name, clock_in::text, clock_out::text,
        COALESCE(shift, 'day') as shift,
        COALESCE(break_minutes, 0) as break_minutes,
        COALESCE(total_hours, 0) as total_hours,
        COALESCE(overtime_hours, 0) as overtime_hours,
        COALESCE(status, 'complete') as status,
        approved_by
      FROM ${this.schema}.timecards
      WHERE clock_in::date >= '${dateRange.start}'
        AND clock_in::date < '${dateRange.end}'
      ORDER BY clock_in
    `;
    return execSql<TimecardRow>(this.config, sql);
  }

  async getInventoryAdjustments(dateRange: DateRange): Promise<InventoryAdjustmentRow[]> {
    const sql = `
      SELECT
        adjustment_id, item_code, item_desc, category,
        adjustment_type, qty_change, reason_code,
        COALESCE(reason_desc, '') as reason_desc,
        adjusted_by, adjusted_at::text,
        COALESCE(unit_cost, 0) as unit_cost, notes
      FROM ${this.schema}.inventory_adjustments
      WHERE adjusted_at >= '${dateRange.start}'
        AND adjusted_at < '${dateRange.end}'
      ORDER BY adjusted_at
    `;
    return execSql<InventoryAdjustmentRow>(this.config, sql);
  }

  async getWasteLogs(dateRange: DateRange): Promise<WasteLogRow[]> {
    const sql = `
      SELECT
        waste_id, item_code, item_desc, category,
        COALESCE(qty_wasted, 0) as qty_wasted,
        COALESCE(unit_cost, 0) as unit_cost,
        COALESCE(total_cost, 0) as total_cost,
        COALESCE(reason_code, 'other') as reason_code,
        COALESCE(reason_desc, '') as reason_desc,
        logged_by, logged_at::text, notes
      FROM ${this.schema}.waste_logs
      WHERE logged_at >= '${dateRange.start}'
        AND logged_at < '${dateRange.end}'
      ORDER BY logged_at
    `;
    return execSql<WasteLogRow>(this.config, sql);
  }

  async getBankDeposits(dateRange: DateRange): Promise<BankDepositRow[]> {
    const sql = `
      SELECT
        deposit_id, deposit_date::text, deposit_type,
        COALESCE(expected_amount, 0) as expected_amount,
        COALESCE(actual_amount, 0) as actual_amount,
        COALESCE(variance, 0) as variance,
        COALESCE(reference_no, '') as reference_no,
        COALESCE(status, 'pending') as status,
        notes
      FROM ${this.schema}.bank_deposits
      WHERE deposit_date >= '${dateRange.start}'
        AND deposit_date < '${dateRange.end}'
      ORDER BY deposit_date
    `;
    return execSql<BankDepositRow>(this.config, sql);
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    return execSql<T>(this.config, sql);
  }
}
