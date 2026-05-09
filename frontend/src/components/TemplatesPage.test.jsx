import React from "react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import TemplatesPage from "./TemplatesPage";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "tid"),
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

vi.mock("./GuidedTemplateBuilder", () => ({
  default: function MockGuidedBuilder({ onHandoffToEditor, onSave, onCancel }) {
    return (
      <div data-testid="guided-builder">
        <button
          onClick={() =>
            onHandoffToEditor("<p>html</p>", "Subj", "Name", "MAIN")
          }
        >
          Handoff
        </button>
        <button
          onClick={() =>
            onSave({ name: "T", type: "MAIN", subject: "S", body_html: "<p/>" })
          }
        >
          Save from Guided
        </button>
        <button onClick={onCancel}>Cancel Guided</button>
      </div>
    );
  },
}));

vi.mock("./RichTextEditor", () => ({
  default: function MockRichTextEditor({
    onSave,
    onCancel,
    initialHtml,
    templateName,
  }) {
    return (
      <div data-testid="rich-text-editor">
        <span data-testid="rte-initial-html">{initialHtml}</span>
        <span data-testid="rte-name">{templateName}</span>
        <button
          onClick={() =>
            onSave({ name: "T", type: "MAIN", subject: "S", body_html: "<p/>" })
          }
        >
          Save from Editor
        </button>
        <button onClick={onCancel}>Cancel Editor</button>
      </div>
    );
  },
}));

const MOCK_TEMPLATES = [
  {
    id: 1,
    name: "SWE Template",
    type: "MAIN",
    subject: "Excited about {{company}}",
    created_at: "2026-04-04T12:00:00",
  },
  {
    id: 2,
    name: "ML Follow-up",
    type: "FOLLOW_UP",
    subject: "Following up",
    created_at: "2026-04-03T10:00:00",
  },
];

describe("TemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listTemplates.mockResolvedValue(MOCK_TEMPLATES);
  });

  test("shows templates after loading", async () => {
    render(<TemplatesPage />);
    await waitFor(() => {
      expect(screen.getByText("SWE Template")).toBeInTheDocument();
      expect(screen.getByText("ML Follow-up")).toBeInTheDocument();
    });
  });

  test("Create New Template opens the chooser", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    expect(screen.getByTestId("choose-guided")).toBeInTheDocument();
    expect(screen.getByTestId("choose-freeform")).toBeInTheDocument();
  });

  test("choosing Guided Builder renders the guided component", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-guided"));
    expect(screen.getByTestId("guided-builder")).toBeInTheDocument();
  });

  test("choosing Free-form Editor renders the rich editor", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-freeform"));
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
  });

  test("guided builder handoff swaps to the rich editor with the html", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-guided"));
    fireEvent.click(screen.getByText("Handoff"));
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    expect(screen.getByTestId("rte-initial-html")).toHaveTextContent("<p>html</p>");
  });

  test("saving from the guided builder calls createTemplate and returns to list", async () => {
    api.createTemplate.mockResolvedValueOnce({ id: 3 });
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-guided"));
    fireEvent.click(screen.getByText("Save from Guided"));
    await waitFor(() => expect(api.createTemplate).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId("guided-builder")).not.toBeInTheDocument()
    );
  });

  test("delete action opens the confirmation dialog", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByText("SWE Template"));
    fireEvent.click(screen.getByLabelText("delete-1"));
    expect(screen.getByText(/delete template\?/i)).toBeInTheDocument();
  });

  test("confirming delete calls deleteTemplate with the correct id", async () => {
    api.deleteTemplate.mockResolvedValueOnce(null);
    render(<TemplatesPage />);
    await waitFor(() => screen.getByText("SWE Template"));
    fireEvent.click(screen.getByLabelText("delete-1"));
    fireEvent.click(screen.getByTestId("confirm-delete-btn"));
    await waitFor(() =>
      expect(api.deleteTemplate).toHaveBeenCalledWith(1)
    );
  });

  test("edit action switches to the editor with the template's data", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByText("SWE Template"));
    fireEvent.click(screen.getByLabelText("edit-1"));
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    expect(screen.getByTestId("rte-name")).toHaveTextContent("SWE Template");
  });
});
