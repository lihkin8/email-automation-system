import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import CampaignsPage from "./CampaignsPage";

jest.mock("../services/api", () => ({
  listCampaigns: jest.fn(),
  listTemplates: jest.fn(),
  listContactLists: jest.fn(),
  createCampaign: jest.fn(),
  getCampaignPreview: jest.fn(),
  getCampaignMetrics: jest.fn(),
  getCampaignUnopened: jest.fn(),
  sendCampaign: jest.fn(),
}));

import {
  listCampaigns,
  listTemplates,
  listContactLists,
  getCampaignPreview,
  getCampaignMetrics,
  getCampaignUnopened,
} from "../services/api";

describe("CampaignsPage", () => {
  test("renders and loads campaigns", async () => {
    listCampaigns.mockResolvedValue([{ id: 1, name: "C1" }]);
    listTemplates.mockResolvedValue([{ id: 10, name: "T1" }]);
    listContactLists.mockResolvedValue([{ id: 20, name: "L1" }]);
    getCampaignPreview.mockResolvedValue({
      sample_contact: { name: "A", email: "a@x.com", company: "X" },
      subject_rendered: "Hi",
      body_html_rendered: "<p>Body</p>",
      resolved_variables: {},
    });
    getCampaignMetrics.mockResolvedValue({
      sent_main_count: 0,
      opened_main_count: 0,
      open_rate_pct: 0,
    });
    getCampaignUnopened.mockResolvedValue([]);

    render(<CampaignsPage />);

    await waitFor(() => {
      expect(screen.getByText("Campaigns")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(listCampaigns).toHaveBeenCalled();
      expect(screen.getByText("Create campaign")).toBeInTheDocument();
      expect(screen.getByText("Unopened contacts")).toBeInTheDocument();
    });
  });
});

