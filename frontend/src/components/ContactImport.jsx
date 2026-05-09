import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";

import { confirmImport, uploadContacts } from "@/lib/api";
import { useAction } from "@/lib/useAction";
import { cn } from "@/lib/utils";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STEPS = [
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "success", label: "Confirm" },
];

export default function ContactImport() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState("upload");
  const [contacts, setContacts] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [listName, setListName] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const { run: doParse, isPending: parsing } = useAction(
    (file) => uploadContacts(file, setUploadProgress),
    {
      loading: "Parsing contacts...",
      success: (data) =>
        `Parsed ${data.contacts.length} contact${data.contacts.length === 1 ? "" : "s"}`,
      error: "Couldn't parse the file. Check the format and try again.",
      onSuccess: (data) => {
        setContacts(data.contacts);
        setParseErrors(data.errors ?? []);
        setStep("preview");
        setUploadProgress(0);
      },
      onError: () => setUploadProgress(0),
    }
  );

  const { run: doConfirm, isPending: confirming } = useAction(
    () =>
      confirmImport({
        listName,
        source: "TEXT_FILE",
        contacts,
      }),
    {
      loading: "Saving contact list...",
      success: "Contact list created",
      onSuccess: (data) => {
        setImportedCount(data.imported_count);
        setStep("success");
      },
    }
  );

  const reset = () => {
    setStep("upload");
    setContacts([]);
    setParseErrors([]);
    setListName("");
    setImportedCount(0);
    setUploadProgress(0);
  };

  const handleFile = (file) => {
    if (!file) return;
    doParse(file).catch(() => {});
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Import contacts
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload a .txt file. Each company on its own line, then{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-xs">
              email@company.com - Full Name
            </code>
            .
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/contacts")}>
          <ArrowLeft />
          Back to lists
        </Button>
      </header>

      <Stepper currentStep={step} />

      {step === "upload" ? (
        <Card>
          <CardContent className="p-6">
            <div
              data-testid="drop-zone"
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                dragActive
                  ? "border-primary bg-accent/50"
                  : "border-border hover:border-primary/60 hover:bg-accent/40"
              )}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
                <CloudUpload className="h-6 w-6" />
              </span>
              <p className="mt-4 text-sm font-medium text-foreground">
                Drag &amp; drop your .txt file
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                or click to browse
              </p>
              {parsing ? (
                <div className="mt-4 w-64">
                  <Progress value={uploadProgress} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              ) : null}
            </div>

            <input
              ref={fileInputRef}
              data-testid="file-input"
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </CardContent>
        </Card>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-4">
          {parseErrors.length > 0 ? (
            <Alert variant="warning">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>
                {parseErrors.length} line{parseErrors.length > 1 ? "s" : ""} could
                not be parsed
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2 flex flex-wrap gap-1">
                  {parseErrors.map((err, i) => (
                    <Badge key={i} variant="warning">
                      {err}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Review the parsed contacts</CardTitle>
              <CardDescription>
                {contacts.length} contact{contacts.length === 1 ? "" : "s"} ready to
                import.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-foreground">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.email}
                        </TableCell>
                        <TableCell>{c.company}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="list-name">List name</Label>
                <Input
                  id="list-name"
                  placeholder="e.g. Tech Companies Spring 2026"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  aria-label="List name"
                />
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button variant="outline" onClick={reset} disabled={confirming}>
                  <RefreshCcw />
                  Start over
                </Button>
                <Button
                  onClick={() => doConfirm()}
                  disabled={!listName.trim() || confirming}
                  loading={confirming}
                >
                  Confirm Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === "success" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">
                Successfully imported {importedCount} contact
                {importedCount === 1 ? "" : "s"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Saved as "{listName}". You can now use it in any campaign.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate("/contacts")}>Back to lists</Button>
              <Button variant="outline" onClick={reset}>
                Import another list
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stepper({ currentStep }) {
  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);
  return (
    <ol className="flex items-center gap-3 text-xs">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s.id} className="flex items-center gap-3">
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold",
                done && "border-success bg-success text-success-foreground",
                active && "border-primary bg-primary text-primary-foreground",
                !done && !active && "border-border text-muted-foreground"
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "font-medium uppercase tracking-wide",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px w-8 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
