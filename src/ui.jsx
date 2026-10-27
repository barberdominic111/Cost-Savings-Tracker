import React from "react";
import { T } from "./theme.js";

export function Card({ children, style }) {
  return <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 12, ...style }}>{children}</div>;
}
export function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: T.placeholder, textTransform: "uppercase", marginBottom: 8 }}>{children}</div>;
}
export function PrimaryButton({ children, onClick, style, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: disabled ? T.gray : T.blue, color: "#FFFFFF", border: "none", borderRadius: 12, padding: "18px", fontSize: 18, fontWeight: 800, letterSpacing: "0.05em", width: "100%", touchAction: "manipulation", cursor: disabled ? "default" : "pointer", fontFamily: T.font, ...style }}>{children}</button>
  );
}
export function OutlineButton({ children, onClick, style, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: "#FFFFFF", border: `1.5px solid ${T.border}`, borderRadius: 10, color: T.muted, fontWeight: 700, padding: "10px 14px", touchAction: "manipulation", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: T.font, fontSize: 14, ...style }}>{children}</button>
  );
}
export function DestructiveButton({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{ background: T.redLightBg, color: T.red, border: `1.5px solid ${T.redLightBorder}`, borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 13, touchAction: "manipulation", cursor: "pointer", fontFamily: T.font, ...style }}>{children}</button>
  );
}
export function ToggleChip({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{ background: active ? T.blueLightBg : "#FFFFFF", border: `1.5px solid ${active ? T.blue : T.border}`, color: active ? T.blue : T.muted, fontWeight: 700, borderRadius: 10, padding: "8px 12px", fontSize: 13, touchAction: "manipulation", cursor: "pointer", fontFamily: T.font, whiteSpace: "nowrap" }}>{children}</button>
  );
}
export function Badge({ children, color = T.muted, bg = T.lightestGray, border = T.lightGray }) {
  return <span style={{ display: "inline-block", background: bg, color, border: `1px solid ${border}`, borderRadius: 6, padding: "2px 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", marginLeft: 6, verticalAlign: "middle" }}>{children}</span>;
}
export function Notice({ children, tone = "info", style }) {
  const tones = {
    info: { bg: T.blueLightBg, border: T.blueLightBorder, color: "#1D4ED8" },
    warn: { bg: "#FFFBEB", border: "#FDE68A", color: "#B45309" },
    error: { bg: T.redLightBg, border: T.redLightBorder, color: T.red },
  }[tone];
  return <div style={{ background: tones.bg, border: `1px solid ${tones.border}`, color: tones.color, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.45, marginBottom: 10, ...style }}>{children}</div>;
}

const inputBase = { border: `1.5px solid ${T.gray}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, background: T.bg, color: T.text, width: "100%", boxSizing: "border-box" };

/* Number fields hold null when blank. Blank means UNKNOWN, never 0. */
export function Field({ label, value, onChange, type = "number", options, hint, badge, rows = 3, placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 5 }}>{label}{badge}</div>
      {type === "select" ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} style={{ ...inputBase, fontFamily: T.font }}>
          {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      ) : type === "textarea" ? (
        <textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ ...inputBase, fontFamily: T.font, resize: "vertical" }} />
      ) : (
        <input
          type={type === "number" ? "number" : "text"}
          inputMode={type === "number" ? "decimal" : undefined}
          step="any"
          value={value ?? ""}
          placeholder={placeholder ?? (type === "number" ? "unknown" : "")}
          onChange={(e) => {
            if (type !== "number") return onChange(e.target.value);
            const raw = e.target.value;
            if (raw === "") return onChange(null);
            const num = parseFloat(raw);
            onChange(Number.isFinite(num) ? num : null);
          }}
          style={{ ...inputBase, fontFamily: type === "number" ? T.mono : T.font }}
        />
      )}
      {hint && <div style={{ fontSize: 12, color: T.placeholder, fontFamily: T.mono, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
export function EmptyState({ children }) {
  return <div style={{ textAlign: "center", color: T.placeholder, fontSize: 15, padding: "60px 24px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 16 }}>{children}</div>;
}

export function fmtNum(n, d = 2) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}
export function fmtMoney(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
export function fmtValue(result) {
  if (!result) return "—";
  if (result.status === "incomplete") return "Incomplete";
  if (result.status !== "ok") return "Invalid";
  if (result.unit === "USD") return fmtMoney(result.value);
  if (result.unit === "hours") return `${fmtNum(result.value, 1)} hrs`;
  if (result.unit === "percent") return `${fmtNum(result.value, 1)}%`;
  return fmtNum(result.value);
}
export function downloadFile(filename, text, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
