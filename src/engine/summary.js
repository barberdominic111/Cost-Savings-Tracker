/* Finance summary. Pure. items = [{ line, result }] where result comes from runFormula
   (or stored outputs for saved records). */

export const STATUSES = ["draft", "under_review", "approved", "rejected", "realized", "closed"];
export const LOCKED_STATUSES = ["approved", "realized", "closed"];
export const STATUS_LABELS = { draft: "Draft", under_review: "Under Review", approved: "Approved", rejected: "Rejected", realized: "Realized", closed: "Closed" };

const impactOf = (line) => line.impactType ?? line.classification;

export function bucketFor(line) {
  if (line.formulaId === "fixedOverhead" || line.formulaId === "absorption") return "absorption";
  const t = impactOf(line);
  if (t === "Hard Savings") return "hard";
  if (t === "Cost Avoidance") return "avoidance";
  if (t === "Soft Savings") return "productivity";
  return "noImpact";
}

const mk = () => ({ entries: [], modeled: 0, approved: 0 });

export function detectOverlaps(items) {
  const warnings = [];
  const seen = {};
  items.forEach(({ line }) => {
    const k = `${line.improvement}|${line.formulaId}`;
    seen[k] = (seen[k] || 0) + 1;
  });
  Object.entries(seen).forEach(([k, c]) => {
    if (c > 1) {
      const [imp, f] = k.split("|");
      warnings.push(`Duplicate lines: "${imp}" has ${c} "${f}" calculations. Check for double counting.`);
    }
  });
  const byImp = {};
  items.forEach(({ line, result }) => {
    if (!result || result.status !== "ok") return;
    if (!["directLabor", "overtime", "tempLabor"].includes(line.formulaId)) return;
    const h = line.inputs?.hoursReduced ?? line.inputs?.hours ?? line.inputs?.hoursAvoided;
    (byImp[`${line.improvement}|${h}`] = byImp[`${line.improvement}|${h}`] || []).push(line.formulaId);
  });
  Object.entries(byImp).forEach(([k, ids]) => {
    if (new Set(ids).size > 1) warnings.push(`"${k.split("|")[0]}": Direct Labor, Overtime and/or Temp Labor lines use the same hours (${k.split("|")[1]}). The same hours may be counted twice.`);
  });
  return warnings;
}

export function summarize(items, meta = {}) {
  const b = { hard: mk(), avoidance: mk(), productivity: { ...mk(), hoursModeled: 0, hoursApproved: 0, usdValueModeled: 0 }, absorption: mk(), noImpact: { entries: [] } };
  const incomplete = [];

  items.forEach(({ line, result }) => {
    const bucket = bucketFor(line);
    const entry = { line, result, bucket };
    b[bucket].entries.push(entry);
    if (!result || result.status !== "ok") { incomplete.push(line.id ?? line.lineId); return; }
    if (bucket === "noImpact") return;
    const approved = !!line.approved;
    if (result.unit === "USD") {
      b[bucket].modeled += result.value;
      if (approved) b[bucket].approved += result.value;
      if (bucket === "productivity") b.productivity.usdValueModeled += result.value;
    } else if (result.unit === "hours" && bucket === "productivity") {
      b.productivity.hoursModeled += result.value;
      if (approved) b.productivity.hoursApproved += result.value;
    }
  });

  const ev = meta.realization || {};
  const eligible = meta.assessmentStatus === "realized" && !!(ev.evidence || "").trim() && !!(ev.basis || "").trim();
  return {
    buckets: b,
    incomplete,
    overlaps: detectOverlaps(items),
    realized: { eligible, usd: eligible ? b.hard.approved : null },
  };
}

export function canSetStatus(next, meta, summary, itemCount) {
  const from = meta.assessmentStatus;
  const ev = meta.realization || {};
  if (next === "approved") {
    if (itemCount === 0) return { ok: false, reason: "Add at least one calculation first." };
    if (summary.incomplete.length) return { ok: false, reason: "Resolve incomplete or invalid calculations before approving." };
    const all = Object.values(summary.buckets).flatMap((x) => x.entries || []).filter((e) => e.bucket !== "noImpact");
    if (all.some((e) => !e.line.approved)) return { ok: false, reason: "Every calculation line needs its Finance approval checkbox before approving." };
  }
  if (next === "realized") {
    if (!["approved", "realized"].includes(from)) return { ok: false, reason: "An assessment must be Approved before it can be Realized." };
    if (!(ev.evidence || "").trim() || !(ev.basis || "").trim()) return { ok: false, reason: "Realization requires evidence and a basis." };
  }
  if (next === "closed" && !["approved", "realized", "rejected", "closed"].includes(from)) return { ok: false, reason: "Only Approved, Realized or Rejected assessments can be closed." };
  return { ok: true };
}
