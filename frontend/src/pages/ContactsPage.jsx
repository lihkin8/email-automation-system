// ContactsPage — manage contact lists (list / edit / delete)
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  deleteContactList,
  getContactList,
  listContactLists,
  updateContactList,
} from "../services/api";

const SOURCE_COLORS = { TEXT_FILE: "primary", APOLLO: "secondary" };

export default function ContactsPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("list"); // 'list' | 'edit'
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingList, setEditingList] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listContactLists();
      setLists(data);
    } catch {
      setError("Failed to load contact lists. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const handleEditClick = async (row) => {
    setEditLoading(true);
    setError(null);
    try {
      const detail = await getContactList(row.id);
      setEditingList({
        id: detail.id,
        name: detail.name,
        source: detail.source,
        contacts: detail.contacts.map((c) => ({ ...c })),
      });
      setMode("edit");
    } catch {
      setError("Failed to load list contents.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteContactList(deleteTarget.id);
      setDeleteTarget(null);
      await refreshList();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Failed to delete contact list.");
      setDeleteTarget(null);
    }
  };

  // ── Edit mode handlers ──────────────────────────────────────────────────────

  const updateContactField = (idx, field, value) => {
    setEditingList((prev) => {
      const next = [...prev.contacts];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, contacts: next };
    });
  };

  const removeContactRow = (idx) => {
    setEditingList((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== idx),
    }));
  };

  const addContactRow = () => {
    setEditingList((prev) => ({
      ...prev,
      contacts: [...prev.contacts, { id: null, name: "", email: "", company: "" }],
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingList) return;
    setSaving(true);
    setError(null);
    try {
      await updateContactList(editingList.id, {
        name: editingList.name,
        contacts: editingList.contacts.map((c) => ({
          id: c.id ?? null,
          name: c.name,
          email: c.email,
          company: c.company,
        })),
      });
      setEditingList(null);
      setMode("list");
      await refreshList();
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render: edit mode ───────────────────────────────────────────────────────

  if (mode === "edit" && editingList) {
    const canSave =
      editingList.name.trim().length > 0 &&
      editingList.contacts.every(
        (c) => c.name.trim() && c.email.trim() && c.company.trim()
      );

    return (
      <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
        <Stack direction="row" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            Edit Contact List
          </Typography>
          <Button
            onClick={() => {
              setEditingList(null);
              setMode("list");
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ ml: 2 }}
            onClick={handleSaveEdit}
            disabled={!canSave || saving}
            data-testid="save-list-btn"
          >
            {saving ? <CircularProgress size={20} /> : "Save Changes"}
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="List Name"
          value={editingList.name}
          onChange={(e) =>
            setEditingList((prev) => ({ ...prev, name: e.target.value }))
          }
          fullWidth
          sx={{ mb: 3 }}
        />

        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Company</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {editingList.contacts.map((c, idx) => (
                <TableRow key={c.id ?? `new-${idx}`}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.name}
                      onChange={(e) => updateContactField(idx, "name", e.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.email}
                      onChange={(e) => updateContactField(idx, "email", e.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={c.company}
                      onChange={(e) => updateContactField(idx, "company", e.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Remove contact">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeContactRow(idx)}
                        aria-label={`remove-row-${idx}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {editingList.contacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No contacts. Add one below.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addContactRow}
          data-testid="add-contact-btn"
        >
          Add Contact
        </Button>
      </Box>
    );
  }

  // ── Render: list mode (default) ─────────────────────────────────────────────

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", mt: 4 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Contact Lists
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadFileIcon />}
          onClick={() => navigate("/contacts/import")}
          data-testid="import-new-list-btn"
        >
          Import New List
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading || editLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      ) : lists.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            No contact lists yet.
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => navigate("/contacts/import")}
          >
            Import Your First List
          </Button>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lists.map((l) => (
                <TableRow key={l.id} data-testid={`list-row-${l.id}`}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={l.source}
                      color={SOURCE_COLORS[l.source] ?? "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {l.created_at ? new Date(l.created_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEditClick(l)}
                        aria-label={`edit-${l.id}`}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => setDeleteTarget(l)}
                        aria-label={`delete-${l.id}`}
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

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Contact List?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "<strong>{deleteTarget?.name}</strong>"?
            All contacts in this list will be removed. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            data-testid="confirm-delete-list-btn"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
