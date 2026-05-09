import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  RefreshCcw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import {
  deleteResume,
  fetchSettings,
  updateSettings,
  uploadResume,
} from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useAction } from "@/lib/useAction";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [followUpDays, setFollowUpDays] = useState(3);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingResumeName, setPendingResumeName] = useState(null);
  const fileInputRef = useRef(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setFollowUpDays(data.follow_up_days);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err.message ?? "Failed to load settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { run: doSavePrefs, isPending: saving } = useAction(
    () => updateSettings({ follow_up_days: followUpDays }),
    {
      loading: "Saving preferences...",
      success: "Preferences saved",
    }
  );

  const { run: doUploadResume, isPending: uploading } = useAction(
    (file) => uploadResume(file, setUploadProgress),
    {
      loading: "Uploading resume...",
      success: "Resume uploaded",
      onSuccess: (data) => {
        setSettings((s) => ({
          ...s,
          resume_url: data.resume_url,
          resume_filename: pendingResumeName ?? s?.resume_filename,
        }));
        setUploadProgress(0);
        setPendingResumeName(null);
      },
      onError: () => {
        setUploadProgress(0);
        setPendingResumeName(null);
      },
    }
  );

  const { run: doDeleteResume, isPending: removingResume } = useAction(
    () => deleteResume(),
    {
      loading: "Removing resume...",
      success: "Resume removed",
      onSuccess: () =>
        setSettings((s) => ({ ...s, resume_url: null, resume_filename: null })),
    }
  );

  const handleResumeFile = async (file) => {
    if (!file) return;
    setPendingResumeName(file.name);
    try {
      await doUploadResume(file);
    } catch {
      /* useAction toasts the error */
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load settings</AlertTitle>
        <AlertDescription>{fetchError}</AlertDescription>
      </Alert>
    );
  }

  const followUpInvalid = followUpDays < 1 || followUpDays > 30;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connection status, sending preferences, and the resume we attach to
          campaigns.
        </p>
      </header>

      <Tabs defaultValue="preferences">
        <TabsList>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email preferences</CardTitle>
              <CardDescription>
                How long to wait before automatic follow-ups for unopened emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="follow-up-days">Follow-up after (days)</Label>
                <Input
                  id="follow-up-days"
                  type="number"
                  min={1}
                  max={30}
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(Number(e.target.value))}
                />
                {followUpInvalid ? (
                  <p className="text-xs text-destructive">
                    Must be between 1 and 30 days.
                  </p>
                ) : null}
              </div>
              <Button
                onClick={() => doSavePrefs()}
                loading={saving}
                disabled={saving || followUpInvalid}
              >
                Save preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resume">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resume</CardTitle>
              <CardDescription>
                Attached to outgoing campaign emails. PDF or Word docs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings?.resume_url ? (
                <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={settings.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {settings.resume_filename ?? "resume"}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Linked to all outgoing campaign emails.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => doDeleteResume()}
                    loading={removingResume}
                    disabled={removingResume}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground mx-auto">
                    <Upload className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-sm font-medium">No resume uploaded</p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOC, or DOCX up to a few MB.
                  </p>
                  <Button
                    className="mt-3"
                    onClick={() => fileInputRef.current?.click()}
                    loading={uploading}
                    disabled={uploading}
                  >
                    Upload resume
                  </Button>
                  {uploading ? (
                    <Progress value={uploadProgress} className="mx-auto mt-3 max-w-xs" />
                  ) : null}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  handleResumeFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gmail connection</CardTitle>
              <CardDescription>
                We send campaign emails through your Gmail account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Appearance</p>
                  <p className="text-xs text-muted-foreground">
                    Choose the color theme for this browser.
                  </p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-full sm:w-40" aria-label="Appearance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-secondary text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Gmail</p>
                    <p className="text-xs text-muted-foreground">
                      OAuth-based. Reconnect if scopes change.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {settings?.gmail_connected ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Not connected
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.location.href = `${API_URL}/auth/login`;
                    }}
                  >
                    <RefreshCcw />
                    Reconnect
                  </Button>
                </div>
              </div>
              <a
                href={`${API_URL}/auth/login`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Open OAuth consent
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
