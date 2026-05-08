// src/services/api.js
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true,
});

export const fetchAnalytics = async (page = 1, pageSize = 20) => {
  const response = await api.get("/analytics", {
    params: { page, page_size: pageSize },
  });
  return response.data;
};

export const fetchUnopenedEmails = async (days = 5) => {
  const response = await api.get(`/unopened-emails?days=${days}`);
  return response.data;
};

export const fetchCompanyAnalytics = async () => {
  const response = await api.get("/company-analytics");
  return response.data;
};

export const fetchCompanies = async () => {
  const response = await api.get("/companies");
  return response.data;
};

export const fetchCompanyDetails = async (companyName) => {
  const response = await api.get(`/company/${encodeURIComponent(companyName)}`);
  return response.data;
};

export const fetchCompanyEmails = async (companyName) => {
  const response = await api.get(`/company/${encodeURIComponent(companyName)}/emails`);
  return response.data;
};

// ── Contacts ─────────────────────────────────────────────────────────────────

export const uploadContacts = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/contacts/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const confirmImport = async ({ listName, source, contacts }) => {
  const response = await api.post("/contacts", {
    list_name: listName,
    source,
    contacts,
  });
  return response.data;
};

export const listContactLists = async () => {
  const r = await api.get("/contacts/lists");
  return r.data;
};

// ── Templates ─────────────────────────────────────────────────────────────────

export const listTemplates = async () => {
  const r = await api.get("/templates");
  return r.data;
};

export const createTemplate = async (data) => {
  const r = await api.post("/templates", data);
  return r.data;
};

export const updateTemplate = async (id, data) => {
  const r = await api.put(`/templates/${id}`, data);
  return r.data;
};

export const deleteTemplate = async (id) => {
  await api.delete(`/templates/${id}`);
};

// ── Campaigns (KAN-26/28/29) ──────────────────────────────────────────────────

export const listCampaigns = async () => {
  const r = await api.get("/campaigns");
  return r.data;
};

export const getCampaignPreview = async (campaignId) => {
  const r = await api.get(`/campaigns/${campaignId}/preview`);
  return r.data;
};

export const getCampaignMetrics = async (campaignId) => {
  const r = await api.get(`/campaigns/${campaignId}/metrics`);
  return r.data;
};

export const getCampaignUnopened = async (campaignId, params = {}) => {
  const r = await api.get(`/campaigns/${campaignId}/unopened`, { params });
  return r.data;
};

export const getCampaignContactOpens = async (campaignId, recruiterId) => {
  const r = await api.get(`/campaigns/${campaignId}/contacts/${recruiterId}/opens`);
  return r.data;
};

export const sendCampaign = async (campaignId, delaySeconds = 2.0) => {
  const r = await api.post(`/campaigns/${campaignId}/send`, null, {
    params: { delay_seconds: delaySeconds },
  });
  return r.data;
};

export const createCampaign = async (data) => {
  const r = await api.post("/campaigns", data);
  return r.data;
};

export const updateCampaign = async (id, data) => {
  const r = await api.put(`/campaigns/${id}`, data);
  return r.data;
};

export const deleteCampaign = async (id) => {
  await api.delete(`/campaigns/${id}`);
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const fetchMe = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

// ── Settings ──────────────────────────────────────────────────────────────────

export const fetchSettings = async () => {
  const response = await api.get("/users/settings");
  return response.data;
};

export const updateSettings = async (data) => {
  const response = await api.patch("/users/settings", data);
  return response.data;
};

export const uploadResume = async (file, onProgress) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post("/users/resume", formData, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
  return response.data;
};

export const deleteResume = async () => {
  await api.delete("/users/resume");
};

// ── Onboarding ────────────────────────────────────────────────────────────────

export const fetchOnboardingStatus = async () => {
  const r = await api.get("/onboarding/status");
  return r.data;
};
