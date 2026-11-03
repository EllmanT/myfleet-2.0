# myFleet: legal and compliance notes before public sign-ups

Date: 2026-11-03. Status: founder research notes.

**This is research, NOT legal advice.** It was compiled from web sources (some secondary, some blocked or unreadable) and general knowledge. Anything marked **[UNVERIFIED]** was not confirmed against a primary source. Laws, regulations and regulator notices in this area change quickly. Have a Zimbabwean lawyer (ideally one with ICT/data protection experience) review the items in section 9 before you take public sign-ups.

---

## 0. What myFleet actually does with data (the facts the law attaches to)

| Data | Whose | Notes |
|---|---|---|
| Jobs, customers, invoices, payments records | Your customer (the fleet business), and *their* customers | Business data, some personal (contact names, phone numbers) |
| Driver names, ID numbers, licence details, phone numbers | Drivers (individuals) | Personal data; national ID numbers are high-sensitivity in practice |
| Photos of handwritten logbooks | Mixed (may include driver names, signatures, vehicle regs, customer names) | Sent to Anthropic's Claude API for reading |
| Login identity | Users | Clerk (US) |
| Hosting | all | Vercel (US/global edge), MongoDB Atlas (region matters) |

Key framing: for your customers' data, **the fleet business is typically the "data controller" and myFleet is the "processor/operator"**. For your own user accounts, billing and marketing lists, **myFleet is itself a controller**. Many Southern African laws, including Zimbabwe's, split duties between these roles, so you probably have both sets of duties. (Role definitions: confirm with lawyer.)

---

## 1. Zimbabwe: Cyber and Data Protection Act (2021)

### 1.1 What it is
- Cyber and Data Protection Act [Chapter 12:07] (Act 5 of 2021, republished 11 March 2022). Gazetted text: https://veritaszim.net (PDF "Cyber & Data Protection Act Cap1207 No 5 of 2021 gaz 2022-03-11") and https://zimlii.org/akn/zw/act/2021/5/eng@2022-03-11/source
- Overview: https://www.michalsons.com/blog/zimbabwes-cyber-and-data-protection-act-overview/78795
- Regulations: **SI 155 of 2024 (Cyber and Data Protection (Licensing of Data Controllers and Appointment of Data Protection Officers) Regulations)**, launched 13 September 2024. Summary: https://www.dlapiperafrica.com/zimbabwe/insights/2024/A-Quick-Start-Guide-to-Zimbabwes-Data-Protection-Regulations (also at afriwise.com/blog/a-quick-start-guide-to-zimbabwes-data-protection-regulations). Critique: https://zimbabwe.misa.org/2024/11/09/misa-zimbabwe-analysis-and-position-on-new-data-regulations

### 1.2 Regulator
- **POTRAZ** (Postal and Telecommunications Regulatory Authority of Zimbabwe) is designated as the Data Protection Authority. MISA questions its independence from government (see MISA link above). The Act also gives a role to the Cyber Security and Monitoring Centre.

### 1.3 Registration / licensing (the single most practical duty)
- Under SI 155, entities processing personal data (commercial purposes) must apply for a **Data Controller licence** to POTRAZ using **Form DP1** with fees. Controllers are tiered by number of data subjects (Tier 1 = roughly 50 to 1,000 subjects; Tier 4 = over 500,000; middle tiers not confirmed). Source: DLA Piper link above.
- Licences last 12 months, renewal to be applied for ~3 months before expiry. POTRAZ has 14 days to approve or reject. Existing controllers had a grace period to about March 2025. (DLA Piper.)
- Application asks whether data is stored in Zimbabwe or abroad (DLA Piper), which matters for you (Vercel/Atlas/Anthropic/Clerk are offshore).
- Data Protection Officer (DPO) appointment duty with qualifications; the 90-day timeline is reported by DLA Piper. Whether a tiny controller (Tier 1) must appoint a full DPO, and whether this can be the founder, **[UNVERIFIED]; ask lawyer**.
- Enforcement signals: a trade report says POTRAZ is targeting unlicensed handlers and plans inspections from 1 September 2026 **[UNVERIFIED: page returned 403 to me; seen only via search snippet]**: https://meatechwatch.com/2026/03/25/data-crackdown-looms-potraz-targets-unlicensed-data-handlers/
- **Fee amounts: not found. [UNVERIFIED]** Check POTRAZ website / call them.

### 1.4 Lawful basis, consent, principles
- Processing needs a lawful basis (consent, contract, legal obligation etc.), must be for a specified purpose, minimal, accurate, and secured. Children's data needs parent/guardian consent (DLA Piper). Solely-automated decisions with significant effect need consent or a legal basis (DLA Piper). myFleet's AI only transcribes for human review (Phase 5 design: "review before saving"), which keeps it away from automated decision-making; keep it that way and say so.
- Exact section numbers and wording of the consent standard: read the gazetted Act.

### 1.5 Data subject rights
- The Act gives access/correction/objection type rights; commentators call them "limited" (Michalsons). I could not extract the detail **[UNVERIFIED]**. Practical rule: have a way to export, correct and delete a person's data on request, within ~30 days.

### 1.6 Breach notification
- Report to POTRAZ **within 24 hours** of becoming aware (DLA Piper; confirmed in search). Notify affected individuals within **72 hours** where high risk (DLA Piper). MISA notes the Act's s.17 itself is silent on when to notify subjects; the SI may fill that gap. Treat 24h/72h as the working standard, **lawyer to confirm**.

### 1.7 Cross-border transfers (relevant: you transfer to the US)
- Section 28: no transfer to a third party in a foreign country unless an **adequate level of protection** is ensured (assessed by nature of data, destination law etc.); s.28(3) lets the authority prohibit categories of transfer; s.29 lists exceptions (e.g. consent, necessity). Source: secondary summaries, MISA data library https://data.misa.org/en/entity/28jfydpjr4c?page=32 , UWC thesis https://uwcscholar.uwc.ac.za/items/f096843a-947f-400c-8790-fc0c42b455f2 . One summary says POTRAZ must be notified before transfer **[UNVERIFIED]**.
- No published list of "adequate" countries was found **[UNVERIFIED]**. Practical stance: (a) disclose the offshore transfers and get explicit consent/acknowledgement in Terms and Privacy Policy; (b) have written data-processing terms with each subprocessor (section 3.4); (c) state storage location on your POTRAZ application; (d) choose a MongoDB Atlas region deliberately and record it.

### 1.8 Penalties
- Fines and imprisonment exist for offences; amounts not found **[UNVERIFIED]**. Non-renewal/non-licensing may attract "substantial penalties" (DLA Piper) without figures. The Act is mainly criminal; civil remedies for data subjects are limited (UWC thesis).

### 1.9 What this means for a small SaaS in practice
1. Apply for a POTRAZ data controller licence (as myFleet for your own account/billing data, and ask lawyer whether you also need it as processor for customer data).
2. Decide a DPO/contact person and publish an email (privacy@...).
3. Written privacy policy + processor terms (DPA) with customers.
4. Offshore-transfer disclosure and subprocessor list.
5. Breach playbook that can hit the 24-hour POTRAZ clock (who decides, template, contact route).
6. Data-minimisation: do you actually need driver national ID numbers? If not, make the field optional and discourage it.
7. Deletion and export tooling (see section 3.6).

---

## 2. Other countries as you expand (short comparison)

All entries are from general knowledge unless linked; **verify every row [UNVERIFIED] before entering that market.** Applicability depends on where the *data subject or controller* is, not where myFleet is based.

| Country | Law | Regulator | Applies to myFleet? | Notable points |
|---|---|---|---|---|
| South Africa | POPIA (Act 4 of 2013), fully in force July 2021 | Information Regulator | Yes if processing data of SA customers/drivers, or using automated means in SA; operator duties apply | Operator must have written contract with responsible party; breach notification "as soon as reasonably possible"; cross-border transfer rules (s.72); registration of Information Officer; fines up to R10m / imprisonment |
| Zambia | Data Protection Act No. 3 of 2021 (and Cyber Security Act / Cyber Crimes Act 2021) | Zambia Data Protection Commission | Likely yes for Zambian data subjects | Registration of controllers/processors; localisation/transfer conditions; check current regs |
| Mozambique | No comprehensive data protection act known to me; constitutional privacy plus telecom/e-transactions rules | Unclear | Probably low formal exposure but verify; a Data Protection Bill has been discussed | Treat as "follow best practice, ask local counsel" |
| Botswana | Data Protection Act 2018 (in force 2024) | Information and Data Protection Commission | Yes for Botswana data subjects | Cross-border transfer needs adequacy or safeguards; registration/notification duties |
| Namibia | Data Protection Bill has been in draft for years; not confirmed enacted | n/a | Probably no comprehensive law yet; verify | Follow general principles |
| Kenya/Tanzania/Uganda (East Africa) | Kenya DPA 2019; Uganda DPPA 2019; Tanzania PDPA 2022 | ODPC (KE), PDPO (UG), PDPC (TZ) | Yes when customers/drivers are there | Kenya and Tanzania require registration; do this analysis per country later |

Simple strategy: build to the strictest common denominator (POPIA / Zimbabwe CDPA): written processing terms, subprocessor transparency, breach process, deletion/export. That covers most of the region. Do not market in a new country until that country's registration question is answered.

---

## 3. Policies and AI-processing disclosure

### 3.1 Privacy Policy must contain
- Who you are (legal entity, address, contact, DPO/privacy contact).
- Role: controller for account data; processor for customer business data (and say the customer is controller of its drivers' and customers' data).
- Categories of data collected (account, driver details, ID numbers, logbook photos, usage/log data).
- Purposes and lawful basis for each.
- Who receives it: subprocessors list (3.4), and statement of offshore transfers with countries.
- Retention periods (3.5) and deletion process.
- Data subject rights and how to exercise (include drivers; point them to their employer-customer as first contact).
- Security measures (summary only, no overpromising).
- Breach notification commitment.
- Children (not intended for under-18s).
- Cookies/analytics if any.
- Changes to policy and complaint route (POTRAZ).

### 3.2 Terms of Service must contain
Service description; eligibility (business use); accounts and security; customer responsibility for lawfulness of the data it uploads, including **having the right to upload drivers' personal data and photos**; fees, trial, billing and cancellation (section 4); acceptable use; AI-feature terms; IP and licence to data (customer owns data, grants limited licence to operate service); availability (no guarantee / best efforts, no SLA unless you want one); liability cap and exclusions (lawyer to ensure enforceable under Zimbabwean law); indemnity; suspension/termination; data export on exit; governing law (Zimbabwe), dispute route; changes to terms; contact. Add a short **data processing addendum** clause.

### 3.3 Acceptable Use
No illegal activity or uploading data you have no right to; no scraping/reverse engineering; no sharing accounts; no uploading highly sensitive content unrelated to fleet operations (medical, biometric, children, other IDs); no abusive/spam use; no attempts to break security; we may suspend. Keep to half a page.

### 3.4 AI processing disclosure (what to say)
Plain wording, shown in Privacy Policy **and at the point of upload** (a one-line notice + link):
- Logbook photos you upload to the AI import feature are sent to Anthropic, a US AI provider, via its commercial API, to read the handwriting.
- The AI output is a suggestion; **you review and confirm before anything is saved**. It can be wrong.
- What may appear in photos (names, vehicle numbers, signatures); upload only what you have the right to; avoid photographing unrelated ID documents.
- Anthropic's terms: not used to train its models by default; short backend retention (below).
- How long we keep the original photo (our retention choice) and how to delete it.
- Opt-out: feature is optional; manual entry remains available.
- Consider a per-company AI toggle (you already have per-company module toggles) and record consent/acceptance at first use.

### Anthropic facts (as found 2026-11-03)
- **Training:** Anthropic's API retention page states "Retained data is never used for model training without your express permission": https://platform.claude.com/docs/en/manage-claude/api-and-data-retention . Commercial Terms also say Anthropic may not train on customer content from the services (seen via secondary summary; **read https://www.anthropic.com/legal/commercial-terms yourself [UNVERIFIED directly]**).
- **Retention:** Anthropic's commercial retention article says API inputs and outputs are automatically deleted within **30 days** of receipt/generation, with exceptions (files stored via Files API, ZDR agreements, Usage Policy enforcement, legal requirements): https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data . The platform retention page, however, says conversation content is "not retained by default" except for certain "Covered Models" requiring 30-day retention, i.e. the pages describe retention slightly differently and may reflect different dates or model-specific rules. **Tell customers "up to 30 days" and re-check which model you use.** One blog claimed a cut to 7 days; I could not verify it.
- **Zero data retention:** available by arrangement for eligible customers; not default.
- **DPA:** Anthropic offers a Data Processing Addendum with its Commercial Terms (auto-incorporated per my understanding) **[UNVERIFIED]**. Download/keep a copy for your records.
- **Usage Policy:** your customers' use must comply with Anthropic's Usage Policy (flow down in Acceptable Use).

### 3.5 Subprocessors list (publish this; keep it updated)

| Subprocessor | Purpose | Location | Data | Terms to check |
|---|---|---|---|---|
| Clerk | Sign-in/identity | US | Names, emails, phone, auth metadata | Clerk DPA and privacy policy on clerk.com **[UNVERIFIED: not fetched]** |
| Vercel | App hosting, edge, logs | US/global | Requests, logs, possibly uploads in transit | Vercel DPA (vercel.com/legal/dpa) **[UNVERIFIED]** |
| MongoDB Atlas | Database | Region you selected | All business and driver data | MongoDB DPA / Atlas terms **[UNVERIFIED]** |
| Anthropic | AI logbook reading | US | Logbook photos | Commercial Terms + DPA (above) |
| Email provider (not yet chosen, e.g. Resend/SendGrid) | Transactional email | varies | Email addresses, message content | Sign the DPA of whichever you use |
| Image/file storage (if separate from Vercel/Atlas; check what the app uses) | Photo storage | varies | Logbook photos | Confirm in code review |

Action: collect and file each DPA; note date accepted. Notify customers of changes (e.g. 14 days notice by email).

### 3.6 Retention and deletion (suggested defaults for lawyer to approve)
- Account and business records: for life of the account + 90 days after cancellation, then delete or anonymise; offer export first.
- Financial records customers need: Zimbabwean tax law generally requires businesses to keep records for years (commonly cited **6 years under Income Tax Act / VAT Act [UNVERIFIED]**). That obligation is the customer's, but tell them to export before deleting, and consider whether your invoice data must be retained for the customer's compliance.
- **Logbook photos:** keep only as long as needed for review (suggest delete original image 30 to 90 days after the import is confirmed, or on customer request), because the structured record is what matters. Technical implication: add a deletion job and a "delete this upload" button (research only; no code was changed).
- Backups: say they roll off within e.g. 35 days.
- Logs: e.g. 90 days.
- On a driver's deletion request: route via the customer; delete or anonymise within 30 days unless a legal reason applies.
- Anthropic's side: 30 day rolling deletion (above).

---

## 4. Free trial, guarantee, refund wording

Zimbabwe's Consumer Contracts Act and Consumer Protection Act exist (the Consumer Protection Act was in bill/early stage; **[UNVERIFIED] current status**); myFleet sells to businesses, which weakens consumer-law exposure but does not remove the duty to be clear and not misleading. General principles:
- State the trial length, whether a card or payment is required (none today), and **what happens at the end** (account moves to read-only or suspends unless a plan is chosen; data kept for X days, export always possible).
- Do not auto-charge. Since payment is manual, say: "We will never charge you automatically. We will send an invoice."
- State price in USD, what it includes, billing period, how to pay (EcoCash/bank), and the exchange-rate or fee position (who bears EcoCash/bank charges).
- Refund wording must be specific. Suggestion: "If you pay for a month and are not satisfied, tell us within 7 days of payment and we will refund that month's fee in full. After 7 days, fees for the current month are not refundable but you can cancel before the next month." Only offer a "money-back guarantee" if you will honour it; use the exact period.
- Avoid "unlimited", "guaranteed", "100% accurate" claims.
- Price-change notice: 30 days by email.
- Lawyer to confirm limits on excluding refunds and any cooling-off rules.

Template:
> **Free trial.** Your first [X] months are free. No card and no payment details are needed. When the trial ends we will tell you before anything changes. You choose whether to keep going. If you do not, your account becomes read-only for [30] days so you can export your data, then it is deleted as described in our Privacy Policy.

---

## 5. Invoicing and tax

### 5.1 ZIMRA fiscalisation (FDMS)
- ZIMRA says VAT-registered operators must fiscalise under **SI 104 of 2010**, and states that fiscalisation under s.90 Income Tax Act also covers taxpayers below the USD 25,000 VAT registration threshold. Fiscal tax invoices must be produced via a fiscal device integrated with the **Fiscalisation Data Management System (FDMS)**. Source: https://www.zimra.co.zw/domestic-taxes/corporate/fiscalisation-explained
- "Virtual fiscalisation" lets a taxpayer's own server, or its accounting/POS system, interface to FDMS via free ZIMRA APIs; the solution can be built in-house or by a third party. ZIMRA's page sets **no specific rules for invoicing software providers** beyond FDMS compatibility, and hardware devices come from ZIMRA-approved suppliers (same source).
- 2025 updates: Public Notice 30 of 2025 required buyer details on fiscal invoices/debit/credit notes sent to FDMS from 1 June 2025; later notices on TaRMS-FDMS integration (https://www.fiscal-requirements.com/news/3942-zimbabwe-mandates-fiscal-device-upgrade-for-buyer-detail-transmission ; https://www.e-invoice.app/country/ZW). Non-fiscal invoices reportedly cannot support input-tax or expense claims. Secondary sources; **[UNVERIFIED] against ZIMRA notices**.
- **Implication for myFleet (my reading, not settled):** an invoice generated in myFleet is an **operational/commercial document, not a fiscal tax invoice**, unless it is submitted through a fiscal device/VFD to FDMS. Customers who are required to fiscalise may still need their own fiscal device or an FDMS-integrated system for the legal tax invoice. If customers use myFleet invoices as their tax invoices, they may be non-compliant, and **you could face reputational and possibly contractual exposure** if you imply otherwise.
- What to tell customers (suggested): "Invoices and quotations created in myFleet are business documents. They are not ZIMRA fiscalised tax invoices. If you are required to issue fiscal invoices, you must issue them through your fiscal device or FDMS-approved system. We are looking at an integration." Put this in the Terms and next to the Invoice screen.
- Whether you yourself need approval as a fiscal software provider if you add FDMS integration later: **unknown; ask ZIMRA/lawyer before building it**.

### 5.2 VAT on myFleet's own sales
- Registration threshold USD 25,000 annual taxable turnover per ZIMRA and secondary sources; some sources mention a different rate/threshold tiers **[UNVERIFIED]**. VAT standard rate: 15% historically; one source says 15.5% from 1 Jan 2026 **[UNVERIFIED; check ZIMRA]**. Business Times on the low threshold: https://businesstimes.co.zw/the-impact-of-zimbabwes-low-vat-threshold-on-small-businesses/
- Once registered you must charge VAT on SaaS supplied in Zimbabwe, issue fiscal invoices from a fiscal device, and file returns. Whether services supplied to customers in other countries are zero-rated (exported services), and whether imported digital services rules (e.g. you paying VAT on foreign services like Vercel) apply: **[UNVERIFIED], accountant to advise**.
- Also consider: income tax, and **foreign-currency (USD) receipts**, where Zimbabwe has had multi-currency rules and exchange-control reporting. Ask your accountant/bank how to treat USD EcoCash/bank receipts, and whether you need a company registered (Registrar of Companies) and ZIMRA tax clearance.
- Prices shown: say whether they are VAT-inclusive.

---

## 6. Payments and mobile money

- myFleet records that a payment happened; it does not hold, move, or process money. Licensing under the National Payment Systems Act (Reserve Bank of Zimbabwe) targets payment system operators, payment service providers and mobile money issuers. **Recording-only should generally fall outside licensing**, but this is my reading **[UNVERIFIED]**; confirm with a lawyer, especially if you later add EcoCash/Paynow integrations, reconciliation that touches customer funds, or "pay now" links (then rely on a licensed aggregator like Paynow and never hold funds).
- For your own receipts via EcoCash/bank: you are just a merchant being paid. Keep records, issue invoices, and handle tax (5.2).
- Anti-money-laundering: you are not a financial institution, but keep payment records and do not accept third-party/unexplained payments.
- Do not display customers' bank or mobile-wallet details in ways that expose them, and secure payment-reference data like personal data.

---

## 7. Marketing, testimonials, AI claims

- **Facebook/WhatsApp groups:** posting in groups is generally fine, but follow each group's rules and Meta/WhatsApp policies. WhatsApp Business policy requires opt-in for business-initiated messages (https://business.whatsapp.com/policy , **[UNVERIFIED: not fetched]**). Do not add people to groups or bulk-message numbers collected from elsewhere. Keep a record of who opted in, give an unsubscribe route, and don't buy lists. Zimbabwe's CDPA also treats direct marketing as processing that needs a lawful basis; lawyer to confirm the exact consent rule **[UNVERIFIED]**.
- **Testimonials and case studies:** get written permission (email is fine) stating exactly what you will publish (name, company, quote, numbers, logo) and where. Keep it and let them withdraw. **Allea Worldwide Logistics is the owner's own company:** that is allowed, but disclose the relationship ("our founder's own fleet business") so it does not read as an independent endorsement, and make sure any figures are true and reproducible. Undisclosed self-testimonials are a misleading-advertising risk (the Advertising Regulatory/Consumer rules, plus Meta ad policies).
- **AI accuracy claims:** do not claim "99% accurate" or "reads any handwriting" unless you have measured it on real logbooks and can show the test. Say "reads many handwritten logbooks and shows its work for you to check and correct before saving." Mention that handwriting varies and results need review. Keep a test log (sample size, error rate) as evidence for any number you publish.
- Comparative claims and "first in Zimbabwe" style claims need evidence.
- Trademark: check "myFleet" availability with ZIPO before investing in the brand; the name is generic and may be taken **[UNVERIFIED]**.

---

## 8. Launch checklist ordered by risk

**Tier 1: before the first outside sign-up**
1. Lawyer review of Terms, Privacy Policy, DPA clause (section 9).
2. POTRAZ data controller licence application (Form DP1), or documented advice that you do not need one yet.
3. Privacy Policy, Terms and Acceptable Use live; users must accept at sign-up (checkbox, timestamp stored).
4. AI processing notice at upload, plus consent record; per-company AI toggle.
5. Signed/accepted DPAs: Anthropic, Clerk, Vercel, MongoDB, email provider; Atlas region chosen and documented.
6. Statement on invoices: not ZIMRA fiscal tax invoices.
7. Breach response plan with 24-hour POTRAZ contact route; named person.
8. Company registration, tax registration, bank account in place; accountant opinion on VAT/USD.

**Tier 2: within the first month**
9. Deletion and export capability tested (account delete, driver delete, upload delete) and a retention schedule (3.6).
10. Minimise ID number collection; mask in UI; restrict access by role.
11. Subprocessor page; process to notify changes.
12. Trial/refund wording in Terms and on the pricing page.
13. Marketing opt-in log; testimonial permissions; self-owned-company disclosure.
14. AI accuracy test on real logbooks; wording based on measured results.

**Tier 3: before regional expansion**
15. Per-country analysis (POPIA, Zambia, Botswana, Kenya, etc.).
16. Decide on FDMS integration and ZIMRA approval route.
17. Payment integration licensing check (if you add it).
18. Cyber insurance, trademark, formal security review.

---

## 9. What a Zimbabwean lawyer should review

- Whether myFleet is a controller, processor, or both, and whether it needs a POTRAZ licence/tier, DPO, fees, and renewal.
- Exact consent and lawful-basis rules; direct marketing rules.
- Cross-border transfer compliance for Clerk, Vercel, Atlas, Anthropic (adequacy, notification to POTRAZ, consent).
- Enforceability of liability cap, refund wording, and click-through acceptance.
- Retention periods (tax record rules) and deletion obligations.
- Whether invoices generated by the app create any ZIMRA or fiscal-provider obligations; VAT treatment of USD SaaS and exports (with accountant).
- Payments: confirmation that record-only needs no RBZ licence.
- Consumer protection and advertising rules; testimonial/self-endorsement disclosure.
- Employment/privacy issues: customers' lawful basis to upload drivers' ID numbers and photos.

---

## 10. Plain-language templates (adapt; not final legal text)

### 10.1 Privacy Policy outline and key clauses
1. **Who we are.** "myFleet is run by [legal name], [address], Zimbabwe. Contact: privacy@[domain]."
2. **Two roles.** "For your account and billing details we decide how data is used (we are the controller). For the jobs, customers, drivers and invoices you put in myFleet, you decide what is collected and why; we only store and process it for you (we are the processor)."
3. **What we collect.** Account details; business records; driver details you add (names, licence details, phone numbers, and ID numbers if you choose to add them); logbook photos you upload; basic usage and device logs.
4. **Why.** To run the service, sign you in, bill you, support you, keep it secure, and meet legal duties.
5. **AI reading of logbooks.** "If you use the logbook import, your photo is sent securely to Anthropic (USA), which reads the handwriting for us. You check and confirm the result before it is saved. Anthropic's commercial terms say it does not use this data to train its models, and it deletes it from its systems within about 30 days. Do not upload photos you have no right to share."
6. **Who else sees your data.** List of subprocessors (link). "We do not sell your data."
7. **Sending data abroad.** "Our providers store data outside Zimbabwe, including in [countries]. We use written terms with them to protect it."
8. **How long.** "We keep data while your account is active and for [90] days after it closes, unless the law requires longer. Logbook images are deleted [60] days after import. You can ask us to delete earlier."
9. **Your rights.** Access, correct, delete, object; email us; we respond within [30] days. Drivers: contact your employer first; we will help them.
10. **Security and breaches.** "If a breach affects your data we will tell you and the regulator within the legal time limits."
11. **Complaints.** "Contact us first. You can also complain to POTRAZ."
12. **Changes.** "We will email you about important changes."

### 10.2 Terms of Service outline and key clauses
1. **The service.** myFleet is a back-office tool for transport businesses.
2. **Who can use it.** Businesses and their staff, 18+.
3. **Your data and your responsibility.** "You own your data. You promise you have the right to upload it, including drivers' details and photos, and that you have told drivers how it is used."
4. **Our right to run it.** "You give us permission to store and process your data only to provide the service."
5. **Trial and payment.** (Use section 4 wording.)
6. **AI features.** "AI suggestions may contain mistakes. You are responsible for checking them before relying on them."
7. **Invoices and tax.** "Documents made in myFleet are not ZIMRA fiscalised invoices. You are responsible for meeting your own tax and fiscalisation duties."
8. **Acceptable use.** (3.3.)
9. **Availability.** "We aim for high availability but do not guarantee uninterrupted service. Back up what you need by exporting."
10. **Liability.** "Except where the law does not allow it, our total liability is limited to the fees you paid in the last [3/12] months, and we are not liable for indirect losses." (Lawyer to review.)
11. **Ending.** "You can cancel any time. We may suspend for serious breaches. After closing you can export your data for [30] days."
12. **Data processing.** "Our Privacy Policy forms part of these Terms and sets out how we process personal data on your behalf."
13. **Law.** "Zimbabwean law applies; disputes go to [courts/arbitration]."
14. **Changes.** "We will give [30] days notice of material changes."

### 10.3 Upload-point AI notice (one line)
"Photos you upload here are sent to our AI provider, Anthropic (USA), to read the handwriting. You review everything before it is saved. See [AI processing]."

---

## Source list
- Michalsons overview: https://www.michalsons.com/blog/zimbabwes-cyber-and-data-protection-act-overview/78795
- DLA Piper Africa on SI 155: https://www.dlapiperafrica.com/zimbabwe/insights/2024/A-Quick-Start-Guide-to-Zimbabwes-Data-Protection-Regulations
- Afriwise: https://afriwise.com/blog/a-quick-start-guide-to-zimbabwes-data-protection-regulations
- MISA Zimbabwe: https://zimbabwe.misa.org/2024/11/09/misa-zimbabwe-analysis-and-position-on-new-data-regulations
- Act text: https://zimlii.org/akn/zw/act/2021/5/eng@2022-03-11/source
- UWC thesis on cross-border transfer: https://uwcscholar.uwc.ac.za/items/f096843a-947f-400c-8790-fc0c42b455f2
- POTRAZ enforcement report (not directly readable): https://meatechwatch.com/2026/03/25/data-crackdown-looms-potraz-targets-unlicensed-data-handlers/
- Anthropic API retention: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention
- Anthropic commercial retention: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- ZIMRA fiscalisation: https://www.zimra.co.zw/domestic-taxes/corporate/fiscalisation-explained
- Fiscal requirements news: https://www.fiscal-requirements.com/news/3942-zimbabwe-mandates-fiscal-device-upgrade-for-buyer-detail-transmission
- e-invoice.app Zimbabwe: https://www.e-invoice.app/country/ZW
- Business Times VAT threshold: https://businesstimes.co.zw/the-impact-of-zimbabwes-low-vat-threshold-on-small-businesses/

Not researched with primary sources (marked UNVERIFIED above): other countries' laws, Clerk/Vercel/MongoDB DPAs, RBZ payment licensing, WhatsApp opt-in policy, tax record retention periods, consumer protection law status.
