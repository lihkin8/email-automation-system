import React, { useState } from "react";

import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { generateTemplateHtml } from "@/utils/templateGenerator";

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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const INITIAL_FIELDS = {
  templateName: "",
  templateType: "MAIN",
  subject: "",
  yourName: "",
  yourRole: "",
  school: "",
  gradYear: "",
  achievement1: "",
  achievement2: "",
  achievement3: "",
  skills: "",
  ctaPreference: "coffee_chat",
};

const REQUIRED_FIELDS = [
  "templateName",
  "templateType",
  "subject",
  "yourName",
  "yourRole",
  "school",
  "gradYear",
  "achievement1",
  "achievement2",
  "skills",
];

export default function GuidedTemplateBuilder({
  onHandoffToEditor,
  onSave,
  onCancel,
  saving = false,
}) {
  const [fields, setFields] = useState(INITIAL_FIELDS);

  const set = (key) => (value) =>
    setFields((f) => ({ ...f, [key]: value }));

  const isComplete = REQUIRED_FIELDS.every(
    (k) => fields[k].trim() !== ""
  );

  const generatedHtml = isComplete
    ? generateTemplateHtml({
        yourName: fields.yourName,
        yourRole: fields.yourRole,
        school: fields.school,
        gradYear: fields.gradYear,
        achievement1: fields.achievement1,
        achievement2: fields.achievement2,
        achievement3: fields.achievement3,
        skills: fields.skills,
        ctaPreference: fields.ctaPreference,
      })
    : "";

  const templateData = () => ({
    name: fields.templateName,
    type: fields.templateType,
    subject: fields.subject,
    body_html: generatedHtml,
    variables: { company: "{{company}}", first_name: "{{first_name}}" },
  });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Guided template builder</h2>
        <p className="text-sm text-muted-foreground">
          Fill in your details and we'll assemble a clean, professional email.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>Used to bake personal details into the email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              label="Template name"
              required
              testid="field-templateName"
              value={fields.templateName}
              onChange={set("templateName")}
            />
            <div className="grid gap-2">
              <Label>Template type</Label>
              <Select
                value={fields.templateType}
                onValueChange={set("templateType")}
              >
                <SelectTrigger data-testid="field-templateType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAIN">Main email</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormField
              label="Subject line"
              required
              testid="field-subject"
              value={fields.subject}
              onChange={set("subject")}
            />
            <Separator />
            <FormField
              label="Your name"
              required
              testid="field-yourName"
              value={fields.yourName}
              onChange={set("yourName")}
            />
            <FormField
              label="Your role"
              required
              testid="field-yourRole"
              value={fields.yourRole}
              onChange={set("yourRole")}
              placeholder="e.g. Software Engineer"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="School"
                required
                testid="field-school"
                value={fields.school}
                onChange={set("school")}
              />
              <FormField
                label="Graduation year"
                required
                testid="field-gradYear"
                value={fields.gradYear}
                onChange={set("gradYear")}
              />
            </div>
            <Separator />
            <FormField
              label="Achievement 1"
              required
              testid="field-achievement1"
              value={fields.achievement1}
              onChange={set("achievement1")}
            />
            <FormField
              label="Achievement 2"
              required
              testid="field-achievement2"
              value={fields.achievement2}
              onChange={set("achievement2")}
            />
            <FormField
              label="Achievement 3 (optional)"
              testid="field-achievement3"
              value={fields.achievement3}
              onChange={set("achievement3")}
            />
            <Separator />
            <FormField
              label="Key skills (comma-separated)"
              required
              testid="field-skills"
              value={fields.skills}
              onChange={set("skills")}
              placeholder="React, Python, SQL"
            />
            <div className="grid gap-2">
              <Label>Call to action</Label>
              <Select
                value={fields.ctaPreference}
                onValueChange={set("ctaPreference")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coffee_chat">
                    Virtual coffee chat (20 min)
                  </SelectItem>
                  <SelectItem value="virtual_call">Brief virtual call</SelectItem>
                  <SelectItem value="quick_call">Quick call (15 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              {isComplete
                ? "This is what recipients will see."
                : "Fill in the required fields to see a preview."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[460px] rounded-md border border-border bg-white p-4 text-sm text-zinc-900">
              {isComplete ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(generatedHtml),
                  }}
                />
              ) : (
                <p className="text-zinc-500">
                  Fill in all required fields to see a preview.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!isComplete}
            onClick={() =>
              onHandoffToEditor(
                generatedHtml,
                fields.subject,
                fields.templateName,
                fields.templateType
              )
            }
          >
            Edit in Rich Text Editor
          </Button>
          <Button
            disabled={!isComplete || saving}
            loading={saving}
            onClick={() => onSave(templateData())}
          >
            Save Template
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, required, testid, placeholder }) {
  const id = React.useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
      />
    </div>
  );
}
