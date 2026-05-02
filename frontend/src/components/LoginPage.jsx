import React from "react";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";

const LoginPage = () => {
  const handleLogin = () => {
    window.location.href = `${process.env.REACT_APP_API_URL}/auth/login`;
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#f5f5f5",
      }}
    >
      <Card sx={{ minWidth: 320, p: 2, textAlign: "center" }} elevation={3}>
        <CardContent>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Email Automation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to access your dashboard
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleLogin}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
