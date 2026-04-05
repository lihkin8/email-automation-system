// GuidedTemplateBuilder — KAN-20
// Structured form that auto-generates a professional HTML email body.
// Live preview updates as the user types.
// Two exit paths: save directly, or hand off to the TipTap free-form editor.
import React, { useState } from "react";
import {
  Box,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  Paper,
  Stack,
  Divider,
} from "@mui/material";
import { generateTemplateHtml } from "../utils/templateGenerator";

const INITIAL_FIELDS = {
  templateName: "",
  templateType: "MAIN",
  subject: "",
  yourName: "",
  yourRole: "",
  school: "",
  gradYear: "",
  achievement1: "",
  achievement2: "",
  achievement3: "",
  skills: "",
  ctaPreference: "coffee_chat",
};

const REQUIRED_FIELDS = [
  "templateName",
  "templateType",
  "subject",
  "yourName",
  "yourRole",
  "school",
  "gradYear",
  "achievement1",
  "achievement2",
  "skills",
];

/**
 * @param {object} props
 * @param {(html: string, subject: string, name: string, type: string) => void} props.onHandoffToEditor
 * @param {(templateData: object) => void} props.onSave
 * @param {() => void} props.onCancel
 */
export default function GuidedTemplateBuilder({ onHandoffToEditor, onSave, onCancel }) {
  const [fields, setFields] = useState(INITIAL_FIELDS);

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const isComplete = REQUIRED_FIELDS.every((k) => fields[k].trim() !== "");

  const generatedHtml = isComplete
    ? generateTemplateHtml({
        yourName: fields.yourName,
        yourRole: fields.yourRole,
        school: fields.school,
        gradYear: fields.gradYear,
        achievement1: fields.achievement1,
        achievement2: fields.achievement2,
        achievement3: fields.achievement3,
        skills: fields.skills,
        ctaPreference: fields.ctaPreference,
      })
    : "";

  const templateData = () => ({
    name: fields.templateName,
    type: fields.templateType,
    subject: fields.subject,
    body_html: generatedHtml,
    variables: { company: "{{company}}", first_name: "{{first_name}}" },
  });

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Guided Template Builder
      </Typography>

      <Grid container spacing={3}>
        {/* ── Left: form ──────────────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Stack spacing={2}>
            <TextField
              label="Template Name"
              value={fields.templateName}
              onChange={set("templateName")}
              size="small"
              required
              inputProps={{ "data-testid": "field-templateName" }}
            />

            <FormControl size="small" required>
              <InputLabel>Template Type</InputLabel>
              <Select
                label="Template Type"
                value={fields.templateType}
                onChange={set("templateType")}
                inputProps={{ "data-testid": "field-templateType" }}
              >
                <MenuItem value="MAIN">Main Email</MenuItem>
                <MenuItem value="FOLLOW_UP">Follow-up</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Subject Line"
              value={fields.subject}
              onChange={set("subject")}
              size="small"
              required
              inputProps={{ "data-testid": "field-subject" }}
            />

            <Divider />

            <TextField
              label="Your Name"
              value={fields.yourName}
              onChange={set("yourName")}
              size="small"
              required
              inputProps={{ "data-testid": "field-yourName" }}
            />
            <TextField
              label="Your Role (e.g. Software Engineer)"
              value={fields.yourRole}
              onChange={set("yourRole")}
              size="small"
              required
              inputProps={{ "data-testid": "field-yourRole" }}
            />
            <TextField
              label="School"
              value={fields.school}
              onChange={set("school")}
              size="small"
              required
              inputProps={{ "data-testid": "field-school" }}
            />
            <TextField
              label="Graduation Year"
              value={fields.gradYear}
              onChange={set("gradYear")}
              size="small"
              required
              inputProps={{ "data-testid": "field-gradYear" }}
            />

            <Divider />

            <TextField
              label="Achievement 1"
              value={fields.achievement1}
              onChange={set("achievement1")}
              size="small"
              required
              inputProps={{ "data-testid": "field-achievement1" }}
            />
            <TextField
              label="Achievement 2"
              value={fields.achievement2}
              onChange={set("achievement2")}
              size="small"
              required
              inputProps={{ "data-testid": "field-achievement2" }}
            />
            <TextField
              label="Achievement 3 (optional)"
              value={fields.achievement3}
              onChange={set("achievement3")}
              size="small"
              inputProps={{ "data-testid": "field-achievement3" }}
            />

            <Divider />

            <TextField
              label="Key Skills (comma-separated)"
              value={fields.skills}
              onChange={set("skills")}
              size="small"
              required
              inputProps={{ "data-testid": "field-skills" }}
            />

            <FormControl size="small">
              <InputLabel>Call to Action</InputLabel>
              <Select
                label="Call to Action"
                value={fields.ctaPreference}
                onChange={set("ctaPreference")}
              >
                <MenuItem value="coffee_chat">Virtual coffee chat (20 min)</MenuItem>
                <MenuItem value="virtual_call">Brief virtual call</MenuItem>
                <MenuItem value="quick_call">Quick call (15 min)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Grid>

        {/* ── Right: live preview ──────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            Live Preview
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: 2, minHeight: 300, overflowY: "auto", bgcolor: "grey.50" }}
          >
            {isComplete ? (
              /* Preview renders as real HTML — content comes from the user's own form inputs */
              <Box dangerouslySetInnerHTML={{ __html: generatedHtml }} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Fill in all required fields to see a preview.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          disabled={!isComplete}
          onClick={() =>
            onHandoffToEditor(
              generatedHtml,
              fields.subject,
              fields.templateName,
              fields.templateType
            )
          }
        >
          Edit in Rich Text Editor
        </Button>
        <Button
          variant="contained"
          disabled={!isComplete}
          onClick={() => onSave(templateData())}
        >
          Save Template
        </Button>
      </Stack>
    </Box>
  );
}
