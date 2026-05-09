import React from "react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import CampaignsPage from "./CampaignsPage";

vi.mock("@/lib/api", () => ({
  listCampaigns: vi.fn(),
  listTemplates: vi.fn(),
  listContactLists: vi.fn(),
  createCampaign: vi.fn(),
  getCampaignPreview: vi.fn(),
  getCampaignMetrics: vi.fn(),
  getCampaignUnopened: vi.fn(),
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
} from "@/lib/api";

describe("CampaignsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
