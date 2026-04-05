// TemplateSelector — KAN-22
// Reusable dropdown for selecting a saved template by ID.
// Used in campaign creation and anywhere a template reference is needed.
import React, { useState, useEffect } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
} from "@mui/material";
import { listTemplates } from "../services/api";

/**
 * @param {object} props
 * @param {number|null} props.value          — selected template id
 * @param {(id: number) => void} props.onChange
 * @param {'MAIN'|'FOLLOW_UP'} [props.filterType] — optional type filter
 * @param {string} [props.label]             — defaults to "Select Template"
 */
export default function TemplateSelector({
  value,
  onChange,
  filterType,
  label = "Select Template",
}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTemplates()
      .then((data) => {
        const filtered = filterType ? data.filter((t) => t.type === filterType) : data;
        setTemplates(filtered);
      })
      .finally(() => setLoading(false));
  }, [filterType]);

  if (loading) return <CircularProgress size={24} />;

  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid="template-selector"
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {templates.map((t) => (
          <MenuItem key={t.id} value={t.id}>
            <span>{t.name}</span>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              — {t.subject}
            </Typography>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
