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
