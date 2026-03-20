# AROS Global Compliance Guide
**NirLab Inc | Version 1.0 | 2026-03-20**
> Reference for expansion planning. Legal review required before entering any new market.

---

## Quick Reference: Can AROS Operate Here?

| Market | Privacy Law | Employment/Labor AI | Age-Gated Sales | Readiness |
|--------|-------------|---------------------|-----------------|-----------|
| United States (federal) | CCPA/CPRA, state laws | NLRA, state AI employment laws | State-by-state | ✅ Ready |
| European Union | GDPR | EU AI Act | Country-specific | 🟡 GDPR ready; AI Act compliance needed |
| United Kingdom | UK GDPR | ICO guidance | UK law | 🟡 UK GDPR ready; adapt AI disclosures |
| Canada | PIPEDA / Bill C-27 / Quebec Law 25 | Provincial employment law | AGCO, provincial | 🟡 PIPEDA ready; Quebec addendum needed |
| Australia | Privacy Act 1988 (APPs) | FWA compliance | State/territory liquor laws | 🟡 Feasible with local addendum |
| Brazil | LGPD | CLT | ANVISA | 🟡 DPO + DPA needed |
| Mexico | LFPDPPP | LFT | Cofepris | 🟡 Feasible |
| Japan | APPI | Labor Standards Act | Liquor Tax Act | 🔴 Need local counsel |
| South Korea | PIPA | Labor Relations Act | Liquor License Act | 🔴 Need local counsel + data localization |
| India | DPDP Act 2023 | Industrial Disputes Act | Excise Acts | 🔴 Rules not final; monitor |
| Singapore | PDPA | Employment Act | Liquor Control Act | 🟡 Feasible |
| UAE | Federal DPL No. 45/2021 | UAE Labor Law | Municipality licenses | 🔴 Need local counsel |
| Saudi Arabia | PDPL | Saudi Labor Law | N/A (alcohol prohibited) | 🔴 Liquor vertical N/A |

---

## Critical Compliance Areas for AROS

AROS operates in the restaurant/retail space. Three regulatory areas are most relevant beyond basic privacy:

1. **Labor AI rules** — AROS (via Larry) provides labor cost analysis and scheduling recommendations
2. **Age-gated product sales** — AROS serves liquor stores and tobacco shops
3. **AI transparency** — operators must disclose AI use in certain jurisdictions

---

## 1. United States — Full Detail

### Privacy
**Covered in Privacy Policy Section 9.1** — CCPA/CPRA, VCDPA, state patchwork.

Key operational notes:
- CCPA "Do Not Sell" link required on all web properties accessible to California residents
- CPRA's sensitive PI rules: AROS processes employee data (schedules, labor hours) which may qualify — audit needed
- NY SHIELD Act: documented security program required ✅ (in progress)

### Labor AI Regulations (Larry Agent — High Priority)
Rapidly evolving area. Current status:

| Jurisdiction | Law | What it Requires | Impact on Larry |
|-------------|-----|-----------------|----------------|
| **New York City** | Local Law 144 (2023) | Bias audit + notice for automated employment decision tools | If Larry is used for hiring/firing decisions → audit required. AROS positions Larry as advisory only — **do not use for termination decisions** |
| **Illinois** | AEDT Act (proposed) | Disclosure + opt-out for AI in employment decisions | Monitor; advisory framing limits exposure |
| **California** | AB 1651 (proposed, 2025) | AI disclosure in workplace | Monitor |
| **Federal** | NLRA | Employees have right to organize; AI tools can't infringe | Larry must never be used to identify union activity or suppress organizing |
| **EU** | EU AI Act Art. 6 + Annex III | "High-risk" if used in employment decisions → conformity assessment, transparency, human oversight | **Critical**: Larry must be classified as "limited risk" (advisory only) to avoid high-risk obligations. System prompt must reinforce advisory-only use. |

**Mitigation:** Larry is always advisory. All scheduling changes require explicit operator confirmation. AROS Terms of Service prohibit using Larry for hiring, firing, or disciplinary decisions. UI must include disclosure: "Larry provides data analysis only. Employment decisions require human judgment."

### Age-Gated Products (Liquor/Tobacco Verticals)
- AROS does **not** perform age verification — that's the POS/operator's responsibility
- AROS inventory and sales data for liquor/tobacco is **never used for advertising** minors
- AROS does not provide compliance guidance for specific state/local liquor license requirements — operators must obtain their own legal compliance
- **Add to ToS:** "Operators using AROS in regulated industries (alcohol, tobacco, cannabis) are solely responsible for compliance with all applicable licensing, age verification, and reporting requirements."

### Cannabis (Future Vertical — High Caution)
- Cannabis is federally illegal in the US
- State regulations vary enormously
- **AROS does not currently support cannabis verticals**
- If adding: need per-state legal review, special data handling, and explicit exclusion from federated learning

---

## 2. European Union — GDPR + EU AI Act

### GDPR (Already Covered in Privacy Policy)
Key operational requirements:
- **DPA (Data Processing Agreement)** required for every EU operator ✅ (template needed)
- **SCC (Standard Contractual Clauses)** for US ↔ EU data transfers ✅ (execute with EU operators)
- **DPIA (Data Protection Impact Assessment)** required before processing employee data at scale (Larry), and before behavioral profiling (Sammy's pattern analysis)
- **DPO appointment**: required if processing employee data at scale or as a core activity — assess when EU operator count > 250

### EU AI Act (Effective August 2024; Requirements Phasing In)

The EU AI Act categorizes AI systems by risk:

| AROS Agent | Likely Risk Category | Reason | Obligations |
|-----------|---------------------|--------|-------------|
| Ellie (general assistant) | **Minimal / GPAI** | General purpose; no automated decisions | GPAI transparency + usage policy |
| Ana (inventory) | **Minimal** | Advisory only; no safety/rights impact | Basic transparency |
| Sammy (P&L) | **Minimal** | Advisory only; financial info, not decisions | Basic transparency |
| Victor (voids/fraud) | **Limited** | Used in worker monitoring context | Transparency disclosure to workers |
| Larry (labor/scheduling) | **Limited → High Risk risk if used in employment decisions** | Annex III: employment/workers management | **If used in employment decisions: High Risk — conformity assessment required**. Position as advisory to stay Limited. |
| Rita (reviews) | **Minimal** | No automated decisions affecting rights | Basic transparency |

**Critical for Larry:** EU AI Act Annex III classifies AI in "employment, workers management and access to self-employment" as **High Risk**. This includes tools for: monitoring and evaluating employees, determining access to employment, assigning tasks based on individual behavior.

**How to stay Limited Risk:** Larry must never be used to make employment decisions — only to provide data. System prompt, UI, and ToS must all reinforce this. Conformity assessment (costly) is required for High Risk systems.

**AI Act Transparency Obligations (all AI systems):**
- Users must be informed they are interacting with an AI when not obvious
- Ellie's chat interface must include AI disclosure
- Synthetic/AI-generated content (Rita's draft responses) must be marked

**Timeline:**
- February 2025: Prohibited AI practices apply
- August 2025: GPAI rules apply  
- August 2026: High-risk systems in Annex III apply
- August 2027: High-risk embedded AI in existing products

### ePrivacy Directive
- Cookie consent banner required ✅ (covered in Privacy Policy)
- Analytical/tracking cookies: opt-in required (not just opt-out) for EU users

---

## 3. United Kingdom

UK GDPR largely mirrors GDPR. Key differences:
- ICO (Information Commissioner's Office) is the supervisory authority
- UK Adequacy: US-UK data bridge exists but review status periodically
- UK AI regulation: currently principles-based (ICO guidance); no AI Act equivalent yet
- Employment law: Working Time Regulations 1998 — Larry must not recommend scheduling that violates WTR (48h weekly limit, rest breaks)

---

## 4. Canada

### Federal — PIPEDA
Currently in force. Bill C-27 (CPPA + AIDA) progressing through Parliament.

Key current requirements:
- Consent for collection, use, disclosure of personal information
- Openness principle: privacy policy must be clear and accessible
- Right of access and correction

### Bill C-27 / CPPA (Proposed)
- AIDA (Artificial Intelligence and Data Act): not yet enacted. Would require impact assessments for "high-impact AI systems"
- Monitor: if enacted, Larry and Victor may qualify as high-impact

### Quebec — Law 25
- Strictest in Canada; largely in force
- PIA required before deploying new tech using personal information
- Right to de-indexation
- Data localization: if data processed outside Quebec, operator must be informed
- Privacy officer designation: operators must designate a privacy officer

### Age-Gated Products (Liquor)
- AGCO (Ontario): strict compliance; AROS does not perform compliance functions
- Provincial variations across Canada

---

## 5. Age-Gated Verticals — Global Summary

| Country | Liquor | Tobacco | Cannabis | AROS Role |
|---------|--------|---------|----------|-----------|
| USA | State-by-state | FDA regulated | Federal illegal / state legal | Advisory data only; compliance = operator |
| Canada | AGCO + provincial | Federal + provincial | Legal (federal) | Advisory data only |
| UK | Licensing Act 2003 | TRPR | Illegal | Advisory data only |
| EU | Country-specific | EU Tobacco Directive | Country-specific | Advisory data only |
| Australia | State/territory | Plain packaging laws | State-by-state | Advisory data only |

**Universal position:** AROS never performs age verification. AROS never facilitates age-restricted sales. Operators are solely responsible for all licensing and compliance requirements. This must be explicit in ToS and reinforced in agent behavior.

---

## 6. AI Transparency — Global

| Jurisdiction | Requirement | AROS Response |
|-------------|-------------|--------------|
| EU AI Act | Disclose AI interaction when not obvious | UI disclosure: "You're chatting with Ellie, an AI assistant" |
| California AB 302 (chatbots) | Disclose bot identity | Done in UI |
| Illinois BIPA | Biometrics disclosure | N/A — AROS doesn't use biometrics |
| GDPR Art. 22 | Right not to be subject to purely automated decisions with legal effects | All agent outputs are advisory; humans confirm all decisions |
| General | Labeling AI-generated content | Rita's draft responses labeled as AI-generated |

---

## 7. Data Localization Requirements

Some countries require certain data to stay within national borders:

| Country | Requirement | Impact |
|---------|-------------|--------|
| Russia | Federal Law 242-FZ: personal data of Russian citizens must be stored in Russia | **High** — requires in-country hosting to serve Russian market |
| China | PIPL: personal information processing requires Chinese storage/transfer approval | **Very High** — China requires separate infrastructure |
| India | DPDP Act: data localization rules for sensitive data expected in implementing rules | Monitor |
| Germany | Banking/financial sector rules (BaFin) — not directly applicable | Low |
| Indonesia | GR 71 of 2019: strategic data must remain in country | Monitor |

**Recommendation:** For initial global launch, exclude Russia and China. They require separate infrastructure investments not justified until significant market demand exists.

---

## 8. Employment Law AI Compliance Checklist

For Larry specifically, before deployment in each market:

- [ ] Is Larry used only for advisory purposes? (No automated employment decisions)
- [ ] Does UI clearly state "for informational purposes only"?
- [ ] Does ToS prohibit using Larry for hiring/firing/disciplinary actions?
- [ ] Has a bias audit been completed (required: NYC, potentially EU)?
- [ ] Are workers informed that AI analyzes their scheduling/labor data? (EU, some US states)
- [ ] Are overtime calculations configured for local law (jurisdiction in operator profile)?
- [ ] Does Larry respect local rest-break laws (EU WTD, UK WTR, etc.)?

---

## 9. Launch Readiness by Market

### Phase 1 — Ready Now
- 🇺🇸 United States (federal + CCPA states)
- 🇨🇦 Canada (PIPEDA; Quebec addendum at launch)

### Phase 2 — 3-6 Months
- 🇬🇧 United Kingdom (UK GDPR + AI disclosures)
- 🇦🇺 Australia (Privacy Act addendum)
- 🇲🇽 Mexico (LFPDPPP addendum)

### Phase 3 — 6-12 Months
- 🇪🇺 European Union (GDPR DPA + EU AI Act compliance + DPO)
- 🇧🇷 Brazil (LGPD + DPO designation)
- 🇸🇬 Singapore (PDPA addendum)

### Phase 4 — Research & Local Counsel Required
- 🇯🇵 Japan
- 🇰🇷 South Korea
- 🇮🇳 India (DPDP implementing rules pending)
- 🇦🇪 UAE
- 🇸🇦 Saudi Arabia (liquor vertical N/A)

---

## 10. Ongoing Compliance Calendar

| Cadence | Activity |
|---------|----------|
| Quarterly | Review new US state privacy law enactments; update policy |
| Semi-annually | EU AI Act timeline check; update Larry risk classification if needed |
| Annually | Full privacy policy review; DPIA refresh; trade secret audit |
| On market entry | Local counsel review; DPA/SCC execution; regulatory registration if required |
| On incident | 72h GDPR breach notification; state-specific notification timelines |

---

*Copyright © 2026 NirLab Inc. Confidential. Do not distribute externally without legal review.*
