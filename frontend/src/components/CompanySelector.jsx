import React from "react";
import { FormControl, InputLabel, MenuItem, Select, Box } from "@mui/material";

const CompanySelector = ({ companies, selectedCompany, onCompanyChange }) => {
  return (
    <Box sx={{ minWidth: 200, mb: 3 }}>
      <FormControl fullWidth>
        <InputLabel id="company-select-label">Select Company</InputLabel>
        <Select
          labelId="company-select-label"
          id="company-select"
          value={selectedCompany || ""}
          label="Select Company"
          onChange={(e) => onCompanyChange(e.target.value)}
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
  );
};

export default CompanySelector;
