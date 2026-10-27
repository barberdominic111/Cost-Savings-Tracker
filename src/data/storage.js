import { freshState, migrateState, normalizeState } from "./records.js";

export const KEY_V2 = "mfg-cost-analyzer:v2";
export const KEY_V1 = "mfg-cost-analyzer:v1"; // never deleted by migration

export function loadState() {
  try {
    const raw2 = localStorage.getItem(KEY_V2);
    if (raw2) return normalizeState(JSON.parse(raw2));
  } catch (e) { console.warn("Could not read v2 data:", e); }
  try {
    const raw1 = localStorage.getItem(KEY_V1);
    if (raw1) return migrateState(JSON.parse(raw1));
  } catch (e) { console.warn("Could not migrate v1 data:", e); }
  return freshState();
}

export function saveState(state) {
  try { localStorage.setItem(KEY_V2, JSON.stringify(state)); } catch (e) { console.warn("Could not save data:", e); }
}
