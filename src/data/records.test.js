import { describe, it, expect } from "vitest";
import { createMeta, buildRecord, toEnvelope, toExportAll, validateImport, migrateLegacyAssessment, migrateState, recordFromEnvelope, recordToWorking, linkSnapshot, makeSnapshot, findExistingSnapshot, changesBetween, recordToCSV } from "./records.js";
import { DEFAULT_DATA_MODEL } from "./dataModel.js";

const lines = [{ id: "l1", improvement: "Bottleneck Cycle Reduction", costCategory: "Direct Labor", formulaId: "directLabor", impactType: "Hard Savings", inputs: { hoursReduced: 100, directLaborRate: 28 }, approved: true }];
const mkRecord = () => { const meta = { ...createMeta(), name: "Test" }; return buildRecord({ meta, dataModel: DEFAULT_DATA_MODEL, calculations: lines, selectedImprovement: "Bottleneck Cycle Reduction" }); };

describe("records", () => {
  it("assessmentId is stable across edits; record stores frozen outputs and formula version", () => {
    const meta = { ...createMeta(), name: "T" };
    const a = buildRecord({ meta, dataModel: DEFAULT_DATA_MODEL, calculations: lines, selectedImprovement: null });
    const b = buildRecord({ meta, dataModel: DEFAULT_DATA_MODEL, calculations: lines, selectedImprovement: null });
    expect(a.assessmentId).toBe(b.assessmentId);
    expect(a.calculation.lines[0].outputs.value).toBe(2800);
    expect(a.calculation.formulaVersion).toBeTruthy();
  });
  it("envelope has required contract keys and round-trips", () => {
    const rec = mkRecord();
    const env = toEnvelope(rec);
    ["schemaVersion", "sourceApp", "sourceRecordId", "assessmentId", "improvementId", "exportedAt", "assessment", "sourceSnapshots", "calculation"].forEach((k) => expect(env).toHaveProperty(k));
    ["inputs", "outputs", "classification", "formulaVersion"].forEach((k) => expect(env.calculation).toHaveProperty(k));
    const v = validateImport(JSON.parse(JSON.stringify(env)));
    expect(v.errors).toEqual([]);
    expect(v.kind).toBe("assessment");
    expect(v.records[0].calculation.lines[0].outputs.value).toBe(2800);
    expect(recordFromEnvelope(env).assessmentId).toBe(rec.assessmentId);
  });
  it("bundle manifest is validated", () => {
    const bundle = toExportAll([mkRecord(), mkRecord()]);
    expect(validateImport(bundle).records).toHaveLength(2);
    bundle.manifest.assessmentCount = 5;
    expect(validateImport(bundle).errors.join(" ")).toMatch(/Manifest/);
  });
  it("rejects wrong sourceApp, missing or incompatible schemaVersion", () => {
    expect(validateImport({ sourceApp: "Nope", schemaVersion: "1.0" }).errors.length).toBeGreaterThan(0);
    expect(validateImport({ sourceApp: "TimeStudy" }).errors.join(" ")).toMatch(/schemaVersion/);
    expect(validateImport({ sourceApp: "TimeStudy", schemaVersion: "2.0" }).errors.join(" ")).toMatch(/Unsupported/);
  });
  it("source import requires fields, shows 'not provided' (never 0) and lists unknown keys", () => {
    const bad = validateImport({ sourceApp: "TimeStudy", schemaVersion: "1.0" });
    expect(bad.errors.join(" ")).toMatch(/sourceRecordId/);
    const good = validateImport({ sourceApp: "TimeStudy", schemaVersion: "1.0", sourceRecordId: "ts-1", role: "baseline", sampleSize: 30, cycleTimeStats: { mean: 41 }, mystery: 1 });
    expect(good.errors).toEqual([]);
    expect(good.unknownKeys).toEqual(["mystery"]);
    expect(good.rows.find((r) => r.label === "tags").value).toBe("not provided");
    expect(good.snapshot.raw.mystery).toBe(1);
  });
  it("detects changed WorkStudy source and links snapshots without losing the original", () => {
    const base = { sourceApp: "WorkStudy", schemaVersion: "1.0", sourceRecordId: "ws-1", processId: "P1", revision: 1 };
    const s1 = makeSnapshot(base);
    const meta = linkSnapshot(createMeta(), s1, { adoptIds: true });
    expect(meta.processId).toBe("P1");
    const s2 = makeSnapshot({ ...base, revision: 2, exportedAt: "x" });
    const existing = findExistingSnapshot(meta, s2);
    expect(changesBetween(existing, s2).map((d) => d.path)).toContain("revision");
    const meta2 = linkSnapshot(meta, s2, { supersede: true, adoptIds: true });
    expect(meta2.sourceSnapshots).toHaveLength(2);
    expect(meta2.sourceSnapshots[0].superseded).toBe(true);
    expect(meta2.workStudyRevision).toBe("2");
  });
  it("recordToWorking round-trips lines", () => {
    const w = recordToWorking(mkRecord());
    expect(w.calculations[0].inputs.hoursReduced).toBe(100);
    expect(w.meta.assessmentId).toBeTruthy();
  });
  it("CSV keeps the original six columns first", () => {
    const head = recordToCSV(mkRecord()).split("\n")[0];
    expect(head.startsWith('"Improvement","Cost Category","Formula","Result","Classification","Approved"')).toBe(true);
  });
});

describe("legacy migration", () => {
  const old = { id: 1700000000000, name: "Old one", savedAt: "2026-01-01T00:00:00.000Z", dataModel: { plantName: "P" }, selectedImprovement: "Overtime Elimination",
    calculations: [
      { id: "a", improvement: "Overtime Elimination", costCategory: "Overtime", impactType: "Hard Savings", inputs: { hours: 10, directLaborRate: 28, otRate: 42 }, approved: true },
      { id: "b", improvement: "Temp Labor Reduction", costCategory: "Temp Labor", impactType: "Hard Savings", inputs: { hoursAvoided: 100 }, approved: false },
    ] };
  it("preserves historical results and marks legacy; v1 temp-labor zero is flagged", () => {
    const r = migrateLegacyAssessment(old);
    expect(r.assessmentId).toBeTruthy();
    expect(r.calculation.formulaVersion).toBe("1.0-legacy");
    expect(r.calculation.lines[0].outputs.value).toBe(420);
    expect(r.calculation.lines[1].outputs.value).toBe(0);
    expect(r.calculation.lines[1].outputs.warnings.join(" ")).toMatch(/Legacy/);
    expect(r.createdAt).toBe(old.savedAt);
    expect(r.legacy.legacyId).toBe(old.id);
  });
  it("migrateState keeps data and fills new fields", () => {
    const s = migrateState({ dataModel: { directLaborRate: 31 }, calculations: old.calculations, saved: [old] });
    expect(s.dataModel.directLaborRate).toBe(31);
    expect(s.dataModel).toHaveProperty("setupsPerYear");
    expect(s.saved).toHaveLength(1);
    expect(s.calculations[0].formulaId).toBe("overtime");
  });
});
