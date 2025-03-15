import React from "react";
import {
  Paper,
  Typography,
  Grid2,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";

const CompanyDetail = ({ companyDetails }) => {
  if (!companyDetails) return null;

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        {companyDetails.company} - Detailed Analytics
      </Typography>
      <Grid2 container spacing={3}>
        <Grid2 item xs={12} md={6}>
          <Box>
            <Typography variant="subtitle1" color="text.secondary">
              Email Statistics
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Total Emails Sent"
                  secondary={companyDetails.total_emails}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Opened Emails"
                  secondary={`${companyDetails.opened_emails} (${(
                    (companyDetails.opened_emails /
                      companyDetails.total_emails) *
                    100
                  ).toFixed(1)}%)`}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Follow-ups Sent"
                  secondary={companyDetails.follow_ups}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Total Opens"
                  secondary={companyDetails.total_opens}
                />
              </ListItem>
            </List>
          </Box>
        </Grid2>
        <Grid2 item xs={12} md={6}>
          <Box>
            <Typography variant="subtitle1" color="text.secondary">
              Recruiters
            </Typography>
            <List dense>
              {companyDetails.recruiters.map((recruiter, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={recruiter.recruiter_name}
                    secondary={recruiter.recruiter_email}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </Grid2>
        <Grid2 item xs={12}>
          <Typography variant="subtitle1" color="text.secondary">
            Email Statuses
          </Typography>
          <Box sx={{ mt: 1 }}>
            {companyDetails.email_statuses.split(", ").map((status) => (
              <Chip
                key={status}
                label={status}
                sx={{ mr: 1, mb: 1 }}
                color={status === "SENT" ? "success" : "default"}
              />
            ))}
          </Box>
        </Grid2>
      </Grid2>
    </Paper>
  );
};

export default CompanyDetail;
