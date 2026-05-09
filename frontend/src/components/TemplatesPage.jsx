import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Mail,
  PencilLine,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "@/lib/api";
import { useAction } from "@/lib/useAction";

import GuidedTemplateBuilder from "@/components/GuidedTemplateBuilder";
import RichTextEditor from "@/components/RichTextEditor";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_VARIANT = { MAIN: "secondary", FOLLOW_UP: "warning" };

export default function TemplatesPage() {
  // 'list' | 'create-choose' | 'guided' | 'editor' | 'edit-editor'
  const [mode, setMode] = useState("list");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorInitialHtml, setEditorInitialHtml] = useState("");
  const [editorInitialMeta, setEditorInitialMeta] = useState({
    subject: "",
    name: "",
    type: "MAIN",
  });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (err) {
      setFetchError(err.message ?? "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleGuidedHandoff = (html, subject, name, type) => {
    setEditorInitialHtml(html);
    setEditorInitialMeta({ subject, name, type });
    setMode("editor");
  };

  const { run: doCreate, isPending: creating } = useAction(
    (data) => createTemplate(data),
    {
      loading: "Saving template...",
      success: "Template created",
      onSuccess: () => {
        refresh();
        setMode("list");
      },
    }
  );

  const { run: doUpdate, isPending: updating } = useAction(
    (data) => updateTemplate(editingTemplate.id, data),
    {
      loading: "Saving template...",
      success: "Template updated",
      onSuccess: () => {
        refresh();
        setEditingTemplate(null);
        setMode("list");
      },
    }
  );

  const { run: doDelete, isPending: deleting } = useAction(
    () => deleteTemplate(deleteTarget.id),
    {
      loading: "Deleting template...",
      success: "Template deleted",
      onSuccess: () => {
        setDeleteTarget(null);
        refresh();
      },
    }
  );

  const handleEditClick = (template) => {
    setEditingTemplate(template);
    setMode("edit-editor");
  };

  if (mode === "guided") {
    return (
      <PageScaffold
        title="New template — guided"
        onBack={() => setMode("create-choose")}
      >
        <GuidedTemplateBuilder
          onHandoffToEditor={handleGuidedHandoff}
          onSave={(data) => doCreate(data)}
          onCancel={() => setMode("create-choose")}
          saving={creating}
        />
      </PageScaffold>
    );
  }

  if (mode === "editor") {
    return (
      <PageScaffold
        title="New template — editor"
        onBack={() => setMode("create-choose")}
      >
        <RichTextEditor
          initialHtml={editorInitialHtml}
          subject={editorInitialMeta.subject}
          templateName={editorInitialMeta.name}
          templateType={editorInitialMeta.type}
          onSave={(data) => doCreate(data)}
          onCancel={() => setMode("create-choose")}
          saving={creating}
        />
      </PageScaffold>
    );
  }

  if (mode === "edit-editor") {
    return (
      <PageScaffold
        title={`Edit ${editingTemplate?.name ?? "template"}`}
        onBack={() => {
          setEditingTemplate(null);
          setMode("list");
        }}
      >
        <RichTextEditor
          initialHtml={editingTemplate?.body_html ?? ""}
          subject={editingTemplate?.subject ?? ""}
          templateName={editingTemplate?.name ?? ""}
          templateType={editingTemplate?.type ?? "MAIN"}
          onSave={(data) => doUpdate(data)}
          onCancel={() => {
            setEditingTemplate(null);
            setMode("list");
          }}
          saving={updating}
        />
      </PageScaffold>
    );
  }

  if (mode === "create-choose") {
    return (
      <PageScaffold title="Create new template" onBack={() => setMode("list")}>
        <p className="text-sm text-muted-foreground">
          Pick how you'd like to start.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ChooseCard
            testid="choose-guided"
            title="Guided builder"
            description="Fill a short form. We'll auto-generate a clean, professional email."
            icon={Sparkles}
            onClick={() => setMode("guided")}
          />
          <ChooseCard
            testid="choose-freeform"
            title="Free-form editor"
            description="Write from scratch in a rich text editor with variable support."
            icon={PencilLine}
            onClick={() => {
              setEditorInitialHtml("");
              setEditorInitialMeta({ subject: "", name: "", type: "MAIN" });
              setMode("editor");
            }}
          />
        </div>
      </PageScaffold>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable email bodies. Tag them as MAIN or FOLLOW_UP and we'll
            interpolate variables at send time.
          </p>
        </div>
        <Button onClick={() => setMode("create-choose")} data-testid="create-new-btn">
          <Plus />
          Create new template
        </Button>
      </header>

      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load templates</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Mail className="h-8 w-8 text-muted-foreground" />
            <div>
              <h2 className="text-base font-semibold">No templates yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first to use it in a campaign.
              </p>
            </div>
            <Button onClick={() => setMode("create-choose")}>
              <Plus />
              Create template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} data-testid={`template-row-${t.id}`}>
                  <TableCell className="font-medium text-foreground">
                    {t.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[t.type] ?? "secondary"}>
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[320px] truncate text-muted-foreground">
                    {t.subject}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.created_at
                      ? new Date(t.created_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`edit-${t.id}`}
                        onClick={() => handleEditClick(t)}
                      >
                        <PencilLine className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`delete-${t.id}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              "<strong>{deleteTarget?.name}</strong>" will be permanently
              removed.
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
              data-testid="confirm-delete-btn"
            >
              Delete template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChooseCard({ icon: Icon, title, description, onClick, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className="rounded-lg border border-border bg-card p-6 text-left transition-colors hover:border-primary/60 hover:bg-accent/40"
    >
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function PageScaffold({ title, onBack, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft />
          Back
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}
