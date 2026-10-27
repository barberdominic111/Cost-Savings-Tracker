import { describe, it, expect } from "vitest";
import { runFormula } from "./formulas.js";
import { deriveBasis, defaultInputsFor } from "./basis.js";
import { summarize, canSetStatus, bucketFor } from "./summary.js";
import { DEFAULT_DATA_MODEL } from "../data/dataModel.js";

const dm = { ...DEFAULT_DATA_MODEL, setupsPerYear: 200, reworkUnitsPerYear: 1200, futurePackagingCost: 0.25 };
const L = (o) => ({ id: Math.random().toString(), approved: false, inputs: {}, ...o });

describe("formulas", () => {
  it("direct labor = hours × rate", () => {
    const r = runFormula("directLabor", { hoursReduced: 100, directLaborRate: 28 });
    expect(r.status).toBe("ok");
    expect(r.value).toBe(2800);
  });
  it("missing input is incomplete, not zero", () => {
    const r = runFormula("directLabor", { hoursReduced: 100, directLaborRate: null });
    expect(r.status).toBe("incomplete");
    expect(r.value).toBeNull();
    expect(r.missing).toEqual(["directLaborRate"]);
  });
  it("explicit zero is a real value", () => {
    expect(runFormula("directLabor", { hoursReduced: 0, directLaborRate: 28 }).value).toBe(0);
  });
  it("negative rate is invalid", () => {
    const r = runFormula("directLabor", { hoursReduced: 10, directLaborRate: -5 });
    expect(r.status).toBe("invalid");
  });
  it("overtime splits straight time and premium", () => {
    const r = runFormula("overtime", { hours: 10, directLaborRate: 28, otRate: 42 });
    const get = (k) => r.components.find((c) => c.key === k).value;
    expect(get("straightTimeAvoided")).toBe(280);
    expect(get("otPremiumAvoided")).toBe(140);
    expect(r.value).toBe(420);
    expect(get("straightTimeAvoided") + get("otPremiumAvoided")).toBe(r.value);
  });
  it("temp labor: optional conversion cost offsets first year only when given", () => {
    const a = runFormula("tempLabor", { hoursAvoided: 1000, tempLaborRate: 24, conversionCost: null });
    expect(a.value).toBe(24000);
    expect(a.components.find((c) => c.key === "netFirstYear")).toBeUndefined();
    const b = runFormula("tempLabor", { hoursAvoided: 1000, tempLaborRate: 24, conversionCost: 1500 });
    expect(b.components.find((c) => c.key === "netFirstYear").value).toBe(22500);
  });
  it("capacity created is hours, and warns when none", () => {
    const r = runFormula("capacityCreated", { beforeTime: 0.05, afterTime: 0.04, annualVolume: 120000 });
    expect(r.unit).toBe("hours");
    expect(r.value).toBeCloseTo(1200, 6);
    const w = runFormula("capacityCreated", { beforeTime: 0.04, afterTime: 0.05, annualVolume: 100 });
    expect(w.warnings.length).toBeGreaterThan(0);
  });
  it("absorption efficiency %, rejects zero actual hours", () => {
    expect(runFormula("absorption", { earnedStdHours: 90, actualHours: 100 }).value).toBe(90);
    expect(runFormula("absorption", { earnedStdHours: 90, actualHours: 0 }).status).toBe("invalid");
  });
  it("floor space and equipment avoidance", () => {
    expect(runFormula("floorSpace", { sqFtReduced: 500, sqFtCost: 8 }).value).toBe(4000);
    expect(runFormula("equipmentAvoidance", { equipmentCost: 45000, maintenanceCostAnnual: null }).value).toBe(45000);
  });
  it("legacy zero-fill mode reproduces old behaviour and says so", () => {
    const r = runFormula("tempLabor", { hoursAvoided: 100 }, { legacyZeroFill: true });
    expect(r.value).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/Legacy/);
  });
});

describe("default input basis", () => {
  it("cycle reduction hours", () => {
    expect(deriveBasis("Bottleneck Cycle Reduction", dm).hoursReduced).toBeCloseTo(1200, 6);
  });
  it("setup hours use setup minutes and setups/year", () => {
    expect(deriveBasis("Setup Reduction", dm).hoursReduced).toBe(50);
  });
  it("setup hours stay unknown without setups per year", () => {
    expect(deriveBasis("Setup Reduction", { ...dm, setupsPerYear: null }).hoursReduced).toBeNull();
  });
  it("rework hours", () => {
    expect(deriveBasis("Rework Reduction", dm).hoursReduced).toBe(60);
  });
  it("scrap basis", () => {
    const b = deriveBasis("Scrap Reduction", dm);
    expect(b.materialReductionPerUnit).toBeCloseTo(0.13, 6);
    expect(b.hoursReduced).toBeCloseTo(2880, 6);
  });
  it("packaging and BOM", () => {
    expect(deriveBasis("Packaging Reduction", dm).materialReductionPerUnit).toBeCloseTo(0.1, 6);
    expect(deriveBasis("BOM Reduction", dm).materialReductionPerUnit).toBeCloseTo(0.4, 6);
  });
  it("labor/overtime/temp hours have no default", () => {
    ["Labor Reduction", "Labor Elimination", "Temp Labor Reduction", "Overtime Elimination"].forEach((i) =>
      expect(deriveBasis(i, dm).hoursReduced).toBeNull());
  });
  it("temp labor default pulls avgTempLaborRate (v1 bug fix)", () => {
    expect(defaultInputsFor("tempLabor", "Temp Labor Reduction", dm).tempLaborRate).toBe(24);
  });
  it("setup capacity uses setup time per setup, not cycle time", () => {
    const i = defaultInputsFor("capacityCreated", "Setup Reduction", dm);
    expect(i).toEqual({ beforeTime: 0.5, afterTime: 0.25, annualVolume: 200 });
  });
});

describe("finance summary", () => {
  const mk = (formulaId, impactType, inputs, extra = {}) => L({ improvement: "X", formulaId, impactType, inputs, ...extra });
  it("keeps hours, absorption and cash separate", () => {
    const lines = [
      mk("directLabor", "Hard Savings", { hoursReduced: 100, directLaborRate: 10 }, { approved: true }),
      mk("materialAvoid", "Cost Avoidance", {}),
      mk("capacityCreated", "Soft Savings", { beforeTime: 2, afterTime: 1, annualVolume: 50 }),
      mk("fixedOverhead", "No Impact", { hoursReduced: 100, fixedOverheadRate: 18 }),
    ].map((l) => (l.formulaId === "materialAvoid" ? { ...l, formulaId: "floorSpace", inputs: { sqFtReduced: 10, sqFtCost: 5 } } : l));
    const items = lines.map((line) => ({ line, result: runFormula(line.formulaId, line.inputs) }));
    const s = summarize(items, {});
    expect(s.buckets.hard.modeled).toBe(1000);
    expect(s.buckets.hard.approved).toBe(1000);
    expect(s.buckets.avoidance.modeled).toBe(50);
    expect(s.buckets.productivity.hoursModeled).toBe(50);
    expect(s.buckets.productivity.modeled).toBe(0); // hours never added to dollars
    expect(s.buckets.absorption.modeled).toBe(1800);
    expect(s.buckets.hard.modeled + s.buckets.avoidance.modeled).toBe(1050); // absorption excluded
  });
  it("incomplete lines are excluded from totals and reported", () => {
    const line = mk("directLabor", "Hard Savings", { hoursReduced: null, directLaborRate: 10 });
    const s = summarize([{ line, result: runFormula("directLabor", line.inputs) }], {});
    expect(s.buckets.hard.modeled).toBe(0);
    expect(s.incomplete).toHaveLength(1);
  });
  it("flags same-hours labor overlap and duplicates", () => {
    const a = mk("directLabor", "Hard Savings", { hoursReduced: 100, directLaborRate: 10 });
    const b = mk("overtime", "Hard Savings", { hours: 100, directLaborRate: 10, otRate: 15 });
    const s = summarize([a, b].map((line) => ({ line, result: runFormula(line.formulaId, line.inputs) })), {});
    expect(s.overlaps.join(" ")).toMatch(/same hours/);
  });
  it("realized is unknown (null) without evidence", () => {
    const line = mk("directLabor", "Hard Savings", { hoursReduced: 1, directLaborRate: 1 }, { approved: true });
    const items = [{ line, result: runFormula("directLabor", line.inputs) }];
    expect(summarize(items, { assessmentStatus: "approved" }).realized.usd).toBeNull();
    expect(summarize(items, { assessmentStatus: "realized", realization: { evidence: "GL report", basis: "Q3 actuals" } }).realized.usd).toBe(1);
    expect(summarize(items, { assessmentStatus: "realized", realization: { evidence: "", basis: "" } }).realized.usd).toBeNull();
  });
  it("status gating", () => {
    const line = mk("directLabor", "Hard Savings", { hoursReduced: 1, directLaborRate: 1 });
    const s = summarize([{ line, result: runFormula("directLabor", line.inputs) }], {});
    expect(canSetStatus("approved", { assessmentStatus: "draft" }, s, 1).ok).toBe(false);
    expect(canSetStatus("realized", { assessmentStatus: "draft", realization: {} }, s, 1).ok).toBe(false);
    expect(bucketFor({ formulaId: "fixedOverhead", impactType: "Hard Savings" })).toBe("absorption");
  });
});
