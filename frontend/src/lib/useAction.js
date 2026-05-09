// useAction — every backend write should run through this hook so the user
// always sees a loading toast, a resolution toast, and a disabled CTA in
// between. Pair the returned `isPending` with the calling Button.
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

/**
 * @typedef {object} ActionOptions
 * @property {string|((args: any) => string)} [loading]
 * @property {string|((data: any) => string)} [success]
 * @property {string|((err: Error) => string)} [error]
 * @property {boolean} [confetti]                Burst confetti on success.
 * @property {boolean} [silent]                  Skip toast lifecycle.
 * @property {(data: any) => void} [onSuccess]
 * @property {(err: Error) => void} [onError]
 */

function resolve(value, ...args) {
  return typeof value === "function" ? value(...args) : value;
}

function fireConfetti() {
  // Two side bursts, like a "Campaign Sent" celebration.
  const baseOpts = {
    particleCount: 90,
    spread: 70,
    startVelocity: 35,
    ticks: 200,
    scalar: 0.9,
  };
  confetti({ ...baseOpts, origin: { x: 0.2, y: 0.9 } });
  confetti({ ...baseOpts, origin: { x: 0.8, y: 0.9 } });
}

/**
 * @template Args, Result
 * @param {(args: Args) => Promise<Result>} fn
 * @param {ActionOptions} [options]
 */
export function useAction(fn, options = {}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  const optsRef = useRef(options);
  fnRef.current = fn;
  optsRef.current = options;

  const run = useCallback(async (args) => {
    const opts = optsRef.current;
    setIsPending(true);
    setError(null);

    const loadingMsg = resolve(opts.loading, args) || "Working...";
    const toastId = opts.silent ? undefined : toast.loading(loadingMsg);

    try {
      const data = await fnRef.current(args);
      if (!opts.silent) {
        const successMsg = resolve(opts.success, data) || "Done";
        toast.success(successMsg, { id: toastId });
      }
      if (opts.confetti) fireConfetti();
      opts.onSuccess?.(data);
      return data;
    } catch (err) {
      const errorMsg =
        resolve(opts.error, err) || err?.message || "Something went wrong";
      if (!opts.silent) {
        toast.error(errorMsg, { id: toastId });
      }
      setError(err);
      opts.onError?.(err);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  return { run, isPending, error };
}
