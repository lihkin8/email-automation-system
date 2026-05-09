// API helpers — thin wrappers over apiClient. Names match the legacy
// services/api.js exports so call sites stay stable.
import { ApiError, apiClient } from "@/lib/apiClient";

// ── Analytics ────────────────────────────────────────────────────────────────
export const fetchAnalytics = (page = 1, pageSize = 20) =>
  apiClient.get("/analytics", { params: { page, page_size: pageSize } });

export const fetchUnopenedEmails = (days = 5) =>
  apiClient.get("/unopened-emails", { params: { days } });

export const fetchCompanyAnalytics = () => apiClient.get("/company-analytics");
export const fetchCompanies = () => apiClient.get("/companies");
export const fetchCompanyDetails = (companyName) =>
  apiClient.get(`/company/${encodeURIComponent(companyName)}`);
export const fetchCompanyEmails = (companyName) =>
  apiClient.get(`/company/${encodeURIComponent(companyName)}/emails`);

// ── Contacts ─────────────────────────────────────────────────────────────────
export const uploadContacts = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/contacts/upload", formData, { onUploadProgress });
};

export const confirmImport = ({ listName, source, contacts }) =>
  apiClient.post("/contacts", { list_name: listName, source, contacts });

export const listContactLists = () => apiClient.get("/contacts/lists");
export const getContactList = (id) => apiClient.get(`/contacts/lists/${id}`);
export const updateContactList = (id, data) =>
  apiClient.put(`/contacts/lists/${id}`, data);
export const deleteContactList = (id) =>
  apiClient.delete(`/contacts/lists/${id}`);

// ── Templates ────────────────────────────────────────────────────────────────
export const listTemplates = () => apiClient.get("/templates");
export const createTemplate = (data) => apiClient.post("/templates", data);
export const updateTemplate = (id, data) =>
  apiClient.put(`/templates/${id}`, data);
export const deleteTemplate = (id) => apiClient.delete(`/templates/${id}`);

// ── Campaigns ────────────────────────────────────────────────────────────────
export const listCampaigns = () => apiClient.get("/campaigns");
export const getCampaignPreview = (id) =>
  apiClient.get(`/campaigns/${id}/preview`);
export const getCampaignMetrics = (id) =>
  apiClient.get(`/campaigns/${id}/metrics`);
export const getCampaignUnopened = (id, params = {}) =>
  apiClient.get(`/campaigns/${id}/unopened`, { params });
export const getCampaignContactOpens = (id, recruiterId) =>
  apiClient.get(`/campaigns/${id}/contacts/${recruiterId}/opens`);
export const getSendProgress = async (id) => {
  try {
    return await apiClient.get(`/campaigns/${id}/send-progress`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
};
export const sendCampaign = (id, delaySeconds = 2.0) =>
  apiClient.post(`/campaigns/${id}/send`, null, {
    params: { delay_seconds: delaySeconds },
  });
export const runCampaignFollowUps = (id, delaySeconds = 2.0) =>
  apiClient.post(`/campaigns/${id}/follow-ups/run`, null, {
    params: { delay_seconds: delaySeconds },
  });
export const createCampaign = (data) => apiClient.post("/campaigns", data);
export const updateCampaign = (id, data) =>
  apiClient.put(`/campaigns/${id}`, data);
export const deleteCampaign = (id) => apiClient.delete(`/campaigns/${id}`);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const fetchMe = () => apiClient.get("/auth/me");
export const logout = () => apiClient.post("/auth/logout", null);

// ── Settings ────────────────────────────────────────────────────────────────
export const fetchSettings = () => apiClient.get("/users/settings");
export const updateSettings = (data) => apiClient.patch("/users/settings", data);
export const uploadResume = (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/users/resume", formData, { onUploadProgress });
};
export const deleteResume = () => apiClient.delete("/users/resume");

// ── Onboarding ──────────────────────────────────────────────────────────────
export const fetchOnboardingStatus = () => apiClient.get("/onboarding/status");

// ── Health (used by ColdStartBanner) ────────────────────────────────────────
export const fetchHealth = () => apiClient.get("/health");
