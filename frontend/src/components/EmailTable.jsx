// src/components/EmailTable.jsx
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TablePagination,
} from "@mui/material";

const EmailTable = ({ analytics, pagination, onPageChange }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "sent":
        return "#2196f3";
      case "delivered":
        return "#4caf50";
      case "failed":
        return "#f44336";
      default:
        return "#757575";
    }
  };

  const getEmailTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case "main":
        return "#9c27b0"; // Purple for main emails
      case "follow_up":
        return "#ff9800"; // Orange for follow-ups
      default:
        return "#757575";
    }
  };

  const handleChangePage = (event, newPage) => {
    if (onPageChange) {
      onPageChange(newPage + 1);
    }
  };

  // Add pagination defaults
  const paginationConfig = pagination || {
    total: analytics?.length || 0,
    page: 1,
    page_size: analytics?.length || 20,
    total_pages: 1,
  };

  return (
    <TableContainer
      component={Paper}
      style={{
        marginTop: "1rem",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        borderRadius: "8px",
      }}
    >
      <Table>
        <TableHead>
          <TableRow style={{ backgroundColor: "#f5f5f5" }}>
            <TableCell style={{ fontWeight: "bold" }}>S.No</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Recruiter</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Company</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Type</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Status</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Opened</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Open Count</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>Sent Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {analytics &&
            analytics.map((row, index) => (
              <TableRow
                key={row.email_id}
                sx={{ "&:hover": { backgroundColor: "#f5f5f5" } }}
              >
                <TableCell>{index + 1}</TableCell>
                <TableCell style={{ fontWeight: "500" }}>
                  {row.recruiter_name}
                </TableCell>
                <TableCell>{row.company}</TableCell>
                <TableCell>
                  <Chip
                    label={row.email_type}
                    size="small"
                    style={{
                      backgroundColor: getEmailTypeColor(row.email_type),
                      color: "white",
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.status}
                    size="small"
                    style={{
                      backgroundColor: getStatusColor(row.status),
                      color: "white",
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.is_opened ? "Opened" : "Not Opened"}
                    size="small"
                    style={{
                      backgroundColor: row.is_opened ? "#4caf50" : "#f44336",
                      color: "white",
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={row.open_count}
                    size="small"
                    style={{
                      backgroundColor:
                        row.open_count > 0 ? "#2196f3" : "#757575",
                      color: "white",
                    }}
                  />
                </TableCell>
                <TableCell style={{ color: "#666" }}>
                  {new Date(row.sent_date).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      {pagination && ( // Only show pagination if it's provided
        <TablePagination
          component="div"
          count={paginationConfig.total}
          page={paginationConfig.page - 1}
          rowsPerPage={paginationConfig.page_size}
          rowsPerPageOptions={[20]}
          onPageChange={handleChangePage}
        />
      )}
    </TableContainer>
  );
};

export default EmailTable;
