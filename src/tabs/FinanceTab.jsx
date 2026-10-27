import React from "react";
import { Card, SectionLabel, EmptyState, Notice, Badge, fmtMoney, fmtNum, fmtValue } from "../ui.jsx";
import { runFormula, FORMULAS } from "../engine/formulas.js";
import { summarize, STATUS_LABELS } from "../engine/summary.js";
import { T, BUCKET_COLORS } from "../theme.js";

const TITLES = {
  hard: "HARD SAVINGS (modeled expense reduction)",
  avoidance: "COST AVOIDANCE (future spend prevented)",
  productivity: "PRODUCTIVITY / CAPACITY (not cash)",
  absorption: "ABSORPTION / ACCOUNTING EFFECT (not savings)",
  noImpact: "NO SUBSTANTIATED IMPACT (excluded)",
};

export default function FinanceTab({ calculations, meta }) {
  if (calculations.length === 0) return <EmptyState>No calculations to review yet. Add some from the Fingerprint Matrix tab.</EmptyState>;
  const items = calculations.map((line) => ({ line, result: runFormula(line.formulaId, line.inputs) }));
  const s = summarize(items, meta);
  const b = s.buckets;
  const stat = (value, label, color = T.heading) => (
    <div style={{ background: "#FFFFFF", border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontFamily: T.mono, fontSize: 15, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: T.placeholder, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>{meta.name || "Unsaved assessment"} · <b>{STATUS_LABELS[meta.assessmentStatus]}</b></div>
      {s.incomplete.length > 0 && <Notice tone="error">{s.incomplete.length} calculation(s) are incomplete or invalid and are excluded from all totals.</Notice>}
      {s.overlaps.map((w, i) => <Notice key={i} tone="warn">{w}</Notice>)}

      <SectionLabel>Hard savings by status</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {stat(fmtMoney(b.hard.modeled), "Modeled", T.green)}
        {stat(fmtMoney(b.hard.approved), "Approved", T.green)}
        {stat(s.realized.eligible ? fmtMoney(s.realized.usd) : "—", "Realized", T.green)}
      </div>
      {!s.realized.eligible && <div style={{ fontSize: 11.5, color: T.placeholder, marginBottom: 14 }}>Realized stays blank until the status is Realized with evidence and a basis recorded.</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {stat(fmtMoney(b.avoidance.modeled), "Cost avoidance", T.amber)}
        {stat(`${fmtNum(b.productivity.hoursModeled, 0)} hrs`, "Capacity", T.blue)}
        {stat(fmtMoney(b.absorption.modeled), "Absorption", T.slate)}
      </div>

      {["hard", "avoidance", "productivity", "absorption", "noImpact"].map((k) => {
        const entries = b[k].entries;
        if (!entries.length) return null;
        return (
          <Card key={k} style={{ borderLeft: `4px solid ${BUCKET_COLORS[k]}` }}>
            <SectionLabel>{TITLES[k]}</SectionLabel>
            {entries.map(({ line, result }, idx) => (
              <div key={line.id} style={{ padding: "10px 0", borderTop: idx === 0 ? "none" : `1px solid ${T.lightGray}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: T.heading }}>{line.costCategory}</div>
                    <div style={{ fontSize: 12, color: T.muted }}>{line.improvement}</div>
                    <div style={{ fontSize: 11, color: T.placeholder, fontFamily: T.mono, marginTop: 2 }}>{FORMULAS[line.formulaId]?.label}</div>
                    <div style={{ fontSize: 11, color: T.placeholder, fontFamily: T.mono, marginTop: 2 }}>
                      {FORMULAS[line.formulaId]?.inputs.map((sp) => `${sp.key}=${line.inputs[sp.key] ?? "—"}`).join(", ")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 16, color: result.status === "ok" && k !== "noImpact" ? BUCKET_COLORS[k] : T.placeholder }}>{k === "noImpact" ? "excluded" : fmtValue(result)}</div>
                    <div style={{ fontSize: 11, color: line.approved ? T.green : T.placeholder, fontWeight: 600 }}>{line.approved ? "✓ Approved" : "Pending approval"}</div>
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
