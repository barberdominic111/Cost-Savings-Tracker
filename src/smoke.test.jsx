import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import DataModelTab from "./tabs/DataModelTab.jsx";
import DecisionTreeTab from "./tabs/DecisionTreeTab.jsx";
import MatrixTab from "./tabs/MatrixTab.jsx";
import CalculationsTab from "./tabs/CalculationsTab.jsx";
import FinanceTab from "./tabs/FinanceTab.jsx";
import SavedTab from "./tabs/SavedTab.jsx";
import App from "./App.jsx";
import { DEFAULT_DATA_MODEL } from "./data/dataModel.js";
import { createMeta, buildRecord } from "./data/records.js";
import { defaultInputsFor } from "./engine/basis.js";
import { FINGERPRINT_MATRIX } from "./engine/matrix.js";

describe("render smoke", () => {
  const dm = { ...DEFAULT_DATA_MODEL, setupsPerYear: 200 };
  const meta = { ...createMeta(), name: "S" };
  // one line for every matrix entry
  const lines = Object.entries(FINGERPRINT_MATRIX).flatMap(([imp, es]) => es.map((e, i) => ({ id: `${imp}-${i}`, improvement: imp, costCategory: e.costCategory, formulaId: e.formulaId, impactType: e.impactType, inputs: defaultInputsFor(e.formulaId, imp, dm), approved: false })));
  const rec = buildRecord({ meta, dataModel: dm, calculations: lines, selectedImprovement: "Setup Reduction" });
  it("renders every tab with every matrix line", () => {
    expect(renderToString(<App />)).toContain("Manufacturing Cost Impact Analyzer");
    expect(renderToString(<DataModelTab dataModel={dm} setDataModel={() => {}} />)).toContain("INFORMATIONAL");
    expect(renderToString(<DecisionTreeTab dataModel={dm} selectedImprovement="Setup Reduction" setSelectedImprovement={() => {}} goToMatrix={() => {}} />)).toContain("setup");
    expect(renderToString(<MatrixTab selectedImprovement="Setup Reduction" onSelectCell={() => {}} />)).toContain("Capacity Created");
    expect(renderToString(<CalculationsTab meta={meta} updateMeta={() => {}} calculations={lines} dataModel={dm} updateLine={() => {}} removeLine={() => {}} />)).toContain("Assessment Details");
    expect(renderToString(<FinanceTab calculations={lines} meta={meta} />)).toContain("HARD SAVINGS");
    const fn = () => {};
    expect(renderToString(<SavedTab meta={meta} saved={[rec]} calculations={lines} onSave={fn} onLoad={fn} onNew={fn} onDuplicate={fn} onDelete={fn} onImportRecords={fn} onLink={fn} />)).toContain("Export");
  });
});
