import React from "react";
import { Card, SectionLabel, Notice } from "../ui.jsx";
import { COST_CATEGORIES, FINGERPRINT_MATRIX } from "../engine/matrix.js";
import { T, IMPACT_COLORS } from "../theme.js";

function MatrixCell({ impact, enabled, onClick }) {
  const type = impact ? impact.impactType : "No Impact";
  const colors = IMPACT_COLORS[type] || IMPACT_COLORS["No Impact"];
  const active = !!impact && enabled;
  const absorption = impact && (impact.formulaId === "fixedOverhead" || impact.formulaId === "absorption");
  return (
    <div onClick={active ? onClick : undefined} style={{ background: active ? colors.bg : T.lightestGray, border: `1.5px solid ${active ? colors.border : T.lightGray}`, borderRadius: 8, padding: "10px 6px", textAlign: "center", fontSize: 11, fontWeight: 700, color: active ? colors.text : T.gray, cursor: active ? "pointer" : "default", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}>
      {active ? (absorption ? "Absorption (not cash)" : colors.label) : "—"}
    </div>
  );
}

export default function MatrixTab({ selectedImprovement, onSelectCell }) {
  const impacts = selectedImprovement ? FINGERPRINT_MATRIX[selectedImprovement] || [] : [];
  const impactFor = (cat) => impacts.find((i) => i.costCategory === cat);
  return (
    <div>
      {!selectedImprovement && <Notice tone="error">Select an improvement in the Decision Tree tab first.</Notice>}
      <Card>
        <SectionLabel>{selectedImprovement || "No improvement selected"}</SectionLabel>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: T.muted, marginBottom: 14, flexWrap: "wrap" }}>
          {Object.entries(IMPACT_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}` }} />{v.label}
            </div>
          ))}
        </div>
        {[
          { title: "ERP / Cost Accounting Impact", cats: COST_CATEGORIES.group1 },
          { title: "Planning & Buying Impact", cats: COST_CATEGORIES.group2 },
          { title: "Resource Utilization Impact", cats: COST_CATEGORIES.group3 },
        ].map((g) => (
          <div key={g.title} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{g.title}</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${g.cats.length}, 1fr)`, gap: 8 }}>
              {g.cats.map((cat) => (
                <div key={cat}>
                  <div style={{ fontSize: 10, color: T.placeholder, textAlign: "center", marginBottom: 4, fontWeight: 600 }}>{cat}</div>
                  <MatrixCell impact={impactFor(cat)} enabled={!!selectedImprovement} onClick={() => onSelectCell(impactFor(cat))} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
