// Tests for GuidedTemplateBuilder — KAN-20
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GuidedTemplateBuilder from "./GuidedTemplateBuilder";
import * as templateGenerator from "../utils/templateGenerator";

jest.mock("../utils/templateGenerator");

const noop = () => {};
const DEFAULT_PROPS = {
  onHandoffToEditor: jest.fn(),
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

function fillRequiredFields() {
  fireEvent.change(screen.getByTestId("field-templateName"), {
    target: { value: "My Template" },
  });
  fireEvent.change(screen.getByTestId("field-subject"), {
    target: { value: "Hi {{first_name}}" },
  });
  fireEvent.change(screen.getByTestId("field-yourName"), {
    target: { value: "Alex Kim" },
  });
  fireEvent.change(screen.getByTestId("field-yourRole"), {
    target: { value: "Software Engineer" },
  });
  fireEvent.change(screen.getByTestId("field-school"), {
    target: { value: "UC Berkeley" },
  });
  fireEvent.change(screen.getByTestId("field-gradYear"), {
    target: { value: "2027" },
  });
  fireEvent.change(screen.getByTestId("field-achievement1"), {
    target: { value: "Built chat app" },
  });
  fireEvent.change(screen.getByTestId("field-achievement2"), {
    target: { value: "Won hackathon" },
  });
  fireEvent.change(screen.getByTestId("field-skills"), {
    target: { value: "React, Python" },
  });
}

describe("GuidedTemplateBuilder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    templateGenerator.generateTemplateHtml.mockReturnValue("<p>Generated HTML</p>");
  });

  test("renders all required form fields", () => {
    render(<GuidedTemplateBuilder {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("field-templateName")).toBeInTheDocument();
    expect(screen.getByTestId("field-subject")).toBeInTheDocument();
    expect(screen.getByTestId("field-yourName")).toBeInTheDocument();
    expect(screen.getByTestId("field-school")).toBeInTheDocument();
    expect(screen.getByTestId("field-gradYear")).toBeInTheDocument();
    expect(screen.getByTestId("field-achievement1")).toBeInTheDocument();
    expect(screen.getByTestId("field-achievement2")).toBeInTheDocument();
    expect(screen.getByTestId("field-skills")).toBeInTheDocument();
  });

  test("Save Template button is disabled when required fields are empty", () => {
    render(<GuidedTemplateBuilder {...DEFAULT_PROPS} />);
    expect(screen.getByText("Save Template").closest("button")).toBeDisabled();
    expect(screen.getByText("Edit in Rich Text Editor").closest("button")).toBeDisabled();
  });

  test("buttons become enabled after all required fields are filled", () => {
    render(<GuidedTemplateBuilder {...DEFAULT_PROPS} />);
    fillRequiredFields();
    expect(screen.getByText("Save Template").closest("button")).not.toBeDisabled();
    expect(screen.getByText("Edit in Rich Text Editor").closest("button")).not.toBeDisabled();
  });

  test("Save Template calls onSave with correct template data shape", () => {
    render(<GuidedTemplateBuilder {...DEFAULT_PROPS} />);
    fillRequiredFields();
    fireEvent.click(screen.getByText("Save Template"));

    expect(DEFAULT_PROPS.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My Template",
        type: "MAIN",
        subject: "Hi {{first_name}}",
        body_html: "<p>Generated HTML</p>",
        variables: expect.objectContaining({ company: "{{company}}" }),
      })
    );
  });

  test("Edit in Rich Text Editor calls onHandoffToEditor with html, subject, name, type", () => {
    render(<GuidedTemplateBuilder {...DEFAULT_PROPS} />);
    fillRequiredFields();
    fireEvent.click(screen.getByText("Edit in Rich Text Editor"));

    expect(DEFAULT_PROPS.onHandoffToEditor).toHaveBeenCalledWith(
      "<p>Generated HTML</p>",
      "Hi {{first_name}}",
      "My Template",
      "MAIN"
    );
  });

  test("Cancel button calls onCancel", () => {
    render(<GuidedTemplateBuilder {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(DEFAULT_PROPS.onCancel).toHaveBeenCalled();
  });
});
