import * as React from "react";
import { Toaster, toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { onColdStart } from "@/lib/apiClient";
import { fetchHealth } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Wraps the app with:
 *  - Sonner Toaster (rich colors, top-right, theme-aware)
 *  - ColdStartBanner that appears when any in-flight request blows past the
 *    cold-start threshold or when a one-shot health probe shows the server
 *    is asleep on first load.
 *  - Radix TooltipProvider so app-wide tooltips share a single delay context.
 */
export function FeedbackProvider({ children }) {
  const { resolvedTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={150}>
      {children}
      <Toaster
        theme={resolvedTheme}
        position="top-right"
        offset={64}
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "border border-border bg-card/95 text-card-foreground shadow-xl backdrop-blur",
            description: "text-muted-foreground",
          },
        }}
      />
      <ColdStartBanner />
    </TooltipProvider>
  );
}

function ColdStartBanner() {
  const [active, setActive] = React.useState(0);
  const [bootProbeWaking, setBootProbeWaking] = React.useState(false);

  React.useEffect(() => onColdStart(setActive), []);

  // One-shot boot probe: race a /health request against the cold-start timer.
  // If we mark cold-start before the probe finishes, surface the banner.
  React.useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) setBootProbeWaking(true);
    }, 2500);
    fetchHealth()
      .catch(() => null)
      .finally(() => {
        cancelled = true;
        clearTimeout(t);
        setBootProbeWaking(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const visible = active > 0 || bootProbeWaking;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Server waking up — this can take ~30s on the free tier...</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export { toast };
