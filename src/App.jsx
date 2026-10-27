import React, { useState, useEffect, useMemo } from "react";
import { T } from "./theme.js";
import { loadState, saveState } from "./data/storage.js";
import { buildRecord, recordKey, recordToWorking, createMeta, nowIso, newId, linkSnapshot, emptyRealization } from "./data/records.js";
import { defaultInputsFor } from "./engine/basis.js";
import { LOCKED_STATUSES } from "./engine/summary.js";
import DataModelTab from "./tabs/DataModelTab.jsx";
import DecisionTreeTab from "./tabs/DecisionTreeTab.jsx";
import MatrixTab from "./tabs/MatrixTab.jsx";
import CalculationsTab from "./tabs/CalculationsTab.jsx";
import FinanceTab from "./tabs/FinanceTab.jsx";
import SavedTab from "./tabs/SavedTab.jsx";

const TABS = ["Data Model", "Decision Tree", "Fingerprint Matrix", "Savings Calculations", "Finance Review", "Saved Assessments"];

function TabBar({ active, setActive }) {
  return (
    <div style={{ position: "sticky", top: 0, display: "flex", background: "#FFFFFF", borderBottom: `1px solid ${T.border}`, overflowX: "auto", zIndex: 10 }}>
      {TABS.map((tab) => {
        const on = tab === active;
        return (
          <div key={tab} onClick={() => setActive(tab)} style={{ flex: "1 0 auto", minWidth: 110, padding: "12px 8px", borderBottom: on ? `3px solid ${T.blue}` : "3px solid transparent", color: on ? T.blue : T.muted, fontSize: 12.5, fontWeight: on ? 700 : 600, textAlign: "center", cursor: "pointer", touchAction: "manipulation", whiteSpace: "nowrap" }}>{tab}</div>
        );
      })}
    </div>
  );
}

export default function App() {
  const initial = useMemo(() => loadState(), []);
  const [activeTab, setActiveTab] = useState("Data Model");
  const [dataModel, setDataModel] = useState(initial.dataModel);
  const [selectedImprovement, setSelectedImprovement] = useState(initial.selectedImprovement);
  const [calculations, setCalculations] = useState(initial.calculations);
  const [saved, setSaved] = useState(initial.saved);
  const [meta, setMeta] = useState(initial.meta);

  useEffect(() => {
    saveState({ version: 2, dataModel, selectedImprovement, calculations, saved, meta });
  }, [dataModel, selectedImprovement, calculations, saved, meta]);

  const updateMeta = (patch) => setMeta((m) => ({ ...m, ...patch, updatedAt: nowIso() }));
  const updateLine = (id, patch) => setCalculations((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeLine = (id) => setCalculations((l) => l.filter((c) => c.id !== id));

  const addCalculation = (impact) => {
    if (!impact || !selectedImprovement) return;
    setCalculations((list) => [...list, {
      id: newId(), improvement: selectedImprovement, costCategory: impact.costCategory, formulaId: impact.formulaId,
      impactType: impact.impactType, inputs: defaultInputsFor(impact.formulaId, selectedImprovement, dataModel), approved: false,
    }]);
    setActiveTab("Savings Calculations");
  };

  const putRecord = (rec) => setSaved((list) => {
    const k = recordKey(rec);
    return list.some((r) => recordKey(r) === k) ? list.map((r) => (recordKey(r) === k ? rec : r)) : [...list, rec];
  });

  const onSave = (mode, value) => {
    if (mode === "rename") { updateMeta({ name: value }); return null; }
    if (!meta.name.trim()) return { error: "Give the assessment a name first." };
    const now = nowIso();
    let m = { ...meta };
    let lines = calculations;
    if (mode === "newRevision") {
      const maxRev = Math.max(0, ...saved.filter((r) => r.assessmentId === m.assessmentId).map((r) => r.revision));
      m = { ...m, revision: maxRev + 1, assessmentStatus: "draft", realization: emptyRealization() };
      lines = calculations.map((l) => ({ ...l, approved: false }));
      setCalculations(lines);
    } else {
      const ex = saved.find((r) => recordKey(r) === `${m.assessmentId}:${m.revision}`);
      if (ex && LOCKED_STATUSES.includes(ex.assessmentStatus)) {
        const sig = (ls) => JSON.stringify(ls.map((l) => [l.id, l.inputs, !!l.approved]));
        const unchanged = sig(ex.calculation.lines.map((l) => ({ id: l.lineId, inputs: l.inputs, approved: l.approved }))) === sig(lines);
        if (!unchanged) return { error: `Revision ${m.revision} is ${ex.assessmentStatus}. Calculation changes must be saved as a new revision.` };
      }
    }
    m.updatedAt = now;
    putRecord(buildRecord({ meta: m, dataModel, calculations: lines, selectedImprovement, now }));
    setMeta(m);
    return { ok: mode === "newRevision" ? `Saved as revision ${m.revision}. Approvals cleared; status reset to Draft.` : "Saved." };
  };

  const onLoad = (rec) => {
    if (calculations.length > 0 && !window.confirm("Load this assessment into the editor? Unsaved changes to the current assessment will be replaced.")) return;
    const w = recordToWorking(rec);
    setMeta(w.meta); setCalculations(w.calculations); setSelectedImprovement(w.selectedImprovement);
    setActiveTab("Savings Calculations");
  };
  const onNew = () => {
    if (calculations.length > 0 && !window.confirm("Start a new assessment? Unsaved changes to the current one will be lost.")) return;
    setMeta(createMeta()); setCalculations([]); setSelectedImprovement(null);
  };
  const onDuplicate = (rec) => {
    const now = nowIso();
    const id = newId();
    const copy = JSON.parse(JSON.stringify(rec));
    copy.assessmentId = id; copy.sourceRecordId = id; copy.revision = 1; copy.name = `${rec.name} (copy)`;
    copy.assessmentStatus = "draft"; copy.createdAt = now; copy.updatedAt = now; copy.realization = emptyRealization();
    copy.calculation.lines = copy.calculation.lines.map((l) => ({ ...l, lineId: newId(), approved: false }));
    putRecord(copy);
  };
  const onDelete = (rec) => setSaved((l) => l.filter((r) => recordKey(r) !== recordKey(rec)));
  const onImportRecords = (recs) => {
    const fresh = recs.filter((r) => !saved.some((s) => recordKey(s) === recordKey(r)));
    setSaved((l) => [...l, ...fresh]);
    return { ok: `Imported ${fresh.length} assessment(s).` };
  };
  const onLink = (snapshot, choice) => {
    setMeta((m) => {
      let next = linkSnapshot(m, snapshot, choice);
      if (choice.newRevision) {
        const maxRev = Math.max(m.revision, ...saved.filter((r) => r.assessmentId === m.assessmentId).map((r) => r.revision));
        next = { ...next, revision: maxRev + 1, assessmentStatus: "draft", realization: emptyRealization() };
      }
      return { ...next, updatedAt: nowIso() };
    });
    if (choice.newRevision) setCalculations((l) => l.map((c) => ({ ...c, approved: false })));
    return { ok: choice.newRevision ? "Updated source linked as a new revision. Save to keep it; approvals were cleared." : "Source snapshot linked to the current assessment. Save to keep it." };
  };

  return (
    <div style={{ fontFamily: T.font, background: T.bg, minHeight: "100vh" }}>
      <style>{`input, select, textarea, button { font-family: ${T.font}; } input[type=number] { font-family: ${T.mono}; }`}</style>
      <div style={{ background: "#FFFFFF", borderBottom: `1px solid ${T.border}`, padding: "16px 14px 0" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: T.heading, marginBottom: 2 }}>Manufacturing Cost Impact Analyzer</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Absorption-based cost accounting for process improvements</div>
        </div>
      </div>
      <div style={{ maxWidth: 600, margin: "0 auto" }}><TabBar active={activeTab} setActive={setActiveTab} /></div>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 14px 48px" }}>
        {activeTab === "Data Model" && <DataModelTab dataModel={dataModel} setDataModel={setDataModel} />}
        {activeTab === "Decision Tree" && <DecisionTreeTab dataModel={dataModel} selectedImprovement={selectedImprovement} setSelectedImprovement={setSelectedImprovement} goToMatrix={() => setActiveTab("Fingerprint Matrix")} />}
        {activeTab === "Fingerprint Matrix" && <MatrixTab selectedImprovement={selectedImprovement} onSelectCell={addCalculation} />}
        {activeTab === "Savings Calculations" && <CalculationsTab meta={meta} updateMeta={updateMeta} calculations={calculations} dataModel={dataModel} updateLine={updateLine} removeLine={removeLine} />}
        {activeTab === "Finance Review" && <FinanceTab calculations={calculations} meta={meta} />}
        {activeTab === "Saved Assessments" && <SavedTab meta={meta} saved={saved} calculations={calculations} onSave={onSave} onLoad={onLoad} onNew={onNew} onDuplicate={onDuplicate} onDelete={onDelete} onImportRecords={onImportRecords} onLink={onLink} />}
      </div>
    </div>
  );
}
