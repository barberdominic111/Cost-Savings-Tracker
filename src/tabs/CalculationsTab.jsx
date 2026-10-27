import React, { useState } from "react";
import { Card, SectionLabel, Field, DestructiveButton, OutlineButton, Badge, Notice, EmptyState, fmtValue, fmtMoney, fmtNum } from "../ui.jsx";
import { FORMULAS, runFormula } from "../engine/formulas.js";
import { defaultInputsFor } from "../engine/basis.js";
import { rationaleFor } from "../engine/matrix.js";
import { STATUSES, STATUS_LABELS, canSetStatus, summarize, LOCKED_STATUSES } from "../engine/summary.js";
import { T, IMPACT_COLORS } from "../theme.js";

function CalcCard({ line, dataModel, onChange, onRemove }) {
  const f = FORMULAS[line.formulaId];
  const result = runFormula(line.formulaId, line.inputs);
  const colors = IMPACT_COLORS[line.impactType] || IMPACT_COLORS["No Impact"];
  const setInput = (key, v) => onChange(line.id, { inputs: { ...line.inputs, [key]: v } });
  const repull = () => {
    if (window.confirm("Replace this card's inputs with current Data Model values? Your overrides on this card will be lost.")) {
      onChange(line.id, { inputs: defaultInputsFor(line.formulaId, line.improvement, dataModel) });
    }
  };
  const compMoney = (c) => (c.unit === "USD" ? fmtMoney(c.value) : fmtNum(c.value));
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.heading }}>{line.costCategory}{line.legacy && <Badge color="#B45309" bg="#FFFBEB" border="#FDE68A">LEGACY BASIS</Badge>}</div>
          <div style={{ fontSize: 12, color: T.muted }}>{line.improvement}</div>
        </div>
        <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, textAlign: "center" }}>{colors.label}</div>
      </div>
      <div style={{ fontSize: 12, color: T.placeholder, fontFamily: T.mono, marginBottom: 6 }}>{f?.label}</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12 }}>{rationaleFor(line.impactType, line.formulaId)}</div>

      {f?.inputs.map((spec) => (
        <Field key={spec.key} label={`${spec.label} (${spec.unit})`} value={typeof line.inputs[spec.key] === "number" ? line.inputs[spec.key] : null} onChange={(v) => setInput(spec.key, v)} hint={spec.hint} />
      ))}

      <div style={{ background: T.lightestGray, borderRadius: 10, padding: "12px 14px", marginTop: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.placeholder, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Result</div>
        <div style={{ fontFamily: T.mono, fontSize: 24, fontWeight: 700, color: result.status === "ok" ? T.heading : T.red }}>{fmtValue(result)}</div>
        {result.status === "incomplete" && <div style={{ fontSize: 12, color: T.red, marginTop: 6 }}>Missing: {result.missing.map((k) => f.inputs.find((s) => s.key === k)?.label || k).join(", ")}. Not included in totals.</div>}
        {result.status === "invalid" && <div style={{ fontSize: 12, color: T.red, marginTop: 6 }}>Invalid: {result.invalid.map((x) => `${f.inputs.find((s) => s.key === x.key)?.label || x.key} (${x.reason})`).join(", ")}.</div>}
        {result.components.map((c) => (
          <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.text, marginTop: 6 }}>
            <span>{c.label}</span><span style={{ fontFamily: T.mono }}>{compMoney(c)}</span>
          </div>
        ))}
        {result.warnings.map((w, i) => <div key={i} style={{ fontSize: 11.5, color: T.amber, marginTop: 6 }}>⚠ {w}</div>)}
        {result.notes.map((n, i) => <div key={i} style={{ fontSize: 11.5, color: T.muted, marginTop: 6, fontStyle: "italic" }}>{n}</div>)}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.muted, flex: 1, minWidth: 140 }}>
          <input type="checkbox" checked={!!line.approved} onChange={(e) => onChange(line.id, { approved: e.target.checked })} /> Finance approved
        </label>
        {!line.legacy && <OutlineButton onClick={repull} style={{ padding: "6px 10px", fontSize: 12 }}>Re-pull from Data Model</OutlineButton>}
        <DestructiveButton onClick={() => onRemove(line.id)}>Remove</DestructiveButton>
      </div>
    </Card>
  );
}

function AssessmentDetails({ meta, updateMeta, items }) {
  const [msg, setMsg] = useState("");
  const summary = summarize(items, meta);
  const locked = LOCKED_STATUSES.includes(meta.assessmentStatus);
  const setStatus = (next) => {
    const check = canSetStatus(next, meta, summary, items.length);
    if (!check.ok) { setMsg(check.reason); return; }
    setMsg("");
    updateMeta({ assessmentStatus: next });
  };
  const setReal = (k, v) => updateMeta({ realization: { ...meta.realization, [k]: v } });
  const active = (meta.sourceSnapshots || []);
  return (
    <Card>
      <SectionLabel>Assessment Details</SectionLabel>
      <Field type="text" label="Assessment Name" value={meta.name} onChange={(v) => updateMeta({ name: v })} />
      <Field type="select" label="Status" value={meta.assessmentStatus} options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} onChange={setStatus} />
      {msg && <Notice tone="error">{msg}</Notice>}
      {locked && <Notice tone="warn">This assessment is {STATUS_LABELS[meta.assessmentStatus]}. Changes to calculations must be saved as a new revision.</Notice>}
      <div style={{ fontSize: 11, color: T.placeholder, fontFamily: T.mono, marginBottom: 12 }}>ID {meta.assessmentId} · revision {meta.revision}</div>
      <Field type="text" label="Improvement ID (optional)" value={meta.improvementId} onChange={(v) => updateMeta({ improvementId: v })} />
      <Field type="text" label="Process ID (optional)" value={meta.processId} onChange={(v) => updateMeta({ processId: v })} />
      <Field type="text" label="Sequence ID (optional)" value={meta.sequenceId} onChange={(v) => updateMeta({ sequenceId: v })} />
      <Field type="text" label="Element ID (optional)" value={meta.elementId} onChange={(v) => updateMeta({ elementId: v })} />
      <Field type="text" label="Baseline Version (optional)" value={meta.baselineVersion} onChange={(v) => updateMeta({ baselineVersion: v })} />
      <Field type="textarea" label="Assumptions" value={meta.assumptions} onChange={(v) => updateMeta({ assumptions: v })} />
      <Field type="textarea" label="Exclusions" value={meta.exclusions} onChange={(v) => updateMeta({ exclusions: v })} />
      <Field type="textarea" label="Reviewer Notes" value={meta.reviewerNotes} onChange={(v) => updateMeta({ reviewerNotes: v })} />
      {["approved", "realized"].includes(meta.assessmentStatus) && (
        <div style={{ borderTop: `1px solid ${T.lightGray}`, paddingTop: 12 }}>
          <SectionLabel>Realization Evidence</SectionLabel>
          <Field type="textarea" label="Evidence (e.g. report, GL line, period)" value={meta.realization.evidence} onChange={(v) => setReal("evidence", v)} />
          <Field type="textarea" label="Basis (how the saving was confirmed)" value={meta.realization.basis} onChange={(v) => setReal("basis", v)} />
          <Field type="text" label="Date confirmed" value={meta.realization.date} onChange={(v) => setReal("date", v)} placeholder="YYYY-MM-DD" />
        </div>
      )}
      {active.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.lightGray}`, paddingTop: 12 }}>
          <SectionLabel>Linked Source Evidence (read-only snapshots)</SectionLabel>
          {active.map((s) => (
            <div key={s.snapshotId} style={{ fontSize: 12.5, color: s.superseded ? T.placeholder : T.text, marginBottom: 4 }}>
              {s.sourceApp} · {s.sourceRecordId}{s.sourceRevision != null ? ` · rev ${s.sourceRevision}` : ""} · imported {new Date(s.importedAt).toLocaleDateString()}
              {s.superseded && <Badge>SUPERSEDED</Badge>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function CalculationsTab({ meta, updateMeta, calculations, dataModel, updateLine, removeLine }) {
  const items = calculations.map((line) => ({ line, result: runFormula(line.formulaId, line.inputs) }));
  return (
    <div>
      <AssessmentDetails meta={meta} updateMeta={updateMeta} items={items} />
      {calculations.length === 0 ? (
        <EmptyState>No calculations yet. Go to the Fingerprint Matrix tab and tap a highlighted cell to add one.</EmptyState>
      ) : (
        calculations.map((line) => <CalcCard key={line.id} line={line} dataModel={dataModel} onChange={updateLine} onRemove={removeLine} />)
      )}
    </div>
  );
}
