// RichTextEditor — KAN-21
// TipTap-based rich text editor with a variables sidebar.
// Receives optional initialHtml (e.g. from GuidedTemplateBuilder handoff).
// Outputs HTML via onSave with extracted variables dict.
import React, { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
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
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";

const VARIABLES = [
  { label: "{{first_name}}", description: "Recipient's first name" },
  { label: "{{company}}", description: "Recipient's company" },
  { label: "{{your_name}}", description: "Your name" },
  { label: "{{role}}", description: "Your target role" },
  { label: "{{your_skills}}", description: "Your key skills" },
  { label: "{{custom_1}}", description: "Custom variable 1" },
  { label: "{{custom_2}}", description: "Custom variable 2" },
];

/** Regex-scan HTML for {{...}} patterns and return them as a dict. */
function extractVariables(html) {
  const found = [...html.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return Object.fromEntries([...new Set(found)].map((v) => [v, `{{${v}}}`]));
}

/**
 * @param {object} props
 * @param {string} [props.initialHtml]
 * @param {string} [props.subject]
 * @param {string} [props.templateName]
 * @param {string} [props.templateType]  'MAIN' | 'FOLLOW_UP'
 * @param {(data: object) => void} props.onSave
 * @param {() => void} props.onCancel
 */
export default function RichTextEditor({
  initialHtml = "",
  subject: initialSubject = "",
  templateName: initialName = "",
  templateType: initialType = "MAIN",
  onSave,
  onCancel,
}) {
  const [localName, setLocalName] = useState(initialName);
  const [localSubject, setLocalSubject] = useState(initialSubject);
  const [localType, setLocalType] = useState(initialType);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: initialHtml,
  });

  // Update editor content when initialHtml changes (guided builder handoff)
  useEffect(() => {
    if (editor && initialHtml) {
      editor.commands.setContent(initialHtml);
    }
  }, [initialHtml, editor]);

  // Sync name/subject/type props if they change (edit flow)
  useEffect(() => { setLocalName(initialName); }, [initialName]);
  useEffect(() => { setLocalSubject(initialSubject); }, [initialSubject]);
  useEffect(() => { setLocalType(initialType); }, [initialType]);

  const handleSave = () => {
    if (!editor) return;
    const html = editor.getHTML();
    onSave({
      name: localName,
      type: localType,
      subject: localSubject,
      body_html: html,
      variables: extractVariables(html),
    });
  };

  const insertVariable = (label) => {
    editor?.chain().focus().insertContent(label).run();
  };

  const isActive = (cmd, opts) => editor?.isActive(cmd, opts) ?? false;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Rich Text Editor
      </Typography>

      {/* ── Meta fields ─────────────────────────────────────────────────── */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Template Name"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          size="small"
          sx={{ flexGrow: 1 }}
          inputProps={{ "data-testid": "rte-name" }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Type</InputLabel>
          <Select
            label="Type"
            value={localType}
            onChange={(e) => setLocalType(e.target.value)}
            inputProps={{ "data-testid": "rte-type" }}
          >
            <MenuItem value="MAIN">Main Email</MenuItem>
            <MenuItem value="FOLLOW_UP">Follow-up</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Subject"
          value={localSubject}
          onChange={(e) => setLocalSubject(e.target.value)}
          size="small"
          sx={{ flexGrow: 2 }}
          inputProps={{ "data-testid": "rte-subject" }}
        />
      </Stack>

      <Grid container spacing={2}>
        {/* ── Left: editor ────────────────────────────────────────────── */}
        <Grid item xs={12} md={8}>
          {/* Toolbar */}
          <Paper variant="outlined" sx={{ p: 0.5, mb: 0.5, display: "flex", gap: 0.5 }}>
            <Tooltip title="Bold">
              <IconButton
                size="small"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                color={isActive("bold") ? "primary" : "default"}
                aria-label="bold"
              >
                <FormatBoldIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Italic">
              <IconButton
                size="small"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                color={isActive("italic") ? "primary" : "default"}
                aria-label="italic"
              >
                <FormatItalicIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Underline">
              <IconButton
                size="small"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                color={isActive("underline") ? "primary" : "default"}
                aria-label="underline"
              >
                <FormatUnderlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem />
            <Tooltip title="Align Left">
              <IconButton
                size="small"
                onClick={() => editor?.chain().focus().setTextAlign("left").run()}
                color={isActive("textAlign", { textAlign: "left" }) ? "primary" : "default"}
                aria-label="align left"
              >
                <FormatAlignLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Align Center">
              <IconButton
                size="small"
                onClick={() => editor?.chain().focus().setTextAlign("center").run()}
                color={isActive("textAlign", { textAlign: "center" }) ? "primary" : "default"}
                aria-label="align center"
              >
                <FormatAlignCenterIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Align Right">
              <IconButton
                size="small"
                onClick={() => editor?.chain().focus().setTextAlign("right").run()}
                color={isActive("textAlign", { textAlign: "right" }) ? "primary" : "default"}
                aria-label="align right"
              >
                <FormatAlignRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              minHeight: 300,
              p: 1.5,
              "& .ProseMirror": { outline: "none", minHeight: 280 },
              "& .ProseMirror p": { margin: 0 },
            }}
          >
            <EditorContent editor={editor} data-testid="editor-content" />
          </Paper>
        </Grid>

        {/* ── Right: variables sidebar ─────────────────────────────────── */}
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2" gutterBottom>
            Insert Variable
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Click a variable to insert it at the cursor.
          </Typography>
          <Stack spacing={1}>
            {VARIABLES.map((v) => (
              <Box key={v.label}>
                <Chip
                  label={v.label}
                  onClick={() => insertVariable(v.label)}
                  size="small"
                  clickable
                  color="primary"
                  variant="outlined"
                  data-testid={`var-chip-${v.label}`}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {v.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Grid>
      </Grid>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!localName.trim() || !localSubject.trim()}
        >
          Save Template
        </Button>
      </Stack>
    </Box>
  );
}
