import React from "react";
import { Routes, Route } from "react-router-dom";

import { FeedbackProvider } from "@/components/FeedbackProvider";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";
import ContactsPage from "@/pages/ContactsPage";
import ContactImport from "@/components/ContactImport";
import TemplatesPage from "@/components/TemplatesPage";
import CampaignsPage from "@/pages/CampaignsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SettingsPage from "@/components/SettingsPage";

export default function App() {
  return (
    <FeedbackProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/import" element={<ContactImport />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </FeedbackProvider>
  );
}
