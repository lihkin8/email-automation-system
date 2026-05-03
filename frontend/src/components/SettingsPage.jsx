import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import {
  fetchSettings,
  updateSettings,
  uploadResume,
  deleteResume,
} from "../services/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [followUpDays, setFollowUpDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const resumeInputId = React.useId();

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setSettings(data);
        setFollowUpDays(data.follow_up_days);
      })
      .catch(() => setFetchError("Failed to load settings. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const showSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });

  const handleSavePreferences = async () => {
    if (followUpDays < 1 || followUpDays > 30) {
      showSnackbar("Follow-up days must be between 1 and 30", "error");
      return;
    }
    setSaving(true);
    try {
      await updateSettings({ follow_up_days: followUpDays });
      showSnackbar("Preferences saved");
    } catch {
      showSnackbar("Failed to save preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadResume = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const data = await uploadResume(file, (pct) => setUploadProgress(pct));
      setSettings((s) => ({ ...s, resume_url: data.resume_url, resume_filename: file.name }));
      showSnackbar("Resume uploaded");
    } catch {
      showSnackbar("Failed to upload resume", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleDeleteResume = async () => {
    try {
      await deleteResume();
      setSettings((s) => ({ ...s, resume_url: null, resume_filename: null }));
      showSnackbar("Resume removed");
    } catch {
      showSnackbar("Failed to remove resume", "error");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (fetchError) {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        {fetchError}
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
        Settings
      </Typography>

      {/* Gmail */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Gmail
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip
              label={settings.gmail_connected ? "Connected" : "Not Connected"}
              color={settings.gmail_connected ? "success" : "error"}
              size="small"
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                window.location.href = `${process.env.REACT_APP_API_URL}/auth/login`;
              }}
            >
              Reconnect Gmail
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Email Preferences */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Email Preferences
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <TextField
              label="Follow-up after N days"
              type="number"
              size="small"
              value={followUpDays}
              onChange={(e) => setFollowUpDays(Number(e.target.value))}
              inputProps={{ min: 1, max: 30 }}
              sx={{ width: 220 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleSavePreferences}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Resume */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Resume
          </Typography>
          {settings.resume_url ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography
                component="a"
                href={settings.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "primary.main" }}
              >
                {settings.resume_filename}
              </Typography>
              <Button variant="outlined" color="error" size="small" onClick={handleDeleteResume}>
                Remove
              </Button>
            </Box>
          ) : (
            <Box>
              <input
                id={resumeInputId}
                type="file"
                accept=".pdf,.doc,.docx"
                style={{ display: "none" }}
                onChange={handleUploadResume}
              />
              <label htmlFor={resumeInputId}>
                <Button variant="outlined" component="span" disabled={uploading}>
                  {uploading ? "Uploading…" : "Upload Resume"}
                </Button>
              </label>
              {uploading && (
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{ mt: 1, maxWidth: 220 }}
                />
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
