// Tests for TemplatesPage — KAN-22
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TemplatesPage from "./TemplatesPage";
import * as api from "../services/api";

// Mock API
jest.mock("../services/api");

// Mock child editor components to keep tests focused on page orchestration
jest.mock("./GuidedTemplateBuilder", () =>
  function GuidedTemplateBuilder({ onHandoffToEditor, onSave, onCancel }) {
    return (
      <div data-testid="guided-builder">
        <button onClick={() => onHandoffToEditor("<p>html</p>", "Subj", "Name", "MAIN")}>
          Handoff
        </button>
        <button onClick={() => onSave({ name: "T", type: "MAIN", subject: "S", body_html: "<p/>" })}>
          Save from Guided
        </button>
        <button onClick={onCancel}>Cancel Guided</button>
      </div>
    );
  }
);

jest.mock("./RichTextEditor", () =>
  function RichTextEditor({ onSave, onCancel, initialHtml, templateName }) {
    return (
      <div data-testid="rich-text-editor">
        <span data-testid="rte-initial-html">{initialHtml}</span>
        <span data-testid="rte-name">{templateName}</span>
        <button onClick={() => onSave({ name: "T", type: "MAIN", subject: "S", body_html: "<p/>" })}>
          Save from Editor
        </button>
        <button onClick={onCancel}>Cancel Editor</button>
      </div>
    );
  }
);

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
    jest.clearAllMocks();
    api.listTemplates.mockResolvedValue(MOCK_TEMPLATES);
  });

  test("shows template list after loading", async () => {
    render(<TemplatesPage />);
    await waitFor(() => {
      expect(screen.getByText("SWE Template")).toBeInTheDocument();
      expect(screen.getByText("ML Follow-up")).toBeInTheDocument();
    });
  });

  test("Create New Template button opens mode chooser", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    expect(screen.getByTestId("choose-guided")).toBeInTheDocument();
    expect(screen.getByTestId("choose-freeform")).toBeInTheDocument();
  });

  test("choosing Guided Builder renders GuidedTemplateBuilder", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-guided"));
    expect(screen.getByTestId("guided-builder")).toBeInTheDocument();
  });

  test("choosing Free-form Editor renders RichTextEditor", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-freeform"));
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
  });

  test("guided builder handoff switches to RichTextEditor with the html", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-guided"));
    fireEvent.click(screen.getByText("Handoff"));
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    expect(screen.getByTestId("rte-initial-html")).toHaveTextContent("<p>html</p>");
  });

  test("saving from guided builder calls createTemplate and returns to list", async () => {
    api.createTemplate.mockResolvedValueOnce({ id: 3 });
    render(<TemplatesPage />);
    await waitFor(() => screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("create-new-btn"));
    fireEvent.click(screen.getByTestId("choose-guided"));
    fireEvent.click(screen.getByText("Save from Guided"));
    await waitFor(() => expect(api.createTemplate).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("guided-builder")).not.toBeInTheDocument());
  });

  test("delete icon shows confirmation dialog", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByText("SWE Template"));
    fireEvent.click(screen.getByLabelText("delete-1"));
    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
  });

  test("confirming delete calls deleteTemplate with the correct id", async () => {
    api.deleteTemplate.mockResolvedValueOnce();
    render(<TemplatesPage />);
    await waitFor(() => screen.getByText("SWE Template"));
    fireEvent.click(screen.getByLabelText("delete-1"));
    fireEvent.click(screen.getByTestId("confirm-delete-btn"));
    await waitFor(() => expect(api.deleteTemplate).toHaveBeenCalledWith(1));
  });

  test("edit button switches to edit-editor with correct template data", async () => {
    render(<TemplatesPage />);
    await waitFor(() => screen.getByText("SWE Template"));
    fireEvent.click(screen.getByLabelText("edit-1"));
    expect(screen.getByTestId("rich-text-editor")).toBeInTheDocument();
    expect(screen.getByTestId("rte-name")).toHaveTextContent("SWE Template");
  });
});
