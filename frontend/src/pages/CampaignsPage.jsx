import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Repeat2,
  Send,
  Trash2,
} from "lucide-react";

import {
  createCampaign,
  deleteCampaign,
  getCampaignMetrics,
  getCampaignPreview,
  getCampaignUnopened,
  listCampaigns,
  listContactLists,
  listTemplates,
  runCampaignFollowUps,
  sendCampaign,
} from "@/lib/api";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const NONE_TEMPLATE = "__none__";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [previewCampaign, setPreviewCampaign] = useState(null);
  const [preview, setPreview] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [unopened, setUnopened] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    name: "",
    template_id: "",
    contact_list_id: "",
    follow_up_template_id: "",
    follow_up_days: 5,
  });

  const refreshCampaigns = async () => {
    const data = await listCampaigns();
    setCampaigns(data);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const [cs, ts, ls] = await Promise.all([
          listCampaigns(),
          listTemplates(),
          listContactLists(),
        ]);
        if (cancelled) return;
        setCampaigns(cs);
        setTemplates(ts);
        setContactLists(ls);
      } catch (err) {
        if (cancelled) return;
        setFetchError(err.message ?? "Failed to load campaigns");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!previewCampaign) {
      setPreview(null);
      setMetrics(null);
      setUnopened([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const [p, m, u] = await Promise.all([
          getCampaignPreview(previewCampaign.id),
          getCampaignMetrics(previewCampaign.id),
          getCampaignUnopened(previewCampaign.id),
        ]);
        if (cancelled) return;
        setPreview(p);
        setMetrics(m);
        setUnopened(u);
      } catch (err) {
        if (cancelled) return;
        setPreviewError(err.message ?? "Couldn't load preview");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewCampaign]);

  const { run: doCreate, isPending: creating } = useAction(
    () => {
      const payload = {
        name: form.name,
        template_id: Number(form.template_id),
        contact_list_id: Number(form.contact_list_id),
        follow_up_template_id:
          form.follow_up_template_id && form.follow_up_template_id !== NONE_TEMPLATE
            ? Number(form.follow_up_template_id)
            : null,
        follow_up_days: Number(form.follow_up_days),
      };
      return createCampaign(payload);
    },
    {
      loading: "Creating campaign...",
      success: (c) => `Campaign "${c.name}" created`,
      onSuccess: async () => {
        await refreshCampaigns();
        setForm((f) => ({ ...f, name: "" }));
      },
    }
  );

  const { run: doSend, isPending: sending } = useAction(
    (id) => sendCampaign(id, 2.0),
    {
      loading: "Sending campaign...",
      success: (data) =>
        `Campaign sent — ${data.sent} succeeded${
          data.failed ? `, ${data.failed} failed` : ""
        }`,
      confetti: true,
      onSuccess: async () => {
        if (!previewCampaign) return;
        try {
          const [m, u] = await Promise.all([
            getCampaignMetrics(previewCampaign.id),
            getCampaignUnopened(previewCampaign.id),
          ]);
          setMetrics(m);
          setUnopened(u);
        } catch {
          /* surface via next render only */
        }
      },
    }
  );

  const { run: doFollowUps, isPending: followingUp } = useAction(
    (id) => runCampaignFollowUps(id, 2.0),
    {
      loading: "Sending follow-ups...",
      success: (data) =>
        `Follow-ups sent — ${data.sent ?? 0} succeeded${
          data.failed ? `, ${data.failed} failed` : ""
        }`,
    }
  );

  const { run: doDelete, isPending: deleting } = useAction(
    () => deleteCampaign(deleteTarget.id),
    {
      loading: "Deleting campaign...",
      success: "Campaign deleted",
      onSuccess: async () => {
        const cs = await refreshCampaigns();
        if (previewCampaign?.id === deleteTarget.id) {
          setPreviewCampaign(null);
        }
        setDeleteTarget(null);
        return cs;
      },
    }
  );

  const resolvedVars = useMemo(
    () =>
      preview?.resolved_variables
        ? Object.entries(preview.resolved_variables)
        : [],
    [preview]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Pair a template with a contact list and send.
          </p>
        </div>
      </header>

      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load campaigns</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create campaign</CardTitle>
          <CardDescription>
            We'll combine the template, list, and (optional) follow-up into a
            single campaign you can send.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Spring SWE outreach"
              />
            </FormField>
            <FormField label="Template">
              <Select
                value={form.template_id ? String(form.template_id) : ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, template_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Contact list">
              <Select
                value={form.contact_list_id ? String(form.contact_list_id) : ""}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, contact_list_id: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a list" />
                </SelectTrigger>
                <SelectContent>
                  {contactLists.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Follow-up template (optional)">
              <Select
                value={
                  form.follow_up_template_id
                    ? String(form.follow_up_template_id)
                    : NONE_TEMPLATE
                }
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    follow_up_template_id: v === NONE_TEMPLATE ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_TEMPLATE}>None</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Follow-up after (days)">
              <Input
                type="number"
                min={1}
                max={30}
                value={form.follow_up_days}
                onChange={(e) =>
                  setForm((f) => ({ ...f, follow_up_days: e.target.value }))
                }
              />
            </FormField>
            <div className="flex items-end">
              <Button
                onClick={() => doCreate()}
                loading={creating}
                disabled={
                  creating ||
                  !form.name.trim() ||
                  !form.template_id ||
                  !form.contact_list_id
                }
              >
                <Plus />
                Create campaign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Your campaigns</h2>
        </div>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No campaigns yet. Create your first above.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Contact list</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => {
                  const template = templates.find((t) => t.id === c.template_id);
                  const list = contactLists.find(
                    (l) => l.id === c.contact_list_id
                  );
                  const followTemplate = templates.find(
                    (t) => t.id === c.follow_up_template_id
                  );
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {template?.name ?? `#${c.template_id}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {list?.name ?? `#${c.contact_list_id}`}
                      </TableCell>
                      <TableCell>
                        {followTemplate ? (
                          <Badge variant="outline">
                            {followTemplate.name} · {c.follow_up_days}d
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.created_at
                          ? new Date(c.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewCampaign(c)}
                          >
                            <Eye />
                            Preview
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  doSend(c.id);
                                }}
                              >
                                <Send />
                                Send campaign
                              </DropdownMenuItem>
                              {c.follow_up_template_id ? (
                                <DropdownMenuItem
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    doFollowUps(c.id);
                                  }}
                                >
                                  <Repeat2 />
                                  Run follow-ups
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setDeleteTarget(c);
                                }}
                                data-testid="delete-campaign-btn"
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Sheet
        open={Boolean(previewCampaign)}
        onOpenChange={(o) => !o && setPreviewCampaign(null)}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        >
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>{previewCampaign?.name ?? "Campaign"}</SheetTitle>
            <SheetDescription>
              Live preview rendered against a sample contact.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {previewError ? (
              <Alert variant="destructive">
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            ) : null}

            {previewLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : preview ? (
              <>
                {metrics ? (
                  <Card>
                    <CardContent className="grid grid-cols-3 gap-3 p-4 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Sent (main)
                        </p>
                        <p className="text-lg font-semibold">{metrics.sent_main_count}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Opened
                        </p>
                        <p className="text-lg font-semibold">{metrics.opened_main_count}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Open rate
                        </p>
                        <p className="text-lg font-semibold">
                          {(metrics.open_rate_pct ?? 0).toFixed(1)}%
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sample recipient</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {preview.sample_contact?.name} ·{" "}
                    {preview.sample_contact?.email} ·{" "}
                    {preview.sample_contact?.company}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Subject</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    {preview.subject_rendered}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Email body</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="rounded-md border border-border bg-white p-4 text-zinc-900"
                      dangerouslySetInnerHTML={{
                        __html: preview.body_html_rendered,
                      }}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Resolved variables</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {resolvedVars.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Variable</TableHead>
                            <TableHead>Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resolvedVars.map(([k, v]) => (
                            <TableRow key={k}>
                              <TableCell className="font-mono text-xs">
                                {k}
                              </TableCell>
                              <TableCell>{String(v)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Unopened contacts</CardTitle>
                    <CardDescription>
                      Recipients we still haven't seen open the main email.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {unopened.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Company</TableHead>
                          </TableRow>
                        </TableHeader>
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
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No preview yet.</p>
            )}
          </div>
          <SheetFooter className="border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setPreviewCampaign(null)}
            >
              Close
            </Button>
            {previewCampaign?.follow_up_template_id ? (
              <Button
                variant="outline"
                onClick={() => doFollowUps(previewCampaign.id)}
                loading={followingUp}
              >
                <Repeat2 />
                Run follow-ups
              </Button>
            ) : null}
            <Button
              onClick={() => doSend(previewCampaign.id)}
              loading={sending}
              disabled={!previewCampaign || sending}
            >
              <Send />
              Send campaign
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete campaign?</DialogTitle>
            <DialogDescription>
              "<strong>{deleteTarget?.name}</strong>" will be removed. The
              template and contact list will not be touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => doDelete()}
              loading={deleting}
              data-testid="confirm-delete-campaign-btn"
            >
              Delete campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, children }) {
  const id = React.useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div id={id}>{children}</div>
    </div>
  );
}
