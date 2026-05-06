import { useState, useMemo, useEffect } from "react";

// ─── Brand Colors ────────────────────────────────────────────────────────────
const C = {
  navy:      "#0A3152",
  navyLight: "#1A5276",
  navyPale:  "#EBF2F8",
  navyPale2: "#D6E8F5",
  green:     "#1A7A4A",
  greenBg:   "#EBF7F0",
  greenDark: "#145C38",
  red:       "#C0392B",
  redDark:   "#922B21",
  redBg:     "#FDEDEC",
  amber:     "#D4A017",
  amberBg:   "#FEF9E7",
  amberDark: "#A07800",
  grey100:   "#E8EDF2",
  grey200:   "#D0DAE3",
  grey400:   "#8FA3B1",
  grey600:   "#4A6275",
  white:     "#FFFFFF",
};

// ─── GSV Factor Table (from Annexure 1 of Policy Document) ───────────────────
// Rows = year of surrender (1-based), Cols = policy term [5,6,7,8,10,12,15,20,25,30]
const GSV_TABLE = {
  5:  [0,30,35,90,90],
  6:  [0,30,35,50,90,90],
  7:  [0,30,35,50,50,90,90],
  8:  [0,30,35,50,50,75,90,90],
  10: [0,30,35,50,50,50,50,70,90,90],
  12: [0,30,35,50,50,50,50,60,70,80,90,90],
  15: [0,30,35,50,50,50,50,55,60,65,70,80,85,90,90],
  20: [0,30,35,50,50,50,50,53,56,60,63,66,70,73,76,80,83,86,90,90],
  25: [0,30,35,50,50,50,50,52,54,56,59,61,63,65,68,70,72,74,76,78,80,82,85,88,90],
  30: [0,30,35,50,50,50,50,52,54,56,58,59,61,63,65,67,69,70,72,74,76,78,79,81,83,85,87,88,89,90],
};

const VALID_PT = [5,6,7,8,10,12,15,20,25,30];

function getGSVFactor(pt, yearOfSurrender) {
  const arr = GSV_TABLE[pt] || GSV_TABLE[20];
  const idx = Math.min(yearOfSurrender - 1, arr.length - 1);
  return (arr[idx] ?? 0) / 100;
}

// ─── Secured Income Rate Tables (from Brochure) ───────────────────────────────
// Flexi Start: based on PPT and Deferment Year, and income duration
// Extended Benefit: based on PPT and PT

// Flexi Start Secured Income Rate (% of AP per year), income duration <= 15 yrs
const FLEXI_SI_RATE_SHORT = {
  // PPT: { deferment: rate% }
  5:  {0:15,1:20,2:30,3:35,4:40},
  6:  {0:15,1:20,2:30,3:35,4:40,5:45},
  7:  {0:20,1:25,2:35,3:40,4:45,5:55,6:60},
  8:  {0:20,1:30,2:40,3:45,4:55,5:70,6:80,7:90},
  10: {0:25,1:35,2:45,3:55,4:65,5:85,6:100,7:110},
  12: {0:25,1:35,2:45,3:55,4:65,5:85,6:100,7:110},
};

// Flexi Start Secured Income Rate (% of AP per year), income duration > 15 yrs
const FLEXI_SI_RATE_LONG = {
  5:  {0:20,1:25,2:35,3:40,4:45},
  6:  {0:20,1:25,2:35,3:40,4:45,5:50},
  7:  {0:25,1:30,2:40,3:45,4:50,5:60,6:65},
  8:  {0:30,1:40,2:50,3:60,4:70,5:102,6:110,7:115},
  10: {0:30,1:40,2:50,3:60,4:70,5:102,6:110,7:115},
  12: {0:30,1:40,2:50,3:60,4:70,5:102,6:110,7:115},
};

// Extended Benefit Secured Income Rate (% of AP per year)
// Based on PPT and PT
const EXT_SI_RATE = {
  5:  {10:15,12:15,15:15,20:15,25:20,30:20},
  6:  {10:15,12:15,15:15,20:15,25:20,30:20},
  7:  {10:20,12:20,15:20,20:20,25:20,30:25},
  8:  {10:20,12:20,15:20,20:20,25:25,30:30},
  10: {10:25,12:25,15:25,20:25,25:30,30:30},
  12: {12:25,15:25,20:25,25:30,30:30},
};

// Guaranteed Income Rate (Flexi Start maturity income) - % of AP per year
const GUARANTEED_INCOME_RATE = {
  // PPT: { deferment: { income_period: rate% } }
  // Using brochure example: PPT10, PT10, defer0, IP25 = 44.09%
  // Rates approximate from product design
  10: {0: {10:30,15:38,20:44,25:44,30:48}},
  12: {0: {10:30,15:38,20:44,25:44,30:48}},
  8:  {0: {10:25,15:32,20:38,25:40,30:44}},
};

function getFlexiSIRate(ppt, deferment, incomePeriod) {
  const table = incomePeriod > 15 ? FLEXI_SI_RATE_LONG : FLEXI_SI_RATE_SHORT;
  const row = table[ppt] || table[10];
  return (row[deferment] ?? row[0] ?? 25) / 100;
}

function getExtSIRate(ppt, pt) {
  const row = EXT_SI_RATE[ppt] || EXT_SI_RATE[10];
  return (row[pt] ?? 20) / 100;
}

function getGuaranteedIncomeRate(ppt, deferment, incomePeriod) {
  const tbl = GUARANTEED_INCOME_RATE[ppt] || GUARANTEED_INCOME_RATE[10];
  const row = tbl[deferment] || tbl[0];
  if (!row) return 0.44;
  return (row[incomePeriod] ?? row[25] ?? 44) / 100;
}

// ─── Main Calculation Engine ─────────────────────────────────────────────────
function calculate(inputs) {
  const {
    planOption, ap, ppt, pt, yearsSurrender, deferment,
    incomePeriod, ropChosen, securedIncomePaidYearly,
  } = inputs;

  const totalPremiumsPaid = ap * Math.min(yearsSurrender, ppt);
  // For Flexi Start: PPT = PT, so ppt = pt
  const effectivePT = planOption === "flexi" ? ppt : pt;

  // Secured Income paid so far
  // For Flexi Start: SI starts from year 1 (or deferment+1), runs until end of PPT
  // For Extended: SI from year 1 to PT
  let siPaidYears = 0;
  if (planOption === "flexi") {
    const siStartYear = deferment + 1;
    siPaidYears = Math.max(0, yearsSurrender - siStartYear);
  } else {
    siPaidYears = yearsSurrender - 1; // paid at end of each year
  }

  const siRate = planOption === "flexi"
    ? getFlexiSIRate(ppt, deferment, incomePeriod)
    : getExtSIRate(ppt, effectivePT);

  const annualSI = ap * siRate;
  const siPaidTotal = annualSI * Math.max(0, siPaidYears);

  // GSV
  const gsvFactor = getGSVFactor(effectivePT, yearsSurrender);
  let gsv = gsvFactor * totalPremiumsPaid - siPaidTotal;
  gsv = Math.max(0, gsv);

  // SSV estimate (approximate EPV of paid-up benefits)
  const yearsRemaining = effectivePT - yearsSurrender;
  let ssv = 0;
  if (yearsRemaining > 0) {
    const paidUpRatio = Math.min(yearsSurrender, ppt) / ppt;
    if (planOption === "flexi") {
      // Paid-up guaranteed income + RoP value
      const giRate = getGuaranteedIncomeRate(ppt, deferment, incomePeriod);
      const annualGI = ap * giRate * paidUpRatio;
      const pvGI = annualGI * incomePeriod / Math.pow(1.085, yearsRemaining); // discount to today
      const pvRop = ropChosen ? (totalPremiumsPaid * 1.1) / Math.pow(1.085, yearsRemaining + incomePeriod) : 0;
      ssv = pvGI + pvRop;
    } else {
      // PV of paid-up maturity benefit (100% premiums paid)
      const maturityBenefit = totalPremiumsPaid;
      ssv = maturityBenefit / Math.pow(1.085, yearsRemaining);
    }
    ssv = Math.max(0, ssv);
  }

  const surrenderValue = Math.max(gsv, ssv);
  const svType = gsv >= ssv ? "GSV" : "SSV";

  // Death Benefit
  const baseSA = 11 * ap;
  const deathBenefit = Math.max(baseSA, 1.05 * totalPremiumsPaid);

  // ── What you give up (future benefits if you STAY) ────────────────────────
  let futureIncome = 0;
  let maturityBenefitTotal = 0;
  let totalBenefitIfStay = 0;

  const premiumsStillDue = Math.max(0, ppt - yearsSurrender) * ap;

  if (planOption === "flexi") {
    // Remaining Secured Income during PPT
    const siStartYear = deferment + 1;
    const siEndYear = ppt; // runs till end of PPT
    const remainingSIYears = Math.max(0, siEndYear - Math.max(yearsSurrender, siStartYear - 1));
    const remainingSI = remainingSIYears * annualSI;

    // Guaranteed Income during income period
    const giRate = getGuaranteedIncomeRate(ppt, deferment, incomePeriod);
    const annualGI = ap * giRate;
    const totalGI = annualGI * incomePeriod;

    // RoP
    const ropValue = ropChosen ? totalPremiumsPaid * 1.1 : 0;

    futureIncome = remainingSI + totalGI;
    maturityBenefitTotal = ropValue;
    totalBenefitIfStay = futureIncome + maturityBenefitTotal;
  } else {
    // Remaining Secured Income (Extended Benefit)
    const remainingSIYears = Math.max(0, effectivePT - yearsSurrender);
    const remainingSI = remainingSIYears * annualSI;

    // Maturity: 100% of all premiums paid
    const fullPremiumsPaid = ppt * ap;
    maturityBenefitTotal = fullPremiumsPaid;

    futureIncome = remainingSI;
    totalBenefitIfStay = futureIncome + maturityBenefitTotal;
  }

  const lossIfSurrender = totalBenefitIfStay - surrenderValue;

  // Recovery %
  const recoveryPct = totalPremiumsPaid > 0 ? (surrenderValue / totalPremiumsPaid) * 100 : 0;

  return {
    totalPremiumsPaid,
    gsv,
    ssv,
    surrenderValue,
    svType,
    deathBenefit,
    annualSI,
    siPaidTotal,
    futureIncome,
    maturityBenefitTotal,
    totalBenefitIfStay,
    lossIfSurrender,
    premiumsStillDue,
    recoveryPct,
    gsvFactor: gsvFactor * 100,
  };
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
const fmt = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const pct = (n) => n.toFixed(1) + "%";

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{
      display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"8px 0", borderBottom:`1px solid ${C.grey100}`,
    }}>
      <span style={{color:C.grey600, fontSize:13}}>{label}</span>
      <span style={{
        fontWeight:700, fontSize:14,
        color: highlight === "green" ? C.green : highlight === "red" ? C.red : C.navy,
      }}>{value}</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 14,
      padding: "20px 22px",
      boxShadow: "0 2px 12px rgba(10,49,82,0.08)",
      ...style,
    }}>{children}</div>
  );
}

function CardTitle({ icon, label, color }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:8,
      marginBottom:14, paddingBottom:10,
      borderBottom: `2px solid ${color || C.grey100}`,
    }}>
      <span style={{fontSize:18}}>{icon}</span>
      <span style={{fontWeight:700, fontSize:15, color: color || C.navy}}>{label}</span>
    </div>
  );
}

function ProgressBar({ value, max, color }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{background:C.grey100, borderRadius:99, height:8, overflow:"hidden", marginTop:4}}>
      <div style={{
        width: `${w}%`, height:"100%",
        background: color || C.green, borderRadius:99,
        transition:"width 0.4s ease",
      }}/>
    </div>
  );
}

// ─── Input Component ──────────────────────────────────────────────────────────
function Select({ label, value, onChange, options }) {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:4, textAlign:"left"}}>
      <label style={{fontSize:12, fontWeight:600, color:C.grey600, textTransform:"uppercase", letterSpacing:"0.05em", textAlign:"left", lineHeight:1.4, display:"block"}}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          padding:"9px 12px", borderRadius:8, fontSize:14, fontWeight:500,
          border:`1.5px solid ${C.grey200}`, background:C.white, color:C.navy,
          cursor:"pointer", outline:"none", textAlign:"left", lineHeight:1.4,
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberInput({ label, value, onChange, min, max, prefix }) {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:4, textAlign:"left"}}>
      <label style={{fontSize:12, fontWeight:600, color:C.grey600, textTransform:"uppercase", letterSpacing:"0.05em", textAlign:"left", lineHeight:1.4, display:"block"}}>{label}</label>
      <div style={{position:"relative"}}>
        {prefix && <span style={{
          position:"absolute", left:10, top:"50%", transform:"translateY(-50%)",
          color:C.grey400, fontSize:14, fontWeight:600,
        }}>{prefix}</span>}
        <input type="number" value={value} min={min} max={max}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width:"100%", padding:`9px 12px`, paddingLeft: prefix ? 22 : 12,
            borderRadius:8, fontSize:14, fontWeight:500, lineHeight:1.4,
            border:`1.5px solid ${C.grey200}`, color:C.navy,
            background:C.white, WebkitTextFillColor:C.navy,
            outline:"none", boxSizing:"border-box", textAlign:"left",
          }}
        />
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function GIPRetentionCalculator() {
  // Inject Montserrat font — needed for Edge/non-Chrome browsers
  useEffect(() => {
    if (!document.getElementById("montserrat-font")) {
      const link = document.createElement("link");
      link.id = "montserrat-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);
  const [planOption, setPlanOption] = useState("flexi");
  const [ap, setAp] = useState(100000);
  const [ppt, setPpt] = useState(10);
  const [pt, setPt] = useState(15);    // only for Extended Benefit
  const [yearsSurrender, setYearsSurrender] = useState(3);
  const [deferment, setDeferment] = useState(0);   // Flexi Start only
  const [incomePeriod, setIncomePeriod] = useState(25); // Flexi Start only
  const [ropChosen, setRopChosen] = useState(true);  // Flexi Start only

  // Derived valid options
  const flexiPPTOptions = [5,6,7,8,10,12].map(v=>({value:v,label:`${v} years`}));
  const extPPTOptions   = [5,6,7,8,10,12].map(v=>({value:v,label:`${v} years`}));

  const extPTOptions = useMemo(() => {
    const map = {5:[10,12,15,20,25,30],6:[10,12,15,20,25,30],7:[10,12,15,20,25,30],
                 8:[10,12,15,20,25,30],10:[10,12,15,20,25,30],12:[12,15,20,25,30]};
    return (map[ppt]||[10,15,20,25,30]).map(v=>({value:v,label:`${v} years`}));
  }, [ppt]);

  const maxSurrenderYear = planOption === "flexi" ? ppt : pt;
  const maxDeferment = Math.min(7, ppt - 1);

  const result = useMemo(() => calculate({
    planOption, ap, ppt,
    pt: planOption === "flexi" ? ppt : pt,
    yearsSurrender: Math.min(yearsSurrender, maxSurrenderYear - 1),
    deferment: Math.min(deferment, maxDeferment),
    incomePeriod,
    ropChosen,
  }), [planOption, ap, ppt, pt, yearsSurrender, deferment, incomePeriod, ropChosen, maxSurrenderYear, maxDeferment]);

  const safeYears = Math.min(yearsSurrender, maxSurrenderYear - 1);

  // Future income label
  const futureLabel = planOption === "flexi"
    ? `Remaining Secured Income + ${incomePeriod}-yr Guaranteed Income`
    : "Remaining Secured Income + Maturity Benefit";

  return (
    <div style={{
      fontFamily:"'DM Sans', 'Segoe UI', sans-serif",
      background: "#F0F4F8",
      minHeight:"100vh",
      padding:"0 0 40px 0",
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #8B1818 0%, #0A3152 60%, #1A5276 100%)`,
        padding:"28px 24px 24px",
        color:C.white,
      }}>
        <div style={{maxWidth:700, margin:"0 auto"}}>
          <div style={{display:"flex", alignItems:"center", gap:14, marginBottom:6}}>
            {/* Bandhan Life Official Logo */}
            <svg width="120" height="37" viewBox="0 0 326.84 100" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
              <defs>
                <style>{`
                  .cls-1 { stroke: url(#New_Gradient_Swatch_1-2); stroke-linecap: round; stroke-linejoin: round; }
                  .cls-1, .cls-2 { fill: none; stroke-width: 0px; }
                  .cls-3 { fill: #4678bb; }
                  .cls-3, .cls-4, .cls-5, .cls-6, .cls-7, .cls-8 { stroke-width: 0px; }
                  .cls-4 { fill: #ffffff; }
                  .cls-5 { fill: url(#New_Gradient_Swatch_2); }
                  .cls-6 { fill: #163250; }
                  .cls-7 { fill: url(#New_Gradient_Swatch_1); }
                  .cls-8 { fill: #fff; }
                  .cls-2 { stroke: url(#New_Gradient_Swatch_2-2); stroke-miterlimit: 10; }
                `}</style>
                <linearGradient id="New_Gradient_Swatch_2" x1="11.12" y1="17.3" x2="61.28" y2="77.71" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#e12f15"/>
                  <stop offset=".18" stopColor="#e12f15"/>
                  <stop offset=".42" stopColor="#bb2516"/>
                  <stop offset=".68" stopColor="#981b17"/>
                  <stop offset=".83" stopColor="#8b1818"/>
                  <stop offset=".99" stopColor="#8b1818"/>
                </linearGradient>
                <linearGradient id="New_Gradient_Swatch_2-2" x1="11.12" y1="17.29" x2="74.97" y2="94.2" xlinkHref="#New_Gradient_Swatch_2"/>
                <linearGradient id="New_Gradient_Swatch_1" x1="4.35" y1="49.99" x2="99.97" y2="49.99" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#b31d26"/>
                  <stop offset="1" stopColor="#e12f15"/>
                </linearGradient>
                <linearGradient id="New_Gradient_Swatch_1-2" x1="4.34" x2="99.98" xlinkHref="#New_Gradient_Swatch_1"/>
              </defs>
              <g>
                <path className="cls-4" d="M133.22,46.84c-2.19,0-4.39-.07-6.62-.21-2.23-.14-4.17-.43-5.84-.86V5.64c.87-.16,1.81-.31,2.8-.45.99-.14,2.01-.25,3.04-.33,1.03-.08,2.06-.14,3.07-.18,1.01-.04,1.98-.06,2.89-.06,2.5,0,4.83.19,6.97.57,2.15.38,4,1,5.57,1.88,1.57.87,2.79,2.03,3.67,3.46.87,1.43,1.31,3.2,1.31,5.31,0,1.95-.47,3.62-1.4,5.01-.93,1.39-2.24,2.5-3.9,3.34,2.5.83,4.35,2.07,5.54,3.7,1.19,1.63,1.79,3.7,1.79,6.2,0,4.25-1.55,7.44-4.65,9.57-3.1,2.13-7.85,3.19-14.25,3.19ZM128.15,21.86h5.31c2.86,0,5.11-.41,6.74-1.22,1.63-.81,2.44-2.27,2.44-4.38,0-1.99-.84-3.4-2.53-4.23-1.69-.83-3.89-1.25-6.59-1.25-1.15,0-2.18.02-3.07.06-.89.04-1.66.1-2.29.18v10.85ZM128.15,27.76v12.58c.83.08,1.73.14,2.68.18.95.04,1.83.06,2.62.06,1.55,0,2.99-.1,4.32-.3,1.33-.2,2.48-.55,3.46-1.04.97-.5,1.75-1.16,2.33-2,.58-.83.86-1.91.86-3.22,0-2.34-.86-3.97-2.56-4.89-1.71-.91-4.07-1.37-7.09-1.37h-6.62Z"/>
                <path className="cls-4" d="M165.35,14.41c2.38,0,4.39.3,6.02.89,1.63.6,2.93,1.43,3.9,2.5.97,1.07,1.67,2.38,2.09,3.9.42,1.53.63,3.21.63,5.04v18.9c-1.11.24-2.79.53-5.04.86-2.25.34-4.78.51-7.6.51-1.87,0-3.58-.18-5.13-.54s-2.87-.93-3.96-1.73c-1.09-.79-1.95-1.83-2.56-3.1-.62-1.27-.92-2.84-.92-4.71s.35-3.3,1.04-4.53c.69-1.23,1.64-2.24,2.83-3.01,1.19-.77,2.57-1.33,4.14-1.67,1.57-.34,3.21-.51,4.92-.51.79,0,1.63.05,2.5.15.87.1,1.81.27,2.8.51v-1.19c0-.83-.1-1.63-.3-2.38-.2-.75-.55-1.42-1.04-2-.5-.58-1.15-1.02-1.97-1.34-.82-.32-1.84-.48-3.07-.48-1.67,0-3.2.12-4.59.36-1.39.24-2.52.52-3.4.83l-.89-5.84c.91-.32,2.24-.63,3.99-.95,1.75-.32,3.62-.48,5.6-.48ZM165.95,41.29c2.23,0,3.91-.12,5.07-.36v-7.99c-.4-.12-.97-.24-1.73-.36-.76-.12-1.59-.18-2.5-.18-.79,0-1.6.06-2.41.18-.82.12-1.55.34-2.21.66-.66.32-1.18.77-1.58,1.34-.4.58-.6,1.3-.6,2.18,0,1.71.54,2.89,1.61,3.55,1.07.66,2.52.98,4.35.98Z"/>
                <path className="cls-4" d="M182.22,16.2c1.39-.4,3.2-.78,5.42-1.13s4.69-.54,7.39-.54c2.54,0,4.67.35,6.38,1.04,1.71.7,3.07,1.67,4.08,2.92,1.01,1.25,1.73,2.76,2.15,4.53.42,1.77.63,3.71.63,5.81v17.53h-7.21v-16.39c0-1.67-.11-3.09-.33-4.26-.22-1.17-.58-2.13-1.07-2.86-.5-.73-1.17-1.27-2.03-1.61-.86-.34-1.9-.51-3.13-.51-.91,0-1.87.06-2.86.18-.99.12-1.73.22-2.21.3v25.16h-7.21v-30.16Z"/>
                <path className="cls-4" d="M238.85,45.41c-1.43.44-3.23.83-5.4,1.19s-4.44.54-6.83.54-4.67-.38-6.62-1.13c-1.95-.75-3.61-1.84-4.98-3.25-1.37-1.41-2.42-3.12-3.16-5.13-.74-2.01-1.1-4.26-1.1-6.77s.31-4.7.92-6.71c.62-2.01,1.52-3.73,2.71-5.16,1.19-1.43,2.64-2.53,4.35-3.31,1.71-.77,3.68-1.16,5.9-1.16,1.51,0,2.84.18,3.99.54,1.15.36,2.15.76,2.98,1.19V1.29l7.21-1.19v45.31ZM218.17,30.68c0,3.18.75,5.67,2.27,7.48,1.51,1.81,3.6,2.71,6.26,2.71,1.15,0,2.14-.05,2.95-.15.81-.1,1.48-.21,2-.33v-17.88c-.64-.44-1.48-.84-2.53-1.22-1.05-.38-2.18-.57-3.37-.57-2.62,0-4.54.89-5.75,2.68-1.21,1.79-1.82,4.21-1.82,7.27Z"/>
                <path className="cls-4" d="M243.44,46.36V1.29l7.21-1.19v15.44c.79-.28,1.72-.52,2.77-.72,1.05-.2,2.1-.3,3.13-.3,2.5,0,4.58.35,6.23,1.04,1.65.7,2.97,1.67,3.96,2.92.99,1.25,1.7,2.75,2.12,4.5.42,1.75.63,3.7.63,5.84v17.53h-7.21v-16.39c0-1.67-.11-3.09-.33-4.26-.22-1.17-.58-2.13-1.07-2.86-.5-.73-1.16-1.27-2-1.61-.83-.34-1.87-.51-3.1-.51-.95,0-1.93.1-2.92.3-.99.2-1.73.38-2.21.54v24.8h-7.21Z"/>
                <path className="cls-4" d="M283.92,14.41c2.38,0,4.39.3,6.02.89,1.63.6,2.93,1.43,3.9,2.5.97,1.07,1.67,2.38,2.09,3.9.42,1.53.63,3.21.63,5.04v18.9c-1.11.24-2.79.53-5.04.86-2.25.34-4.78.51-7.6.51-1.87,0-3.58-.18-5.13-.54s-2.87-.93-3.96-1.73c-1.09-.79-1.95-1.83-2.56-3.1-.62-1.27-.92-2.84-.92-4.71s.35-3.3,1.04-4.53c.69-1.23,1.64-2.24,2.83-3.01,1.19-.77,2.57-1.33,4.14-1.67,1.57-.34,3.21-.51,4.92-.51.79,0,1.63.05,2.5.15.87.1,1.81.27,2.8.51v-1.19c0-.83-.1-1.63-.3-2.38-.2-.75-.55-1.42-1.04-2-.5-.58-1.15-1.02-1.97-1.34-.82-.32-1.84-.48-3.07-.48-1.67,0-3.2.12-4.59.36-1.39.24-2.52.52-3.4.83l-.89-5.84c.91-.32,2.24-.63,3.99-.95,1.75-.32,3.62-.48,5.6-.48ZM284.51,41.29c2.23,0,3.91-.12,5.07-.36v-7.99c-.4-.12-.97-.24-1.73-.36-.76-.12-1.59-.18-2.5-.18-.79,0-1.6.06-2.41.18-.82.12-1.55.34-2.21.66-.66.32-1.18.77-1.58,1.34-.4.58-.6,1.3-.6,2.18,0,1.71.54,2.89,1.61,3.55,1.07.66,2.52.98,4.35.98Z"/>
                <path className="cls-4" d="M300.79,16.2c1.39-.4,3.2-.78,5.42-1.13s4.69-.54,7.39-.54c2.54,0,4.67.35,6.38,1.04,1.71.7,3.07,1.67,4.08,2.92,1.01,1.25,1.73,2.76,2.15,4.53.42,1.77.63,3.71.63,5.81v17.53h-7.21v-16.39c0-1.67-.11-3.09-.33-4.26-.22-1.17-.58-2.13-1.07-2.86-.5-.73-1.17-1.27-2.03-1.61-.86-.34-1.9-.51-3.13-.51-.91,0-1.87.06-2.86.18-.99.12-1.73.22-2.21.3v25.16h-7.21v-30.16Z"/>
                <path className="cls-4" d="M144.66,95.83v3.52h-23.49v-41.31h4.05v37.79h19.43Z"/>
                <path className="cls-4" d="M151.04,59.23c0,.91-.28,1.64-.83,2.18-.56.54-1.23.8-2.03.8s-1.47-.27-2.03-.8c-.56-.54-.83-1.26-.83-2.18s.28-1.64.83-2.18c.56-.54,1.23-.81,2.03-.81s1.47.27,2.03.81c.56.54.83,1.26.83,2.18ZM150.15,99.35h-3.88v-30.82h3.88v30.82Z"/>
                <path className="cls-4" d="M167.14,53.09c1.67,0,3.03.13,4.08.39,1.05.26,1.74.49,2.06.69l-.77,3.34c-.44-.2-1.08-.41-1.94-.63-.86-.22-1.94-.33-3.25-.33-2.74,0-4.7.7-5.87,2.09-1.17,1.39-1.76,3.62-1.76,6.68v3.22h12.4v3.28h-12.4v27.54h-3.88v-34.16c0-4.01.92-7.03,2.77-9.06,1.85-2.03,4.7-3.04,8.55-3.04Z"/>
                <path className="cls-4" d="M171.79,83.91c0-2.7.39-5.06,1.16-7.06.77-2.01,1.79-3.69,3.04-5.04,1.25-1.35,2.68-2.35,4.29-3.01,1.61-.66,3.27-.98,4.98-.98,3.78,0,6.79,1.23,9.03,3.7,2.24,2.46,3.37,6.26,3.37,11.39,0,.32-.01.64-.03.95-.02.32-.05.62-.09.89h-21.64c.12,3.78,1.05,6.68,2.8,8.7,1.75,2.03,4.53,3.04,8.35,3.04,2.11,0,3.78-.2,5.01-.6,1.23-.4,2.13-.73,2.68-1.01l.72,3.34c-.56.32-1.6.7-3.13,1.13-1.53.44-3.33.66-5.39.66-2.7,0-5.01-.4-6.92-1.19-1.91-.79-3.48-1.91-4.71-3.34-1.23-1.43-2.13-3.13-2.68-5.1-.56-1.97-.83-4.12-.83-6.47ZM193.67,81.47c-.08-3.22-.83-5.72-2.27-7.51s-3.46-2.68-6.08-2.68c-1.39,0-2.63.28-3.73.83-1.09.56-2.05,1.3-2.86,2.24-.82.93-1.45,2.02-1.91,3.25-.46,1.23-.73,2.52-.8,3.88h17.65Z"/>
              </g>
              <g>
                <path className="cls-8" d="M44.79,6.01c-5.23,7.23-8.56,16.68-8.52,28,.05,12.45,5.36,22.82,13.72,29.69,8.31-6.87,13.8-17.05,13.64-29.46-.11-9.3-.98-17.99-9-29.04-1.28-1.77-3.51-4.05-4.67-5.15-.13,0-3.13,3.13-5.18,5.96"/>
                <path className="cls-5" d="M48.51.03C21.62.84,0,22.85,0,49.94s22.37,49.99,49.97,49.99c9.13,0,33.96-3.82,45.65-29.64-5.02,2.05-10.5,3.18-16.25,3.18-23.8,0-43.06-15.43-43.09-39.25-.03-12.24,3.68-22.08,9.33-29.35,1.15-1.47,3.04-3.54,4.35-4.86-.08,0-1.37.03-1.46.03"/>
                <path className="cls-7" d="M54.45,4.87c7.49,10,9.23,19.57,9.23,29.39,0,23.81-19.3,39.24-43.09,39.24-5.74,0-11.21-1.13-16.24-3.17,11.92,26.55,36.5,29.64,45.64,29.64,27.6,0,49.98-22.38,49.98-49.99S78.35.88,51.43.07c-.07,0-1.4-.07-1.46-.07,1.28,1.32,3.35,3.36,4.47,4.86"/>
                <g>
                  <path className="cls-3" d="M77.76,21.62c1.03,7.7-.31,16.31-5.01,24.98-5.17,9.52-13.52,15.29-22.76,17.11-3.54-8.69-3.55-18.76,1.69-28.21,3.92-7.09,8.16-13.39,18.87-18.56,1.71-.83,4.36-1.66,5.7-2.03.1.05,1.11,3.69,1.51,6.7"/>
                  <path className="cls-6" d="M22.22,21.62c-1.03,7.7.31,16.31,5.01,24.98,5.17,9.52,13.52,15.29,22.76,17.11,3.54-8.69,3.55-18.76-1.69-28.21-3.92-7.09-8.16-13.39-18.87-18.56-1.71-.83-4.36-1.66-5.7-2.03-.1.05-1.11,3.69-1.51,6.7"/>
                </g>
              </g>
            </svg>
            <div style={{borderLeft:`1px solid rgba(255,255,255,0.25)`, paddingLeft:14, display:"flex", flexDirection:"column", gap:2}}>
              <h1 style={{
                margin:0, fontSize:22, fontWeight:800,
                fontFamily:"'Montserrat', 'Segoe UI', sans-serif",
                letterSpacing:"-0.02em",
                color:"#FFFFFF",
              }}>GIP Retention Calculator</h1>
              <p style={{margin:0, opacity:0.65, fontSize:12, color:"#FFFFFF", fontFamily:"'DM Sans', 'Segoe UI', sans-serif"}}>Guaranteed Income Plan</p>
            </div>
          </div>
          <p style={{margin:"10px 0 0", opacity:0.8, fontSize:13, lineHeight:1.5}}>
            See exactly how much you stand to lose if you exit your policy today — vs. what you gain by staying.
          </p>
        </div>
      </div>

      <div style={{maxWidth:700, margin:"0 auto", padding:"0 16px"}}>

        {/* ── INPUT SECTION ─────────────────────────────────────────── */}
        <Card style={{marginTop:-12, position:"relative", zIndex:2, borderRadius:"0 0 14px 14px"}}>
          <div style={{
            display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px 16px",
          }}>
            {/* Plan Option */}
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:12, fontWeight:600, color:C.grey600, textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:6}}>Which plan are you on?</label>
              <div style={{display:"flex", gap:10}}>
                {[["flexi","Flexi Start"],["extended","Extended Benefit"]].map(([v,l]) => (
                  <button key={v} onClick={() => setPlanOption(v)} style={{
                    flex:1, padding:"9px 0", borderRadius:8, border:`2px solid`,
                    borderColor: planOption===v ? C.navy : C.grey200,
                    background: planOption===v ? C.navy : C.white,
                    color: planOption===v ? C.white : C.grey600,
                    fontWeight:700, fontSize:13, cursor:"pointer",
                    transition:"all 0.15s",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            <NumberInput label="How much do you pay per year? (₹)" value={ap} onChange={setAp} min={30000} prefix="₹" />
            <Select label="For how many years do you pay?" value={ppt} onChange={v=>setPpt(Number(v))}
              options={planOption==="flexi" ? flexiPPTOptions : extPPTOptions} />

            {planOption === "extended" && (
              <Select label="Policy Term (Total duration)" value={pt} onChange={v=>setPt(Number(v))} options={extPTOptions} />
            )}

            {planOption === "flexi" && (
              <>
                <Select label="How long do you want income after maturity?" value={incomePeriod} onChange={v=>setIncomePeriod(Number(v))}
                  options={[10,15,20,25,30].map(v=>({value:v,label:`${v} years`}))} />
                <Select label="Did you delay your income start? (Deferment)" value={deferment} onChange={v=>setDeferment(Number(v))}
                  options={[...Array(maxDeferment+1)].map((_,i)=>({value:i,label:i===0?"No — income starts Year 1":`Yes — income starts Year ${i+1}`}))} />
              </>
            )}

            <div style={{display:"flex", flexDirection:"column", gap:4}}>
              <label style={{fontSize:12, fontWeight:600, color:C.grey600, textTransform:"uppercase", letterSpacing:"0.05em"}}>
                Which year are you thinking of exiting? (1–{maxSurrenderYear-1})
              </label>
              <input type="range" min={1} max={maxSurrenderYear-1} value={safeYears}
                onChange={e=>setYearsSurrender(Number(e.target.value))}
                style={{accentColor:C.navy, marginTop:8}}
              />
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:C.grey400}}>Year 1</span>
                <span style={{fontSize:14,fontWeight:700,color:C.navy}}>Exiting at end of Year {safeYears}</span>
                <span style={{fontSize:12,color:C.grey400}}>Year {maxSurrenderYear-1}</span>
              </div>
            </div>

            {planOption === "flexi" && (
              <div style={{display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.navyPale, borderRadius:8}}>
                <input type="checkbox" id="rop" checked={ropChosen} onChange={e=>setRopChosen(e.target.checked)}
                  style={{width:16,height:16,accentColor:C.navy,cursor:"pointer"}} />
                <label htmlFor="rop" style={{fontSize:13,fontWeight:600,color:C.navy,cursor:"pointer"}}>
                  Did you opt for Premiums Back (RoP) at the start?
                </label>
              </div>
            )}
          </div>
        </Card>

        {/* ── HERO: SURRENDER VALUE ─────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`,
          borderRadius:14, padding:"22px 22px", marginTop:16, color:C.white,
        }}>
          <div style={{fontSize:12, opacity:0.65, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16}}>
            If you exit at end of Year {safeYears}
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:20}}>
            <div>
              <div style={{fontSize:12,opacity:0.65,marginBottom:4}}>Total you've paid so far</div>
              <div style={{fontSize:22,fontWeight:800}}>{fmt(result.totalPremiumsPaid)}</div>
            </div>
            <div>
              <div style={{fontSize:12,opacity:0.65,marginBottom:4}}>You'd get back ({result.svType})</div>
              <div style={{fontSize:22,fontWeight:800,color:"#7EE8C0"}}>{fmt(result.surrenderValue)}</div>
            </div>
          </div>

          {/* Recovery bar */}
          <div style={{marginTop:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,opacity:0.65}}>How much of your money comes back</span>
              <span style={{fontSize:14,fontWeight:700,color: result.recoveryPct >= 100 ? "#7EE8C0" : "#F5A623"}}>
                {pct(result.recoveryPct)}
              </span>
            </div>
            <div style={{background:"rgba(255,255,255,0.15)",borderRadius:99,height:8}}>
              <div style={{
                width:`${Math.min(100,result.recoveryPct)}%`,height:"100%",
                background: result.recoveryPct>=100?"#7EE8C0":"#F5A623",
                borderRadius:99, transition:"width 0.4s ease",
              }}/>
            </div>
          </div>

          <div style={{marginTop:12, padding:"10px 14px", background:"rgba(255,255,255,0.08)", borderRadius:8, fontSize:12, display:"flex",justifyContent:"space-between"}}>
            <span style={{opacity:0.75}}>Min guaranteed: {fmt(result.gsv)}</span>
            <span style={{opacity:0.75}}>Estimated value: {fmt(result.ssv)}</span>
          </div>
          <div style={{marginTop:8, fontSize:12, opacity:0.55, textAlign:"center"}}>
            You receive whichever is higher · Income already paid out: {fmt(result.siPaidTotal)}
          </div>
        </div>

        {/* ── WHAT YOU GIVE UP ─────────────────────────────────────── */}
        <Card style={{marginTop:16, border:`2px solid ${C.redBg}`}}>
          <CardTitle icon="🚨" label="What You're Walking Away From" color={C.red} />

          <div style={{
            background: C.redBg, borderRadius:10, padding:"14px 16px", marginBottom:16,
          }}>
            <div style={{fontSize:12,color:C.redDark,fontWeight:600,marginBottom:6}}>
              MONEY YOU WILL NEVER GET BACK
            </div>
            <div style={{fontSize:26,fontWeight:800,color:C.red}}>{fmt(result.lossIfSurrender)}</div>
            <div style={{fontSize:12,color:C.redDark,marginTop:4}}>
              This is the gap between what you'd get today vs. what you'd receive if you stay
            </div>
          </div>

          {/* Visual comparison bar */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,color:C.grey600,fontWeight:600}}>Exit today</span>
              <span style={{fontSize:12,color:C.grey600,fontWeight:600}}>Stay till end</span>
            </div>
            <div style={{background:C.grey100,borderRadius:99,height:16,position:"relative",overflow:"hidden"}}>
              <div style={{
                position:"absolute",left:0,top:0,height:"100%",
                width:`${result.totalBenefitIfStay > 0 ? Math.min(95,(result.surrenderValue/result.totalBenefitIfStay)*100) : 0}%`,
                background:C.red,borderRadius:99,
                display:"flex",alignItems:"center",justifyContent:"flex-end",
                paddingRight:6,
              }}>
                <span style={{fontSize:10,color:C.white,fontWeight:700}}>{fmt(result.surrenderValue)}</span>
              </div>
            </div>
            <div style={{textAlign:"right",marginTop:4,fontSize:12,color:C.green,fontWeight:700}}>
              vs {fmt(result.totalBenefitIfStay)} if you stay
            </div>
          </div>

          <InfoRow label="Your yearly income from this policy" value={fmt(result.annualSI) + " / year"} />
          <InfoRow label={futureLabel} value={fmt(result.futureIncome)} highlight="green" />
          {planOption === "flexi" && ropChosen && (
            <InfoRow label="Your premiums back + 10% bonus (at end)" value={fmt(result.maturityBenefitTotal)} highlight="green" />
          )}
          {planOption === "extended" && (
            <InfoRow label="All your premiums returned at the end" value={fmt(result.maturityBenefitTotal)} highlight="green" />
          )}
          {result.premiumsStillDue > 0 && (
            <div style={{
              marginTop:12, padding:"10px 14px",
              background:C.amberBg, borderRadius:8,
              fontSize:13, color:C.amberDark,
            }}>
              ⚠️ You still have <strong>{fmt(result.premiumsStillDue)}</strong> left to pay — but the returns far outweigh the cost of staying.
            </div>
          )}
        </Card>

        <Card style={{marginTop:16}}>
          <CardTitle icon="🛡️" label="Your Family's Protection — Gone Too" color={C.navy} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <div style={{background:C.navyPale,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
              <div style={{fontSize:12,color:C.grey600,marginBottom:4}}>Your family gets today if something happens to you</div>
              <div style={{fontSize:20,fontWeight:800,color:C.navy}}>{fmt(result.deathBenefit)}</div>
            </div>
            <div style={{background:C.redBg,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
              <div style={{fontSize:12,color:C.redDark,marginBottom:4}}>If you exit, they get</div>
              <div style={{fontSize:20,fontWeight:800,color:C.red}}>₹0</div>
            </div>
          </div>
          <p style={{fontSize:12,color:C.grey400,marginTop:12,marginBottom:0,lineHeight:1.6}}>
            The moment you exit, your life cover disappears. Your family would no longer be protected.
          </p>
        </Card>

        {/* ── TOTAL VALUE SCORECARD ─────────────────────────────────── */}
        <Card style={{marginTop:16}}>
          <CardTitle icon="📈" label="The Full Picture: Stay vs. Exit" color={C.green} />
          <div style={{
            background: C.greenBg, borderRadius:10, padding:"14px 16px", marginBottom:14,
          }}>
            <div style={{fontSize:12,color:C.greenDark,fontWeight:600,marginBottom:4}}>TOTAL YOU RECEIVE IF YOU STAY</div>
            <div style={{fontSize:26,fontWeight:800,color:C.green}}>{fmt(result.totalBenefitIfStay)}</div>
            <div style={{fontSize:12,color:C.greenDark,marginTop:2}}>All amounts are guaranteed — not linked to markets</div>
          </div>
          <InfoRow label="Total you'll pay over the full term" value={fmt(ppt * ap)} />
          <InfoRow label="Regular income you'd still receive" value={fmt(result.futureIncome)} highlight="green" />
          {planOption==="flexi" && ropChosen && <InfoRow label="Premiums back + 10% bonus at the end" value={fmt(result.maturityBenefitTotal)} highlight="green" />}
          {planOption==="extended" && <InfoRow label="All premiums returned at the end" value={fmt(result.maturityBenefitTotal)} highlight="green" />}

          <div style={{
            marginTop:14, padding:"12px 16px",
            background: C.navyPale, borderRadius:8,
            display:"flex", justifyContent:"space-between", alignItems:"center",
          }}>
            <span style={{fontSize:13,fontWeight:600,color:C.navy}}>Exiting today costs you</span>
            <span style={{fontSize:18,fontWeight:800,color:C.red}}>− {fmt(result.lossIfSurrender)}</span>
          </div>
        </Card>

        {/* ── ALTERNATIVES TO SURRENDER ────────────────────────────── */}
        <Card style={{marginTop:16}}>
          <CardTitle icon="💡" label="Before You Exit, Consider These Options" color={C.amber} />
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {
                icon:"🏦",
                title:"Take a Loan Against Your Policy",
                desc:`Need cash urgently? Borrow up to ${fmt(result.surrenderValue * 0.8)} at ~8.5% interest. Your policy stays alive and your income keeps coming.`,
              },
              {
                icon:"⏸️",
                title:"Stop Paying, But Keep the Policy",
                desc:"Can't afford premiums right now? You can stop paying and the policy continues — just with a smaller income and cover. Much better than exiting entirely.",
              },
              {
                icon:"💰",
                title:"Save Your Income Inside the Policy",
                desc:"Instead of taking your income monthly, let it build up inside the policy. You can withdraw any amount (min ₹2,000) whenever you need it.",
              },
              {
                icon:"🔄",
                title:"Use Your Income to Pay Premiums",
                desc:"After 3 years, your policy income can automatically pay your next premium — so your out-of-pocket cost drops significantly.",
              },
              {
                icon:"⏳",
                title:"Missed Some Payments? You Can Revive",
                desc:"If you've skipped premiums, don't exit — you have up to 5 years to pay them back and get all your benefits fully restored.",
              },
            ].map(a => (
              <div key={a.title} style={{
                display:"flex", flexDirection:"column", alignItems:"center",
                gap:6, padding:"14px 16px",
                background:C.amberBg, borderRadius:10, textAlign:"center",
              }}>
                <span style={{fontSize:24,lineHeight:1}}>{a.icon}</span>
                <div style={{fontWeight:700,fontSize:14,color:C.amberDark}}>{a.title}</div>
                <div style={{fontSize:12,color:C.grey600,lineHeight:1.5,maxWidth:480}}>{a.desc}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{marginTop:20,padding:"14px 16px",background:C.grey100,borderRadius:10}}>
          <p style={{margin:0, fontSize:11, color:C.grey400, lineHeight:1.7}}>
            <strong>Note:</strong> The amounts shown are indicative estimates based on your policy details. Actual values may vary — please refer to your official policy documents or speak with your advisor before making any decision. Bandhan Life Insurance Limited, IRDAI Reg. No. 138 (UIN: 138N118V02).
          </p>
        </div>

      </div>
    </div>
  );
}