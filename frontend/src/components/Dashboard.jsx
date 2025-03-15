// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import {
  Container,
  Grid2,
  Paper,
  Typography,
  CircularProgress,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import {
  fetchAnalytics,
  fetchCompanyAnalytics,
  fetchCompanies,
  fetchCompanyDetails,
  fetchCompanyEmails,
} from "../services/api";
import EmailTable from "./EmailTable";
import CompanyAnalytics from "./CompanyAnalytics";

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [companyDetails, setCompanyDetails] = useState(null);
  const [companyAnalytics, setCompanyAnalytics] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch initial data (companies list and analytics)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [companiesData, analyticsData] = await Promise.all([
          fetchCompanies(),
          fetchCompanyAnalytics(),
        ]);
        setCompanies(companiesData.companies);
        setCompanyAnalytics(analyticsData.company_analytics);
      } catch (err) {
        setError("Failed to load initial data");
        console.error("Error:", err);
      }
    };
    fetchInitialData();
  }, []);

  // Handle company data loading based on selection
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        setLoading(true);
        if (selectedCompany === "all") {
          const data = await fetchAnalytics(currentPage);
          setAnalytics(data.analytics);
          setPagination(data.pagination);
          setCompanyDetails(null);
        } else {
          const [details, emails] = await Promise.all([
            fetchCompanyDetails(selectedCompany),
            fetchCompanyEmails(selectedCompany),
          ]);
          setCompanyDetails(details.company_details);
          setAnalytics(emails.company_emails);
          setPagination(null);
        }
      } catch (err) {
        setError(
          `Failed to load ${
            selectedCompany === "all" ? "analytics" : selectedCompany
          } data`
        );
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadCompanyData();
  }, [selectedCompany, currentPage]);

  const calculateStats = () => {
    if (!analytics) return {};

    return {
      totalEmails: analytics.length,
      openedEmails: analytics.filter((email) => email.is_opened).length,
      totalOpens: analytics.reduce((sum, email) => sum + email.open_count, 0),
      uniqueCompanies:
        selectedCompany === "all"
          ? new Set(analytics.map((email) => email.company)).size
          : 1,
    };
  };

  const handleCompanyChange = (event) => {
    setSelectedCompany(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  if (loading) {
    return (
      <Container style={{ textAlign: "center", paddingTop: "2rem" }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container style={{ paddingTop: "2rem" }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const stats = calculateStats();

  return (
    <Container maxWidth="lg" style={{ marginTop: "2rem" }}>
      <Typography variant="h4" gutterBottom>
        Email Analytics Dashboard
      </Typography>

      {/* Company Selector */}
      <Box sx={{ minWidth: 200, mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel id="company-select-label">Select Company</InputLabel>
          <Select
            labelId="company-select-label"
            id="company-select"
            value={selectedCompany}
            label="Select Company"
            onChange={handleCompanyChange}
          >
            <MenuItem value="all">All Companies</MenuItem>
            {companies.map((company) => (
              <MenuItem key={company} value={company}>
                {company}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Summary Statistics */}
      <Grid2 container spacing={3} style={{ marginBottom: "2rem" }}>
        <Grid2 item xs={12} sm={6} md={3}>
          <Paper
            elevation={3}
            style={{
              padding: "1.5rem",
              textAlign: "center",
              backgroundColor: "#f5f5f5",
            }}
          >
            <Typography variant="h6">Total Emails</Typography>
            <Typography variant="h4" color="primary">
              {stats.totalEmails}
            </Typography>
          </Paper>
        </Grid2>
        <Grid2 item xs={12} sm={6} md={3}>
          <Paper
            elevation={3}
            style={{
              padding: "1.5rem",
              textAlign: "center",
              backgroundColor: "#e8f5e9",
            }}
          >
            <Typography variant="h6">Opened Emails</Typography>
            <Typography variant="h4" color="success.main">
              {stats.openedEmails} (
              {Math.round((stats.openedEmails / stats.totalEmails) * 100)}%)
            </Typography>
          </Paper>
        </Grid2>
        <Grid2 item xs={12} sm={6} md={3}>
          <Paper
            elevation={3}
            style={{
              padding: "1.5rem",
              textAlign: "center",
              backgroundColor: "#e3f2fd",
            }}
          >
            <Typography variant="h6">Total Opens</Typography>
            <Typography variant="h4" color="info.main">
              {stats.totalOpens}
            </Typography>
          </Paper>
        </Grid2>
        <Grid2 item xs={12} sm={6} md={3}>
          <Paper
            elevation={3}
            style={{
              padding: "1.5rem",
              textAlign: "center",
              backgroundColor: "#fff3e0",
            }}
          >
            <Typography variant="h6">Companies</Typography>
            <Typography variant="h4" color="warning.main">
              {stats.uniqueCompanies}
            </Typography>
          </Paper>
        </Grid2>
      </Grid2>

      {/* Company Details */}
      {companyDetails && (
        <Box mb={3}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              {selectedCompany} Details
            </Typography>
            <Grid2 container spacing={2}>
              <Grid2 item xs={12} md={6}>
                <Typography variant="body1">
                  Total Emails: {companyDetails.total_emails}
                </Typography>
                <Typography variant="body1">
                  Opened Emails: {companyDetails.opened_emails}
                </Typography>
                <Typography variant="body1">
                  Follow-ups: {companyDetails.follow_ups}
                </Typography>
              </Grid2>
              <Grid2 item xs={12} md={6}>
                <Typography variant="body1">
                  Total Opens: {companyDetails.total_opens}
                </Typography>
                <Typography variant="body1">
                  Last Interaction:{" "}
                  {companyDetails.last_interaction
                    ? new Date(companyDetails.last_interaction).toLocaleString()
                    : "N/A"}
                </Typography>
              </Grid2>
            </Grid2>
          </Paper>
        </Box>
      )}

      {/* Company Analytics Table (shown only for 'all' view) */}
      {selectedCompany === "all" && (
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Company-wise Analytics
          </Typography>
          <CompanyAnalytics analytics={companyAnalytics} />
        </Box>
      )}

      {/* Detailed Email Table */}
      <Box>
        <Typography variant="h5" gutterBottom>
          {selectedCompany === "all"
            ? "All Email Logs"
            : `${selectedCompany} Email Logs`}
        </Typography>
        <EmailTable
          analytics={analytics}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      </Box>
    </Container>
  );
};

export default Dashboard;
