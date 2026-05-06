# Shubh Samriddhi Retention Calculator — Project Context

## What This Project Is
A React-based internal tool for Bandhan Life insurance agents to retain customers who are considering surrendering their Shubh Samriddhi policy early. The calculator shows the customer exactly what they lose by surrendering today vs staying till maturity.

**Live URL:** Deployed on Vercel via GitHub repo `sushant9275/shubh-samriddhi`
**Deploy command:**
```bash
cd "/Users/sushantratnaparkhi/Desktop/Work/SS/shubh-samriddhi"
git add src/App.jsx
git commit -m "your message"
git push
```
**Files:**
- `src/App.jsx` — main calculator (save directly here, rename from downloaded file)
- `src/main.jsx` — login gate (password: `bandhan2025`)

---

## Product: Shubh Samriddhi (Bandhan Life)

### What It Is
A non-linked, participating, limited-pay endowment life insurance plan.
- Customer pays premiums for PPT years (5–12), policy runs for PT years (15–30)
- At maturity: receives SAM (Sum Assured on Maturity) + Terminal Bonus + Cash Bonuses
- During policy: receives annual Cash Bonus (payout or accumulation mode)
- Death benefit: Max(11 × AP, SAM, age-based multiple × AP)

### Key Terms
| Term | Meaning |
|---|---|
| AP | Annual Premium |
| PPT | Premium Paying Term (years customer pays) |
| PT | Policy Term (total years policy runs) |
| SAM | Sum Assured on Maturity = PPT × AP |
| CB | Cash Bonus (annual, non-guaranteed) |
| TB | Terminal Bonus (paid at maturity only, non-guaranteed) |
| GSV | Guaranteed Surrender Value |
| SSV | Special Surrender Value |
| SV | Surrender Value = Max(GSV, SSV) |

---

## Calculation Formulas (All Derived From 12 Actual Customer BIs)

### Cash Bonus Rate (% of AP per year)
Rates vary by entry age. Higher age = slightly lower rate.

**PPT = 6 (special/rare case):**
- @4%: 2.5% of AP/year
- @8%: 15% of AP/year

**PPT = 10:**
- @4%: 17% of AP/year
- @8%: 36% of AP/year

**PPT = 12 (standard):**
- @4%: `Max(19.5%, 22% − Max(age−35, 0) × 0.15%)`
- @8%: `Max(34%, 40% − Max(age−35, 0) × 0.25%)`

Example (age 33, PPT 12): CB@4% = 22%, CB@8% = 40%
Example (age 51, PPT 12): CB@4% = 19.5%, CB@8% = 34%

### Terminal Bonus
**TB@4% = 0** for all PPT ≥ 10 (confirmed across all 12 BIs)
**TB@4% = 75.6% of AP** for PPT = 6 only

**TB@8%:**
- Zero when: `CB@8% ≥ 40% AND (entry_age + PT) ≤ 53`
  (young customer matures early → company has less surplus to share)
- Otherwise: rate × AP using table below

| Condition | TB@8% rate |
|---|---|
| PT ≤ 20, maturity age 45–55 | 70% of AP |
| PT ≤ 20, maturity age 56–65 | 75% of AP |
| PT ≤ 20, maturity age 66–79 | 100% of AP |
| PT 21–25 | 115% of AP |
| PT > 25 | 130% of AP (extrapolated) |
| PPT = 6 | 183.6% of AP |

### GSV (Guaranteed Surrender Value)
```
GSV = Max(GSV_factor × Total_Premiums_Paid − Cash_Bonuses_Paid_to_Date, 0)
```

GSV factors by PPT=12 (IRDAI mandated):
| Premiums Paid | GSV Factor |
|---|---|
| 1 | 0% |
| 2 | 30% |
| 3 | 35% |
| 4–7 | 50% |
| 8 | 58% |
| 9 | 65% |
| 10 | 75% |
| 11 | 80% |
| 12+ | 90% |

**Surrender Benefit column in BI** = GSV factor × premiums paid (BEFORE bonus deduction) — this is the gross/raw figure shown in the Guaranteed section of the BI.

### SSV (Special Surrender Value)
Derived from reverse-engineering all 12 BI data points.
Consistent implied discount rate of ~8% across all customers.
```
SSV = (SAM × premiums_paid/PPT) / (1.08)^(PT − years_paid)
```
- `paid_up_SAM` = SAM × (min(years_paid, PPT) / PPT)
- This is PV of the paid-up benefit discounted at 8% for remaining years
- SSV > GSV mainly in first 1–2 years when GSV = 0
- After year 3, GSV dominates for PPT=12 customers

### Final Surrender Value
```
SV = Max(GSV, SSV) + Accumulated_Bonus (if accumulation mode)
```

### Accumulated Bonus (Accumulation Mode)
Each year's bonus earns 4% simple interest from year earned to present:
```
accBVal = Σ (cbpy4 × (1 + 0.04 × (years_paid − yr))) for yr = 1 to years_paid
```
Future bonuses at maturity also earn 4% simple interest to maturity date.

### Payout Mode vs Accumulation Mode
- **Payout:** CB paid out each year → deducted from GSV on surrender → futCb = cbpy × yrsToMat (flat)
- **Accumulation:** CB stays in policy earning 4% simple interest → added to SV → futCb = accBVal + future bonuses with 4% interest

---

## BI Data Summary (12 Customer Benefit Illustrations Analysed)

| ID | Age | AP | PPT | PT | CB@4%/yr | CB@8%/yr | TB@8% |
|----|-----|----|-----|----|----------|----------|-------|
| 1 | 59 | 1,00,000 | 6 | 20 | 2,500 | 15,000 | 1,83,600 |
| 2 | 30 | 60,000 | 12 | 20 | 15,000 | 24,000 | 0 |
| 3 | 51 | 51,000 | 12 | 21 | 9,945 | 17,340 | 1,16,953 |
| 4 | 52 | 2,00,000 | 12 | 20 | 42,000 | 71,000 | 1,68,000 |
| 5 | 24 | 80,000 | 12 | 20 | 17,200 | 32,400 | 0 |
| 6 | 42 | 1,00,000 | 12 | 20 | 24,500 | 38,000 | 74,400 |
| 7 | 46 | 70,000 | 12 | 20 | 15,400 | 25,900 | 48,720 |
| 8 | 33 | 50,000 | 12 | 20 | 12,500 | 20,000 | 0 |
| 9 | 43 | 50,000 | 12 | 20 | 11,750 | 18,500 | 52,800 |
| 10 | 33 | 60,000 | 12 | 20 | 15,000 | 24,000 | 0 |
| 11 | 33 | 1,50,000 | 12 | 25 | 39,000 | 61,500 | 2,47,500 |
| 12 | 25 | 50,000 | 10 | 20 | 8,500 | 18,000 | 35,000 |

**TB@8% = 0 for:** IDs 2, 5, 8, 10 — all mature at age ≤ 53 with CB@8% ≥ 40%

---

## Key Product Rules & Clarifications

1. **Reversionary Bonus = 0** always — Cash Bonus is the only annual bonus on this product
2. **Accumulation mode interest rate = 4%** simple interest (confirmed)
3. **PPT=6 is a special/rare configuration** — treat separately, different CB and TB rates
4. **Maturity age = entry_age + PT** (not age 100 — this is an endowment, not whole life)
5. **Death benefit = Max(11 × AP, SAM, age_multiple × AP)**
   - Age multiples: <45 = 7×, 45–50 = 10×, 51–55 = 11×, 56+ = 7×
6. **Policy term options:** 15, 16, 17, 18, 19, 20, 21, 22, 25, 30 years
7. **TB is non-guaranteed** — depends on company investment performance
8. **CB is non-guaranteed** — depends on company investment performance

---

## UI Structure
The calculator has these sections in order:
1. **Input form** — Entry Age, Annual Premium, PPT, Policy Term, Premiums Paid, Cash Bonus Mode
2. **Hero card** (dark blue) — Total Invested, Surrender Value breakdown (GSV/SSV/which used), recovery %
3. **Total Value at Maturity** (green) — Conservative @4% and Optimistic @8%, with breakdown of SAM + TB + CB, interest shown in accumulation mode
4. **What You Permanently Give Up** (red) — surrender vs maturity visual bar, loss amounts, premiums remaining callout
5. **Life Cover Lost** — death benefit amount
6. **Alternatives to Surrender** — loan, premium holiday, paid-up, partial withdrawal options
7. **Disclaimer** — simplified, no internal rate details

---

## Decisions Made / Pending

### Completed
- ✅ CB rates updated from flat 4%/8% to BI-derived age-graded formula
- ✅ TB rates updated from SAM-based guesswork to BI-derived AP-based formula
- ✅ SSV implemented: `paid_up_SAM / (1.08)^remaining_years`
- ✅ SV = Max(GSV, SSV) correctly implemented
- ✅ Accumulation mode auto-calculates with 4% simple interest
- ✅ Maturity age fixed (was wrong "age 100", now entry_age + PT)
- ✅ Disclaimer simplified — no internal rates shown

### Pending / Future Work
- ⏳ Move CB + TB formulas to Vercel Serverless Functions for IP protection
  (browser sends inputs, server returns final numbers — formulas never in JS)
- ⏳ SSV post-PPT behaviour — after PPT complete, GSV always dominates so SSV is academic; still mathematically correct
- ⏳ Validate TB rates against more BIs when available

---

## Tech Stack
- **Frontend:** React + Vite (JSX, no TypeScript)
- **Styling:** Inline styles only, no CSS files, no Tailwind
- **Deployment:** Vercel (auto-deploy on push to main)
- **Repo:** GitHub `sushant9275/shubh-samriddhi`
- **Auth:** Simple password gate in `main.jsx` (password: `bandhan2025`)
- **No backend currently** — all calculations in browser

---

## Brand Colors (Bandhan Life)
```js
navy:      "#0A3152"
navyLight: "#1A5276"
navyPale:  "#EBF2F8"
green:     "#1A7A4A"
greenBg:   "#EBF7F0"
red:       "#C0392B"
redDark:   "#922B21"
redBg:     "#FDEDEC"
amber:     "#D4A017"
amberBg:   "#FEF9E7"
grey100:   "#E8EDF2"
grey400:   "#8FA3B1"
grey600:   "#4A6275"
white:     "#FFFFFF"
```
