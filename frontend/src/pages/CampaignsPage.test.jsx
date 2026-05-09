import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import CampaignsPage from "./CampaignsPage";

vi.mock("@/lib/api", () => ({
  listCampaigns: vi.fn(),
  listTemplates: vi.fn(),
  listContactLists: vi.fn(),
  createCampaign: vi.fn(),
  getCampaignPreview: vi.fn(),
  getCampaignMetrics: vi.fn(),
  getCampaignUnopened: vi.fn(),
  getSendProgress: vi.fn(),
  sendCampaign: vi.fn(),
  runCampaignFollowUps: vi.fn(),
  deleteCampaign: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "tid"),
    success: vi.fn(),
    error: vi.fn(),
    promise: vi.fn(),
  },
}));

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import {
  listCampaigns,
  listTemplates,
  listContactLists,
  getCampaignPreview,
  getCampaignMetrics,
  getCampaignUnopened,
  getSendProgress,
  sendCampaign,
} from "@/lib/api";

describe("CampaignsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders the page and lists campaigns", async () => {
    listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: "C1",
        template_id: 10,
        contact_list_id: 20,
        follow_up_template_id: null,
        follow_up_days: 5,
        created_at: "2026-04-04T12:00:00",
      },
    ]);
    listTemplates.mockResolvedValue([{ id: 10, name: "T1" }]);
    listContactLists.mockResolvedValue([{ id: 20, name: "L1" }]);

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText("Campaigns")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(listCampaigns).toHaveBeenCalled();
      expect(screen.getAllByText("Create campaign").length).toBeGreaterThan(0);
      expect(screen.getByText("C1")).toBeInTheDocument();
    });
  });

  test("renders preview as a centered dialog with sanitized html", async () => {
    listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: "C1",
        template_id: 10,
        contact_list_id: 20,
        follow_up_template_id: null,
        follow_up_days: 5,
        created_at: "2026-04-04T12:00:00",
      },
    ]);
    listTemplates.mockResolvedValue([{ id: 10, name: "T1" }]);
    listContactLists.mockResolvedValue([{ id: 20, name: "L1" }]);
    getCampaignPreview.mockResolvedValue({
      campaign_id: 1,
      sample_contact: { name: "Jane", email: "jane@example.com", company: "Acme" },
      subject_rendered: "Hi Jane",
      body_html_rendered: '<p>Hello</p><img src="x" onerror="alert(1)" />',
      resolved_variables: { first_name: "Jane" },
    });
    getCampaignMetrics.mockResolvedValue({
      sent_main_count: 0,
      opened_main_count: 0,
      open_rate_pct: 0,
    });
    getCampaignUnopened.mockResolvedValue([]);

    render(<CampaignsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /preview/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("max-w-5xl");
    expect(within(dialog).getByText("Hi Jane")).toBeInTheDocument();
    expect(dialog.innerHTML).toContain("<p>Hello</p>");
    expect(dialog.innerHTML).not.toContain("onerror");
  });

  test("polls send progress while sending from the preview dialog", async () => {
    let resolveSend;
    listCampaigns.mockResolvedValue([
      {
        id: 1,
        name: "C1",
        template_id: 10,
        contact_list_id: 20,
        follow_up_template_id: null,
        follow_up_days: 5,
        created_at: "2026-04-04T12:00:00",
      },
    ]);
    listTemplates.mockResolvedValue([{ id: 10, name: "T1" }]);
    listContactLists.mockResolvedValue([{ id: 20, name: "L1" }]);
    getCampaignPreview.mockResolvedValue({
      campaign_id: 1,
      sample_contact: { name: "Jane", email: "jane@example.com", company: "Acme" },
      subject_rendered: "Hi Jane",
      body_html_rendered: "<p>Hello</p>",
      resolved_variables: {},
    });
    getCampaignMetrics.mockResolvedValue({
      sent_main_count: 0,
      opened_main_count: 0,
      open_rate_pct: 0,
    });
    getCampaignUnopened.mockResolvedValue([]);
    getSendProgress
      .mockResolvedValueOnce({
        campaign_id: 1,
        status: "RUNNING",
        total: 3,
        pending: 2,
        sent: 1,
        failed: 0,
      })
      .mockResolvedValue({
        campaign_id: 1,
        status: "RUNNING",
        total: 3,
        pending: 1,
        sent: 2,
        failed: 0,
      });
    sendCampaign.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      })
    );

    render(<CampaignsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /preview/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /send campaign/i }));

    await waitFor(() => {
      expect(getSendProgress).toHaveBeenCalledWith(1);
      expect(within(dialog).getByText(/Sent 1 of 3/i)).toBeInTheDocument();
    });

    resolveSend({ sent: 3, failed: 0 });
    await waitFor(() => expect(sendCampaign).toHaveBeenCalledWith(1, 2.0));
  });
});
