import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { fetchOnboardingStatus } from "../services/api";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const s = await fetchOnboardingStatus();
        setStatus(s);
      } catch {
        setError("Failed to load onboarding status");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const steps = [
    {
      key: "gmail",
      label: "Connect Gmail",
      done: !!status?.gmail_connected,
      description:
        "Connect your Gmail so we can send campaign emails from your account.",
      cta: {
        label: "Connect Gmail",
        href: `${(process.env.REACT_APP_API_URL || "").replace(/\/$/, "")}/auth/login`,
      },
    },
    {
      key: "resume",
      label: "Upload resume",
      done: !!status?.has_resume,
      description:
        "Upload your resume once — we’ll attach it to outgoing campaign emails.",
      cta: { label: "Go to Settings", to: "/settings" },
    },
    {
      key: "template",
      label: "Create a template",
      done: !!status?.has_template,
      description:
        "Create a MAIN template (and optionally a FOLLOW_UP template) for your campaign.",
      cta: { label: "Go to Templates", to: "/templates" },
    },
    {
      key: "contacts",
      label: "Import contacts",
      done: !!status?.has_contacts,
      description:
        "Upload a contact list so we know who to email in your campaign.",
      cta: { label: "Go to Contacts", to: "/contacts" },
    },
    {
      key: "campaign",
      label: "Create & send a campaign",
      done: !!status?.has_campaign,
      description:
        "Create a campaign, preview the rendered email, then send it.",
      cta: { label: "Go to Campaigns", to: "/campaigns" },
    },
  ];

  const activeStep = Math.max(
    0,
    steps.findIndex((s) => !s.done)
  );

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
        Onboarding
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
        {steps.map((s) => (
          <Step key={s.key} completed={s.done}>
            <StepLabel>{s.label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {steps[activeStep]?.label ?? "All set"}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {steps[activeStep]?.description ??
              "You’ve completed onboarding. You can start creating campaigns any time."}
          </Typography>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {steps[activeStep]?.cta?.href ? (
              <Button variant="contained" component="a" href={steps[activeStep].cta.href}>
                {steps[activeStep].cta.label}
              </Button>
            ) : steps[activeStep]?.cta?.to ? (
              <Button
                variant="contained"
                component={Link}
                to={steps[activeStep].cta.to}
              >
                {steps[activeStep].cta.label}
              </Button>
            ) : (
              <Button variant="contained" component={Link} to="/campaigns">
                Go to Campaigns
              </Button>
            )}

            <Button variant="outlined" onClick={() => window.location.reload()}>
              Refresh status
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
