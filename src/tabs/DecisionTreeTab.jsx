import React from "react";
import { Card, SectionLabel, ToggleChip, PrimaryButton } from "../ui.jsx";
import { IMPROVEMENT_CATEGORIES } from "../engine/matrix.js";
import { deriveBasis } from "../engine/basis.js";
import { T } from "../theme.js";

export default function DecisionTreeTab({ selectedImprovement, setSelectedImprovement, goToMatrix, dataModel }) {
  const basis = selectedImprovement ? deriveBasis(selectedImprovement, dataModel) : null;
  return (
    <div>
      <Card>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.heading, marginBottom: 4 }}>What changed in the process?</div>
        <div style={{ fontSize: 13, color: T.muted }}>Pick the improvement type. Your selection highlights the impacted cells in the Fingerprint Matrix.</div>
      </Card>
      {IMPROVEMENT_CATEGORIES.map((cat) => (
        <Card key={cat.category}>
          <SectionLabel>{cat.category}</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cat.items.map((item) => (
              <ToggleChip key={item} active={selectedImprovement === item} onClick={() => setSelectedImprovement(item)}>{item}</ToggleChip>
            ))}
          </div>
        </Card>
      ))}
      {basis && (
        <Card>
          <SectionLabel>How default hours are derived</SectionLabel>
          {basis.notes.map((n, i) => <div key={i} style={{ fontSize: 12.5, color: T.muted, marginBottom: 4 }}>{n}</div>)}
          <div style={{ fontSize: 12, color: T.placeholder, marginTop: 6 }}>If a needed Data Model value is blank, the calculation card will show as incomplete until you fill it in.</div>
        </Card>
      )}
      {selectedImprovement && <PrimaryButton onClick={goToMatrix}>View Fingerprint Matrix →</PrimaryButton>}
    </div>
  );
}
