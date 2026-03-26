# AROS — Customer Onboarding Guide

Welcome to AROS, your AI-powered retail operations platform. This guide walks you through getting started — from creating your account to having AI agents manage your store operations.

---

## What You'll Need

- A business email address
- Your store name and address
- Your POS system credentials (if connecting a point-of-sale)
- 10 minutes

---

## Step 1: Create Your Account

Visit your AROS portal URL (provided by your administrator or reseller).

1. Click **Create Account**
2. Fill in:
   - **Full Name** — your name
   - **Company Name** — your business name
   - **Email** — business email (this becomes your admin login)
   - **Password** — minimum 12 characters
3. Click **Sign Up**

You'll be redirected to the onboarding wizard automatically.

---

## Step 2: Verify Your Email

A 6-digit verification code is sent to your email.

1. Check your inbox (and spam folder)
2. Enter the code in the verification field
3. Click **Verify**

> If you don't receive the code, click **Resend Code** to get a new one.

---

## Step 3: Choose Your Plan

Select the plan that fits your business:

| Plan | Price | Stores | Users | AI Agents | AI Model | Best For |
|------|-------|--------|-------|-----------|----------|----------|
| **Free** | $0/mo | 1 | 1 | Local only | Ollama (on-device) | Trying AROS out |
| **Starter** | $49/mo | 1 | 3 | 5 agents | Haiku (fast) | Single-store operators |
| **Pro** | $149/mo | Up to 10 | Unlimited | 14 agents | Sonnet (advanced) | Multi-store chains |
| **Business** | $499/mo | Up to 50 | Unlimited | All agents | Full fleet | Enterprise & franchise |

- **Free plan** — no payment required, proceed directly to setup
- **Starter / Pro** — enter payment via Stripe checkout
- **Business** — contact our sales team for a custom setup

---

## Step 4: Set Up Your Business

Fill in your business details:

| Field | Description | Example |
|-------|-------------|---------|
| **Company Name** | Your business name | Casey's Corner Store |
| **First Store Name** | Your primary location | Casey's — Main St |
| **Industry** | Select from the dropdown | Convenience, Grocery, Liquor, Tobacco, QSR, Gas, Cannabis, Franchise, Other |
| **Number of Stores** | Total locations you operate | 3 |
| **Phone** | Business contact number | (555) 123-4567 |
| **Address** | Street, City, State, ZIP, Country | 123 Main St, Austin, TX 78701, US |

Click **Complete Setup** when done.

---

## Step 5: You're Live

After setup completes, you'll see a confirmation screen:

> "You're all set! AROS is configuring your AI agents now."

**If you chose managed hosting** — click **Go to Dashboard** to start using AROS immediately.

**If you chose self-hosted** — you'll receive a **License Key**. Copy it and either:
- Set it as an environment variable: `AROS_LICENSE_KEY=your-key-here`
- Save it to `~/.aros/license.key` on your server

Then follow the self-hosting guide on GitHub to deploy.

---

## Step 6: Connect Your POS System

Once you're on the dashboard, connect your point-of-sale system to unlock the full power of AROS.

1. Navigate to **Marketplace** from the sidebar
2. Find your POS connector (RapidRMS, Clover, Square, etc.)
3. Click **Install**
4. Enter your POS credentials when prompted:
   - For **RapidRMS**: Client ID, Email, Password
   - For **Clover**: Merchant ID, API Token
   - For **Square**: Access Token, Location ID
5. Click **Test Connection** — wait for the green checkmark
6. Select which **store locations** to sync
7. Click **Connect**

AROS will begin syncing your sales, inventory, and customer data. Initial sync may take a few minutes depending on data volume.

---

## Step 7: Meet Your AI Agents

Based on your plan and industry, AROS automatically assigns AI agents to your workspace:

| Agent | Role | What They Do |
|-------|------|-------------|
| **Ana** | Chief Data Officer | Analyzes your sales trends, inventory patterns, customer behavior |
| **Sammy** | Support Specialist | Answers your operational questions, troubleshoots issues |
| **Victor** | Security Analyst | Monitors for anomalies, flags suspicious transactions |
| **Larry** | Finance Lead | Tracks revenue, margins, cost analysis |
| **Rita** | Retail Intelligence | Pricing recommendations, promotion planning, demand forecasting |

You can add or remove agents anytime from the **Marketplace** tab.

---

## Step 8: Invite Your Team

1. Go to **Settings** from the sidebar
2. Click **Invite Members**
3. Enter team member emails and assign roles:

| Role | Access Level |
|------|-------------|
| **Admin** | Full access — settings, billing, all stores, all agents |
| **Store Admin** | Manage specific stores, view reports, chat with agents |
| **User** | View dashboards, ask questions, read-only access |

Invitations expire after 7 days. Resend if needed.

---

## Using AROS Day-to-Day

### Chat with Your Agents

The **Chat** page is your primary interface. Ask questions in plain English:

- "How were sales yesterday compared to last week?"
- "Which items are running low on inventory?"
- "Show me my top 10 customers this month"
- "Create a purchase order for items below reorder point"

Agents pull real-time data from your connected POS and respond with actionable insights.

### View Dashboards

The **Dashboard** page shows at-a-glance metrics:
- Daily/weekly/monthly sales totals with comparisons
- Inventory alerts and stock levels
- Employee performance
- Fuel pricing (if applicable)
- Customer loyalty stats

### Run Reports

Navigate to **Reports** to generate:
- Sales breakdown by category, time period, or store
- Inventory valuation and movement
- Employee shift summaries
- Promotion performance

---

## Managing Multiple Stores

If you operate more than one location:

1. Use the **Store Selector** to switch between locations
2. The **Comparison** page shows side-by-side metrics across stores
3. Agents automatically scope their answers to your selected store (or all stores if none selected)

---

## Budget & Cost Controls

AROS tracks AI usage costs transparently:

1. Go to **Settings > Costs**
2. Set daily, weekly, or monthly spending limits
3. View usage breakdown by agent and model
4. Receive alerts when approaching limits

---

## Getting Help

- **Chat with Sammy** — your support agent, available 24/7 in the chat
- **Email support** — contact your AROS administrator
- **Knowledge Base** — access from the Help menu in the sidebar

---

## Quick Reference

| Task | Where |
|------|-------|
| Ask a question | Chat page |
| View sales data | Dashboard |
| Connect a POS system | Marketplace > Install connector |
| Add an AI agent | Marketplace > Agents tab |
| Invite team members | Settings > Members |
| Set spending limits | Settings > Costs |
| Switch stores | Store Selector (top bar) |
| View reports | Reports page |

---

*Welcome to AROS. Your AI team is ready to work.*
