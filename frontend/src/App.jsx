// App — KAN-22
// Root component with React Router navigation and top-level AppShell.
import React from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
} from "@mui/material";
import Dashboard from "./components/Dashboard";
import ContactImport from "./components/ContactImport";
import TemplatesPage from "./components/TemplatesPage";
import SettingsPage from "./components/SettingsPage";
import LoginPage from "./components/LoginPage";
import RequireAuth from "./components/RequireAuth";
import CampaignsPage from "./pages/CampaignsPage";
import ContactsPage from "./pages/ContactsPage";
import OnboardingPage from "./pages/OnboardingPage";

const NAV_LINKS = [
  { label: "Dashboard", path: "/" },
  { label: "Contacts", path: "/contacts" },
  { label: "Templates", path: "/templates" },
  { label: "Campaigns", path: "/campaigns" },
  { label: "Onboarding", path: "/onboarding" },
  { label: "Settings", path: "/settings" },
];

function NavBar() {
  const location = useLocation();
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Email Automation
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {NAV_LINKS.map(({ label, path }) => (
            <Button
              key={path}
              component={Link}
              to={path}
              color={location.pathname === path ? "primary" : "inherit"}
              variant={location.pathname === path ? "outlined" : "text"}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function AppShell() {
  return (
    <>
      <NavBar />
      <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/import" element={<ContactImport />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Container>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  );
}
