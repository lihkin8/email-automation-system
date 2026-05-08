// ContactImport — KAN-17
// Three-step flow: upload → preview → success
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Typography,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Alert,
  Chip,
  CircularProgress,
  Paper,
  Stack,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { uploadContacts, confirmImport } from "../services/api";

export default function ContactImport() {
  const navigate = useNavigate();
  const [step, setStep] = useState("upload"); // 'upload' | 'preview' | 'success'
  const [contacts, setContacts] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [listName, setListName] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await uploadContacts(file);
      setContacts(result.contacts);
      setParseErrors(result.errors);
      setStep("preview");
    } catch (err) {
      setError("Failed to parse file. Please check the format and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await confirmImport({
        listName,
        source: "TEXT_FILE",
        contacts,
      });
      setImportedCount(result.imported_count);
      setStep("success");
    } catch (err) {
      setError("Failed to save contact list. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setContacts([]);
    setParseErrors([]);
    setListName("");
    setImportedCount(0);
    setError(null);
  };

  // ── Step 1: Upload ──────────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Import Contacts
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload a .txt file with your contacts. Each company on its own line
          followed by emails in the format:{" "}
          <code>email@company.com - Full Name</code>
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper
          data-testid="drop-zone"
          variant="outlined"
          sx={{
            p: 6,
            textAlign: "center",
            border: "2px dashed",
            borderColor: "primary.light",
            borderRadius: 2,
            cursor: "pointer",
            "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {loading ? (
            <CircularProgress />
          ) : (
            <>
              <UploadFileIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
              <Typography variant="body1">
                Drag and drop a .txt file here, or click to browse
              </Typography>
            </>
          )}
        </Paper>

        <input
          data-testid="file-input"
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </Box>
    );
  }

  // ── Step 2: Preview ─────────────────────────────────────────────────────────
  if (step === "preview") {
    return (
      <Box sx={{ maxWidth: 800, mx: "auto", mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Preview Contacts
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review the parsed contacts below. Fix the source file and re-upload if
          anything looks wrong.
        </Typography>

        {parseErrors.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {parseErrors.length} line{parseErrors.length > 1 ? "s" : ""} could
              not be parsed:
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {parseErrors.map((err, i) => (
                <Chip key={i} label={err} size="small" color="warning" />
              ))}
            </Stack>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Company</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.company}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="List Name"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
            placeholder="e.g. Tech Companies Spring 2026"
          />
          <Button variant="outlined" onClick={handleReset}>
            Start Over
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={!listName.trim() || loading}
          >
            {loading ? <CircularProgress size={20} /> : "Confirm Import"}
          </Button>
        </Stack>
      </Box>
    );
  }

  // ── Step 3: Success ─────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
      <Alert severity="success" sx={{ mb: 3 }}>
        Successfully imported <strong>{importedCount}</strong> contacts to list "
        <strong>{listName}</strong>".
      </Alert>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => navigate("/contacts")}>
          Back to Lists
        </Button>
        <Button variant="outlined" onClick={handleReset}>
          Import Another List
        </Button>
      </Stack>
    </Box>
  );
}
