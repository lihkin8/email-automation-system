// TemplatesPage — KAN-22
// Orchestrates the full template CRUD flow.
// Mode state machine: list → create-choose → guided | editor | edit-editor
import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
  Stack,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import GuidedTemplateBuilder from "./GuidedTemplateBuilder";
import RichTextEditor from "./RichTextEditor";
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from "../services/api";

const TYPE_COLORS = { MAIN: "primary", FOLLOW_UP: "warning" };

export default function TemplatesPage() {
  // 'list' | 'create-choose' | 'guided' | 'editor' | 'edit-editor'
  const [mode, setMode] = useState("list");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorInitialHtml, setEditorInitialHtml] = useState("");
  const [editorInitialMeta, setEditorInitialMeta] = useState({ subject: "", name: "", type: "MAIN" });
  const [deleteTarget, setDeleteTarget] = useState(null); // template to confirm delete

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch {
      setError("Failed to load templates. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleGuidedHandoff = (html, subject, name, type) => {
    setEditorInitialHtml(html);
    setEditorInitialMeta({ subject, name, type });
    setMode("editor");
  };

  const handleSaveNew = async (data) => {
    try {
      await createTemplate(data);
      await refreshList();
      setMode("list");
    } catch {
      setError("Failed to save template.");
    }
  };

  const handleSaveEdit = async (data) => {
    try {
      await updateTemplate(editingTemplate.id, data);
      await refreshList();
      setEditingTemplate(null);
      setMode("list");
    } catch {
      setError("Failed to update template.");
    }
  };

  const handleEditClick = (template) => {
    setEditingTemplate(template);
    setMode("edit-editor");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTemplate(deleteTarget.id);
      setDeleteTarget(null);
      await refreshList();
    } catch {
      setError("Failed to delete template.");
      setDeleteTarget(null);
    }
  };

  // ── Render modes ────────────────────────────────────────────────────────────

  if (mode === "guided") {
    return (
      <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
        <GuidedTemplateBuilder
          onHandoffToEditor={handleGuidedHandoff}
          onSave={handleSaveNew}
          onCancel={() => setMode("create-choose")}
        />
      </Box>
    );
  }

  if (mode === "editor") {
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4 }}>
        <RichTextEditor
          initialHtml={editorInitialHtml}
          subject={editorInitialMeta.subject}
          templateName={editorInitialMeta.name}
          templateType={editorInitialMeta.type}
          onSave={handleSaveNew}
          onCancel={() => setMode("create-choose")}
        />
      </Box>
    );
  }

  if (mode === "edit-editor") {
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4 }}>
        <RichTextEditor
          initialHtml={editingTemplate?.body_html ?? ""}
          subject={editingTemplate?.subject ?? ""}
          templateName={editingTemplate?.name ?? ""}
          templateType={editingTemplate?.type ?? "MAIN"}
          onSave={handleSaveEdit}
          onCancel={() => {
            setEditingTemplate(null);
            setMode("list");
          }}
        />
      </Box>
    );
  }

  if (mode === "create-choose") {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 8, textAlign: "center" }}>
        <Typography variant="h5" gutterBottom>
          Create New Template
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Choose how you'd like to start:
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} justifyContent="center">
          <Paper
            variant="outlined"
            sx={{ p: 4, cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
            onClick={() => setMode("guided")}
            data-testid="choose-guided"
          >
            <Typography variant="h6">Guided Builder</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Fill a short form and auto-generate a professional email.
            </Typography>
          </Paper>
          <Paper
            variant="outlined"
            sx={{ p: 4, cursor: "pointer", "&:hover": { borderColor: "primary.main" } }}
            onClick={() => {
              setEditorInitialHtml("");
              setEditorInitialMeta({ subject: "", name: "", type: "MAIN" });
              setMode("editor");
            }}
            data-testid="choose-freeform"
          >
            <Typography variant="h6">Free-form Editor</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Write from scratch in a rich text editor with variable support.
            </Typography>
          </Paper>
        </Stack>
        <Button sx={{ mt: 3 }} onClick={() => setMode("list")}>
          Back to Templates
        </Button>
      </Box>
    );
  }

  // ── Mode: list (default) ────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Templates
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setMode("create-choose")}
          data-testid="create-new-btn"
        >
          Create New Template
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : templates.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            No templates yet. Create your first one!
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} data-testid={`template-row-${t.id}`}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={t.type}
                      color={TYPE_COLORS[t.type] ?? "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.subject}
                  </TableCell>
                  <TableCell>
                    {new Date(t.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(t)}
                        aria-label={`edit-${t.id}`}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => setDeleteTarget(t)}
                        aria-label={`delete-${t.id}`}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* ── Delete confirmation dialog ──────────────────────────────────── */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Template?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "<strong>{deleteTarget?.name}</strong>"? This
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            data-testid="confirm-delete-btn"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
