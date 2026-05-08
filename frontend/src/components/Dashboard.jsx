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
  getCampaignMetrics,
  getCampaignUnopened,
  listCampaigns,
} from "../services/api";
import EmailTable from "./EmailTable";
import CompanyAnalytics from "./CompanyAnalytics";

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [viewMode, setViewMode] = useState("company"); // 'company' | 'campaign'
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [companyDetails, setCompanyDetails] = useState(null);
  const [companyAnalytics, setCompanyAnalytics] = useState(null);
  const [campaignMetrics, setCampaignMetrics] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch initial data (companies list and analytics)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [companiesData, analyticsData, campaignsData] = await Promise.all([
          fetchCompanies(),
          fetchCompanyAnalytics(),
          listCampaigns(),
        ]);
        setCompanies(companiesData.companies);
        setCompanyAnalytics(analyticsData.company_analytics);
        setCampaigns(campaignsData);
        setSelectedCampaignId(campaignsData[0]?.id ?? "");
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
        if (viewMode === "campaign") {
          if (!selectedCampaignId) {
            setAnalytics([]);
            setCampaignMetrics(null);
            setPagination(null);
            setCompanyDetails(null);
            return;
          }
          const [metrics, unopened] = await Promise.all([
            getCampaignMetrics(selectedCampaignId),
            getCampaignUnopened(selectedCampaignId),
          ]);
          setCampaignMetrics(metrics);
          setAnalytics(
            unopened.map((r) => ({
              email_id: r.email_id,
              recruiter_name: r.recruiter_name,
              company: r.company,
              email_type: "MAIN",
              status: "SENT",
              is_opened: false,
              open_count: 0,
              sent_date: r.sent_date,
            }))
          );
          setPagination(null);
          setCompanyDetails(null);
        } else if (selectedCompany === "all") {
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
            viewMode === "campaign"
              ? "campaign data"
              : selectedCompany === "all"
                ? "analytics"
                : selectedCompany
          } data`
        );
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadCompanyData();
  }, [viewMode, selectedCompany, selectedCampaignId, currentPage]);

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

  const handleViewModeChange = (event) => {
    setViewMode(event.target.value);
    setCurrentPage(1);
    setError(null);
  };

  const handleCampaignChange = (event) => {
    setSelectedCampaignId(event.target.value);
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
        {viewMode === "campaign"
          ? "Campaign Tracking Dashboard"
          : "Email Analytics Dashboard"}
      </Typography>

      {/* Mode + selector */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <FormControl sx={{ minWidth: 220 }}>
          <InputLabel id="mode-select-label">View</InputLabel>
          <Select
            labelId="mode-select-label"
            value={viewMode}
            label="View"
            onChange={handleViewModeChange}
          >
            <MenuItem value="company">By company</MenuItem>
            <MenuItem value="campaign">By campaign</MenuItem>
          </Select>
        </FormControl>

        {viewMode === "company" ? (
          <FormControl sx={{ minWidth: 260 }}>
            <InputLabel id="company-select-label">Company</InputLabel>
            <Select
              labelId="company-select-label"
              id="company-select"
              value={selectedCompany}
              label="Company"
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
        ) : (
          <FormControl sx={{ minWidth: 320 }}>
            <InputLabel id="campaign-select-label">Campaign</InputLabel>
            <Select
              labelId="campaign-select-label"
              value={selectedCampaignId}
              label="Campaign"
              onChange={handleCampaignChange}
            >
              {campaigns.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
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
            <Typography variant="h6">
              {viewMode === "campaign" ? "Opened (main)" : "Opened Emails"}
            </Typography>
            <Typography variant="h4" color="success.main">
              {viewMode === "campaign"
                ? `${campaignMetrics?.opened_main_count ?? 0} (${Math.round(
                    campaignMetrics?.open_rate_pct ?? 0
                  )}%)`
                : `${stats.openedEmails} (${Math.round(
                    (stats.openedEmails / stats.totalEmails) * 100
                  )}%)`}
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
            <Typography variant="h6">
              {viewMode === "campaign" ? "Unopened" : "Companies"}
            </Typography>
            <Typography variant="h4" color="warning.main">
              {viewMode === "campaign" ? stats.totalEmails : stats.uniqueCompanies}
            </Typography>
          </Paper>
        </Grid2>
      </Grid2>

      {/* Company Details */}
      {viewMode === "company" && companyDetails && (
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
      {viewMode === "company" && selectedCompany === "all" && (
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
          {viewMode === "campaign"
            ? "Unopened contacts (main)"
            : selectedCompany === "all"
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
