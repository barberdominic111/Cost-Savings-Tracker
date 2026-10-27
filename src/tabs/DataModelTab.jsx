import React from "react";
import { Card, SectionLabel, Field, Badge, Notice } from "../ui.jsx";
import { FIELD_GROUPS } from "../data/dataModel.js";
import { T } from "../theme.js";

export default function DataModelTab({ dataModel, setDataModel }) {
  const update = (key, value) => setDataModel((dm) => ({ ...dm, [key]: value }));
  return (
    <div>
      <Notice>
        Values here are sample defaults. Replace them with your plant's actual rates. A blank number is treated as <b>unknown</b>, never as zero. Existing calculation cards keep the inputs they were created with; changing a rate here does not rewrite them.
      </Notice>
      {FIELD_GROUPS.map((group) => (
        <Card key={group.title}>
          <SectionLabel>{group.title}</SectionLabel>
          {group.fields.map((f) => (
            <Field
              key={f.key} label={f.label} type={f.type} options={f.options} hint={f.hint}
              value={f.type === "number" ? (typeof dataModel[f.key] === "number" ? dataModel[f.key] : null) : dataModel[f.key]}
              badge={f.used === false ? <Badge>INFORMATIONAL</Badge> : f.used === "optional" ? <Badge color="#B45309" bg="#FFFBEB" border="#FDE68A">OPTIONAL OFFSET</Badge> : null}
              onChange={(v) => update(f.key, v)}
            />
          ))}
        </Card>
      ))}
      <div style={{ fontSize: 11, color: T.placeholder }}>Informational fields are stored for reference and are not used by any calculation yet.</div>
    </div>
  );
}
