// src/services/api.js
import axios from "axios";

//const API_BASE_URL = "http://localhost:8000";
const API_BASE_URL = process.env.REACT_APP_API_URL;

export const fetchAnalytics = async (page = 1, pageSize = 20) => {
  const response = await axios.get(`${API_BASE_URL}/analytics`, {
    params: { page, page_size: pageSize },
  });
  return response.data;
};

export const fetchUnopenedEmails = async (days = 5) => {
  const response = await axios.get(
    `${API_BASE_URL}/unopened-emails?days=${days}`
  );
  return response.data;
};

export const fetchCompanyAnalytics = async () => {
  const response = await axios.get(`${API_BASE_URL}/company-analytics`);
  return response.data;
};

export const fetchCompanies = async () => {
  const response = await axios.get(`${API_BASE_URL}/companies`);
  return response.data;
};

export const fetchCompanyDetails = async (companyName) => {
  const response = await axios.get(
    `${API_BASE_URL}/company/${encodeURIComponent(companyName)}`
  );
  return response.data;
};

export const fetchCompanyEmails = async (companyName) => {
  const response = await axios.get(
    `${API_BASE_URL}/company/${encodeURIComponent(companyName)}/emails`
  );
  return response.data;
};

// ── Contacts ─────────────────────────────────────────────────────────────────

export const uploadContacts = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axios.post(`${API_BASE_URL}/contacts/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    withCredentials: true,
  });
  return response.data; // { contacts: [...], errors: [...] }
};

export const confirmImport = async ({ listName, source, contacts }) => {
  const response = await axios.post(
    `${API_BASE_URL}/contacts`,
    { list_name: listName, source, contacts },
    { withCredentials: true }
  );
  return response.data; // { contact_list_id, imported_count }
};

// ── Templates ─────────────────────────────────────────────────────────────────

export const listTemplates = async () => {
  const r = await axios.get(`${API_BASE_URL}/templates`, { withCredentials: true });
  return r.data;
};

export const createTemplate = async (data) => {
  const r = await axios.post(`${API_BASE_URL}/templates`, data, { withCredentials: true });
  return r.data;
};

export const updateTemplate = async (id, data) => {
  const r = await axios.put(`${API_BASE_URL}/templates/${id}`, data, { withCredentials: true });
  return r.data;
};

export const deleteTemplate = async (id) => {
  await axios.delete(`${API_BASE_URL}/templates/${id}`, { withCredentials: true });
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const fetchMe = async () => {
  const response = await axios.get(`${API_BASE_URL}/auth/me`, {
    withCredentials: true,
  });
  return response.data;
};
