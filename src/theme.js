export const T = {
  font: "Inter, system-ui, sans-serif",
  mono: "DM Mono, monospace",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#1E293B",
  heading: "#0F172A",
  muted: "#64748B",
  placeholder: "#94A3B8",
  blue: "#2563EB",
  blueLightBg: "#EFF6FF",
  blueLightBorder: "#BFDBFE",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  redLightBg: "#FEF2F2",
  redLightBorder: "#FECACA",
  purple: "#A855F7",
  sky: "#0EA5E9",
  slate: "#64748B",
  gray: "#CBD5E1",
  lightGray: "#E2E8F0",
  lightestGray: "#F1F5F9",
};

export const IMPACT_COLORS = {
  "Hard Savings": { bg: "#ECFDF5", border: T.green, text: "#047857", label: "Hard Savings" },
  "Cost Avoidance": { bg: "#FFFBEB", border: T.amber, text: "#B45309", label: "Cost Avoidance" },
  "Soft Savings": { bg: T.blueLightBg, border: T.blue, text: "#1D4ED8", label: "Soft Savings / Productivity" },
  "No Impact": { bg: T.lightestGray, border: T.gray, text: T.muted, label: "No Impact" },
};

export const BUCKET_COLORS = {
  hard: T.green,
  avoidance: T.amber,
  productivity: T.blue,
  absorption: T.slate,
  noImpact: T.gray,
};
