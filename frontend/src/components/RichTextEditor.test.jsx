import React from "react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import RichTextEditor from "./RichTextEditor";

const mockRun = vi.fn();
const mockEditor = {
  isActive: vi.fn(() => false),
  chain: vi.fn(() => ({
    focus: () => ({
      toggleBold: () => ({ run: mockRun }),
      toggleItalic: () => ({ run: mockRun }),
      toggleUnderline: () => ({ run: mockRun }),
      setTextAlign: () => ({ run: mockRun }),
      insertContent: () => ({ run: mockRun }),
    }),
  })),
  commands: { setContent: vi.fn() },
  getHTML: vi.fn(() => "<p>Hello {{first_name}} from {{company}}</p>"),
  destroy: vi.fn(),
};

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => mockEditor),
  EditorContent: ({ "data-testid": testId }) => (
    <div data-testid={testId ?? "editor-content"} />
  ),
}));

vi.mock("@tiptap/starter-kit", () => ({ default: {} }));
vi.mock("@tiptap/extension-underline", () => ({
  default: { configure: vi.fn() },
}));
vi.mock("@tiptap/extension-link", () => ({
  default: { configure: vi.fn(() => ({})) },
}));
vi.mock("@tiptap/extension-text-align", () => ({
  default: { configure: vi.fn(() => ({})) },
}));

const DEFAULT_PROPS = {
  initialHtml: "<p>Initial content</p>",
  subject: "Hello there",
  templateName: "Test Template",
  templateType: "MAIN",
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe("RichTextEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEditor.getHTML.mockReturnValue(
      "<p>Hello {{first_name}} from {{company}}</p>"
    );
  });

  test("renders the editor surface", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("editor-content")).toBeInTheDocument();
  });

  test("pre-populates name and subject from props", () => {
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

  test("Save Template forwards the editor HTML and extracted variables", () => {
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

  test("Save is disabled when name is empty", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} templateName="" />);
    expect(screen.getByText("Save Template").closest("button")).toBeDisabled();
  });

  test("Save is disabled when subject is empty", () => {
    render(<RichTextEditor {...DEFAULT_PROPS} subject="" />);
    expect(screen.getByText("Save Template").closest("button")).toBeDisabled();
  });
});
