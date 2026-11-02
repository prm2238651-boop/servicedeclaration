"use client";

import { useState } from "react";

type Option = string | { value: string; label: string };

export function CreatableSelect({
  name,
  label,
  options,
  required = false,
  customPlaceholder = "Saisissez la nouvelle valeur",
}: {
  name: string;
  label: string;
  options: Option[];
  required?: boolean;
  customPlaceholder?: string;
}) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const [selection, setSelection] = useState(normalized[0]?.value ?? "");
  const isCustom = selection === "__CUSTOM__";

  return (
    <div className="field">
      <label htmlFor={`${name}-choice`}>{label}</label>
      <select
        className="input"
        id={`${name}-choice`}
        name={isCustom ? undefined : name}
        value={selection}
        onChange={(event) => setSelection(event.target.value)}
        required={required}
      >
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
        <option value="__CUSTOM__">Autre… (ajouter une nouvelle valeur)</option>
      </select>
      {isCustom && (
        <input
          className="input"
          id={name}
          name={name}
          placeholder={customPlaceholder}
          required={required}
          autoFocus
        />
      )}
    </div>
  );
}
