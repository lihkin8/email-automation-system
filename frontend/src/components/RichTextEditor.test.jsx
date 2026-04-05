// Tests for RichTextEditor — KAN-21
// TipTap is mocked to avoid DOM complexity in Jest/jsdom.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RichTextEditor from "./RichTextEditor";

// ── TipTap mock ───────────────────────────────────────────────────────────────
const mockRun = jest.fn();
const mockEditor = {
  isActive: jest.fn(() => false),
  chain: jest.fn(() => ({
    focus: () => ({
      toggleBold: () => ({ run: mockRun }),
      toggleItalic: () => ({ run: mockRun }),
      toggleUnderline: () => ({ run: mockRun }),
      setTextAlign: () => ({ run: mockRun }),
      insertContent: () => ({ run: mockRun }),
    }),
  })),
  commands: { setContent: jest.fn() },
  getHTML: jest.fn(() => "<p>Hello {{first_name}} from {{company}}</p>"),
  destroy: jest.fn(),
};

jest.mock("@tiptap/react", () => ({
  useEditor: jest.fn(),
  EditorContent: ({ "data-testid": testId }) => (
    <div data-testid={testId ?? "editor-content"} />
  ),
}));

jest.mock("@tiptap/starter-kit", () => ({}));
jest.mock("@tiptap/extension-underline", () => ({ configure: jest.fn() }));
jest.mock("@tiptap/extension-link", () => ({ configure: jest.fn(() => ({})) }));
jest.mock("@tiptap/extension-text-align", () => ({ configure: jest.fn(() => ({})) }));

// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  initialHtml: "<p>Initial content</p>",
  subject: "Hello there",
  templateName: "Test Template",
  templateType: "MAIN",
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

const { useEditor } = require("@tiptap/react");

describe("RichTextEditor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore useEditor mock after clearAllMocks wipes its return value
    useEditor.mockReturnValue(mockEditor);
    mockEditor.getHTML.mockReturnValue("<p>Hello {{first_name}} from {{company}}</p>");
  });

  test("renders the editor content area", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("pre-populates name, subject, and type fields from props", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("rte-name")).toHaveValue("Test Template");
    expect(screen.getByTestId("rte-subject")).toHaveValue("Hello there");
  });

  test("renders all 7 variable chips", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("var-chip-{{first_name}}")).toBeInTheDocument();
    expect(screen.getByTestId("var-chip-{{company}}")).toBeInTheDocument();
    expect(screen.getByTestId("var-chip-{{your_name}}")).toBeInTheDocument();
    expect(screen.getByTestId("var-chip-{{role}}")).toBeInTheDocument();
    expect(screen.getByTestId("var-chip-{{your_skills}}")).toBeInTheDocument();
    expect(screen.getByTestId("var-chip-{{custom_1}}")).toBeInTheDocument();
    expect(screen.getByTestId("var-chip-{{custom_2}}")).toBeInTheDocument();
  });

  test("Save Template calls onSave with correct shape including extracted variables", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText("Save Template"));

    expect(DEFAULT_PROPS.onSave).toHaveBeenCalledWith({
      name: "Test Template",
      type: "MAIN",
      subject: "Hello there",
      body_html: "<p>Hello {{first_name}} from {{company}}</p>",
      variables: { first_name: "{{first_name}}", company: "{{company}}" },
    });
  });

  test("Cancel button calls onCancel", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(DEFAULT_PROPS.onCancel).toHaveBeenCalled();
  });

  test("Save button is disabled when name is empty", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} templateName="" />);
    expect(screen.getByText("Save Template").closest("button")).toBeDisabled();
  });

  test("Save button is disabled when subject is empty", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} subject="" />);
    expect(screen.getByText("Save Template").closest("button")).toBeDisabled();
  });
});
