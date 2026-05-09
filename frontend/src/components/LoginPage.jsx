import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = `${API_URL}/auth/login`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <BackgroundGlow />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        <Card className="border-border/80 bg-card/80 backdrop-blur">
          <CardHeader className="items-center space-y-3 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-secondary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Email Automation</CardTitle>
              <CardDescription className="mt-1">
                Sign in to send, track, and follow up on every email.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLogin} className="w-full" size="lg">
              <GoogleMark className="h-4 w-4" />
              Continue with Google
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              We use your Google account to send campaign emails through Gmail.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
    </div>
  );
}

function GoogleMark(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        d="M21.35 11.1H12v3.2h5.35c-.23 1.45-1.65 4.25-5.35 4.25-3.22 0-5.85-2.66-5.85-5.95s2.63-5.95 5.85-5.95c1.83 0 3.06.78 3.77 1.45l2.57-2.49C16.66 3.97 14.55 3 12 3 6.98 3 2.93 7.05 2.93 12.07S6.98 21.14 12 21.14c6.93 0 9.07-4.86 9.07-7.36 0-.5-.05-.97-.12-1.43z"
        fill="currentColor"
      />
    </svg>
  );
}
