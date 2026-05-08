import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  createCampaign,
  deleteCampaign,
  getCampaignMetrics,
  getCampaignUnopened,
  getCampaignPreview,
  listCampaigns,
  listContactLists,
  listTemplates,
  sendCampaign,
} from "../services/api";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [templates, setTemplates] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [unopened, setUnopened] = useState([]);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    template_id: "",
    contact_list_id: "",
    follow_up_template_id: "",
    follow_up_days: 5,
  });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [cs, ts, ls] = await Promise.all([
          listCampaigns(),
          listTemplates(),
          listContactLists(),
        ]);
        setCampaigns(cs);
        setTemplates(ts);
        setContactLists(ls);
        setSelectedCampaignId(cs[0]?.id ?? "");
      } catch (e) {
        setError("Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      setPreview(null);
      setMetrics(null);
      setUnopened([]);
      return;
    }
    (async () => {
      try {
        setError(null);
        const [p, m, u] = await Promise.all([
          getCampaignPreview(selectedCampaignId),
          getCampaignMetrics(selectedCampaignId),
          getCampaignUnopened(selectedCampaignId),
        ]);
        setPreview(p);
        setMetrics(m);
        setUnopened(u);
      } catch (e) {
        setPreview(null);
        setMetrics(null);
        setUnopened([]);
        setError("Failed to load preview");
      }
    })();
  }, [selectedCampaignId]);

  const resolvedVars = useMemo(() => {
    return preview?.resolved_variables ? Object.entries(preview.resolved_variables) : [];
  }, [preview]);

  const handleSend = async () => {
    if (!selectedCampaignId) return;
    try {
      setSending(true);
      await sendCampaign(selectedCampaignId, 2.0);
      const [m, u] = await Promise.all([
        getCampaignMetrics(selectedCampaignId),
        getCampaignUnopened(selectedCampaignId),
      ]);
      setMetrics(m);
      setUnopened(u);
    } catch {
      setError("Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteCampaign(deleteTarget.id);
      const cs = await listCampaigns();
      setCampaigns(cs);
      if (deleteTarget.id === selectedCampaignId) {
        setSelectedCampaignId(cs[0]?.id ?? "");
      }
      setDeleteTarget(null);
    } catch {
      setError("Failed to delete campaign");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      const payload = {
        name: form.name,
        template_id: Number(form.template_id),
        contact_list_id: Number(form.contact_list_id),
        follow_up_template_id: form.follow_up_template_id ? Number(form.follow_up_template_id) : null,
        follow_up_days: Number(form.follow_up_days),
      };
      const created = await createCampaign(payload);
      const cs = await listCampaigns();
      setCampaigns(cs);
      setSelectedCampaignId(created.id);
      setForm((f) => ({ ...f, name: "" }));
    } catch {
      setError("Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={4}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Campaigns
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Create campaign
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="template-select-label">Template</InputLabel>
              <Select
                labelId="template-select-label"
                value={form.template_id}
                label="Template"
                onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
              >
                {templates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="list-select-label">Contact list</InputLabel>
              <Select
                labelId="list-select-label"
                value={form.contact_list_id}
                label="Contact list"
                onChange={(e) => setForm((f) => ({ ...f, contact_list_id: e.target.value }))}
              >
                {contactLists.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="fu-template-select-label">Follow-up template (optional)</InputLabel>
              <Select
                labelId="fu-template-select-label"
                value={form.follow_up_template_id}
                label="Follow-up template (optional)"
                onChange={(e) => setForm((f) => ({ ...f, follow_up_template_id: e.target.value }))}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {templates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Follow-up days"
              type="number"
              value={form.follow_up_days}
              onChange={(e) => setForm((f) => ({ ...f, follow_up_days: e.target.value }))}
              fullWidth
            />
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={
                  creating ||
                  !form.name ||
                  !form.template_id ||
                  !form.contact_list_id
                }
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 3 }}>
        <FormControl sx={{ minWidth: 260 }}>
          <InputLabel id="campaign-select-label">Campaign</InputLabel>
          <Select
            labelId="campaign-select-label"
            value={selectedCampaignId}
            label="Campaign"
            onChange={(e) => setSelectedCampaignId(e.target.value)}
          >
            {campaigns.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          disabled={!selectedCampaignId || sending}
          onClick={handleSend}
        >
          {sending ? "Sending..." : "Send campaign"}
        </Button>

        <Tooltip title="Delete campaign">
          <span>
            <IconButton
              color="error"
              disabled={!selectedCampaignId}
              onClick={() => {
                const c = campaigns.find((x) => x.id === selectedCampaignId);
                if (c) setDeleteTarget(c);
              }}
              aria-label="delete-campaign"
              data-testid="delete-campaign-btn"
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {!preview ? (
        <Typography color="text.secondary">
          Select a campaign to preview.
        </Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2 }}>
          {!!metrics && (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Metrics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sent (main): {metrics.sent_main_count} · Opened (main):{" "}
                  {metrics.opened_main_count} · Open rate:{" "}
                  {Number(metrics.open_rate_pct || 0).toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Sample contact
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {preview.sample_contact?.name} · {preview.sample_contact?.email} ·{" "}
                {preview.sample_contact?.company}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Subject
              </Typography>
              <Typography variant="body1">{preview.subject_rendered}</Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Preview
              </Typography>
              <Box
                sx={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 1,
                  p: 2,
                }}
                dangerouslySetInnerHTML={{ __html: preview.body_html_rendered }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Resolved variables
              </Typography>
              {resolvedVars.length === 0 ? (
                <Typography color="text.secondary">None</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Variable</TableCell>
                      <TableCell>Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resolvedVars.map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell>{k}</TableCell>
                        <TableCell>{String(v)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Unopened contacts
              </Typography>
              {unopened.length === 0 ? (
                <Typography color="text.secondary">None</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Company</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {unopened.map((u) => (
                      <TableRow key={u.email_id}>
                        <TableCell>{u.recruiter_name}</TableCell>
                        <TableCell>{u.recruiter_email}</TableCell>
                        <TableCell>{u.company}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>Delete Campaign?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "<strong>{deleteTarget?.name}</strong>"?
            This will not delete the template or contact list. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleting}
            data-testid="confirm-delete-campaign-btn"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
