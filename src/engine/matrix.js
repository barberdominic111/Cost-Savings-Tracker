/* Data-driven fingerprint matrix. Each impact references a named formula (formulaId). */

export const IMPROVEMENT_CATEGORIES = [
  { category: "Time Reduced", items: ["Non-Bottleneck Cycle Reduction", "Bottleneck Cycle Reduction", "Setup Reduction", "Rework Reduction"] },
  { category: "Quality Improved", items: ["Scrap Reduction", "Defect Reduction"] },
  { category: "Material Reduced", items: ["Packaging Reduction", "BOM Reduction"] },
  { category: "Resource Changed", items: ["Labor Reduction", "Labor Elimination", "Temp Labor Reduction", "Overtime Elimination"] },
  { category: "Space / Asset Changed", items: ["Floor Space Reduction", "Equipment Reduction"] },
];

export const COST_CATEGORIES = {
  group1: ["Direct Labor", "Variable Overhead", "Fixed Overhead"],
  group2: ["Material", "Overtime"],
  group3: ["Temp Labor", "Capacity Created", "Absorption Improvement"],
};

const e = (costCategory, impactType, formulaId) => ({ costCategory, impactType, formulaId });

export const FINGERPRINT_MATRIX = {
  "Non-Bottleneck Cycle Reduction": [e("Direct Labor", "Soft Savings", "directLabor"), e("Variable Overhead", "Soft Savings", "variableOverhead"), e("Capacity Created", "Soft Savings", "capacityCreated")],
  "Bottleneck Cycle Reduction": [e("Direct Labor", "Hard Savings", "directLabor"), e("Variable Overhead", "Hard Savings", "variableOverhead"), e("Capacity Created", "Soft Savings", "capacityCreated"), e("Absorption Improvement", "Soft Savings", "absorption")],
  "Setup Reduction": [e("Direct Labor", "Soft Savings", "directLabor"), e("Capacity Created", "Soft Savings", "capacityCreated")],
  "Rework Reduction": [e("Direct Labor", "Hard Savings", "directLabor"), e("Variable Overhead", "Hard Savings", "variableOverhead"), e("Material", "Hard Savings", "material")],
  "Scrap Reduction": [e("Material", "Hard Savings", "material"), e("Direct Labor", "Hard Savings", "directLabor"), e("Fixed Overhead", "No Impact", "fixedOverhead")],
  "Defect Reduction": [e("Material", "Cost Avoidance", "material"), e("Direct Labor", "Cost Avoidance", "directLabor")],
  "Packaging Reduction": [e("Material", "Hard Savings", "material")],
  "BOM Reduction": [e("Material", "Hard Savings", "material")],
  "Labor Reduction": [e("Direct Labor", "Soft Savings", "directLabor"), e("Capacity Created", "Soft Savings", "capacityCreated")],
  "Labor Elimination": [e("Direct Labor", "Hard Savings", "directLabor"), e("Variable Overhead", "Hard Savings", "variableOverhead"), e("Fixed Overhead", "No Impact", "fixedOverhead")],
  "Temp Labor Reduction": [e("Temp Labor", "Hard Savings", "tempLabor")],
  "Overtime Elimination": [e("Overtime", "Hard Savings", "overtime")],
  "Floor Space Reduction": [e("Fixed Overhead", "Cost Avoidance", "floorSpace")],
  "Equipment Reduction": [e("Fixed Overhead", "Cost Avoidance", "equipmentAvoidance")],
};

export function rationaleFor(impactType, formulaId) {
  if (formulaId === "fixedOverhead" || formulaId === "absorption")
    return "Absorption / standard-cost effect: changes how fixed cost is spread, not cash spent. Never counted as savings.";
  switch (impactType) {
    case "Hard Savings": return "Modeled reduction in actual expense. Counts as realized only with evidence that spend dropped.";
    case "Cost Avoidance": return "Future spend prevented. Not a current-period expense reduction.";
    case "Soft Savings": return "Released hours or capacity. Becomes financial benefit only with a defined use or conversion.";
    default: return "No substantiated financial effect under the selected assumptions.";
  }
}
