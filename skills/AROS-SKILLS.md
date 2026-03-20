# AROS Skills Architecture — The Agent Workforce for Retail

*AROS (Agent Retail Operating System) runs a store so the owner doesn't have to be there 24/7.*

## Design Principle

The operator handles customers face-to-face. AROS handles everything behind the counter:
**data → insight → decision → action → report to owner.**

Skills are organized by business function. Each skill maps to what a human manager would do — but faster, cheaper, and 24/7.

---

## Skill Categories

### 1. 📦 INVENTORY INTELLIGENCE
*"What do we have, what do we need, and what's going bad?"*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **stock-pulse** | Real-time inventory levels by category/SKU. Flags low stock, overstock, dead stock. | Continuous |
| **auto-reorder** | Predicts when items will run out based on velocity + lead time. Generates PO drafts. | Daily |
| **shrink-detector** | Compares expected vs actual inventory. Flags theft, waste, damage, spoilage patterns. | Daily |
| **expiry-tracker** | Tracks perishable items (food, tobacco, lottery). Alerts before expiry. FIFO enforcement. | Daily |
| **vendor-scorecard** | Rates suppliers on: fill rate, lead time, price stability, quality. Recommends alternatives. | Weekly |
| **planogram-advisor** | Suggests shelf layout based on sales velocity, margins, and adjacency logic. | Monthly |

### 2. 💰 SALES & REVENUE
*"How much are we making, from what, and how do we make more?"*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **daily-flash** | End-of-day sales summary: total revenue, transactions, avg ticket, top sellers, voids, refunds. | Daily |
| **margin-monitor** | Tracks gross margin by category/SKU. Flags items selling below target margin. | Daily |
| **price-optimizer** | Analyzes competitor pricing, elasticity, and margin targets. Suggests price adjustments. | Weekly |
| **promo-engine** | Designs promotions based on slow movers, seasonal trends, and margin room. Measures lift. | Weekly |
| **basket-analyzer** | Market basket analysis — what sells together. Drives cross-sell/upsell/placement. | Weekly |
| **daypart-analyzer** | Revenue patterns by hour/day. Identifies peak/dead zones for staffing and promotions. | Weekly |

### 3. 💵 CASH & FINANCIAL
*"Where's the money going?"*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **cash-reconciler** | Matches register totals to deposits. Flags overages/shortages by cashier/shift. | Daily |
| **expense-tracker** | Categorizes operating expenses (utilities, rent, supplies, payroll). Budget vs actual. | Weekly |
| **pnl-generator** | Generates store P&L statement: revenue, COGS, gross margin, operating expenses, net profit. | Weekly/Monthly |
| **tax-prep** | Tracks sales tax collected, excise taxes (tobacco/alcohol), prepares filing summaries. | Monthly |
| **cashflow-forecast** | Projects cash position 30/60/90 days out based on trends and known obligations. | Weekly |

### 4. 👥 WORKFORCE & OPERATIONS
*"Who's working, how are they performing, and is the store running right?"*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **shift-optimizer** | Generates optimal schedules based on traffic patterns, labor laws, and budget. | Weekly |
| **cashier-scorecard** | Performance metrics per employee: speed, accuracy, void rate, upsell rate. | Daily |
| **opening-closing-checklist** | Digital checklists for open/close SOPs. Tracks compliance. Photos for verification. | Daily |
| **compliance-monitor** | Age verification compliance, alcohol/tobacco sale rules, health inspection readiness. | Continuous |
| **maintenance-tracker** | Equipment health (coolers, coffee machines, fuel pumps). Predictive maintenance alerts. | Daily |

### 5. 🛢️ FUEL OPERATIONS (C-Store specific)
*"Fuel is the traffic driver — optimize it."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **fuel-price-advisor** | Monitors competitor fuel prices (GasBuddy/OPIS feeds). Suggests optimal pricing. | Multiple daily |
| **tank-monitor** | Tank level tracking, delivery scheduling, water/leak detection. Conexxus TLG integration. | Continuous |
| **fuel-margin-tracker** | Tracks fuel margins by grade. Alerts on margin compression. | Daily |
| **fuel-delivery-optimizer** | Optimizes fuel delivery scheduling based on consumption rates and tank capacity. | As needed |

### 6. 🍔 FOOD SERVICE (QSR / C-Store Foodservice)
*"Food is the margin — don't waste it."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **food-waste-tracker** | Tracks prep vs sold vs wasted. Optimizes prep quantities by daypart. | Daily |
| **menu-optimizer** | Analyzes item profitability, popularity, and prep complexity. Recommends menu changes. | Monthly |
| **food-safety-logger** | Temperature logs, prep time tracking, holding time alerts. Health code compliance. | Continuous |
| **recipe-cost-calculator** | Calculates true recipe cost including waste factor. Updates as ingredient prices change. | Weekly |

### 7. 🎯 CUSTOMER & MARKETING
*"Who are our customers and how do we get more of them?"*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **loyalty-analyzer** | Customer visit frequency, spend patterns, lapse detection. Triggers win-back campaigns. | Weekly |
| **review-monitor** | Monitors Google/Yelp reviews. Drafts responses. Flags urgent issues. | Daily |
| **local-competitor-watch** | Tracks competitor openings, closings, price changes, promotions within trade area. | Weekly |
| **campaign-launcher** | Creates and schedules promotions: SMS, email, social media, in-store signage. Measures ROI. | As needed |
| **foot-traffic-analyzer** | Estimates customer count by hour/day using POS transaction data. Correlates with weather/events. | Daily |

### 8. 📊 OWNER INTELLIGENCE
*"The daily briefing a store owner actually wants."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **morning-briefing** | Daily summary: yesterday's sales, cash position, inventory alerts, schedule, weather impact. | Daily 6am |
| **weekly-scorecard** | KPI dashboard: sales trend, margins, labor %, shrink %, customer count, vs last week/year. | Weekly |
| **monthly-report** | Full business review: P&L, inventory turns, top/bottom performers, growth opportunities. | Monthly |
| **growth-advisor** | Strategic recommendations: new product categories, service additions, expansion timing. | Monthly |
| **benchmark-compare** | Compares store metrics to industry averages (NACS data for c-stores, NRA for QSR). | Monthly |
| **what-if-simulator** | Scenario modeling: "What if I raise cigarette prices 5%?" "What if I add a pizza program?" | On demand |

### 9. 🔒 LOSS PREVENTION & SECURITY
*"Protect the business."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **void-refund-auditor** | Flags suspicious void/refund patterns by cashier. Detects sweethearting. | Daily |
| **cash-variance-alert** | Immediate alert on cash drawer discrepancies above threshold. | Real-time |
| **transaction-anomaly** | Detects unusual patterns: after-hours sales, rapid-fire voids, manual price overrides. | Continuous |
| **vendor-delivery-audit** | Verifies delivered quantities match invoiced quantities. Flags discrepancies. | Per delivery |

### 10. 📣 MARKETING AGENT
*"No customers, no business. Drive demand relentlessly."*

Every business needs a marketing person. Most small retailers can't afford one. AROS IS their marketing person.

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **brand-voice** | Maintains consistent brand messaging across all channels. Tone, style, visuals. | Always on |
| **social-media-manager** | Creates and schedules posts (Instagram, Facebook, X, Google Business). Product highlights, events, seasonal content. | 3-5x/week |
| **local-seo** | Optimizes Google Business Profile: hours, photos, posts, Q&A, keywords. Tracks local search ranking. | Weekly |
| **promo-calendar** | Plans monthly promotional calendar tied to holidays, events, seasons, and supplier deals. | Monthly |
| **sms-email-campaigns** | Designs, sends, and measures targeted campaigns to customer segments. Open rates, redemption, ROI. | As needed |
| **competitor-intel** | Monitors competitor ads, promotions, pricing, reviews. Identifies gaps and opportunities. | Weekly |
| **signage-creator** | Generates in-store signage, price tags, promo banners, window displays (print-ready). | As needed |
| **community-builder** | Identifies local partnerships, sponsorships, events. Builds store presence in the neighborhood. | Monthly |
| **reputation-manager** | Monitors and responds to Google/Yelp reviews. Solicits reviews from happy customers. Damage control on negatives. | Daily |
| **campaign-roi-tracker** | Measures every marketing dollar spent vs incremental revenue generated. Kills underperformers. | Weekly |

### 11. 🏷️ PROCUREMENT AGENT
*"Buy smart. Every penny saved on purchasing is a penny of pure profit."*

The procurement agent's single mission: get the best possible deal on every item, minimize stock overhead, and maximize margin.

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **vendor-negotiator** | Tracks vendor pricing history. Identifies when prices increased without justification. Prepares negotiation briefs with competitor quotes. | Per order cycle |
| **deal-hunter** | Scans vendor promotions, close-out deals, bulk discounts, seasonal offers. Matches to store velocity to avoid overstocking on "deals." | Daily |
| **cost-comparison** | Maintains price matrix across all vendors for each SKU. Flags when switching vendors saves money. | Weekly |
| **order-optimizer** | Calculates optimal order quantities balancing: unit cost (bulk discounts), carrying cost, shelf life, storage space, and cash flow impact. | Per order |
| **supplier-diversifier** | Ensures no single-supplier dependency. Identifies backup sources for critical items. | Monthly |
| **dead-stock-liquidator** | Identifies items that haven't sold in 30/60/90 days. Proposes markdown strategy, bundle deals, return-to-vendor, or donation (tax deduction). | Weekly |
| **margin-maximizer** | For every product category: finds the mix of brands/sizes/pack-types that maximizes gross margin per shelf foot. | Monthly |
| **payment-terms-optimizer** | Negotiates and tracks payment terms (net 30, 2%/10 net 30). Prioritizes early-pay discounts when cash allows. | Monthly |
| **seasonal-buy-planner** | Plans ahead for seasonal inventory (holiday candy, summer drinks, back-to-school). Pre-buys at off-season prices. | Quarterly |
| **rebate-tracker** | Tracks manufacturer rebates, volume incentives, and co-op advertising funds. Ensures nothing is left on the table. | Monthly |

### 12. 💼 PAYROLL & HR
*"Pay people right, on time, every time."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **payroll-processor** | Calculates gross/net pay from timeclock data. Handles overtime, tips, deductions. Generates pay stubs. | Bi-weekly |
| **timecard-auditor** | Validates employee clock-in/out timestamps. Flags missed punches, early/late arrivals, buddy punching, overtime approaching. | Daily |
| **labor-cost-tracker** | Tracks labor cost as % of sales by shift/day/week. Alerts when exceeding target (industry: 12-15% c-store, 25-30% QSR). | Daily |
| **break-compliance** | Ensures meal/rest break compliance per state labor law. Flags violations before they become fines. | Daily |
| **pto-tracker** | Tracks vacation, sick days, personal time. Alerts when coverage gaps exist. | As needed |

### 13. 🎁 CUSTOMER LOYALTY & CRM
*"A repeat customer is worth 10x a new one."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **loyalty-engine** | Manages points/rewards program. Tracks earn/burn rates. Designs tier structures. | Continuous |
| **customer-profiler** | Builds profiles from transaction data: visit frequency, avg spend, preferred items, time of day, payment method. | Weekly |
| **churn-predictor** | Identifies customers whose visit frequency is declining. Triggers win-back offers before they leave. | Weekly |
| **vip-detector** | Identifies top 20% customers by spend/frequency. Ensures they get special treatment (exclusive offers, early access). | Monthly |
| **segment-builder** | Groups customers into actionable segments: "morning coffee regulars", "weekend beer buyers", "lottery players". | Monthly |

### 14. 📈 DATA ANALYST
*"Turn raw POS data into business intelligence."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **transaction-profiler** | Deep analysis of every transaction: items per basket, payment type, time-of-day patterns, cashier correlation. | Daily |
| **item-profiler** | Per-SKU intelligence: velocity, margin contribution, seasonal patterns, price sensitivity, cross-sell affinity. | Weekly |
| **basket-bundler** | Identifies items frequently purchased together (chips+beverage, beer+ice, cigarettes+lighter). Drives placement and bundle pricing. | Weekly |
| **trend-spotter** | Detects emerging trends (rising/falling categories, new items gaining traction, declining brands). | Weekly |
| **anomaly-detective** | Catches statistical outliers across all data: unusual sales spikes/drops, pricing errors, inventory ghosts. | Daily |
| **custom-report-builder** | Natural language query → SQL → formatted report. "Show me beer sales by brand for the last 3 months." | On demand |
| **benchmark-engine** | Compares store KPIs to industry benchmarks (NACS for c-store, NRA for QSR). Identifies gaps and strengths. | Monthly |

### 15. 🏦 BANK & RECONCILIATION
*"Every dollar in matches every dollar out."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **bank-reconciler** | Matches POS settlement reports to bank deposits. Flags discrepancies by payment type (cash, credit, debit, EBT, mobile). | Daily |
| **payment-processor-auditor** | Verifies credit card processor fees match contract rates. Catches overcharges and hidden fees. | Monthly |
| **deposit-tracker** | Tracks cash deposits from store to bank. Flags late deposits, missing deposits, or amount mismatches. | Daily |
| **accounts-payable** | Tracks vendor invoices, payment due dates, early-pay discounts. Prevents double payments and late fees. | Weekly |
| **revenue-reconciler** | Reconciles POS revenue → payment processor → bank → accounting. End-to-end money trail. | Weekly |

### 16. 🗑️ WASTE & SPOILAGE
*"Waste is profit walking out the door."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **waste-logger** | Tracks all waste/spoilage/damage/theft by category with reason codes. Dollar value calculated at cost. | Daily |
| **expiry-countdown** | Scans inventory for items approaching expiration. Triggers markdown/promotion/donation before waste. | Daily |
| **dead-item-killer** | Identifies items with zero or near-zero velocity for 30/60/90+ days. Proposes: markdown, return-to-vendor, discontinue, donate (tax deduction). | Weekly |
| **shrink-analyzer** | Calculates shrink rate by category (expected vs actual inventory). Isolates cause: theft, damage, admin error, vendor short. | Monthly |
| **waste-cost-reporter** | Monthly waste cost as % of revenue and COGS. Trend analysis. Sets reduction targets. | Monthly |

### 17. 🔔 CHANGE MONITORING
*"Nothing changes without you knowing about it."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **price-change-monitor** | Detects any price changes in POS — who changed it, when, old vs new, margin impact. Flags unauthorized changes. Tracks vendor cost increases over time. | Real-time |
| **cost-change-tracker** | Monitors vendor/wholesale cost changes per SKU. Calculates margin erosion. Alerts when cost increase wasn't passed to retail price (margin squeeze). | Per delivery/invoice |
| **qty-change-monitor** | Detects inventory quantity adjustments outside of normal sales flow — manual adjustments, receiving errors, count corrections. Flags suspicious patterns (e.g., repeated write-downs on same items/same employee). | Real-time |
| **pack-size-detector** | Catches vendor "shrinkflation" — same SKU, same cost, smaller pack/size. Recalculates per-unit cost. | Per delivery |
| **price-override-auditor** | Tracks every manual price override at register. Who, what item, original vs override price, frequency. Prevents unauthorized discounting. | Daily |

### 18. 📋 REGULATORY & COMPLIANCE
*"Stay legal."*

| Skill | What It Does | Frequency |
|-------|-------------|-----------|
| **age-verify-audit** | Tracks age verification compliance rate. Flags gaps. Generates training reports. | Daily |
| **license-tracker** | Monitors license/permit expiration dates (liquor, tobacco, food, business). Alerts 60 days before. | Monthly |
| **tax-rate-updater** | Monitors tax rate changes (sales tax, excise tax) and updates POS configuration. | As needed |
| **health-inspection-prep** | Pre-inspection checklist based on local health code requirements. Score prediction. | Monthly |

---

## Skill Priority Matrix — Start Lean, Scale Up

### Phase 1: MVP (Day 1 — runs the store)
**14 core skills that deliver immediate value:**

| Priority | Skill | Category | Why First |
|----------|-------|----------|-----------|
| 🔴 | morning-briefing | Owner Intel | Owner sees value immediately — daily report in their pocket |
| 🔴 | daily-flash | Sales | End-of-day summary — replaces "how'd we do today?" |
| 🔴 | stock-pulse | Inventory | Real-time inventory awareness — prevents empty shelves |
| 🔴 | auto-reorder | Inventory | Automated PO generation — saves hours per week |
| 🔴 | cash-reconciler | Cash | Daily cash accountability — catches theft/errors fast |
| 🔴 | cashier-scorecard | Workforce | Employee performance visibility — data not gut feeling |
| 🔴 | void-refund-auditor | Loss Prev | Catches fraud early |
| 🔴 | opening-closing-checklist | Workforce | Operational consistency — even when owner isn't there |
| 🔴 | margin-monitor | Sales | Know your real margins — not just revenue |
| 🔴 | weekly-scorecard | Owner Intel | KPI tracking — getting better or worse? |
| 🔴 | deal-hunter | Procurement | Find savings on every purchase — immediate margin boost |
| 🔴 | cost-comparison | Procurement | Know if you're overpaying vs alternatives |
| 🔴 | reputation-manager | Marketing | Monitor + respond to reviews — most impactful marketing for SMB |
| 🔴 | local-seo | Marketing | Google Business optimization — free customer acquisition |

### Phase 2: Growth (Month 2-3)
- **Data Analyst:** transaction-profiler, item-profiler, basket-bundler, anomaly-detective
- **Loyalty/CRM:** customer-profiler, loyalty-engine, churn-predictor
- **Payroll/HR:** payroll-processor, timecard-auditor, labor-cost-tracker
- **Bank:** bank-reconciler, deposit-tracker, revenue-reconciler
- **Waste:** waste-logger, expiry-countdown, dead-item-killer
- **Procurement:** order-optimizer, dead-stock-liquidator, margin-maximizer
- **Marketing:** social-media-manager, promo-calendar, reputation-manager (enhanced)
- **Inventory:** shrink-detector, expiry-tracker, vendor-scorecard
- **Workforce:** shift-optimizer, compliance-monitor
- **Fuel (if c-store):** fuel-price-advisor, tank-monitor

### Phase 3: Competitive Edge (Month 4+)
- **Data Analyst:** trend-spotter, custom-report-builder, benchmark-engine
- **Loyalty/CRM:** vip-detector, segment-builder
- **Procurement:** vendor-negotiator, payment-terms-optimizer, seasonal-buy-planner, rebate-tracker, supplier-diversifier
- **Marketing:** competitor-intel, campaign-launcher, community-builder, signage-creator, campaign-roi-tracker, sms-email-campaigns
- **Bank:** payment-processor-auditor, accounts-payable
- **Waste:** shrink-analyzer, waste-cost-reporter
- **Payroll:** break-compliance, pto-tracker
- **Sales:** price-optimizer, promo-engine, daypart-analyzer
- **Owner Intel:** growth-advisor, benchmark-compare, what-if-simulator
- **Food (if QSR):** food-waste-tracker, menu-optimizer, food-safety-logger, recipe-cost-calculator

---

## Data Sources Each Skill Needs

| Data Source | Skills That Use It | Connection |
|------------|-------------------|------------|
| POS/Transaction data | Almost all | RapidRMS API / CortexDB |
| Inventory counts | stock-pulse, auto-reorder, shrink-detector | POS API / manual counts |
| Vendor/Purchase orders | auto-reorder, vendor-scorecard, delivery-audit | POS purchasing module |
| Employee/Time records | shift-optimizer, cashier-scorecard | POS / time clock |
| Fuel tank gauges | tank-monitor, fuel-delivery | Conexxus TLG / ATG feed |
| Competitor prices | fuel-price-advisor, local-competitor | OPIS / GasBuddy API / web scrape |
| Bank/Payment data | cash-reconciler, expense-tracker | Bank feeds / payment processor |
| Customer data | loyalty-analyzer, basket-analyzer | POS loyalty / CRM |
| Reviews | review-monitor | Google/Yelp API |
| Weather | foot-traffic, daypart | Open-Meteo / wttr.in |

---

## Business Type Adaptations

### C-Store / Gas Station
- Full skill set including fuel operations (Section 5)
- Tobacco/alcohol compliance emphasis (Section 10)
- Lottery tracking (add to inventory)
- High shrink risk → loss prevention priority

### QSR / Fast Food
- Food service skills (Section 6) become primary
- Labor optimization critical (high turnover industry)
- Speed of service metrics (order-to-delivery time)
- Menu engineering replaces planogram

### Retail / General Merchandise
- Planogram and visual merchandising emphasis
- Seasonal inventory planning
- E-commerce integration if applicable
- Customer loyalty programs primary growth lever

### Liquor Store
- Age verification compliance critical
- Price optimization by brand/category
- Allocated/limited product management
- State-specific regulatory compliance

---

## Architecture Notes

- Each skill is a self-contained module that reads from connectors and outputs to the owner
- Skills compose — morning-briefing pulls from daily-flash, stock-pulse, cash-reconciler
- Skills run on schedules (cron) or triggers (threshold breaches)
- All skills report through AROS agent → owner via preferred channel (app, SMS, email, WhatsApp)
- AROS platform provides the runtime; skills are the brains
- Skills are the same across business types; **data connectors** change per POS/ERP system
- Connector abstraction: `RapidRMS Connector`, `Clover Connector`, `Square Connector`, etc.

---

*"An army's strength lies not in its size, but in the training of its soldiers." — Arthashastra 10.3*
