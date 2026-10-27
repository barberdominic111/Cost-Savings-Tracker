/* Assessment records, migration, JSON export/import contracts. Pure (no DOM). */
import { FORMULAS, FORMULA_VERSION, runFormula, DEFAULT_FORMULA_BY_CATEGORY } from "../engine/formulas.js";
import { summarize } from "../engine/summary.js";
import { rationaleFor } from "../engine/matrix.js";
import { DEFAULT_DATA_MODEL } from "./dataModel.js";

export const SCHEMA_VERSION = "1.0";
export const SOURCE_APP = "CostAnalyzer";
export const UNITS = { currency: "USD", time: "hours", rates: "USD/hr", volume: "units/yr", setupAndRework: "minutes", cycleTime: "hours/unit" };

export const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);
export const nowIso = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));
export const recordKey = (r) => `${r.assessmentId}:${r.revision}`;
export const emptyRealization = () => ({ evidence: "", basis: "", date: "" });

export function createMeta(now = nowIso()) {
  return {
    assessmentId: newId(), revision: 1, name: "", assessmentStatus: "draft",
    createdAt: now, updatedAt: now,
    improvementId: "", processId: "", sequenceId: "", elementId: "",
    workStudySourceRecordId: "", workStudyRevision: "", baselineVersion: "",
    assumptions: "", exclusions: "", reviewerNotes: "",
    realization: emptyRealization(), sourceSnapshots: [], legacy: null,
  };
}

export function evaluateLines(lines) {
  return lines.map((line) => ({ line, result: runFormula(line.formulaId, line.inputs) }));
}

function toRecordLine({ line, result }) {
  const impact = line.impactType ?? line.classification;
  return {
    lineId: line.id, improvement: line.improvement, costCategory: line.costCategory,
    formulaId: line.formulaId, formulaLabel: FORMULAS[line.formulaId]?.label ?? "",
    inputs: clone(line.inputs || {}), outputs: result,
    classification: impact, classificationRationale: rationaleFor(impact, line.formulaId),
    approved: !!line.approved, legacy: !!line.legacy,
  };
}

function compactTotals(s) {
  return {
    hardModeled: s.buckets.hard.modeled, hardApproved: s.buckets.hard.approved,
    avoidanceModeled: s.buckets.avoidance.modeled, avoidanceApproved: s.buckets.avoidance.approved,
    capacityHoursModeled: s.buckets.productivity.hoursModeled, softValueModeledUsd: s.buckets.productivity.usdValueModeled,
    absorptionModeledUsd: s.buckets.absorption.modeled, incompleteCount: s.incomplete.length,
    realizedUsd: s.realized.usd,
  };
}

export function buildRecord({ meta, dataModel, calculations, selectedImprovement, now = nowIso() }) {
  const items = evaluateLines(calculations);
  const summary = summarize(items, meta);
  const snaps = clone(meta.sourceSnapshots || []);
  return {
    schemaVersion: SCHEMA_VERSION, sourceApp: SOURCE_APP,
    sourceRecordId: meta.assessmentId, assessmentId: meta.assessmentId, revision: meta.revision,
    name: (meta.name || "").trim(), assessmentStatus: meta.assessmentStatus,
    createdAt: meta.createdAt, updatedAt: now,
    improvementId: meta.improvementId || null, processId: meta.processId || null, sequenceId: meta.sequenceId || null, elementId: meta.elementId || null,
    timeStudyIds: [...new Set(snaps.filter((s) => s.sourceApp === "TimeStudy" && !s.superseded).map((s) => s.sourceRecordId))],
    workStudySourceRecordId: meta.workStudySourceRecordId || null, workStudyRevision: meta.workStudyRevision || null,
    baselineVersion: meta.baselineVersion || null,
    selectedImprovement: selectedImprovement || null,
    assumptions: meta.assumptions || "", exclusions: meta.exclusions || "", reviewerNotes: meta.reviewerNotes || "",
    realization: clone(meta.realization || emptyRealization()),
    sourceSnapshots: snaps,
    inputSnapshot: { currency: "USD", units: UNITS, dataModel: clone(dataModel) },
    calculation: { formulaVersion: FORMULA_VERSION, lines: items.map(toRecordLine), totals: compactTotals(summary) },
    legacy: meta.legacy ? clone(meta.legacy) : null,
  };
}

export function recordToWorking(record) {
  const meta = {
    ...createMeta(record.createdAt),
    assessmentId: record.assessmentId, revision: record.revision, name: record.name, assessmentStatus: record.assessmentStatus,
    createdAt: record.createdAt, updatedAt: record.updatedAt,
    improvementId: record.improvementId || "", processId: record.processId || "", sequenceId: record.sequenceId || "", elementId: record.elementId || "",
    workStudySourceRecordId: record.workStudySourceRecordId || "", workStudyRevision: record.workStudyRevision || "",
    baselineVersion: record.baselineVersion || "",
    assumptions: record.assumptions || "", exclusions: record.exclusions || "", reviewerNotes: record.reviewerNotes || "",
    realization: { ...emptyRealization(), ...(record.realization || {}) },
    sourceSnapshots: clone(record.sourceSnapshots || []), legacy: record.legacy || null,
  };
  const calculations = record.calculation.lines.map((l) => ({
    id: l.lineId, improvement: l.improvement, costCategory: l.costCategory, formulaId: l.formulaId,
    impactType: l.classification, inputs: clone(l.inputs || {}), approved: !!l.approved, legacy: !!l.legacy,
  }));
  return { meta, calculations, selectedImprovement: record.selectedImprovement };
}

/* Items for summarizing a SAVED record from its stored (frozen) outputs. */
export function recordItems(record) {
  return record.calculation.lines.map((l) => ({
    line: { id: l.lineId, improvement: l.improvement, formulaId: l.formulaId, classification: l.classification, approved: l.approved, inputs: l.inputs },
    result: l.outputs,
  }));
}

/* ---------- Legacy (v1 localStorage) migration ---------- */
function legacyLine(c) {
  const formulaId = DEFAULT_FORMULA_BY_CATEGORY[c.costCategory];
  return { id: c.id, improvement: c.improvement, costCategory: c.costCategory, formulaId, impactType: c.impactType, inputs: c.inputs || {}, approved: !!c.approved, legacy: true };
}

export function migrateLegacyAssessment(old, now = nowIso()) {
  const assessmentId = newId();
  const lines = (old.calculations || []).map(legacyLine);
  const items = lines.map((line) => ({ line, result: runFormula(line.formulaId, line.inputs, { legacyZeroFill: true }) }));
  const meta = { ...createMeta(old.savedAt || now), assessmentId, name: old.name || "Migrated assessment", createdAt: old.savedAt || now, updatedAt: old.savedAt || now,
    legacy: { migratedAt: now, legacyId: old.id ?? null, note: "Migrated from v1. Original calculation logic preserved; missing inputs were treated as 0 in the original app." } };
  const rec = buildRecord({ meta, dataModel: { ...DEFAULT_DATA_MODEL, ...(old.dataModel || {}) }, calculations: lines, selectedImprovement: old.selectedImprovement, now: old.savedAt || now });
  // Freeze the legacy-semantics outputs
  rec.calculation.lines = items.map(toRecordLine);
  rec.calculation.formulaVersion = "1.0-legacy";
  rec.calculation.totals = compactTotals(summarize(items, meta));
  return rec;
}

export function freshState() {
  return { version: 2, dataModel: { ...DEFAULT_DATA_MODEL }, selectedImprovement: null, calculations: [], saved: [], meta: createMeta() };
}

export function migrateState(v1, now = nowIso()) {
  const s = freshState();
  s.dataModel = { ...DEFAULT_DATA_MODEL, ...(v1.dataModel || {}) };
  s.selectedImprovement = v1.selectedImprovement || null;
  s.calculations = (v1.calculations || []).map(legacyLine);
  s.saved = (v1.saved || []).map((a) => migrateLegacyAssessment(a, now));
  return s;
}

export function normalizeState(s) {
  const f = freshState();
  return {
    version: 2,
    dataModel: { ...DEFAULT_DATA_MODEL, ...(s.dataModel || {}) },
    selectedImprovement: s.selectedImprovement || null,
    calculations: Array.isArray(s.calculations) ? s.calculations : [],
    saved: Array.isArray(s.saved) ? s.saved : [],
    meta: { ...f.meta, ...(s.meta || {}), realization: { ...emptyRealization(), ...(s.meta?.realization || {}) }, sourceSnapshots: s.meta?.sourceSnapshots || [] },
  };
}

/* ---------- Export ---------- */
function classificationSummary(record) {
  const set = new Set(record.calculation.lines.map((l) => l.classification));
  return set.size === 1 ? [...set][0] : set.size === 0 ? "None" : "Mixed";
}

export function toEnvelope(record, exportedAt = nowIso()) {
  const { sourceSnapshots, ...assessment } = record;
  const inputs = {}, outputs = {};
  record.calculation.lines.forEach((l) => { inputs[l.lineId] = l.inputs; outputs[l.lineId] = l.outputs; });
  return {
    schemaVersion: SCHEMA_VERSION, sourceApp: SOURCE_APP,
    sourceRecordId: record.assessmentId, assessmentId: record.assessmentId, improvementId: record.improvementId ?? null,
    exportedAt, assessment, sourceSnapshots: sourceSnapshots || [],
    calculation: {
      formulaVersion: record.calculation.formulaVersion,
      inputs: { currency: "USD", units: UNITS, dataModel: record.inputSnapshot.dataModel, lines: inputs },
      outputs: { lines: outputs, totals: record.calculation.totals },
      classification: classificationSummary(record),
    },
  };
}

export function toExportAll(records, exportedAt = nowIso()) {
  return {
    schemaVersion: SCHEMA_VERSION, sourceApp: SOURCE_APP,
    manifest: { appName: "Manufacturing Cost Impact Analyzer", sourceApp: SOURCE_APP, schemaVersion: SCHEMA_VERSION, formulaVersion: FORMULA_VERSION, exportedAt, assessmentCount: records.length },
    assessments: records.map((r) => toEnvelope(r, exportedAt)),
  };
}

export function recordFromEnvelope(env) {
  return { ...clone(env.assessment), sourceSnapshots: clone(env.sourceSnapshots || []) };
}

export function validateRecord(r) {
  const errors = [];
  if (!r || typeof r !== "object") return ["Assessment is not an object."];
  if (typeof r.assessmentId !== "string" || !r.assessmentId) errors.push("Missing assessmentId.");
  if (typeof r.revision !== "number") errors.push("Missing numeric revision.");
  if (!r.createdAt || !r.updatedAt) errors.push("Missing createdAt/updatedAt.");
  if (!r.calculation || !Array.isArray(r.calculation.lines)) errors.push("Missing calculation.lines.");
  else r.calculation.lines.forEach((l, i) => {
    if (!l.lineId) errors.push(`Line ${i + 1}: missing lineId.`);
    if (!FORMULAS[l.formulaId]) errors.push(`Line ${i + 1}: unknown formulaId "${l.formulaId}".`);
    if (!l.outputs || typeof l.outputs !== "object") errors.push(`Line ${i + 1}: missing outputs.`);
  });
  return errors;
}

/* ---------- Import validation ---------- */
const major = (v) => String(v).split(".")[0];
const SOURCE_APPS = ["CostAnalyzer", "TimeStudy", "WorkStudy"];

const CONTRACTS = {
  TimeStudy: {
    required: ["sourceRecordId", "role", "sampleSize", "cycleTimeStats"],
    known: ["schemaVersion", "sourceApp", "sourceRecordId", "exportedAt", "studyDate", "studyName", "role", "sampleSize", "cycleTimeStats", "tags", "revision"],
  },
  WorkStudy: {
    required: ["sourceRecordId", "processId", "revision"],
    known: ["schemaVersion", "sourceApp", "sourceRecordId", "exportedAt", "name", "processId", "sequenceId", "elementId", "revision", "selectedStandardTime", "standardTimeUnits", "source", "volumeAssumptions"],
  },
};

const show = (v) => (v === undefined || v === null || v === "" ? "not provided" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function validateImport(json) {
  const out = { kind: null, errors: [], warnings: [], rows: [], unknownKeys: [], records: [], snapshot: null };
  if (!json || typeof json !== "object" || Array.isArray(json)) { out.errors.push("File is not a JSON object."); return out; }
  if (!SOURCE_APPS.includes(json.sourceApp)) { out.errors.push(`Unrecognized sourceApp "${json.sourceApp ?? "(missing)"}". Expected one of: ${SOURCE_APPS.join(", ")}.`); return out; }
  if (!json.schemaVersion) { out.errors.push("Missing schemaVersion."); return out; }
  if (major(json.schemaVersion) !== major(SCHEMA_VERSION)) { out.errors.push(`Unsupported schemaVersion ${json.schemaVersion} (this app supports ${SCHEMA_VERSION}).`); return out; }

  if (json.sourceApp === "CostAnalyzer") {
    const envs = json.manifest ? json.assessments : [json];
    if (json.manifest) {
      if (!Array.isArray(json.assessments)) out.errors.push("Bundle is missing the assessments array.");
      else if (json.manifest.assessmentCount !== json.assessments.length) out.errors.push(`Manifest says ${json.manifest.assessmentCount} assessments but file contains ${json.assessments.length}.`);
    }
    if (out.errors.length) return out;
    out.kind = json.manifest ? "assessmentBundle" : "assessment";
    envs.forEach((env, i) => {
      if (!env || !env.assessment) { out.errors.push(`Assessment ${i + 1}: missing "assessment".`); return; }
      const rec = recordFromEnvelope(env);
      const errs = validateRecord(rec);
      if (errs.length) errs.forEach((e) => out.errors.push(`Assessment ${i + 1}: ${e}`));
      else {
        out.records.push(rec);
        out.rows.push({ label: rec.name || "(unnamed)", value: `rev ${rev(rec)}, ${rec.calculation.lines.length} lines, status ${rec.assessmentStatus}` });
      }
    });
    return out;
  }

  const c = CONTRACTS[json.sourceApp];
  out.kind = json.sourceApp === "TimeStudy" ? "timeStudy" : "workStudy";
  c.required.forEach((k) => { if (json[k] === undefined || json[k] === null || json[k] === "") out.errors.push(`Missing required field "${k}".`); });
  out.unknownKeys = Object.keys(json).filter((k) => !c.known.includes(k));
  if (out.unknownKeys.length) out.warnings.push(`Fields not recognized by this app (kept in the raw snapshot, not interpreted): ${out.unknownKeys.join(", ")}.`);
  if (json.sourceApp === "TimeStudy" && json.role && !["baseline", "trial", "post-change"].includes(json.role)) out.warnings.push(`Unexpected role "${json.role}" (expected baseline, trial, or post-change).`);
  c.known.filter((k) => !["schemaVersion", "sourceApp"].includes(k)).forEach((k) => out.rows.push({ label: k, value: show(json[k]) }));
  if (!out.errors.length) out.snapshot = makeSnapshot(json);
  return out;
}
const rev = (r) => r.revision;

export function makeSnapshot(json, importedAt = nowIso()) {
  return {
    snapshotId: newId(), sourceApp: json.sourceApp, sourceRecordId: json.sourceRecordId,
    sourceRevision: json.revision ?? json.exportedAt ?? null, importedAt, linkType: "snapshot", superseded: false,
    summary: { processId: json.processId ?? null, sequenceId: json.sequenceId ?? null, elementId: json.elementId ?? null, role: json.role ?? null },
    raw: clone(json),
  };
}

export function diffObjects(a, b, path = "") {
  const diffs = [];
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  const keys = new Set([...(isObj(a) ? Object.keys(a) : []), ...(isObj(b) ? Object.keys(b) : [])]);
  keys.forEach((k) => {
    const p = path ? `${path}.${k}` : k;
    const x = a?.[k], y = b?.[k];
    if (isObj(x) && isObj(y)) diffs.push(...diffObjects(x, y, p));
    else if (JSON.stringify(x) !== JSON.stringify(y)) diffs.push({ path: p, before: x, after: y });
  });
  return diffs;
}

/* Find an existing active snapshot for the same source record. */
export function findExistingSnapshot(meta, snapshot) {
  return (meta.sourceSnapshots || []).find((s) => !s.superseded && s.sourceApp === snapshot.sourceApp && s.sourceRecordId === snapshot.sourceRecordId) || null;
}

export function changesBetween(existing, snapshot) {
  return diffObjects(existing.raw, snapshot.raw).filter((d) => d.path !== "exportedAt");
}

/* Link a snapshot into the working meta. opts.adoptIds copies WorkStudy IDs; opts.supersede marks the previous one. */
export function linkSnapshot(meta, snapshot, opts = {}) {
  const next = { ...meta, sourceSnapshots: (meta.sourceSnapshots || []).map((s) => ({ ...s })) };
  if (opts.supersede) next.sourceSnapshots.forEach((s) => { if (!s.superseded && s.sourceApp === snapshot.sourceApp && s.sourceRecordId === snapshot.sourceRecordId) s.superseded = true; });
  next.sourceSnapshots.push(snapshot);
  if (opts.adoptIds && snapshot.sourceApp === "WorkStudy") {
    next.workStudySourceRecordId = snapshot.sourceRecordId;
    next.workStudyRevision = snapshot.raw.revision != null ? String(snapshot.raw.revision) : "";
    next.processId = snapshot.raw.processId ?? next.processId;
    next.sequenceId = snapshot.raw.sequenceId ?? next.sequenceId;
    next.elementId = snapshot.raw.elementId ?? next.elementId;
  }
  return next;
}

/* ---------- CSV (existing columns preserved, new columns appended) ---------- */
export function recordToCSV(record) {
  const rows = [["Improvement", "Cost Category", "Formula", "Result", "Classification", "Approved", "Unit", "Status", "Missing Inputs", "Formula Version"]];
  record.calculation.lines.forEach((l) => {
    const o = l.outputs;
    const ok = o && o.status === "ok";
    rows.push([
      l.improvement, l.costCategory, l.formulaLabel,
      ok ? (o.unit === "percent" ? `${o.value.toFixed(1)}%` : o.value.toFixed(2)) : "",
      l.classification, l.approved ? "Yes" : "No",
      o?.unit ?? "", o?.status ?? "", (o?.missing || []).join("; "), o?.formulaVersion ?? "",
    ]);
  });
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
