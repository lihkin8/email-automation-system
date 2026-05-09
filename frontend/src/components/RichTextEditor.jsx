import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline as UnderlineIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const VARIABLES = [
  { label: "{{first_name}}", description: "Recipient's first name" },
  { label: "{{company}}", description: "Recipient's company" },
  { label: "{{your_name}}", description: "Your name" },
  { label: "{{role}}", description: "Your target role" },
  { label: "{{your_skills}}", description: "Your key skills" },
  { label: "{{custom_1}}", description: "Custom variable 1" },
  { label: "{{custom_2}}", description: "Custom variable 2" },
];

function extractVariables(html) {
  const found = [...html.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return Object.fromEntries([...new Set(found)].map((v) => [v, `{{${v}}}`]));
}

export default function RichTextEditor({
  initialHtml = "",
  subject: initialSubject = "",
  templateName: initialName = "",
  templateType: initialType = "MAIN",
  onSave,
  onCancel,
  saving = false,
}) {
  const [localName, setLocalName] = useState(initialName);
  const [localSubject, setLocalSubject] = useState(initialSubject);
  const [localType, setLocalType] = useState(initialType);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: initialHtml,
  });

  useEffect(() => {
    if (editor && initialHtml) editor.commands.setContent(initialHtml);
  }, [initialHtml, editor]);
  useEffect(() => setLocalName(initialName), [initialName]);
  useEffect(() => setLocalSubject(initialSubject), [initialSubject]);
  useEffect(() => setLocalType(initialType), [initialType]);

  const handleSave = () => {
    if (!editor) return;
    const html = editor.getHTML();
    onSave({
      name: localName,
      type: localType,
      subject: localSubject,
      body_html: html,
      variables: extractVariables(html),
    });
  };

  const insertVariable = (label) =>
    editor?.chain().focus().insertContent(label).run();

  const isActive = (cmd, opts) => editor?.isActive(cmd, opts) ?? false;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px_1.5fr]">
        <div className="space-y-2">
          <Label htmlFor="rte-name-label">Template name</Label>
          <Input
            id="rte-name-label"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            data-testid="rte-name"
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={localType} onValueChange={setLocalType}>
            <SelectTrigger data-testid="rte-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MAIN">Main email</SelectItem>
              <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rte-subject-label">Subject</Label>
          <Input
            id="rte-subject-label"
            value={localSubject}
            onChange={(e) => setLocalSubject(e.target.value)}
            data-testid="rte-subject"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <TooltipProvider delayDuration={150}>
          <div className="space-y-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1">
              <ToolbarButton
                label="Bold"
                active={isActive("bold")}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Italic"
                active={isActive("italic")}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Underline"
                active={isActive("underline")}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              >
                <UnderlineIcon className="h-4 w-4" />
              </ToolbarButton>
              <Separator orientation="vertical" className="mx-1 h-5" />
              <ToolbarButton
                label="Align left"
                active={isActive("textAlign", { textAlign: "left" })}
                onClick={() => editor?.chain().focus().setTextAlign("left").run()}
              >
                <AlignLeft className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Align center"
                active={isActive("textAlign", { textAlign: "center" })}
                onClick={() =>
                  editor?.chain().focus().setTextAlign("center").run()
                }
              >
                <AlignCenter className="h-4 w-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Align right"
                active={isActive("textAlign", { textAlign: "right" })}
                onClick={() =>
                  editor?.chain().focus().setTextAlign("right").run()
                }
              >
                <AlignRight className="h-4 w-4" />
              </ToolbarButton>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <EditorContent editor={editor} data-testid="editor-content" />
            </div>
          </div>
        </TooltipProvider>

        <aside className="space-y-3 rounded-md border border-border bg-card/60 p-4">
          <div>
            <h3 className="text-sm font-semibold">Insert variable</h3>
            <p className="text-xs text-muted-foreground">
              Click a chip to insert it at the cursor.
            </p>
          </div>
          <div className="space-y-2">
            {VARIABLES.map((v) => (
              <button
                key={v.label}
                type="button"
                onClick={() => insertVariable(v.label)}
                className="block w-full rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
                data-testid={`var-chip-${v.label}`}
              >
                <Badge variant="outline" className="font-mono text-xs">
                  {v.label}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={!localName.trim() || !localSubject.trim() || saving}
        >
          Save Template
        </Button>
      </div>
    </div>
  );
}

function ToolbarButton({ label, active, onClick, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            active && "bg-accent text-foreground"
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
