import React from "react";
import { Box, Button, Typography } from "@mui/material";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/login`;
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={3}
    >
      <Typography variant="h4">Email Automation</Typography>
      <Button variant="contained" size="large" onClick={handleLogin}>
        Sign in with Google
      </Button>
    </Box>
  );
}
