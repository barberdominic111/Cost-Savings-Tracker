import React, { useState, useEffect, useMemo } from "react";

/* =========================================================================
   LOCAL STORAGE PERSISTENCE
   All app data lives on-device in the browser's localStorage. Nothing is
   sent to a server. Clearing browser data / site data will erase it.
   ========================================================================= */
const STORAGE_KEY = "mfg-cost-analyzer:v1";

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Could not load saved data:", e);
    return null;
  }
}

function savePersisted(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save data:", e);
  }
}

/* =========================================================================
   THEME (from provided theme spec)
   ========================================================================= */
const T = {
  font: "Inter, system-ui, sans-serif",
  mono: "DM Mono, monospace",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#1E293B",
  heading: "#0F172A",
  muted: "#64748B",
  placeholder: "#94A3B8",
  blue: "#2563EB",
  blueLightBg: "#EFF6FF",
  blueLightBorder: "#BFDBFE",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  redLightBg: "#FEF2F2",
  redLightBorder: "#FECACA",
  purple: "#A855F7",
  sky: "#0EA5E9",
  slate: "#64748B",
  gray: "#CBD5E1",
  lightGray: "#E2E8F0",
  lightestGray: "#F1F5F9",
};

const GFONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap";

/* =========================================================================
   IMPACT TYPE COLORS
   ========================================================================= */
const IMPACT_COLORS = {
  "Hard Savings": { bg: "#ECFDF5", border: T.green, text: "#047857", label: "Hard Savings" },
  "Cost Avoidance": { bg: "#FFFBEB", border: T.amber, text: "#B45309", label: "Cost Avoidance" },
  "Soft Savings": { bg: T.blueLightBg, border: T.blue, text: "#1D4ED8", label: "Soft Savings / Productivity" },
  "No Impact": { bg: T.lightestGray, border: T.gray, text: T.muted, label: "No Impact" },
};

/* =========================================================================
   DECISION TREE / IMPROVEMENT TYPES
   ========================================================================= */
const IMPROVEMENT_CATEGORIES = [
  {
    category: "Time Reduced",
    items: ["Non-Bottleneck Cycle Reduction", "Bottleneck Cycle Reduction", "Setup Reduction", "Rework Reduction"],
  },
  {
    category: "Quality Improved",
    items: ["Scrap Reduction", "Defect Reduction"],
  },
  {
    category: "Material Reduced",
    items: ["Packaging Reduction", "BOM Reduction"],
  },
  {
    category: "Resource Changed",
    items: ["Labor Reduction", "Labor Elimination", "Temp Labor Reduction", "Overtime Elimination"],
  },
  {
    category: "Space / Asset Changed",
    items: ["Floor Space Reduction", "Equipment Reduction"],
  },
];

const COST_CATEGORIES = {
  group1: ["Direct Labor", "Variable Overhead", "Fixed Overhead"],
  group2: ["Material", "Overtime"],
  group3: ["Temp Labor", "Capacity Created", "Absorption Improvement"],
};

/* =========================================================================
   FINGERPRINT MATRIX (data-driven — no hard-coded UI calc logic)
   Each improvement lists which cost categories it touches and how.
   ========================================================================= */
const FINGERPRINT_MATRIX = {
  "Non-Bottleneck Cycle Reduction": [
    { costCategory: "Direct Labor", impactType: "Soft Savings", formula: "hoursReduced * directLaborRate" },
    { costCategory: "Variable Overhead", impactType: "Soft Savings", formula: "hoursReduced * variableBurdenRate" },
    { costCategory: "Capacity Created", impactType: "Soft Savings", formula: "(beforeTime - afterTime) * annualVolume" },
  ],
  "Bottleneck Cycle Reduction": [
    { costCategory: "Direct Labor", impactType: "Hard Savings", formula: "hoursReduced * directLaborRate" },
    { costCategory: "Variable Overhead", impactType: "Hard Savings", formula: "hoursReduced * variableBurdenRate" },
    { costCategory: "Capacity Created", impactType: "Soft Savings", formula: "(beforeTime - afterTime) * annualVolume" },
    { costCategory: "Absorption Improvement", impactType: "Soft Savings", formula: "earnedStdHours / actualHours" },
  ],
  "Setup Reduction": [
    { costCategory: "Direct Labor", impactType: "Soft Savings", formula: "hoursReduced * directLaborRate" },
    { costCategory: "Capacity Created", impactType: "Soft Savings", formula: "(beforeTime - afterTime) * annualVolume" },
  ],
  "Rework Reduction": [
    { costCategory: "Direct Labor", impactType: "Hard Savings", formula: "hoursReduced * directLaborRate" },
    { costCategory: "Variable Overhead", impactType: "Hard Savings", formula: "hoursReduced * variableBurdenRate" },
    { costCategory: "Material", impactType: "Hard Savings", formula: "annualVolume * materialReductionPerUnit" },
  ],
  "Scrap Reduction": [
    { costCategory: "Material", impactType: "Hard Savings", formula: "annualVolume * materialReductionPerUnit" },
    { costCategory: "Direct Labor", impactType: "Hard Savings", formula: "hoursReduced * directLaborRate" },
    { costCategory: "Fixed Overhead", impactType: "No Impact", formula: "hoursReduced * fixedOverheadRate" },
  ],
  "Defect Reduction": [
    { costCategory: "Material", impactType: "Cost Avoidance", formula: "annualVolume * materialReductionPerUnit" },
    { costCategory: "Direct Labor", impactType: "Cost Avoidance", formula: "hoursReduced * directLaborRate" },
  ],
  "Packaging Reduction": [
    { costCategory: "Material", impactType: "Hard Savings", formula: "annualVolume * materialReductionPerUnit" },
  ],
  "BOM Reduction": [
    { costCategory: "Material", impactType: "Hard Savings", formula: "annualVolume * materialReductionPerUnit" },
  ],
  "Labor Reduction": [
    { costCategory: "Direct Labor", impactType: "Soft Savings", formula: "hoursReduced * directLaborRate" },
    { costCategory: "Capacity Created", impactType: "Soft Savings", formula: "(beforeTime - afterTime) * annualVolume" },
  ],
  "Labor Elimination": [
    { costCategory: "Direct Labor", impactType: "Hard Savings", formula: "hoursReduced * directLaborRate" },
    { costCategory: "Variable Overhead", impactType: "Hard Savings", formula: "hoursReduced * variableBurdenRate" },
    { costCategory: "Fixed Overhead", impactType: "No Impact", formula: "hoursReduced * fixedOverheadRate" },
  ],
  "Temp Labor Reduction": [
    { costCategory: "Temp Labor", impactType: "Hard Savings", formula: "hoursAvoided * tempLaborRate" },
  ],
  "Overtime Elimination": [
    { costCategory: "Overtime", impactType: "Hard Savings", formula: "hours * otRate" },
  ],
  "Floor Space Reduction": [
    { costCategory: "Fixed Overhead", impactType: "Cost Avoidance", formula: "sqFtReduced * costPerSqFt" },
  ],
  "Equipment Reduction": [
    { costCategory: "Fixed Overhead", impactType: "Cost Avoidance", formula: "equipmentCost" },
  ],
};

/* =========================================================================
   CALCULATION ENGINE (pure functions — no UI logic)
   Each returns { result, breakdown: [{label, value}], resultLabel }
   ========================================================================= */
function computeDirectLabor(inputs) {
  const { hoursReduced = 0, directLaborRate = 0 } = inputs;
  return {
    result: hoursReduced * directLaborRate,
    resultLabel: "Direct Labor Savings",
    breakdown: [
      { label: "Hours Reduced", value: hoursReduced },
      { label: "Direct Labor Rate ($/hr)", value: directLaborRate },
    ],
  };
}
function computeVariableOverhead(inputs) {
  const { hoursReduced = 0, variableBurdenRate = 0 } = inputs;
  return {
    result: hoursReduced * variableBurdenRate,
    resultLabel: "Variable Overhead Savings",
    breakdown: [
      { label: "Hours Reduced", value: hoursReduced },
      { label: "Variable Burden Rate ($/hr)", value: variableBurdenRate },
    ],
  };
}
function computeFixedOverhead(inputs) {
  const { hoursReduced = 0, fixedOverheadRate = 0 } = inputs;
  return {
    result: hoursReduced * fixedOverheadRate,
    resultLabel: "Absorption / Standard Cost Impact",
    breakdown: [
      { label: "Hours Reduced", value: hoursReduced },
      { label: "Fixed Overhead Rate ($/hr)", value: fixedOverheadRate },
    ],
    note: "Not automatically classified as savings — fixed overhead impact affects absorption, not cash cost.",
  };
}
function computeMaterial(inputs) {
  const { annualVolume = 0, materialReductionPerUnit = 0 } = inputs;
  return {
    result: annualVolume * materialReductionPerUnit,
    resultLabel: "Material Savings",
    breakdown: [
      { label: "Annual Volume (units)", value: annualVolume },
      { label: "Material Reduction / Unit ($)", value: materialReductionPerUnit },
    ],
  };
}
function computeOvertime(inputs) {
  const { hours = 0, directLaborRate = 0, otRate = 0 } = inputs;
  const straight = hours * directLaborRate;
  const premium = hours * (otRate - directLaborRate);
  const total = hours * otRate;
  return {
    result: total,
    resultLabel: "Overtime Avoided (Total)",
    breakdown: [
      { label: "Hours", value: hours },
      { label: "OT Rate ($/hr)", value: otRate },
      { label: "Straight Time Avoided ($)", value: straight },
      { label: "OT Premium Avoided ($)", value: premium },
    ],
  };
}
function computeTempLabor(inputs) {
  const { hoursAvoided = 0, tempLaborRate = 0 } = inputs;
  return {
    result: hoursAvoided * tempLaborRate,
    resultLabel: "Temp Labor Savings",
    breakdown: [
      { label: "Hours Avoided", value: hoursAvoided },
      { label: "Temp Labor Rate ($/hr)", value: tempLaborRate },
    ],
  };
}
function computeCapacityCreated(inputs) {
  const { beforeTime = 0, afterTime = 0, annualVolume = 0 } = inputs;
  return {
    result: (beforeTime - afterTime) * annualVolume,
    resultLabel: "Capacity Created - Requires Conversion",
    breakdown: [
      { label: "Before Time (hrs/unit)", value: beforeTime },
      { label: "After Time (hrs/unit)", value: afterTime },
      { label: "Annual Volume (units)", value: annualVolume },
    ],
    note: "Hours of capacity created. Requires conversion to $ value (e.g. via absorption of new volume) to count as savings.",
  };
}
function computeAbsorption(inputs) {
  const { earnedStdHours = 0, actualHours = 1 } = inputs;
  const pct = actualHours === 0 ? 0 : (earnedStdHours / actualHours) * 100;
  return {
    result: pct,
    resultLabel: "Absorption Efficiency %",
    isPercent: true,
    breakdown: [
      { label: "Earned Standard Hours", value: earnedStdHours },
      { label: "Actual Hours", value: actualHours },
    ],
  };
}

const CALC_ENGINE = {
  "Direct Labor": computeDirectLabor,
  "Variable Overhead": computeVariableOverhead,
  "Fixed Overhead": computeFixedOverhead,
  "Material": computeMaterial,
  "Overtime": computeOvertime,
  "Temp Labor": computeTempLabor,
  "Capacity Created": computeCapacityCreated,
  "Absorption Improvement": computeAbsorption,
};

// Which data-model fields feed each calc's inputs, for auto-pull defaults
function defaultInputsFor(costCategory, dataModel, timeInputs) {
  const dm = dataModel;
  const t = timeInputs;
  switch (costCategory) {
    case "Direct Labor":
      return { hoursReduced: t.hoursReduced, directLaborRate: dm.directLaborRate };
    case "Variable Overhead":
      return { hoursReduced: t.hoursReduced, variableBurdenRate: dm.variableBurdenRate };
    case "Fixed Overhead":
      return { hoursReduced: t.hoursReduced, fixedOverheadRate: dm.fixedOverheadRate };
    case "Material":
      return { annualVolume: dm.annualVolume, materialReductionPerUnit: t.materialReductionPerUnit };
    case "Overtime":
      return { hours: t.hoursReduced, directLaborRate: dm.directLaborRate, otRate: dm.directLaborRate * (dm.overtimeMultiplier || 1.5) };
    case "Temp Labor":
      return { hoursAvoided: t.hoursReduced, tempLaborRate: dm.tempLaborRate };
    case "Capacity Created":
      return { beforeTime: dm.currentCycleTime, afterTime: dm.improvedCycleTime, annualVolume: dm.annualVolume };
    case "Absorption Improvement":
      return { earnedStdHours: dm.annualVolume * dm.improvedCycleTime, actualHours: dm.workHoursPerYear };
    default:
      return {};
  }
}

/* =========================================================================
   DATA MODEL DEFAULTS
   ========================================================================= */
const DEFAULT_DATA_MODEL = {
  plantName: "",
  department: "",
  workCenter: "",
  processType: "Assembly",

  directLaborRate: 28,
  variableBurdenRate: 12,
  fixedOverheadRate: 18,
  fullyLoadedLaborRate: 58,
  workHoursPerYear: 2080,

  numDirectLaborEmployees: 12,
  avgEmployeeLoadedCost: 62000,
  avgTempLaborRate: 24,
  tempConversionCost: 1500,
  overtimeMultiplier: 1.5,

  annualVolume: 120000,
  weeklyVolume: 2300,
  monthlyVolume: 10000,
  unitsPerHour: 45,
  demandGrowthRate: 3,
  currentBottleneckWorkCenter: "",

  currentCycleTime: 0.05,
  improvedCycleTime: 0.04,
  currentSetupTime: 30,
  improvedSetupTime: 15,
  currentReworkTime: 5,
  improvedReworkTime: 2,

  currentScrapPct: 4,
  futureScrapPct: 2,
  materialCostPerUnit: 6.5,
  laborContentPerUnit: 1.2,
  reworkCostPerUnit: 3.1,

  currentMaterialCost: 6.5,
  futureMaterialCost: 6.1,
  packagingCost: 0.35,
  freightCost: 0.2,
  disposalCost: 0.05,

  sqFtCost: 8,
  equipmentCost: 45000,
  equipmentDepreciation: 9000,
  maintenanceCost: 4000,
};

const FIELD_GROUPS = [
  {
    title: "Plant Information",
    fields: [
      { key: "plantName", label: "Plant Name", type: "text" },
      { key: "department", label: "Department", type: "text" },
      { key: "workCenter", label: "Work Center", type: "text" },
      { key: "processType", label: "Process Type", type: "select", options: ["Assembly", "Machining", "Injection Molding", "Packaging", "Other"] },
    ],
  },
  {
    title: "Labor Cost Model",
    fields: [
      { key: "directLaborRate", label: "Direct Labor Rate ($/hr)", type: "number" },
      { key: "variableBurdenRate", label: "Variable Labor Burden Rate ($/hr)", type: "number" },
      { key: "fixedOverheadRate", label: "Fixed Overhead Rate ($/hr)", type: "number" },
      { key: "fullyLoadedLaborRate", label: "Fully Loaded Labor Rate ($/hr)", type: "number" },
      { key: "workHoursPerYear", label: "Work Hours Per Year", type: "number" },
    ],
  },
  {
    title: "Labor Resource Model",
    fields: [
      { key: "numDirectLaborEmployees", label: "# Direct Labor Employees", type: "number" },
      { key: "avgEmployeeLoadedCost", label: "Avg Employee Loaded Cost ($/yr)", type: "number" },
      { key: "avgTempLaborRate", label: "Avg Temp Labor Rate ($/hr)", type: "number" },
      { key: "tempConversionCost", label: "Temp Conversion Cost ($)", type: "number" },
      { key: "overtimeMultiplier", label: "Avg Overtime Multiplier (x)", type: "number" },
    ],
  },
  {
    title: "Production Model",
    fields: [
      { key: "annualVolume", label: "Annual Volume (units)", type: "number" },
      { key: "weeklyVolume", label: "Weekly Volume (units)", type: "number" },
      { key: "monthlyVolume", label: "Monthly Volume (units)", type: "number" },
      { key: "unitsPerHour", label: "Units per Hour", type: "number" },
      { key: "demandGrowthRate", label: "Demand Growth Rate (%)", type: "number" },
      { key: "currentBottleneckWorkCenter", label: "Current Bottleneck Work Center", type: "text" },
    ],
  },
  {
    title: "Time Model",
    fields: [
      { key: "currentCycleTime", label: "Current Cycle Time (hrs/unit)", type: "number" },
      { key: "improvedCycleTime", label: "Improved Cycle Time (hrs/unit)", type: "number" },
      { key: "currentSetupTime", label: "Current Setup Time (min)", type: "number" },
      { key: "improvedSetupTime", label: "Improved Setup Time (min)", type: "number" },
      { key: "currentReworkTime", label: "Current Rework Time (min)", type: "number" },
      { key: "improvedReworkTime", label: "Improved Rework Time (min)", type: "number" },
    ],
  },
  {
    title: "Quality Model",
    fields: [
      { key: "currentScrapPct", label: "Current Scrap %", type: "number" },
      { key: "futureScrapPct", label: "Future Scrap %", type: "number" },
      { key: "materialCostPerUnit", label: "Material Cost Per Unit ($)", type: "number" },
      { key: "laborContentPerUnit", label: "Labor Content Per Unit (hrs)", type: "number" },
      { key: "reworkCostPerUnit", label: "Rework Cost Per Unit ($)", type: "number" },
    ],
  },
  {
    title: "Material Model",
    fields: [
      { key: "currentMaterialCost", label: "Current Material Cost ($/unit)", type: "number" },
      { key: "futureMaterialCost", label: "Future Material Cost ($/unit)", type: "number" },
      { key: "packagingCost", label: "Packaging Cost ($/unit)", type: "number" },
      { key: "freightCost", label: "Freight Cost ($/unit)", type: "number" },
      { key: "disposalCost", label: "Disposal Cost ($/unit)", type: "number" },
    ],
  },
  {
    title: "Space / Asset Model",
    fields: [
      { key: "sqFtCost", label: "Square Foot Cost ($/sqft/yr)", type: "number" },
      { key: "equipmentCost", label: "Equipment Cost ($)", type: "number" },
      { key: "equipmentDepreciation", label: "Equipment Depreciation ($/yr)", type: "number" },
      { key: "maintenanceCost", label: "Maintenance Cost ($/yr)", type: "number" },
    ],
  },
];

/* =========================================================================
   SHARED UI PRIMITIVES
   ========================================================================= */
function Card({ children, style }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}
function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: T.placeholder, textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}
function PrimaryButton({ children, onClick, style, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? T.gray : T.blue,
        color: "#FFFFFF",
        border: "none",
        borderRadius: 12,
        padding: "18px",
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: "0.05em",
        width: "100%",
        touchAction: "manipulation",
        cursor: disabled ? "default" : "pointer",
        fontFamily: T.font,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
function OutlineButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "#FFFFFF",
        border: `1.5px solid ${T.border}`,
        borderRadius: 10,
        color: T.muted,
        fontWeight: 700,
        padding: "10px 14px",
        touchAction: "manipulation",
        cursor: "pointer",
        fontFamily: T.font,
        fontSize: 14,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
function DestructiveButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: T.redLightBg,
        color: T.red,
        border: `1.5px solid ${T.redLightBorder}`,
        borderRadius: 8,
        padding: "6px 14px",
        fontWeight: 700,
        fontSize: 13,
        touchAction: "manipulation",
        cursor: "pointer",
        fontFamily: T.font,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
function ToggleChip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? T.blueLightBg : "#FFFFFF",
        border: `1.5px solid ${active ? T.blue : T.border}`,
        color: active ? T.blue : T.muted,
        fontWeight: 700,
        borderRadius: 10,
        padding: "8px 12px",
        fontSize: 13,
        touchAction: "manipulation",
        cursor: "pointer",
        fontFamily: T.font,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
function Field({ label, value, onChange, type = "number", options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 5 }}>{label}</div>
      {type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            border: `1.5px solid ${T.gray}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 15,
            background: T.bg,
            color: T.text,
            width: "100%",
            boxSizing: "border-box",
            fontFamily: T.font,
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
          style={{
            border: `1.5px solid ${T.gray}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 15,
            background: T.bg,
            color: T.text,
            width: "100%",
            boxSizing: "border-box",
            fontFamily: type === "number" ? T.mono : T.font,
          }}
        />
      )}
    </div>
  );
}
function EmptyState({ children }) {
  return (
    <div style={{ textAlign: "center", color: T.placeholder, fontSize: 15, padding: "60px 24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 16 }}>
      {children}
    </div>
  );
}
function fmtMoney(n) {
  if (n === undefined || n === null || isNaN(n)) return "$0";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtNum(n, decimals = 2) {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

/* =========================================================================
   TAB BAR
   ========================================================================= */
const TABS = [
  "Data Model",
  "Decision Tree",
  "Fingerprint Matrix",
  "Savings Calculations",
  "Finance Review",
  "Saved Assessments",
];

function TabBar({ active, setActive }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        display: "flex",
        background: "#FFFFFF",
        borderBottom: `1px solid ${T.border}`,
        overflowX: "auto",
        zIndex: 10,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <div
            key={tab}
            onClick={() => setActive(tab)}
            style={{
              flex: "1 0 auto",
              minWidth: 110,
              padding: "12px 8px",
              borderBottom: isActive ? `3px solid ${T.blue}` : "3px solid transparent",
              color: isActive ? T.blue : T.muted,
              fontSize: 12.5,
              fontWeight: isActive ? 700 : 600,
              textAlign: "center",
              cursor: "pointer",
              touchAction: "manipulation",
              whiteSpace: "nowrap",
            }}
          >
            {tab}
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   TAB 1: DATA MODEL
   ========================================================================= */
function DataModelTab({ dataModel, setDataModel }) {
  const update = (key, value) => setDataModel((dm) => ({ ...dm, [key]: value }));
  return (
    <div>
      <Card style={{ background: T.blueLightBg, border: `1px solid ${T.blueLightBorder}` }}>
        <div style={{ fontSize: 13, color: "#1D4ED8", lineHeight: 1.5 }}>
          When you analyze an improvement, the app already knows the rates and information needed to calculate savings — everything below feeds the calculation engine automatically.
        </div>
      </Card>
      {FIELD_GROUPS.map((group) => (
        <Card key={group.title}>
          <SectionLabel>{group.title}</SectionLabel>
          {group.fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              type={f.type}
              options={f.options}
              value={dataModel[f.key]}
              onChange={(v) => update(f.key, v)}
            />
          ))}
        </Card>
      ))}
    </div>
  );
}

/* =========================================================================
   TAB 2: DECISION TREE
   ========================================================================= */
function DecisionTreeTab({ selectedImprovement, setSelectedImprovement, goToMatrix }) {
  return (
    <div>
      <Card>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.heading, marginBottom: 4 }}>What changed in the process?</div>
        <div style={{ fontSize: 13, color: T.muted }}>Pick the improvement type. Your selection highlights the impacted cells in the Fingerprint Matrix.</div>
      </Card>
      {IMPROVEMENT_CATEGORIES.map((cat) => (
        <Card key={cat.category}>
          <SectionLabel>{cat.category}</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cat.items.map((item) => (
              <ToggleChip
                key={item}
                active={selectedImprovement === item}
                onClick={() => setSelectedImprovement(item)}
              >
                {item}
              </ToggleChip>
            ))}
          </div>
        </Card>
      ))}
      {selectedImprovement && (
        <PrimaryButton onClick={goToMatrix}>View Fingerprint Matrix →</PrimaryButton>
      )}
    </div>
  );
}

/* =========================================================================
   TAB 3: FINGERPRINT MATRIX
   ========================================================================= */
function MatrixCell({ impact, isImprovementSelected, onClick }) {
  const type = impact ? impact.impactType : "No Impact";
  const colors = IMPACT_COLORS[type] || IMPACT_COLORS["No Impact"];
  const active = impact && isImprovementSelected;
  return (
    <div
      onClick={active ? onClick : undefined}
      style={{
        background: active ? colors.bg : T.lightestGray,
        border: `1.5px solid ${active ? colors.border : T.lightGray}`,
        borderRadius: 8,
        padding: "10px 6px",
        textAlign: "center",
        fontSize: 11,
        fontWeight: 700,
        color: active ? colors.text : T.gray,
        cursor: active ? "pointer" : "default",
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
      }}
    >
      {active ? colors.label : "—"}
    </div>
  );
}

function FingerprintMatrixTab({ selectedImprovement, onSelectCell }) {
  const allCostCategories = [...COST_CATEGORIES.group1, ...COST_CATEGORIES.group2, ...COST_CATEGORIES.group3];
  const impacts = selectedImprovement ? FINGERPRINT_MATRIX[selectedImprovement] || [] : [];
  const impactFor = (cat) => impacts.find((i) => i.costCategory === cat);

  return (
    <div>
      {!selectedImprovement && (
        <Card style={{ background: T.redLightBg, border: `1px solid ${T.redLightBorder}` }}>
          <div style={{ fontSize: 13, color: T.red, fontWeight: 600 }}>Select an improvement in the Decision Tree tab first.</div>
        </Card>
      )}
      <Card>
        <SectionLabel>{selectedImprovement || "No improvement selected"}</SectionLabel>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.muted, marginBottom: 14, flexWrap: "wrap" }}>
          {Object.entries(IMPACT_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}` }} />
              {v.label}
            </div>
          ))}
        </div>

        {[
          { title: "ERP / Cost Accounting Impact", cats: COST_CATEGORIES.group1 },
          { title: "Planning & Buying Impact", cats: COST_CATEGORIES.group2 },
          { title: "Resource Utilization Impact", cats: COST_CATEGORIES.group3 },
        ].map((group) => (
          <div key={group.title} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
              {group.title}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${group.cats.length}, 1fr)`, gap: 8 }}>
              {group.cats.map((cat) => (
                <div key={cat}>
                  <div style={{ fontSize: 10, color: T.placeholder, textAlign: "center", marginBottom: 4, fontWeight: 600 }}>{cat}</div>
                  <MatrixCell
                    impact={impactFor(cat)}
                    isImprovementSelected={!!selectedImprovement}
                    onClick={() => onSelectCell(cat, impactFor(cat))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* =========================================================================
   TAB 4: SAVINGS CALCULATIONS
   ========================================================================= */
function CalculationCard({ calc, dataModel, onUpdateInputs, onRemove, onApprove }) {
  const engineFn = CALC_ENGINE[calc.costCategory];
  const output = engineFn(calc.inputs);
  const colors = IMPACT_COLORS[calc.impactType] || IMPACT_COLORS["No Impact"];

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.heading }}>{calc.costCategory}</div>
          <div style={{ fontSize: 12, color: T.muted }}>{calc.improvement}</div>
        </div>
        <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8 }}>
          {colors.label}
        </div>
      </div>

      <div style={{ fontSize: 12, color: T.placeholder, fontFamily: T.mono, marginBottom: 10 }}>
        formula: {calc.formula}
      </div>

      {output.breakdown.map((b, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 600, marginBottom: 3 }}>{b.label}</div>
          <input
            type="number"
            value={calc.inputs[Object.keys(calc.inputs)[i]]}
            onChange={(e) => {
              const key = Object.keys(calc.inputs)[i];
              onUpdateInputs(calc.id, { ...calc.inputs, [key]: parseFloat(e.target.value) || 0 });
            }}
            style={{
              border: `1.5px solid ${T.gray}`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 14,
              background: T.bg,
              color: T.text,
              width: "100%",
              boxSizing: "border-box",
              fontFamily: T.mono,
            }}
          />
        </div>
      ))}

      <div style={{ background: T.lightestGray, borderRadius: 10, padding: "12px 14px", marginTop: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.placeholder, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          {output.resultLabel}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 700, color: T.heading }}>
          {output.isPercent ? `${fmtNum(output.result, 1)}%` : fmtMoney(output.result)}
        </div>
        {output.note && (
          <div style={{ fontSize: 11, color: T.amber, marginTop: 6, fontStyle: "italic" }}>{output.note}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.muted, flex: 1 }}>
          <input type="checkbox" checked={!!calc.approved} onChange={(e) => onApprove(calc.id, e.target.checked)} />
          Finance approved
        </label>
        <DestructiveButton onClick={() => onRemove(calc.id)}>Remove</DestructiveButton>
      </div>
    </Card>
  );
}

function SavingsCalculationsTab({ calculations, dataModel, setCalculations }) {
  const onUpdateInputs = (id, inputs) => {
    setCalculations((list) => list.map((c) => (c.id === id ? { ...c, inputs } : c)));
  };
  const onRemove = (id) => setCalculations((list) => list.filter((c) => c.id !== id));
  const onApprove = (id, approved) => setCalculations((list) => list.map((c) => (c.id === id ? { ...c, approved } : c)));

  if (calculations.length === 0) {
    return <EmptyState>No calculations yet. Go to the Fingerprint Matrix tab and tap a highlighted cell to add one.</EmptyState>;
  }

  return (
    <div>
      {calculations.map((calc) => (
        <CalculationCard
          key={calc.id}
          calc={calc}
          dataModel={dataModel}
          onUpdateInputs={onUpdateInputs}
          onRemove={onRemove}
          onApprove={onApprove}
        />
      ))}
    </div>
  );
}

/* =========================================================================
   TAB 5: FINANCE REVIEW SUMMARY
   ========================================================================= */
function classificationGroup(impactType) {
  if (impactType === "Hard Savings") return "HARD SAVINGS";
  if (impactType === "Cost Avoidance") return "COST AVOIDANCE";
  return "PRODUCTIVITY / CAPACITY";
}

function FinanceReviewTab({ calculations }) {
  const groups = { "HARD SAVINGS": [], "COST AVOIDANCE": [], "PRODUCTIVITY / CAPACITY": [] };
  let totals = { "HARD SAVINGS": 0, "COST AVOIDANCE": 0, "PRODUCTIVITY / CAPACITY": 0 };

  calculations.forEach((calc) => {
    const engineFn = CALC_ENGINE[calc.costCategory];
    const output = engineFn(calc.inputs);
    const group = classificationGroup(calc.impactType);
    groups[group].push({ calc, output });
    if (!output.isPercent) totals[group] += output.result;
  });

  if (calculations.length === 0) {
    return <EmptyState>No calculations to review yet. Add some from the Fingerprint Matrix tab.</EmptyState>;
  }

  const groupColor = {
    "HARD SAVINGS": T.green,
    "COST AVOIDANCE": T.amber,
    "PRODUCTIVITY / CAPACITY": T.blue,
  };
  const groupBg = {
    "HARD SAVINGS": "#ECFDF5",
    "COST AVOIDANCE": "#FFFBEB",
    "PRODUCTIVITY / CAPACITY": T.blueLightBg,
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {Object.keys(groups).map((g) => (
          <div key={g} style={{ background: "#FFFFFF", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 8px", textAlign: "center" }}>
            <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color: groupColor[g] }}>{fmtMoney(totals[g])}</div>
            <div style={{ fontSize: 10, color: T.placeholder, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{g}</div>
          </div>
        ))}
      </div>

      {Object.entries(groups).map(([groupName, items]) => {
        if (items.length === 0) return null;
        return (
          <Card key={groupName} style={{ borderLeft: `4px solid ${groupColor[groupName]}` }}>
            <SectionLabel>{groupName}</SectionLabel>
            {items.map(({ calc, output }, idx) => (
              <div key={calc.id} style={{ padding: "10px 0", borderTop: idx === 0 ? "none" : `1px solid ${T.lightGray}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.heading }}>{calc.costCategory}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{calc.improvement}</div>
                    <div style={{ fontSize: 11, color: T.placeholder, fontFamily: T.mono, marginTop: 2 }}>{calc.formula}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 16, color: groupColor[groupName] }}>
                      {output.isPercent ? `${fmtNum(output.result, 1)}%` : fmtMoney(output.result)}
                    </div>
                    <div style={{ fontSize: 11, color: calc.approved ? T.green : T.placeholder, fontWeight: 600 }}>
                      {calc.approved ? "✓ Approved" : "Pending approval"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

/* =========================================================================
   TAB 6: SAVED ASSESSMENTS
   ========================================================================= */
function toCSV(assessment) {
  const rows = [["Improvement", "Cost Category", "Formula", "Result", "Classification", "Approved"]];
  assessment.calculations.forEach((calc) => {
    const output = CALC_ENGINE[calc.costCategory](calc.inputs);
    rows.push([
      calc.improvement,
      calc.costCategory,
      calc.formula,
      output.isPercent ? `${output.result.toFixed(1)}%` : output.result.toFixed(2),
      calc.impactType,
      calc.approved ? "Yes" : "No",
    ]);
  });
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SavedAssessmentsTab({ saved, setSaved, dataModel, calculations, selectedImprovement }) {
  const [name, setName] = useState("");

  const saveCurrent = () => {
    if (!name.trim()) return;
    const assessment = {
      id: Date.now(),
      name: name.trim(),
      dataModel: { ...dataModel },
      calculations: calculations.map((c) => ({ ...c })),
      selectedImprovement,
      savedAt: new Date().toISOString(),
    };
    setSaved((list) => [...list, assessment]);
    setName("");
  };

  const duplicate = (assessment) => {
    setSaved((list) => [...list, { ...assessment, id: Date.now(), name: assessment.name + " (copy)" }]);
  };
  const remove = (id) => setSaved((list) => list.filter((a) => a.id !== id));

  return (
    <div>
      <Card>
        <SectionLabel>Save Current Assessment</SectionLabel>
        <Field label="Assessment Name" type="text" value={name} onChange={setName} />
        <PrimaryButton onClick={saveCurrent} disabled={!name.trim() || calculations.length === 0}>
          Save Assessment
        </PrimaryButton>
        {calculations.length === 0 && (
          <div style={{ fontSize: 12, color: T.placeholder, marginTop: 8 }}>Add at least one calculation before saving.</div>
        )}
      </Card>

      {saved.length === 0 ? (
        <EmptyState>No saved assessments yet.</EmptyState>
      ) : (
        saved.map((a) => (
          <Card key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: T.heading }}>{a.name}</div>
                <div style={{ fontSize: 12, color: T.muted }}>{a.dataModel.plantName || "Unnamed plant"} · {a.calculations.length} calculations</div>
                <div style={{ fontSize: 11, color: T.placeholder, fontFamily: T.mono, marginTop: 2 }}>
                  Saved {new Date(a.savedAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <OutlineButton onClick={() => duplicate(a)}>Duplicate</OutlineButton>
              <OutlineButton onClick={() => downloadCSV(`${a.name.replace(/\s+/g, "_")}.csv`, toCSV(a))}>Export CSV</OutlineButton>
              <DestructiveButton onClick={() => remove(a.id)}>Delete</DestructiveButton>
            </div>
          </Card>
        ))
      )}

      <Card style={{ marginTop: 20 }}>
        <SectionLabel>Storage</SectionLabel>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
          All data on this app is stored locally in this browser only. It is not sent to any server and will not sync across devices.
        </div>
        <DestructiveButton
          onClick={() => {
            if (window.confirm("This will permanently erase all data model values, calculations, and saved assessments on this device. Continue?")) {
              localStorage.removeItem("mfg-cost-analyzer:v1");
              window.location.reload();
            }
          }}
        >
          Reset All Data
        </DestructiveButton>
      </Card>
    </div>
  );
}

/* =========================================================================
   APP ROOT
   ========================================================================= */
export default function App() {
  const persisted = useMemo(() => loadPersisted(), []);

  const [activeTab, setActiveTab] = useState("Data Model");
  const [dataModel, setDataModel] = useState(persisted?.dataModel || DEFAULT_DATA_MODEL);
  const [selectedImprovement, setSelectedImprovement] = useState(persisted?.selectedImprovement || null);
  const [calculations, setCalculations] = useState(persisted?.calculations || []);
  const [saved, setSaved] = useState(persisted?.saved || []);

  // Persist to localStorage any time the data changes
  useEffect(() => {
    savePersisted({ dataModel, selectedImprovement, calculations, saved });
  }, [dataModel, selectedImprovement, calculations, saved]);

  const addCalculation = (costCategory, impact) => {
    const timeInputs = {
      hoursReduced: (dataModel.currentCycleTime - dataModel.improvedCycleTime) * dataModel.annualVolume,
      materialReductionPerUnit: dataModel.currentMaterialCost - dataModel.futureMaterialCost,
    };
    const inputs = defaultInputsFor(costCategory, dataModel, timeInputs);
    const id = `${selectedImprovement}-${costCategory}-${Date.now()}`;
    setCalculations((list) => [
      ...list,
      {
        id,
        improvement: selectedImprovement,
        costCategory,
        impactType: impact.impactType,
        formula: impact.formula,
        inputs,
        approved: false,
      },
    ]);
    setActiveTab("Savings Calculations");
  };

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh" }}>
      <style>{`
        input, select, button { font-family: ${T.font}; }
        input[type=number] { font-family: ${T.mono}; }
      `}</style>

      <div style={{ background: "#FFFFFF", borderBottom: `1px solid ${T.border}`, padding: "16px 14px 0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: T.heading, marginBottom: 2 }}>Manufacturing Cost Impact Analyzer</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Absorption-based cost accounting for process improvements</div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <TabBar active={activeTab} setActive={setActiveTab} />
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 14px 48px" }}>
        {activeTab === "Data Model" && <DataModelTab dataModel={dataModel} setDataModel={setDataModel} />}
        {activeTab === "Decision Tree" && (
          <DecisionTreeTab
            selectedImprovement={selectedImprovement}
            setSelectedImprovement={setSelectedImprovement}
            goToMatrix={() => setActiveTab("Fingerprint Matrix")}
          />
        )}
        {activeTab === "Fingerprint Matrix" && (
          <FingerprintMatrixTab
            selectedImprovement={selectedImprovement}
            onSelectCell={(costCategory, impact) => {
              if (impact) addCalculation(costCategory, impact);
            }}
          />
        )}
        {activeTab === "Savings Calculations" && (
          <SavingsCalculationsTab calculations={calculations} dataModel={dataModel} setCalculations={setCalculations} />
        )}
        {activeTab === "Finance Review" && <FinanceReviewTab calculations={calculations} />}
        {activeTab === "Saved Assessments" && (
          <SavedAssessmentsTab
            saved={saved}
            setSaved={setSaved}
            dataModel={dataModel}
            calculations={calculations}
            selectedImprovement={selectedImprovement}
          />
        )}
      </div>
    </div>
  );
}
