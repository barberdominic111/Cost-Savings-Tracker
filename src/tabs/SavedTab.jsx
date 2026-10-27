import React, { useState } from "react";
import { Card, SectionLabel, Field, PrimaryButton, OutlineButton, DestructiveButton, Notice, Badge, EmptyState, downloadFile, fmtMoney } from "../ui.jsx";
import { recordKey, recordToCSV, toEnvelope, toExportAll, validateImport, findExistingSnapshot, changesBetween, newId, nowIso, emptyRealization } from "../data/records.js";
import { LOCKED_STATUSES, STATUS_LABELS } from "../engine/summary.js";
import { KEY_V1, KEY_V2 } from "../data/storage.js";
import { T } from "../theme.js";

const safe = (s) => (s || "assessment").replace(/[^a-z0-9]+/gi, "_");

export default function SavedTab({ meta, saved, calculations, onSave, onLoad, onNew, onDuplicate, onDelete, onImportRecords, onLink }) {
  const [msg, setMsg] = useState(null);
  const [selected, setSelected] = useState({});
  const [pending, setPending] = useState(null); // import preview
  const existing = saved.find((r) => recordKey(r) === `${meta.assessmentId}:${meta.revision}`);
  const isSel = (r) => selected[recordKey(r)] !== false; // default: selected

  const doSave = (mode) => setMsg(onSave(mode));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      setPending({ fileName: file.name, json, v: validateImport(json) });
    } catch {
      setPending({ fileName: file.name, json: null, v: { errors: ["File is not valid JSON."], warnings: [], rows: [], unknownKeys: [], records: [], kind: null } });
    }
  };

  const confirmImport = (asCopy) => {
    const { v } = pending;
    if (v.records?.length) {
      const recs = v.records.map((r) => (asCopy ? { ...r, assessmentId: newId(), sourceRecordId: undefined, revision: 1, name: `${r.name} (imported copy)`, createdAt: nowIso(), updatedAt: nowIso() } : r)).map((r) => ({ ...r, sourceRecordId: r.assessmentId }));
      const result = onImportRecords(recs);
      setMsg(result);
    } else if (v.snapshot) {
      setMsg(onLink(v.snapshot, pending.choice || {}));
    }
    setPending(null);
  };

  const renderPreview = () => {
    const { v, fileName } = pending;
    const conflicts = (v.records || []).filter((r) => saved.some((s) => recordKey(s) === recordKey(r)));
    const ex = v.snapshot ? findExistingSnapshot(meta, v.snapshot) : null;
    const changes = ex ? changesBetween(ex, v.snapshot) : [];
    return (
      <Card style={{ border: `1.5px solid ${T.blue}` }}>
        <SectionLabel>Import preview · {fileName}</SectionLabel>
        {v.errors.map((e, i) => <Notice key={i} tone="error">{e}</Notice>)}
        {v.warnings.map((w, i) => <Notice key={i} tone="warn">{w}</Notice>)}
        {!v.errors.length && (
          <>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Detected: <b>{v.kind}</b>. Nothing is saved until you confirm.</div>
            {v.rows.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "3px 0", borderBottom: `1px solid ${T.lightestGray}` }}>
                <span style={{ color: T.muted }}>{r.label}</span>
                <span style={{ fontFamily: T.mono, color: r.value === "not provided" ? T.placeholder : T.text, textAlign: "right", wordBreak: "break-word" }}>{r.value}</span>
              </div>
            ))}
            {conflicts.length > 0 && <Notice tone="warn" style={{ marginTop: 10 }}>{conflicts.length} assessment(s) already exist with the same ID and revision. They will not be overwritten. Import as a copy instead.</Notice>}
            {ex && changes.length > 0 && (
              <Notice tone="warn" style={{ marginTop: 10 }}>
                This source record is already linked and has changed:
                {changes.slice(0, 8).map((c, i) => <div key={i} style={{ fontFamily: T.mono, fontSize: 11.5 }}>{c.path}: {JSON.stringify(c.before) ?? "—"} → {JSON.stringify(c.after) ?? "—"}</div>)}
                {changes.length > 8 && <div>…and {changes.length - 8} more</div>}
              </Notice>
            )}
            {ex && changes.length === 0 && <Notice tone="info" style={{ marginTop: 10 }}>This source record is already linked and unchanged.</Notice>}
          </>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {!v.errors.length && v.records?.length > 0 && conflicts.length === 0 && <OutlineButton onClick={() => confirmImport(false)} style={{ color: T.blue, borderColor: T.blue }}>Confirm import</OutlineButton>}
          {!v.errors.length && v.records?.length > 0 && <OutlineButton onClick={() => confirmImport(true)}>Import as copy</OutlineButton>}
          {!v.errors.length && v.snapshot && !ex && <OutlineButton onClick={() => { pending.choice = { adoptIds: true }; confirmImport(); }} style={{ color: T.blue, borderColor: T.blue }}>Link to current assessment{v.kind === "workStudy" ? " + copy IDs" : ""}</OutlineButton>}
          {!v.errors.length && v.snapshot && ex && changes.length > 0 && (
            <>
              <OutlineButton onClick={() => { pending.choice = { supersede: true, adoptIds: true, newRevision: true }; confirmImport(); }} style={{ color: T.blue, borderColor: T.blue }}>Use updated source (new revision)</OutlineButton>
            </>
          )}
          <OutlineButton onClick={() => setPending(null)}>{ex && changes.length > 0 ? "Keep original snapshot" : "Cancel"}</OutlineButton>
        </div>
      </Card>
    );
  };

  const recs = saved.filter(isSel);
  return (
    <div>
      <Card>
        <SectionLabel>Current Assessment</SectionLabel>
        <div style={{ fontSize: 13, color: T.text, marginBottom: 4 }}>{meta.name || "(unnamed)"} <Badge>{STATUS_LABELS[meta.assessmentStatus]}</Badge></div>
        <div style={{ fontSize: 11, color: T.placeholder, fontFamily: T.mono, marginBottom: 12 }}>ID {meta.assessmentId} · revision {meta.revision}</div>
        <Field type="text" label="Assessment Name" value={meta.name} onChange={(v) => onSave("rename", v)} />
        <PrimaryButton onClick={() => doSave("save")} disabled={!meta.name.trim() || calculations.length === 0}>{existing ? "Save Changes" : "Save Assessment"}</PrimaryButton>
        {existing && <OutlineButton onClick={() => doSave("newRevision")} style={{ width: "100%", marginTop: 8 }}>Save as New Revision (clears approvals)</OutlineButton>}
        {msg && <Notice tone={msg.error ? "error" : "info"} style={{ marginTop: 10 }}>{msg.error || msg.ok}</Notice>}
        {calculations.length === 0 && <div style={{ fontSize: 12, color: T.placeholder, marginTop: 8 }}>Add at least one calculation before saving.</div>}
        <OutlineButton onClick={onNew} style={{ width: "100%", marginTop: 8 }}>Start New Assessment</OutlineButton>
      </Card>

      {pending && renderPreview()}

      {saved.length === 0 ? <EmptyState>No saved assessments yet.</EmptyState> : saved.map((a) => {
        const t = a.calculation.totals;
        return (
          <Card key={recordKey(a)}>
            <div style={{ display: "flex", gap: 10 }}>
              <input type="checkbox" checked={isSel(a)} onChange={(e) => setSelected((s) => ({ ...s, [recordKey(a)]: e.target.checked }))} style={{ marginTop: 4 }} aria-label="Include in export" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: T.heading }}>{a.name}<Badge>{STATUS_LABELS[a.assessmentStatus]}</Badge>{a.legacy && <Badge color="#B45309" bg="#FFFBEB" border="#FDE68A">LEGACY</Badge>}</div>
                <div style={{ fontSize: 12, color: T.muted }}>rev {a.revision} · {a.calculation.lines.length} lines · hard {fmtMoney(t.hardModeled)} · avoidance {fmtMoney(t.avoidanceModeled)}{t.incompleteCount ? ` · ${t.incompleteCount} incomplete` : ""}</div>
                <div style={{ fontSize: 11, color: T.placeholder, fontFamily: T.mono, marginTop: 2 }}>Updated {new Date(a.updatedAt).toLocaleString()} · formulas v{a.calculation.formulaVersion}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <OutlineButton onClick={() => onLoad(a)}>Edit</OutlineButton>
              <OutlineButton onClick={() => onDuplicate(a)}>Duplicate</OutlineButton>
              <OutlineButton onClick={() => downloadFile(`${safe(a.name)}_r${a.revision}.csv`, recordToCSV(a))}>CSV</OutlineButton>
              <OutlineButton onClick={() => downloadFile(`${safe(a.name)}_r${a.revision}.json`, JSON.stringify(toEnvelope(a), null, 2), "application/json")}>JSON</OutlineButton>
              <DestructiveButton onClick={() => { if (window.confirm(`Delete "${a.name}" revision ${a.revision}?`)) onDelete(a); }}>Delete</DestructiveButton>
            </div>
          </Card>
        );
      })}

      <Card>
        <SectionLabel>Export / Import</SectionLabel>
        <OutlineButton disabled={recs.length === 0} onClick={() => downloadFile(`cost-analyzer-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(toExportAll(recs), null, 2), "application/json")} style={{ width: "100%", marginBottom: 8 }}>Export {recs.length} selected as JSON bundle</OutlineButton>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Import a Cost Analyzer export, or a TimeStudy / WorkStudy JSON export to link as read-only evidence:</div>
        <input type="file" accept=".json,application/json" onChange={onFile} style={{ fontSize: 13 }} />
      </Card>

      <Card>
        <SectionLabel>Storage</SectionLabel>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>All data is stored locally in this browser only and does not sync across devices. Export JSON regularly as a backup.</div>
        <DestructiveButton onClick={() => {
          if (window.confirm("This will permanently erase all data on this device (including any older v1 data). Continue?")) {
            localStorage.removeItem(KEY_V2); localStorage.removeItem(KEY_V1); window.location.reload();
          }
        }}>Reset All Data</DestructiveButton>
      </Card>
    </div>
  );
}
