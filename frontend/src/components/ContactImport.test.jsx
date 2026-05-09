import React from "react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import ContactImport from "./ContactImport";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  uploadContacts: vi.fn(),
  confirmImport: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "tid"),
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

const renderImport = () =>
  render(
    <MemoryRouter>
      <ContactImport />
    </MemoryRouter>
  );

const MOCK_CONTACTS = [
  { name: "Jane Smith", email: "jane@google.com", company: "Google" },
  { name: "Bob Jones", email: "bob@meta.com", company: "Meta" },
];

describe("ContactImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shows the drop zone initially", () => {
    renderImport();
    expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
  });

  test("shows preview table after a successful upload", async () => {
    api.uploadContacts.mockResolvedValueOnce({
      contacts: MOCK_CONTACTS,
      errors: [],
    });
    renderImport();
    const file = new File(
      ["Google:\njane@google.com - Jane Smith\n"],
      "contacts.txt",
      { type: "text/plain" }
    );
    await userEvent.upload(screen.getByTestId("file-input"), file);

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
      expect(screen.getByText("Google")).toBeInTheDocument();
    });
  });

  test("renders parse-error chips when the API reports errors", async () => {
    api.uploadContacts.mockResolvedValueOnce({
      contacts: [MOCK_CONTACTS[0]],
      errors: ["Line 3: missing '-' separator"],
    });
    renderImport();
    await userEvent.upload(
      screen.getByTestId("file-input"),
      new File(["x"], "c.txt")
    );

    await waitFor(() => {
      expect(screen.getByText(/could not be parsed/i)).toBeInTheDocument();
      expect(
        screen.getByText("Line 3: missing '-' separator")
      ).toBeInTheDocument();
    });
  });

  test("disables Confirm Import until a list name is provided", async () => {
    api.uploadContacts.mockResolvedValueOnce({
      contacts: MOCK_CONTACTS,
      errors: [],
    });
    renderImport();
    await userEvent.upload(
      screen.getByTestId("file-input"),
      new File(["x"], "c.txt")
    );
    await waitFor(() => screen.getByText("Confirm Import"));
    expect(screen.getByText("Confirm Import").closest("button")).toBeDisabled();
  });

  test("confirms the import and shows the success state", async () => {
    api.uploadContacts.mockResolvedValueOnce({
      contacts: MOCK_CONTACTS,
      errors: [],
    });
    api.confirmImport.mockResolvedValueOnce({
      contact_list_id: 1,
      imported_count: 2,
    });
    renderImport();
    await userEvent.upload(
      screen.getByTestId("file-input"),
      new File(["x"], "c.txt")
    );
    await waitFor(() => screen.getByLabelText(/list name/i));
    await userEvent.type(screen.getByLabelText(/list name/i), "My List");
    await userEvent.click(screen.getByText("Confirm Import"));

    await waitFor(() => {
      expect(screen.getByText(/successfully imported/i)).toBeInTheDocument();
      expect(screen.getByText(/My List/)).toBeInTheDocument();
    });
    expect(api.confirmImport).toHaveBeenCalledWith({
      listName: "My List",
      source: "TEXT_FILE",
      contacts: MOCK_CONTACTS,
    });
  });
});
