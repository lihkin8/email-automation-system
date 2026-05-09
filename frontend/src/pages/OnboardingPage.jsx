import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Circle,
  CircleCheck,
  Mail,
  RefreshCcw,
  Send,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";

import { fetchOnboardingStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchOnboardingStatus();
      setStatus(s);
    } catch (err) {
      setError(err.message ?? "Failed to load onboarding status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const steps = [
    {
      key: "gmail",
      label: "Connect Gmail",
      description:
        "Connect your Google account so we can send campaign emails from your address.",
      done: !!status?.gmail_connected,
      icon: Mail,
      cta: { label: "Connect Gmail", href: `${API_URL}/auth/login` },
    },
    {
      key: "resume",
      label: "Upload your resume",
      description:
        "Upload your resume once. We'll attach it to every outgoing campaign email.",
      done: !!status?.has_resume,
      icon: UploadCloud,
      cta: { label: "Open Settings", to: "/settings" },
    },
    {
      key: "template",
      label: "Create a template",
      description:
        "Build a MAIN template (and an optional FOLLOW_UP) with merge variables.",
      done: !!status?.has_template,
      icon: Sparkles,
      cta: { label: "Open Templates", to: "/templates" },
    },
    {
      key: "contacts",
      label: "Import contacts",
      description:
        "Upload at least one contact list — that's who your campaign will email.",
      done: !!status?.has_contacts,
      icon: Users,
      cta: { label: "Open Contacts", to: "/contacts" },
    },
    {
      key: "campaign",
      label: "Send your first campaign",
      description:
        "Combine a template with a list, preview the rendered email, and hit send.",
      done: !!status?.has_campaign,
      icon: Send,
      cta: { label: "Open Campaigns", to: "/campaigns" },
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completed / steps.length) * 100);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Five quick steps to send your first campaign.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCcw />
          Refresh status
        </Button>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load status</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {completed === steps.length
                ? "You're all set"
                : `${completed} of ${steps.length} complete`}
            </CardTitle>
            <CardDescription>{progressPct}%</CardDescription>
          </div>
          <Progress value={progressPct} className="mt-3" />
        </CardHeader>
      </Card>

      <ol className="space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-20 w-full rounded-lg" />
              </li>
            ))
          : steps.map((s, i) => <StepRow key={s.key} step={s} index={i} />)}
      </ol>
    </div>
  );
}

function StepRow({ step, index }) {
  const Icon = step.icon;
  return (
    <li>
      <Card
        className={cn(
          "transition-colors",
          step.done ? "border-success/40 bg-success/5" : ""
        )}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background">
            {step.done ? (
              <CircleCheck className="h-5 w-5 text-success" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
          </span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                {index + 1}. {step.label}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {step.description}
            </p>
          </div>
          {!step.done ? (
            step.cta?.href ? (
              <Button asChild variant="outline" size="sm">
                <a href={step.cta.href}>
                  {step.cta.label}
                  <ArrowRight />
                </a>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to={step.cta.to}>
                  {step.cta.label}
                  <ArrowRight />
                </Link>
              </Button>
            )
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
