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

// ── Auth ──────────────────────────────────────────────────────────────────────

export const fetchMe = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};
