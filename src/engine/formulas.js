/* Named, tested formulas. Pure functions, no UI.
   Missing inputs are UNKNOWN (null) and never silently treated as zero.
   An explicit 0 is a real value. */

export const FORMULA_VERSION = "1.1.0";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const DEFAULT_FORMULA_BY_CATEGORY = {
  "Direct Labor": "directLabor",
  "Variable Overhead": "variableOverhead",
  "Fixed Overhead": "fixedOverhead",
  Material: "material",
  Overtime: "overtime",
  "Temp Labor": "tempLabor",
  "Capacity Created": "capacityCreated",
  "Absorption Improvement": "absorption",
};

const comp = (key, label, value, unit) => ({ key, label, value, unit });

export const FORMULAS = {
  directLabor: {
    label: "Hours Reduced × Direct Labor Rate",
    unit: "USD",
    kind: "expense",
    inputs: [
      { key: "hoursReduced", label: "Hours Reduced (per year)", unit: "hrs", min: 0 },
      { key: "directLaborRate", label: "Direct Labor Rate", unit: "$/hr", min: 0 },
    ],
    compute: (i) => ({ value: i.hoursReduced * i.directLaborRate, components: [] }),
  },
  variableOverhead: {
    label: "Hours Reduced × Variable Burden Rate",
    unit: "USD",
    kind: "expense",
    inputs: [
      { key: "hoursReduced", label: "Hours Reduced (per year)", unit: "hrs", min: 0 },
      { key: "variableBurdenRate", label: "Variable Burden Rate", unit: "$/hr", min: 0 },
    ],
    compute: (i) => ({ value: i.hoursReduced * i.variableBurdenRate, components: [] }),
  },
  fixedOverhead: {
    label: "Hours Reduced × Fixed Overhead Rate (Absorption / Standard Cost Impact)",
    unit: "USD",
    kind: "absorption",
    inputs: [
      { key: "hoursReduced", label: "Hours Reduced (per year)", unit: "hrs", min: 0 },
      { key: "fixedOverheadRate", label: "Fixed Overhead Rate", unit: "$/hr", min: 0 },
    ],
    compute: (i) => ({
      value: i.hoursReduced * i.fixedOverheadRate,
      components: [],
      notes: ["Absorption / standard-cost effect. Fixed cost is re-spread, not removed. Never counted as cash savings."],
    }),
  },
  material: {
    label: "Annual Volume × Material Reduction Per Unit",
    unit: "USD",
    kind: "expense",
    inputs: [
      { key: "annualVolume", label: "Annual Volume", unit: "units", min: 0 },
      { key: "materialReductionPerUnit", label: "Material Reduction Per Unit", unit: "$/unit", min: 0 },
    ],
    compute: (i) => ({ value: i.annualVolume * i.materialReductionPerUnit, components: [] }),
  },
  overtime: {
    label: "Hours × OT Rate (split: straight time + OT premium)",
    unit: "USD",
    kind: "expense",
    inputs: [
      { key: "hours", label: "Overtime Hours Avoided (per year)", unit: "hrs", min: 0 },
      { key: "directLaborRate", label: "Direct Labor Rate (straight time)", unit: "$/hr", min: 0 },
      { key: "otRate", label: "Overtime Rate", unit: "$/hr", min: 0 },
    ],
    compute: (i) => {
      const straight = i.hours * i.directLaborRate;
      const premium = i.hours * (i.otRate - i.directLaborRate);
      const total = i.hours * i.otRate;
      const warnings = [];
      if (i.otRate < i.directLaborRate) warnings.push("OT rate is below the straight-time rate.");
      return {
        value: total,
        components: [
          comp("straightTimeAvoided", "Straight Time Avoided", straight, "USD"),
          comp("otPremiumAvoided", "OT Premium Avoided", premium, "USD"),
        ],
        warnings,
        notes: ["If the work must still be done at straight time, only the OT premium is avoided."],
      };
    },
  },
  tempLabor: {
    label: "Hours Avoided × Temp Labor Rate (optional one-time conversion offset)",
    unit: "USD",
    kind: "expense",
    inputs: [
      { key: "hoursAvoided", label: "Temp Hours Avoided (per year)", unit: "hrs", min: 0 },
      { key: "tempLaborRate", label: "Temp Labor Rate", unit: "$/hr", min: 0 },
      { key: "conversionCost", label: "One-time Conversion Cost (optional)", unit: "$", min: 0, optional: true,
        hint: "Enter only if temps are being converted to permanent." },
    ],
    compute: (i) => {
      const gross = i.hoursAvoided * i.tempLaborRate;
      const components = [comp("grossAnnual", "Gross Annual Temp Cost Avoided", gross, "USD")];
      const notes = [];
      if (i.conversionCost === null) {
        notes.push("Conversion cost not included.");
      } else {
        components.push(comp("conversionCost", "One-time Conversion Cost", i.conversionCost, "USD"));
        components.push(comp("netFirstYear", "Net First-Year Effect", gross - i.conversionCost, "USD"));
      }
      return { value: gross, components, notes };
    },
  },
  capacityCreated: {
    label: "(Before Time − After Time) × Quantity Per Year",
    unit: "hours",
    kind: "capacity",
    inputs: [
      { key: "beforeTime", label: "Before Time (hrs per unit/setup)", unit: "hrs", min: 0 },
      { key: "afterTime", label: "After Time (hrs per unit/setup)", unit: "hrs", min: 0 },
      { key: "annualVolume", label: "Quantity Per Year (units, setups, or reworked units)", unit: "qty", min: 0 },
    ],
    compute: (i) => {
      const value = (i.beforeTime - i.afterTime) * i.annualVolume;
      const warnings = i.afterTime >= i.beforeTime ? ["After time is not lower than before time: no capacity created."] : [];
      return {
        value,
        components: [],
        warnings,
        notes: ["Capacity Created - Requires Conversion. Hours only; not dollars until a defined use or conversion exists."],
      };
    },
  },
  absorption: {
    label: "Earned Standard Hours ÷ Actual Hours",
    unit: "percent",
    kind: "efficiency",
    inputs: [
      { key: "earnedStdHours", label: "Earned Standard Hours", unit: "hrs", min: 0 },
      { key: "actualHours", label: "Actual Hours Worked", unit: "hrs", min: 0, positive: true, legacyDefault: 1 },
    ],
    compute: (i) => ({
      value: i.actualHours === 0 ? 0 : (i.earnedStdHours / i.actualHours) * 100,
      components: [],
      notes: ["Efficiency %. An accounting/absorption measure, not cash."],
    }),
  },
  floorSpace: {
    label: "Square Feet Released × Square Foot Cost",
    unit: "USD",
    kind: "avoidance",
    inputs: [
      { key: "sqFtReduced", label: "Square Feet Released", unit: "sqft", min: 0 },
      { key: "sqFtCost", label: "Square Foot Cost (per year)", unit: "$/sqft/yr", min: 0 },
    ],
    compute: (i) => ({
      value: i.sqFtReduced * i.sqFtCost,
      components: [],
      notes: ["Counts only if the space is released or reused (sublease, avoided expansion, etc.)."],
    }),
  },
  equipmentAvoidance: {
    label: "Equipment Cost Avoided (one-time)",
    unit: "USD",
    kind: "avoidance",
    inputs: [
      { key: "equipmentCost", label: "Equipment Cost Avoided (one-time)", unit: "$", min: 0 },
      { key: "maintenanceCostAnnual", label: "Annual Maintenance Avoided (optional)", unit: "$/yr", min: 0, optional: true },
    ],
    compute: (i) => ({
      value: i.equipmentCost,
      components: i.maintenanceCostAnnual === null ? [] : [comp("maintenanceCostAnnual", "Annual Maintenance Avoided (shown, not added)", i.maintenanceCostAnnual, "USD")],
      notes: ["One-time spend avoided. Annual maintenance is shown separately and not added."],
    }),
  },
};

export function getFormula(id) {
  return FORMULAS[id] || null;
}

/* runFormula: validates inputs, runs the named formula.
   status: "ok" | "incomplete" (unknown inputs) | "invalid" (bad values) */
export function runFormula(formulaId, inputs, opts = {}) {
  const f = FORMULAS[formulaId];
  const base = { formulaId, formulaVersion: FORMULA_VERSION };
  if (!f) return { ...base, status: "invalid", value: null, unit: null, kind: null, missing: [], invalid: [{ key: "formulaId", reason: "Unknown formula" }], components: [], warnings: [], notes: [] };

  const missing = [];
  const invalid = [];
  const warnings = [];
  const eff = {};

  for (const spec of f.inputs) {
    const v = inputs ? inputs[spec.key] : undefined;
    if (v === undefined || v === null || v === "") {
      if (spec.optional) { eff[spec.key] = null; continue; }
      if (opts.legacyZeroFill) {
        eff[spec.key] = spec.legacyDefault ?? 0;
        warnings.push(`Legacy result: missing "${spec.label}" was treated as ${spec.legacyDefault ?? 0}.`);
        continue;
      }
      missing.push(spec.key);
      continue;
    }
    if (!isNum(v)) { invalid.push({ key: spec.key, reason: "Not a number" }); continue; }
    if (spec.min !== undefined && v < spec.min) { invalid.push({ key: spec.key, reason: `Must be ≥ ${spec.min}` }); continue; }
    if (spec.positive && v <= 0 && !opts.legacyZeroFill) { invalid.push({ key: spec.key, reason: "Must be > 0" }); continue; }
    eff[spec.key] = v;
  }

  if (missing.length || invalid.length) {
    return { ...base, status: invalid.length ? "invalid" : "incomplete", value: null, unit: f.unit, kind: f.kind, missing, invalid, components: [], warnings, notes: [] };
  }

  const out = f.compute(eff);
  const w = [...warnings, ...(out.warnings || [])];
  if (isNum(out.value) && out.value < 0) w.push("Result is negative (no reduction).");
  return { ...base, status: "ok", value: out.value, unit: f.unit, kind: f.kind, missing: [], invalid: [], components: out.components || [], warnings: w, notes: out.notes || [], ...(opts.legacyZeroFill ? { legacyZeroFill: true } : {}) };
}
