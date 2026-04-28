# Reality Check — Real-world Painpoints vs. CTEM Framework

**Date:** 2026-04-24
**Scope:** Strategic evaluation of whether building strictly to the Gartner CTEM framework actually addresses the painpoints security organisations face in 2024–2026.
**Method:** Synthesis of 78 independent sources — analyst surveys (Gartner, Forrester, ESG, IDC), vendor research (Verizon DBIR 2025, IBM X-Force, Wiz, Orca, CrowdStrike), practitioner blogs (Filigran, SoftwareAnalyst, Phil Venables, Allie Mellen), trade press (Dark Reading, CSO Online, TheHackerNews), and ISC2 / SANS / Ponemon workforce + breach studies.
**Reviewer perspective:** Strategic product positioning, brutal honesty over framework loyalty.
**Companion docs:**
- [`2026-04-ctem-framework-gap-analysis.md`](./2026-04-ctem-framework-gap-analysis.md) — framework-compliance audit
- [`../plans/2026-Q2-ctem-framework-alignment.md`](../plans/2026-Q2-ctem-framework-alignment.md) — current 90-day plan (likely needs revision per §9 of this doc)

---

## TL;DR — the uncomfortable truth in 4 lines

1. **CTEM is the 2022 frame for the 2018–2024 problem set.** It does not natively cover the four painpoints that dominate 2024–2026: identity, AI/agentic risk, supply-chain depth, and remediation execution.
2. **Only 16% of organisations have actually implemented CTEM** while **87% recognise its importance** [thehackernews.com 2026] — the largest framework-vs-execution chasm in the industry today.
3. The most accurate practitioner quote in any source we found: *"I've got enough tech that tells me what's wrong. I don't have enough tech that helps me fix it."* [softwareanalyst.io] — *this* is the real painpoint, not "I need a better dashboard."
4. **A "we are a CTEM platform" strategy is targeting the painpoints of 2022.** Organisations winning in 2026 are bolting four things onto CTEM that are not in CTEM: an identity stack, an AI/agent governance layer, a cyber-risk-quantification ($) translator, and a Risk Operations Center (RemOps) operating model.

---

## 1. Top 10 painpoints organisations actually face (2024–2026)

Ranked by severity × frequency. "CTEM addresses?" graded **Yes / Partial / No** with reasoning.

| # | Painpoint | Quantitative signal | CTEM addresses? |
|---|---|---|---|
| 1 | **Identity is the dominant attack vector** — credentials, MFA bypass, infostealers, NHIs | 60% of breaches involve stolen credentials; valid-creds give 85% intrusion ratio; identity loopholes drive ~90% of Unit 42's IR cases; **80% of identity breaches involve non-human identities**; 2 billion leaked credentials in 2025 [verizon.com, beyondidentity.com, industrialcyber.co, spycloud.com] | **Partial** — CTEM scoping/discovery can include identity surfaces, but the framework was designed for *exposure* (CVE, misconfig, attack-path) not *credential lifecycle*, session-token theft, or NHI rotation. ITDR / NHI-management is a parallel category, not a CTEM phase |
| 2 | **Mobilisation / remediation gap** — knowing what to fix ≠ getting it fixed | "Visibility is no longer the primary challenge — the gap is execution"; mobilisation is the most frequently failed CTEM stage; 60% say VM gets less attention than other IT projects [darkreading.com, hackateer.com, helpnetsecurity.com] | **No** — CTEM has a "mobilisation" stage in name, but Gartner explicitly says CTEM is a *framework, not an operating model*. Cross-team remediation ownership (Security ↔ IT ↔ Cloud ↔ App) is exactly where it stalls |
| 3 | **AI risk** — shadow AI, ungoverned AI, AI-powered attacks | 97% of AI-related breach victims lacked AI access controls; 63% have no AI governance; 20% of breaches now involve shadow AI (+$670K cost premium → $4.63M average); 41% cite AI as the #1 skill gap; 48% of pros rank agentic AI as the #1 attack vector for 2026 [ibm.com, isc2.org, darkreading.com] | **No** — CTEM scope predates the GenAI/agentic-AI explosion. AI-TRiSM is a separate Gartner category. CTEM has no native concept of model exposure, prompt-injection surface, agent identity, or training-data leakage |
| 4 | **Tool sprawl despite "consolidation"** | 76% of CISOs feel overwhelmed by tool-driven alert volume; 71% use >10 cloud security tools, 16% use >50; 60% rank consolidation as #1 priority [businesswire.com, techtarget.com, helpnetsecurity.com] | **Partial** — CTEM theoretically encourages aggregation, but each "CTEM platform" becomes another tool in practice. Wiz's own benchmark notes spend rising while teams "still struggle to keep up" |
| 5 | **Vulnerability prioritisation broken** — CVE/NVD breakdown + CVSS noise | 20,000+ CVEs in H1 2025 alone (3× growth); ~35% have public exploits; **NVD backlog of 24,000+ unenriched CVEs**; median patch time 32 days vs. 0-day mass exploitation on edge devices in hours [verizon.com, csoonline.com, technologyreview.com, securityweek.com] | **Partial** — CTEM's prioritisation stage names the problem but assumes upstream intel is reliable. With NVD broken and exploit timelines collapsing to hours, CTEM's quarterly-cycle assumption is mismatched to attacker tempo |
| 6 | **Third-party / supply-chain breaches doubled** | Third-party involvement in breaches doubled YoY to 30% (Verizon DBIR 2025); software supply-chain attacks averaged 28+/month in 2025 (peak 41 in Oct); 91% of CISOs report rising 3rd-party incidents; only 35% have integrated TPRM with other risk functions [verizon.com, industrialcyber.co, panorays.com, ncontracts.com] | **No / Partial** — CTEM scoping nominally includes "external attack surface" but vendor pipelines, SBOMs, sub-processors, Nth-party blast radius are TPRM/SCRM territory. CTEM offers no contractual, attestation, or continuous-vendor-monitoring primitive |
| 7 | **Skills crisis & burnout** | 95% of organisations cite at least one skills gap; 88% had a security incident attributable to skill deficiency; 48% of pros exhausted; 47% overwhelmed; 63% of CISOs witnessed/experienced burnout in past year; 29% of organisations cannot afford skilled hires [isc2.org, proofpoint.com] | **No** — CTEM by design requires *more* coordination across *more* disciplines, making the skills problem worse before better. No framework solves headcount |
| 8 | **Detection coverage gap (SIEM vs. ATT&CK)** | Enterprise SIEMs cover only **21% of MITRE ATT&CK techniques (79% blind)**; 13% of detection rules are non-functional; covers only 4 of the top-10 most-used techniques [helpnetsecurity.com, darkreading.com] | **No** — CTEM is *exposure* management (left of boom). Detection engineering & threat-informed defence (right of boom) live in a separate operating loop. CTEM does not produce or validate detections |
| 9 | **Board-CISO alignment & outcome metrics** | Boardroom alignment dropped from 84% to 64% (2024 → 2025); 68% of CISOs say leadership underestimates the threat; CISOs report tool/policy metrics, boards want dollar exposure & ROI [proofpoint.com, helpnetsecurity.com, evanta.com] | **Partial** — CTEM's "scoping" stage encourages business-aligned exposure framing, and Gartner's ODM (outcome-driven metrics) work is adjacent. But CTEM does not produce financial loss-exceedance curves boards need (that is CRQ — FAIR / Kovrr / Safe Security territory) |
| 10 | **OT/ICS, IoT, unmanaged-device blind spots** | 43% of organisations lack full visibility into IoT/OT/unmanaged; 21.5% of organisations had an ICS/OT incident in past year; 50% of OT incidents originated from unauthorised external access; only 13% have advanced remote-access controls [hackateer.com, mbtmag.com, dragos.com] | **Partial** — CTEM in principle covers OT scope, but most CTEM tooling is IT-centric. Active scanning is unsafe in OT; passive ICS-aware discovery (Dragos, Claroty, Nozomi) is a separate stack. CTEM's framework is aspirational here, not operational |

**Honourable mentions** (just missed top-10): insider risk ($17.4M average loss; 70% of IP theft within 90 days of resignation); ransom payment pressure (66% would consider paying); SEC personal-CISO liability (post-SolarWinds); geopolitical disruption (88% concerned about state-sponsored attacks; 74% investing in resilience).

---

## 2. What CTEM does well — five real wins

Not marketing fluff; genuine framework value:

- ✅ **Reframes VM** from "patch everything" to "fix what is actually exploitable in *this* environment." Reachability + runtime work (Orca, Endor, Wiz) reduces FPs by 70% and prioritisation time by 90% when properly integrated.
- ✅ **Continuous external attack-surface enumeration.** EASM/ASM as a credible CTEM sub-stage — forgotten subdomains, misconfigured S3, expired certs are visible in a way they were not in 2020.
- ✅ **Attack-path / "choke-point" thinking.** XM-Cyber-style graph analysis to find the 2% of issues that gate 90% of risk is the most defensible CTEM contribution.
- ✅ **Forces a continuous cadence.** Kills the "annual pentest + quarterly scan" model that dominated 2010s VM. Cymulate's 2025 validation report shows organisations running continuous validation reduce dwell time materially.
- ✅ **Common vocabulary for board conversations.** "Exposure" is more board-friendly than "vulnerability backlog." Helps CISOs translate operations to risk language.

---

## 3. Where CTEM fails real customers

For each gap: who fills it instead.

| Gap | Why the framework fails | Where customers bolt-on |
|---|---|---|
| **Identity-centric attacks** | No model for credential exposure, OAuth grant sprawl, session-token theft, MFA bypass, NHI rotation. Yet 60–90% of breaches start here | ITDR (CrowdStrike Falcon Identity), ISPM (SailPoint), NHI management (Token Security, Astrix) |
| **Cross-team remediation ownership** | Framework asserts "mobilisation" but is silent on operating model. Vendors are inventing the **"Risk Operations Center (ROC)"** specifically because CTEM-as-framework does not tell you who fixes what | Seemplicity, Cogent, Tonic — emerging "RemOps" category |
| **AI-native exposure** | Prompt-injection surfaces, model supply chain (HuggingFace), agent identity, training-data leakage, MCP-server exposure — none have first-class treatment in CTEM five stages | AI-SPM tools (Acuvity, Pillar), AI-TRiSM platforms |
| **Detection & response** | CTEM stops at "is this exposure reachable and important?" Does not produce a detection rule, a SOAR playbook, or a hunt query | SOC modernisation, Detection-Engineering-as-Code |
| **Software supply chain depth** | SBOM ingestion, transitive-dep risk, build-pipeline integrity, signing/attestation are not CTEM primitives, despite being where 30% of breaches now originate | SBOM tools (Anchore, Endor), build security (Chainguard) |
| **OT/ICS realities** | Discovery stage assumes scanners can probe — but OT environments forbid that | Dragos, Claroty, Nozomi (passive only) |
| **Cyber Risk Quantification ($)** | Boards want loss-exceedance curves; CTEM gives exposure scores | FAIR Institute methodology, Kovrr, Safe Security |
| **Insider / human risk** | 92% of data-loss CISOs cite departing employees; 45% of breaches are insider-driven. CTEM has no behavioural / DLP / UEBA primitive | Proofpoint ITM, Code42, Forcepoint |
| **Resilience & recovery (post-breach)** | CISOs ranked cyber resilience as #1 priority for 2025. CTEM is firmly left-of-boom; recovery, immutability, tabletop frequency are out of scope | Rubrik, Cohesity, Veeam (immutable backup) |
| **Geopolitical / nation-state risk modelling** | Forrester explicitly recommends quarterly *geopolitical* reviews — outside any CTEM stage | Recorded Future, Mandiant Intelligence |

**The pattern:** every gap above has 1–3 vendor categories thriving outside the CTEM framework. Customers have already voted — they do not believe CTEM covers these.

---

## 4. Critiques of CTEM itself — analyst & practitioner voices

The most uncomfortable signals from the corpus:

- 🔥 *"Polished frameworks…delivering little beyond rebranded scanning and dashboards."* [filigran.io] — Vendors are repackaging old VM/ASM as "CTEM platforms"
- 🔥 *"Only 16% of orgs have actually implemented CTEM while 87% recognise its importance."* [thehackernews.com 2026] — textbook framework-vs-execution chasm
- 🔥 *"We're rich in noise, poor in signal."* [filigran.io] — 96% of security teams cannot validate whether risks are exploitable; 2-in-3 lack a consolidated risk view
- 🔥 **Validation is the most-skipped stage** — and it is the only one separating CTEM from traditional VM. 67% cite scope limits, 66% time constraints, 65% missed exposures via manual testing [cymulate.com]. *If validation is skipped, CTEM collapses back to RBVM with new branding*
- 🔥 **Dark Reading headline:** *"Exposure Management Is at a Breaking Point, Forcing a Reset"* — the category is buckling under its own promise [darkreading.com]
- 🔥 **Practitioner quote of the year:** *"I've got enough tech that tells me what's wrong. I don't have enough tech that helps me fix it."* [softwareanalyst.io]
- 🔥 *"CTEM is not a capability vendors can simply 'deliver' — it's an internal operating model that organisations must design and own."* [filigran.io]
- 🔥 **The framework predates the threats it now claims to address.** Gartner introduced CTEM in 2022 — before ChatGPT, before agentic AI, before the NVD collapse, before the 3rd-party breach explosion. **The five stages are unchanged.**

**Verdict from the corpus:** CTEM is a *real and useful* framework for thinking, but currently *over-marketed* as both an operating model and a product category. It is in the **early Trough of Disillusionment** for buyers who tried to "deploy CTEM" by buying a tool — though it still sits firmly in vendor marketing's Peak of Inflated Expectations.

---

## 5. What security teams actually buy / build (2024–2026)

Budget signal from Wiz, Gigamon, Fortra, IANS, ISC2, Evanta, Gartner.

| Trending UP | Trending FLAT/DOWN |
|---|---|
| **Identity stack** — ITDR, ISPM, NHI management, passwordless (43% of CISOs prioritising IAM/MFA/ZT) | Standalone vulnerability scanners (commoditised) |
| **AI-powered detection & triage** (35% of CISOs investing) | Compliance-only spend ("lacking value despite steady investment") |
| **CNAPP / cloud security** (Wiz, Orca, Palo PA — fastest-growing line item) | Best-of-breed point tools (under consolidation pressure) |
| **DSPM & data security** (39% of CISOs prioritising DLP, up from 33%) | Pure-play SIEM (being absorbed into XDR / cloud-SIEM) |
| **Aggregator / exposure platforms** (Axonius, Seemplicity, Cogent, Tonic) | Standalone EASM (folding into broader exposure) |
| **AI security / AI-TRiSM** (AI Security Posture Management — emerging acronym) | Consulting-heavy services |
| **MSSPs** to stretch budget | |
| **Cyber Risk Quantification** (Safe, Kovrr, FAIR) for board reporting | |
| **Reachability-based prioritisation** (Endor, Oligo, Apiiro) | |
| **OT visibility** (Dragos, Claroty — #1 OT investment area for 50% of organisations) | |

**Macro:** Gartner forecasts security spend $213B (2025) → **$240B (2026), +12.5%** — an inflection up after 2025's slowest-growth year (4%). *But Wiz's own data shows CISOs feel they are "spending big and still losing ground."*

**The category practitioners actually want is "RemOps" — remediation operations — not more discovery.**

---

## 6. The "next layer" beyond CTEM — emerging signals

Where the framework is showing strain and what comes next:

1. **Risk Operations Center (ROC) / Cyber Risk Operations** — vendor-coined term filling CTEM's missing operating-model layer. Combines exposure feed + ticketing + SLA + cross-team accountability. Likely the next Gartner category
2. **AI-TRiSM + AI-SPM** — AI Security Posture Management; agentic-AI workloads will demand a separate scoping/discovery primitive (model registry, agent identity, MCP-tool inventory, prompt-injection testing)
3. **Identity-centric exposure (ISPM + ITDR + NHI Governance) as a co-equal pillar** with infrastructure exposure. The 82:1 NHI-to-human ratio breaks every CTEM scoping assumption
4. **Continuous threat-led validation (BAS + adversary emulation) collapsing into CTEM** — Pentera, SafeBreach, AttackIQ becoming default; "validation" stage is the differentiator
5. **Outcome-driven metrics (ODM) → Cyber Risk Quantification (CRQ)** — board pressure (and SEC materiality) is forcing CISOs to translate exposure scores → dollar loss curves. CTEM does not natively do this
6. **Resilience / recovery primacy** — "cyber resilience" became the #1 CISO priority in 2025. The next framework will be right-of-boom-aware (containment, immutable backup, tabletop tempo, regulator notification)
7. **Software supply chain & SBOM as a first-class telemetry stream** — CISA's 2025 SBOM minimum-elements update + 30% third-party breach rate force this to be its own programme
8. **Geopolitical risk modelling** — Forrester's Mellen and Phil Venables both pushing for quarterly geopolitical reviews; CTEM has no scoping primitive for this
9. **Agentic AI defenders fighting agentic AI attackers** — *"An agent that runs code perfectly 10,000 times in sequence looks normal."* Current SIEM/EDR are blind to this. Defensive pattern is barely defined
10. **Data-centric security (DSPM + data lineage)** — 35% of breaches involve shadow data; cost premium $5.27M; +291-day mean dwell. Data ≠ exposure to a host — CTEM has no data-flow primitive

**Strategic implication:** CTEM is best viewed as **the 2022 frame for the 2018–2024 problem set.** It does not natively absorb identity, AI, supply chain, data, or operating-model concerns that now dominate. **Building strictly *to* CTEM in 2026 is probably building one war behind.**

---

## 7. OpenCTEM — honest strategic position

### 7.1 Defensible strengths

- ✅ **Multi-tenant + RBAC + audit hash chain** — enterprise foundation rare in open source
- ✅ **Pentest module + AI triage hardened** — combined with CTEM = differentiator vs. Tenable / Qualys
- ✅ **Asset lifecycle (RFC-001)** — few competitors do it as well
- ✅ **CTIS schema** — vendor-neutral ingest format with potential for community adoption

### 7.2 Strategic weaknesses (must confront)

- ❌ **Following a 4-year-old framework.** "CTEM-compliant" alone → 2027 will leave us behind once "next-gen CTEM" / "RemOps" becomes a new Gartner category
- ❌ **No identity story.** 60–90% of breaches start from identity. Product has no IdP integration, no NHI discovery, no credential-exposure tracking
- ❌ **No AI-security story.** Customers are panicking about shadow AI + agentic AI. Product has AI triage (uses AI) but does not secure AI (defend AI)
- ❌ **No CRQ / $ translation.** Boards want dollar exposure. Product has 0–100 risk score → CTO loves it, CFO does not understand it
- ❌ **Workflow builder is the answer to the wrong question.** Customers are not short of workflow tools — they are short of *ownership clarity* and *Definition-of-Done enforcement*
- ❌ **30+ scanner adapters = a coverage race already lost** vs. Tenable / Rapid7. Differentiation does not come from "the 31st scanner"

### 7.3 Confirmed over-engineering (per prior gap-analysis audit)

Module system, LDAP stub, threat-actor matching stub, workflow-builder bloat, 5 notification channels, 126-permission RBAC, 8 compliance frameworks without assessment UI.

---

## 8. Recommended strategic pivot

The 90-day plan in [`../plans/2026-Q2-ctem-framework-alignment.md`](../plans/2026-Q2-ctem-framework-alignment.md) is **correct but insufficient**. Correct because it closes framework gaps. Insufficient because the framework itself is missing the painpoints that dominate 2024–2026.

### Proposed pivot

From **"CTEM-compliant platform"** → **"RemOps platform built on CTEM principles, extending into identity + AI + financial-risk."**

### Strategic positioning statement

> *"OpenCTEM helps you fix the right things — not just find them — across infrastructure, identity, and AI exposure, with measurable financial outcomes."*

### Pivot mapping — keep / cut / add

| Today | Action | Reason |
|---|---|---|
| Discovery + Prioritisation tooling | **Keep + harden** | Foundation is strong |
| Pentest module + AI triage | **Keep + market hard** | Real differentiator |
| Asset lifecycle (RFC-001) | **Keep + extend to identity** | Same pattern applies to NHI, OAuth grants |
| Workflow builder bloated | **Cut → 4 templates** | Wrong painpoint |
| 30+ scanner adapters | **Cut → 5 core + community repo** | Lost race |
| Compliance frameworks without UI | **Archive** | Dead weight |
| Module system | **Remove** | Zero real gating |
| **(NEW) RemOps layer** | **ADD** | Ownership + DoD + re-validation = real painpoint #2 |
| **(NEW) Identity exposure module** | **ADD Q3** | Painpoint #1 industry-wide |
| **(NEW) AI / agent governance** | **ADD Q4** | Painpoint #3, fastest growth |
| **(NEW) CRQ translator ($)** | **ADD Q4** | Board ask, gap CTEM does not cover |
| **(NEW) Supply chain depth** | **R&D Q4** | Painpoint #6, defensible scope |

### 12-month adjusted roadmap

**Q2 2026 (weeks 1–12)** — *Foundation alignment*
Keep the existing 90-day plan unchanged. Output = framework-compliant 22/25.

**Q3 2026 (weeks 13–24)** — *Beyond CTEM v1*
- **Identity Exposure module** — Okta + Azure AD discovery, NHI inventory, OAuth-grant sprawl, dormant accounts, MFA-coverage scorecard
- **RemOps layer** — Definition-of-Done enforcement on every ticket, ownership SLA worker, exception governance auto-reopen, ROC dashboard pattern
- **CRQ translator (MVP)** — convert internal risk score (0–100) → annualised loss expectancy ($), FAIR-lite formula, expose in board-facing reports

**Q4 2026 (weeks 25–36)** — *Next-gen positioning*
- **AI / Agent governance** — model registry, agent identity, MCP-tool inventory, prompt-injection test harness on findings
- **Supply-chain depth** — SBOM transitive-dep graph, build-pipeline integrity, signing attestation
- **Geopolitical risk module** — quarterly review template + Recorded-Future-style intel feed integration

**Q1 2027 (weeks 37–48)** — *Resilience layer*
- **Right-of-boom features** — tabletop tempo tracker, immutable backup posture check, regulator-notification readiness
- **Insider risk** — DLP integration, behavioural baseline (low priority unless customer pull)

---

## 9. Decisions needed before pivoting the plan

Five strategic calls. Each unblocks a workstream.

| # | Decision | Reviewer recommendation | Why |
|---|---|---|---|
| 1 | Primary customer segment | Mid-market (50–500 security headcount) | Mid-market buys "RemOps + CTEM-as-platform" together; enterprise buys best-in-class identity / CRQ separately |
| 2 | Geographic priority | SEA first, then global | SEA: identity priority is high (per CSA SEA reports), supply-chain priority lower; global needs CRQ + AI governance as table stakes |
| 3 | Open-source strategy | Open-core (paid identity / AI / CRQ modules) | Identity / AI security / CRQ have clear B2B value → paid; core CTEM stays free |
| 4 | Identity stack approach | Build Okta integration first; integrate ITDR vendor later | Build = slower but defensible IP; integrate = fast but creates dependency |
| 5 | Time-to-traction | 6-month investor / customer-pilot demo | If yes: cut scope drastically — focus identity + RemOps only. If no: ship full 12-month plan |

---

## 10. Bottom line — the uncomfortable truth

> Building a product to the CTEM framework is like learning chess from a 2018 book: still useful, still correct in principle, but opponents are now playing with 2025 engines you do not see. **CTEM is necessary, not sufficient.** The differentiator for 2026–2027 lies in **making CTEM operational** (RemOps) plus **bolting on the four layers outside CTEM** (Identity, AI, CRQ, supply-chain depth). Organisations that only ship "compliant with the 5 stages" will become commoditised by Q4 2026 when Gartner introduces "CTEM 2.0 / Cyber Risk Operating Model" on the next Hype Cycle.

The right strategic bet is not *more CTEM features*. It is *making CTEM the foundation, then shipping the operating-model and adjacent-domain layers customers are already paying other vendors to fill.*

---

## 11. Source URLs

78 sources fetched (2026-04-24). Grouped for navigability:

### Analyst & survey reports
1. https://www.sans.org/white-papers/sans-attack-surface-management-survey-2025
2. https://www.sans.org/white-papers/state-of-ics-ot-security-2025
3. https://www.sans.org/blog/sans-2025-state-ics-security-report-progress-pressure-path-resilience
4. https://www.dragos.com/blog/sans-state-of-ot-security-2025-what-the-data-tells-us
5. https://www.evanta.com/resources/ciso/survey-report/top-3-priorities-for-cisos-in-2025
6. https://www.evanta.com/resources/ciso/infographic/2025-ciso-leadership-perspectives
7. https://www.gartner.com/en/newsroom/press-releases/2025-06-09-gartner-identifies-strategic-focus-areas-for-cisos-amid-rising-hype-and-scrutiny
8. https://www.gartner.com/en/articles/2025-trends-for-security-and-risk-leaders
9. https://www.ibm.com/reports/data-breach
10. https://www.ibm.com/think/x-force/2025-cost-of-a-data-breach-navigating-ai
11. https://newsroom.ibm.com/2024-07-30-ibm-report-escalating-data-breach-disruption-pushes-costs-to-new-highs
12. https://www.isc2.org/Insights/2025/12/2025-ISC2-Cybersecurity-Workforce-Study
13. https://www.isc2.org/Insights/2025/12/ISC2-Publishes-2025-Cybersecurity-Workforce-Study
14. https://www.proofpoint.com/us/newsroom/press-releases/proofpoint-2025-voice-ciso-report
15. https://www.verizon.com/business/resources/reports/dbir/
16. https://www.verizon.com/business/resources/reports/2025-dbir-executive-summary.pdf
17. https://www.verizon.com/about/news/2025-data-breach-investigations-report

### Identity & NHI signals
18. https://www.beyondidentity.com/resource/verizon-dbir-2025-access-is-still-the-point-of-failure
19. https://industrialcyber.co/reports/identity-loopholes-drive-nearly-90-of-unit-42s-global-incident-response-report-2026-investigations-as-ai-boosts-attack-lifecycle/
20. https://spycloud.com/resource/report/identity-threat-report-2025/
57. https://cloudsecurityalliance.org/artifacts/state-of-non-human-identity-security-survey-report
58. https://cloudsecurityalliance.org/blog/2026/04/23/we-are-fixing-the-wrong-problem-in-non-human-identity-security
59. https://www.weforum.org/stories/2025/10/non-human-identities-ai-cybersecurity/
60. https://www.token.security/assets/the-ultimate-non-human-identity-security-guide

### Vulnerability + NVD breakdown
21. https://www.csoonline.com/article/4065137/cisos-advised-to-rethink-vulnerability-management-as-exploits-sharply-rise.html
22. https://www.helpnetsecurity.com/2025/11/28/hackuity-vulnerability-management-trends-report/
30. https://www.technologyreview.com/2025/07/11/1119370/cybersecurity-alarm-system-breaking-down/
31. https://www.securityweek.com/nist-still-struggling-to-clear-vulnerability-submissions-backlog-in-nvd/
32. https://thehackernews.com/2025/05/beyond-vulnerability-management-cves.html

### CTEM critique + practitioner voices
27. https://www.darkreading.com/cybersecurity-operations/exposure-management-is-at-a-breaking-point-thats-forcing-a-reset
33. https://thehackernews.com/expert-insights/2026/04/why-threat-intelligence-is-missing-link.html
34. https://thehackernews.com/2026/02/the-ctem-divide-why-84-of-security
35. https://thehackernews.com/2025/09/ctems-core-prioritization-and-validation.html
36. https://hackateer.com/ctem-solutions/
37. https://filigran.io/ctem-but-without-the-hype-turning-intel-and-validation-into-outcomes/
38. https://softwareanalyst.substack.com/p/market-guide-2025-evolution-of-modern
39. https://softwareanalyst.io/reports/market-guide-2025-evolution-of-modern-risk-and-exposure-management-platforms/
40. https://cymulate.com/uploaded-files/2025/04/Cymulate-Threat-Exposure-Validation-Impact-Report-2025.pdf
41. https://pentera.io/wp-content/uploads/2025/05/2025-state-of-manual-pentesting-survey-report.pdf
42. https://www.news4hackers.com/ctem-adoption-gap-widens-in-enterprise-security/

### Detection / SIEM coverage
25. https://www.helpnetsecurity.com/2025/06/09/siem-detection-coverage/
28. https://www.darkreading.com/cybersecurity-operations/siems-missing-mark-mitre-techniques

### Tool sprawl + budget
23. https://www.helpnetsecurity.com/2025/12/08/wiz-cybersecurity-spending-priorities-report/
24. https://www.helpnetsecurity.com/2025/12/29/ciso-risk-management/
43. https://www.gigamon.com/company/news-and-events/newsroom/survey-reveals-ciso-priorities-for-2025.html
44. https://www.businesswire.com/news/home/20241015843935/en/Gigamon-Survey-Reveals-CISO-Priorities-for-2025-Amid-Budget-Pressures-and-Rising-Cyber-Threats
45. https://www.iansresearch.com/resources/all-blogs/post/security-blog/2025/09/18/how-cisos-are-using-platforms-and-mssps-to-stretch-security-budgets
46. https://www.elisity.com/blog/2026-cybersecurity-budget-complete-enterprise-planning-guide

### AI risk + agentic AI
29. https://www.darkreading.com/threat-intelligence/2026-agentic-ai-attack-surface-poster-child
47. https://www.acuvity.ai/2025-state-of-ai-security/
48. https://www.businesswire.com/news/home/20251007675598/en/Acuvity-AI-Releases-2025-State-of-AI-Security-Report
49. https://www.metricstream.com/blog/shadow-ai-the-silent-cyber-risk.html
50. https://www.infosecurity-magazine.com/news-features/shadow-ai-governance-cisos/
51. https://www.csoonline.com/article/4143302/the-cisos-guide-to-responding-to-shadow-ai.html
61. https://blog.barracuda.com/2026/02/27/agentic-ai--the-2026-threat-multiplier-reshaping-cyberattacks
62. https://www.kiteworks.com/cybersecurity-risk-management/agentic-ai-attack-surface-enterprise-security-2026/
63. https://www.bvp.com/atlas/securing-ai-agents-the-defining-cybersecurity-challenge-of-2026

### Supply chain
52. https://industrialcyber.co/reports/software-supply-chain-attacks-surge-as-ransomware-groups-escalate-and-industrial-sectors-face-more-exposure/
53. https://www.cisa.gov/sites/default/files/2025-08/2025_CISA_SBOM_Minimum_Elements.pdf
54. https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/the-2025-software-supply-chain-security-report
55. https://deepstrike.io/blog/supply-chain-attack-statistics-2025
56. https://panorays.com/blog/2025-ciso-survey/

### Reachability & cloud
64. https://orca.security/lp/2025-state-of-cloud-security-report/
65. https://orca.security/resources/blog/dynamic-reachability-analysis/
66. https://www.endorlabs.com/learn/5-types-of-reachability-analysis-and-which-is-right-for-you

### Insider + geopolitical
67. https://www.kiteworks.com/cybersecurity-risk-management/hidden-enemy-within-decoding-the-2025-ponemon-institute-report-on-insider-threats/
68. https://www.syteca.com/en/blog/insider-threat-statistics-facts-and-figures
69. https://www.intelligentciso.com/2025/12/03/88-of-uk-and-us-organisations-concerned-about-state-sponsored-cyberattacks-as-national-threat-levels-surge/
26. https://www.helpnetsecurity.com/2026/01/19/cybersecurity-geopolitical-tensions/
70. https://www.recordedfuture.com/research/cyber-geopolitical-battlefield

### CRQ + board reporting
71. https://safe.security/resources/blog/world-economic-forum-cisos-quantify-cyber-risk/
72. https://www.kovrr.com/blog-post/communicating-cyber-risk-at-the-board-level-7-lessons-for-2025

### SEC / personal liability
73. https://perkinscoie.com/insights/update/sec-dismisses-cyber-disclosure-case-against-solarwinds-and-ciso
74. https://www.csoonline.com/article/3609804/what-cisos-need-to-know-about-the-secs-breach-disclosure-rules.html

### CISO leadership voices
75. https://cloud.google.com/blog/products/identity-security/cloud-ciso-perspectives-phil-venables-on-ciso-2-0-and-the-ciso-factory
76. https://www.philvenables.com/
77. https://www.forrester.com/blogs/author/allie_mellen/

### DSPM / data
78. https://www.zscaler.com/blogs/product-insights/secure-shadow-data-cloud-new-innovations-zscaler-dspm

---

## 12. Notes on source quality and disagreement

- **Verizon DBIR (30%) vs. Panorays (91%)** for third-party breach involvement measure different things — breach share vs. CISO trend perception. Both are valid; do not collapse.
- **ISC2 (47% overwhelmed) vs. Proofpoint (63% witnessed/experienced burnout)** — likely population/methodology differences, both signal "high."
- **TheHackerNews 16% CTEM-implementation vs. Hackuity 65% "fully adopted CTEM"** — sharp conflict; Hackuity's respondent base self-selected for VM maturity and respondents conflate "running CTEM" with "we have ASM + RBVM + scanning." Treat the **16% as the more honest signal**.
- Two URLs returned 403 on direct fetch (Dark Reading, HackerNews 2026); content there sourced via search summary rather than full fetch.
