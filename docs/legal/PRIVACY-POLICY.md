# AROS Privacy Policy
**NirLab Inc | Effective Date: [EFFECTIVE_DATE] | Version 1.0**

> ⚠️ This policy covers global deployments. Have legal counsel review before publishing — requirements vary by jurisdiction and business type.

---

## 1. Introduction

NirLab Inc ("NirLab", "we", "us", "our") operates the AROS platform (Agentic Retail Operating System). This Privacy Policy explains how we collect, use, share, and protect information when you use AROS.

We take privacy seriously — not just as a legal requirement, but as a business value. Operator data is the foundation of what AROS does. We will never sell it, exploit it, or use it in ways operators don't expect.

---

## 2. Who This Policy Covers

This policy applies to:
- **Operators** — businesses that subscribe to and operate AROS
- **End Users** — employees and staff who interact with AROS on behalf of an Operator
- **Website visitors** — anyone visiting our marketing website or documentation

It does not cover the data that Operators collect from their own customers via their POS systems. Operators are responsible for their customers' privacy under their own privacy policies.

---

## 3. Data We Collect

### 3.1 Operator Account Data
- Business name, address, contact information
- Payment information (processed by Stripe; NirLab does not store card numbers)
- Subscription tier, billing history
- Connected integrations (RapidRMS, Clover, Square, DoorDash, etc.)

### 3.2 Business Operations Data
Data flowing through AROS from connected POS/business systems:
- Sales transactions (amounts, items, timestamps — no customer PII by default)
- Inventory levels and movement
- Labor schedules and shift data
- Void and refund records
- Review data (aggregated from connected review platforms)

### 3.3 AI Interaction Data
- Conversations with Ellie and other AROS agents
- Queries, questions, and responses
- Feedback signals (thumbs up/down on agent responses)
- Agent-generated insights and recommendations

### 3.4 Technical Data
- IP addresses, browser type, device type
- Usage patterns, feature usage, session duration
- Error logs and crash reports
- API request logs (retained 90 days)

### 3.5 Data We Do NOT Collect (by design)
- End-customer PII from POS systems (we receive transaction data, not customer identities)
- Biometric data
- Health information
- Social security numbers or government IDs
- Payment card numbers (Stripe handles these)

---

## 4. How We Use Data

### 4.1 Service Delivery
- Powering AROS agents (Ellie, Ana, Sammy, Victor, Larry, Rita)
- Generating P&L reports, anomaly alerts, and recommendations
- Training and improving agent responses for your specific business

### 4.2 Platform Improvement (Federated Learning)
We improve AROS platform intelligence using anonymized, aggregated patterns across operators. Key protections:
- **No individual operator data is shared** with other operators
- Benchmarking uses **k-anonymity** (minimum cohort size of 50) — no pattern is surfaced unless enough operators share it
- Operators can **opt out** of federated learning in Settings → Data → Platform Improvement
- Opted-out operators still benefit from platform improvements but do not contribute to them

### 4.3 Fine-Tuning AI Models
- Conversation data and feedback signals are used to fine-tune AROS AI models
- Fine-tuning data is attributed to your tenant but never surfaced to other tenants
- Operators can disable this in Settings → Data → AI Training Opt-Out

### 4.4 Communications
- Transactional emails (receipts, alerts, account changes)
- Product updates and release notes (opt-out available)
- Security and compliance notices (cannot opt out — required for service)

### 4.5 Legal & Safety
- Fraud detection and prevention
- Compliance with legal obligations
- Enforcement of our Terms of Service

---

## 5. Data Sharing

We do not sell personal data. Period.

We share data only with:

| Recipient | What | Why |
|-----------|------|-----|
| Infrastructure providers (AWS, etc.) | Encrypted operational data | Service delivery |
| Stripe | Payment information | Billing |
| Connected integrations (RapidRMS, etc.) | Only data you explicitly connect | Service delivery |
| Legal authorities | Only under valid legal process | Legal compliance |
| Acquirers (in M&A) | Business data under NDA | Business continuity |

We require all sub-processors to maintain equivalent data protection standards and execute Data Processing Agreements (DPAs).

---

## 6. Data Retention

| Data Type | Retention Period | Notes |
|-----------|-----------------|-------|
| Account data | Duration of subscription + 90 days | Extended to 7 years for financial/tax records |
| Business operations data | 2 years rolling | Configurable per tier |
| AI conversation data | 1 year | Shorter retention available on request |
| API logs | 90 days | |
| Payment records | 7 years | Legal/tax requirement |
| Deleted account data | 30 days grace period, then purged | Backups cleared within 90 days |

Operators can request earlier deletion for most data types. Some data must be retained for legal compliance.

---

## 7. Data Security

- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Databases isolated per tenant — no shared data stores between operators
- Access control: employees access operator data only on need-to-know basis, logged
- Annual security audits (target: SOC 2 Type II certification)
- Incident response: operators notified within 72 hours of a confirmed breach
- Bug bounty program: [security@nirlab.com]

---

## 8. Your Rights

### All Operators
- **Access** — request a copy of all data we hold about you
- **Correction** — request correction of inaccurate data
- **Deletion** — request deletion of your data (subject to legal retention requirements)
- **Portability** — receive your data in machine-readable format (JSON/CSV)
- **Objection** — object to specific processing uses (e.g., federated learning opt-out)

### Additional Rights by Jurisdiction (see Section 9)

To exercise rights: [privacy@nirlab.com] | Response within 30 days (15 days for EEA/UK requests).

---

## 9. Jurisdiction-Specific Requirements

### 9.1 United States

#### Federal
- **COPPA** — AROS is not directed at children under 13. We do not knowingly collect data from minors.
- **GLBA** — Not applicable (AROS is not a financial institution; payment processing via Stripe).
- **HIPAA** — Not applicable. AROS does not process Protected Health Information. Pharmacy vertical operators must not use AROS for prescription or patient data.
- **FTC Act** — We comply with FTC guidelines on unfair or deceptive practices.

#### State Laws

**California — CCPA/CPRA**
- California residents have additional rights: right to know, right to delete, right to opt-out of sale (we do not sell), right to non-discrimination
- Designated contact: privacy@nirlab.com | Toll-free: [PHONE_PLACEHOLDER]
- We do not sell or share personal information for cross-context behavioral advertising
- "Do Not Sell or Share" link on our website (required even though we don't sell)
- Data retention limits: we do not retain personal information longer than necessary
- Sensitive personal information: we do not collect or use sensitive PI as defined under CPRA

**Virginia — VCDPA**
- Virginia residents have rights to access, correct, delete, portability, and opt out of targeted advertising
- We do not engage in targeted advertising or profiling with legal/significant effects

**Colorado, Connecticut, Texas, Montana, Iowa, Indiana, Tennessee, Oregon, Delaware, New Hampshire, New Jersey, Nebraska, Maryland, Kentucky, Minnesota, Rhode Island, others adopting state privacy laws**
- We comply with applicable state privacy law requirements as they come into effect
- Contact privacy@nirlab.com for state-specific rights requests

**New York — SHIELD Act**
- We maintain reasonable administrative, technical, and physical safeguards for data of NY residents
- Breach notification: NY residents notified within required timeframes

#### BIPA (Illinois)
- AROS does not collect biometric identifiers or information. This section is a compliance acknowledgment.

---

### 9.2 European Economic Area (EEA) & United Kingdom — GDPR / UK GDPR

**Legal Bases for Processing**

| Processing Activity | Legal Basis |
|--------------------|-------------|
| Service delivery | Contract performance (Art. 6(1)(b)) |
| Security / fraud prevention | Legitimate interests (Art. 6(1)(f)) |
| Platform improvement (federated) | Legitimate interests (Art. 6(1)(f)) |
| Marketing communications | Consent (Art. 6(1)(a)) |
| Legal compliance | Legal obligation (Art. 6(1)(c)) |

**EEA/UK Specific Rights**
- Right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20), object (Art. 21)
- Right to lodge a complaint with your local supervisory authority
- Response time: 30 days (extendable to 60 with notice for complex requests)

**International Data Transfers**
- Primary data storage: United States
- For EEA/UK operators: we execute Standard Contractual Clauses (SCCs) as the transfer mechanism
- Data Processing Agreement (DPA) available upon request: privacy@nirlab.com

**Data Protection Officer (DPO)**
- Required for large-scale processing. NirLab will appoint a DPO or designated representative as required.
- Contact: dpo@nirlab.com [TO BE CONFIGURED]

**UK GDPR**
- UK operators: the UK ICO is the supervisory authority
- UK adequacy decisions apply to UK-US transfers under the UK-US data bridge (where applicable)

---

### 9.3 Canada — PIPEDA / Bill C-27 / Quebec Law 25

**PIPEDA (Federal)**
- We collect, use, and disclose personal information with consent
- Operators may request access to their personal information
- Breach notification: PIPEDA breach of security safeguards reporting requirements apply

**Quebec — Law 25 (Bill 64)**
- Privacy impact assessment (PIA) conducted for high-risk processing
- Operators can appoint a data protection officer — AROS provides data access to support this
- Cross-border transfer disclosure: data may be stored in the United States
- Consent mechanism: explicit consent required for non-essential processing

---

### 9.4 Australia — Privacy Act 1988 / Australian Privacy Principles (APPs)

- We comply with the 13 Australian Privacy Principles
- Cross-border disclosure: data may be transferred to the United States — we take reasonable steps to ensure equivalent protection
- Operators may request access and correction of their personal information
- Complaints: contact privacy@nirlab.com; if unresolved, the OAIC (Office of the Australian Information Commissioner) can be contacted

---

### 9.5 Brazil — LGPD (Lei Geral de Proteção de Dados)

- Legal bases for processing aligned with LGPD Art. 7 (contract, legitimate interest, legal obligation, consent)
- Data Subject rights: access, correction, deletion, portability, information about sharing, revocation of consent
- DPO (Encarregado): dpo@nirlab.com
- Data stored in the United States; transfers subject to LGPD Chapter V requirements
- ANPD (Autoridade Nacional de Proteção de Dados) is the supervisory authority

---

### 9.6 Mexico — LFPDPPP

- Notice and consent principles apply per LFPDPPP
- Operators have rights to access (acceso), correction (rectificación), cancellation (cancelación), and objection (oposición) — the "ARCO" rights
- Contact: privacy@nirlab.com
- INAI (Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales) is the supervisory authority

---

### 9.7 Additional Jurisdictions (Future Expansion)

| Region | Framework | Status |
|--------|-----------|--------|
| Japan | APPI (Act on Protection of Personal Information) | Monitor |
| South Korea | PIPA (Personal Information Protection Act) | Monitor |
| India | DPDP Act 2023 | Monitor — enacted, rules pending |
| Singapore | PDPA (Personal Data Protection Act) | Monitor |
| UAE | Federal DPL No. 45 of 2021 | Monitor |
| Saudi Arabia | PDPL (Personal Data Protection Law) | Monitor |

As AROS expands into these markets, this policy will be updated with jurisdiction-specific requirements.

---

## 10. Cookies and Tracking

AROS web UI uses:
- **Essential cookies** — session management, authentication (cannot opt out)
- **Preference cookies** — language, UI preferences (opt out available)
- **Analytics cookies** — usage patterns via privacy-preserving analytics (opt out available)

We do not use third-party advertising cookies or behavioral tracking for ad targeting.

Cookie consent: managed via consent banner on first visit, per applicable requirements (GDPR, CCPA, ePrivacy Directive).

---

## 11. Children's Privacy

AROS is designed for business operators and their staff. We do not knowingly collect data from individuals under the age of 16 (or higher age as required by local law). If we learn we've collected such data, we will delete it promptly.

---

## 12. Changes to This Policy

We'll notify operators of material changes:
- 30 days advance notice via email and in-app notification
- For material changes requiring new consent (GDPR), we will seek re-consent
- Policy version history maintained at [URL]/legal/privacy/history

---

## 13. Contact

**Privacy requests and questions:**
privacy@nirlab.com

**Data Protection Officer:**
dpo@nirlab.com

**Mailing address:**
NirLab Inc
[ADDRESS_PLACEHOLDER]

**Response SLA:** 30 days (15 days for EEA/UK requests)

---

*Copyright © 2026 NirLab Inc. All Rights Reserved.*
