import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
} from "@mui/material";

const CompanyAnalytics = ({ analytics }) => {
  return (
    <TableContainer
      component={Paper}
      style={{
        marginTop: "2rem",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
      }}
    >
      <Typography variant="h6" style={{ padding: "1rem" }}>
        Company-wise Email Analytics
      </Typography>
      <Table>
        <TableHead>
          <TableRow style={{ backgroundColor: "#f5f5f5" }}>
            <TableCell style={{ fontWeight: "bold" }}>Company</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Total Emails</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Opened</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Open Rate</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Follow-ups</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Total Opens</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>
              Last Interaction
            </TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Statuses</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {analytics?.map((row) => (
            <TableRow
              key={row.company}
              sx={{ "&:hover": { backgroundColor: "#f5f5f5" } }}
            >
              <TableCell>{row.company}</TableCell>
              <TableCell>{row.total_emails}</TableCell>
              <TableCell>{row.opened_emails}</TableCell>
              <TableCell>
                {((row.opened_emails / row.total_emails) * 100).toFixed(1)}%
              </TableCell>
              <TableCell>{row.follow_ups}</TableCell>
              <TableCell>{row.total_opens}</TableCell>
              <TableCell>
                {row.last_interaction
                  ? new Date(row.last_interaction).toLocaleString()
                  : "N/A"}
              </TableCell>
              <TableCell>
                {row.email_statuses.split(", ").map((status) => (
                  <Chip
                    key={status}
                    label={status}
                    size="small"
                    style={{
                      margin: "2px",
                      backgroundColor:
                        status === "SENT" ? "#4caf50" : "#f44336",
                      color: "white",
                    }}
                  />
                ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default CompanyAnalytics;
