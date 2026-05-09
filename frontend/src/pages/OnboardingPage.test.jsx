import React from "react";
import { describe, test, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import OnboardingPage from "./OnboardingPage";

vi.mock("@/lib/api", () => ({
  fetchOnboardingStatus: vi.fn(),
}));

import { fetchOnboardingStatus } from "@/lib/api";

describe("OnboardingPage", () => {
  test("renders steps and CTAs once status loads", async () => {
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

    expect(screen.getAllByText(/Connect Gmail/).length).toBeGreaterThan(0);
    expect(screen.getByText("Refresh status")).toBeInTheDocument();
  });
});
