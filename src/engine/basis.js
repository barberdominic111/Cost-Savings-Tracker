/* Default-input derivation per improvement type.
   Unknown stays null. Nothing is silently defaulted to zero. */

const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const sub = (a, b) => (n(a) === null || n(b) === null ? null : a - b);
const mul = (...xs) => (xs.some((x) => n(x) === null) ? null : xs.reduce((p, x) => p * x, 1));

export function deriveBasis(improvement, dm) {
  const out = { hoursReduced: null, materialReductionPerUnit: null, sqFtReduced: null, capacity: { beforeTime: null, afterTime: null, quantity: null }, notes: [] };
  switch (improvement) {
    case "Non-Bottleneck Cycle Reduction":
    case "Bottleneck Cycle Reduction":
      out.hoursReduced = mul(sub(dm.currentCycleTime, dm.improvedCycleTime), dm.annualVolume);
      out.capacity = { beforeTime: n(dm.currentCycleTime), afterTime: n(dm.improvedCycleTime), quantity: n(dm.annualVolume) };
      out.notes.push("Hours basis: (current − improved cycle time) × annual volume.");
      break;
    case "Setup Reduction": {
      const d = sub(dm.currentSetupTime, dm.improvedSetupTime);
      out.hoursReduced = d === null || n(dm.setupsPerYear) === null ? null : (d / 60) * dm.setupsPerYear;
      out.capacity = { beforeTime: n(dm.currentSetupTime) === null ? null : dm.currentSetupTime / 60, afterTime: n(dm.improvedSetupTime) === null ? null : dm.improvedSetupTime / 60, quantity: n(dm.setupsPerYear) };
      out.notes.push("Hours basis: (current − improved setup minutes) ÷ 60 × setups per year. Needs 'Setups Per Year'.");
      break;
    }
    case "Rework Reduction": {
      const d = sub(dm.currentReworkTime, dm.improvedReworkTime);
      out.hoursReduced = d === null || n(dm.reworkUnitsPerYear) === null ? null : (d / 60) * dm.reworkUnitsPerYear;
      out.capacity = { beforeTime: n(dm.currentReworkTime) === null ? null : dm.currentReworkTime / 60, afterTime: n(dm.improvedReworkTime) === null ? null : dm.improvedReworkTime / 60, quantity: n(dm.reworkUnitsPerYear) };
      out.notes.push("Hours basis: (current − improved rework minutes) ÷ 60 × reworked units per year. Needs 'Reworked Units Per Year'.");
      break;
    }
    case "Scrap Reduction":
    case "Defect Reduction": {
      const diff = sub(dm.currentScrapPct, dm.futureScrapPct);
      const unitsAvoided = diff === null || n(dm.annualVolume) === null ? null : (diff / 100) * dm.annualVolume;
      out.hoursReduced = mul(unitsAvoided, dm.laborContentPerUnit);
      out.materialReductionPerUnit = diff === null || n(dm.materialCostPerUnit) === null ? null : (dm.materialCostPerUnit * diff) / 100;
      out.notes.push("Basis: scrap % reduction × volume × labor content per unit; material = material cost × scrap % reduction.");
      break;
    }
    case "Packaging Reduction":
      out.materialReductionPerUnit = sub(dm.packagingCost, dm.futurePackagingCost);
      out.notes.push("Basis: packaging cost − future packaging cost. Needs 'Future Packaging Cost'.");
      break;
    case "BOM Reduction":
      out.materialReductionPerUnit = sub(dm.currentMaterialCost, dm.futureMaterialCost);
      out.notes.push("Basis: current − future material cost per unit.");
      break;
    case "Floor Space Reduction":
      out.notes.push("Enter square feet released. No default.");
      break;
    default:
      out.notes.push("Enter hours for this improvement. No default.");
  }
  return out;
}

export function defaultInputsFor(formulaId, improvement, dm) {
  const b = deriveBasis(improvement, dm);
  switch (formulaId) {
    case "directLabor": return { hoursReduced: b.hoursReduced, directLaborRate: n(dm.directLaborRate) };
    case "variableOverhead": return { hoursReduced: b.hoursReduced, variableBurdenRate: n(dm.variableBurdenRate) };
    case "fixedOverhead": return { hoursReduced: b.hoursReduced, fixedOverheadRate: n(dm.fixedOverheadRate) };
    case "material": return { annualVolume: n(dm.annualVolume), materialReductionPerUnit: b.materialReductionPerUnit };
    case "overtime": return { hours: b.hoursReduced, directLaborRate: n(dm.directLaborRate), otRate: mul(dm.directLaborRate, dm.overtimeMultiplier) };
    case "tempLabor": return { hoursAvoided: b.hoursReduced, tempLaborRate: n(dm.avgTempLaborRate), conversionCost: null };
    case "capacityCreated": return { beforeTime: b.capacity.beforeTime, afterTime: b.capacity.afterTime, annualVolume: b.capacity.quantity };
    case "absorption": return { earnedStdHours: mul(dm.annualVolume, dm.improvedCycleTime), actualHours: null };
    case "floorSpace": return { sqFtReduced: b.sqFtReduced, sqFtCost: n(dm.sqFtCost) };
    case "equipmentAvoidance": return { equipmentCost: n(dm.equipmentCost), maintenanceCostAnnual: n(dm.maintenanceCost) };
    default: return {};
  }
}
