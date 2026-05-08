import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OnboardingPage from "./OnboardingPage";

jest.mock("../services/api", () => ({
  fetchOnboardingStatus: jest.fn(),
}));

import { fetchOnboardingStatus } from "../services/api";

describe("OnboardingPage", () => {
  test("renders stepper and CTA", async () => {
    fetchOnboardingStatus.mockResolvedValue({
      gmail_connected: false,
      has_resume: false,
      has_template: false,
      has_contacts: false,
      has_campaign: false,
    });

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Onboarding")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Connect Gmail").length).toBeGreaterThan(0);
    expect(screen.getByText("Refresh status")).toBeInTheDocument();
  });
});

