import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";

/**
 * useNavigationLock prevents navigation when isDirty is true,
 * and provides a 'shouldShake' signal to trigger UI feedback.
 * 
 * @param isDirty Whether there are unsaved changes
 * @param durationMs Duration of the shake/flash effect in ms (default 600ms)
 * @returns boolean shouldShake - true when navigation was attempted and blocked
 */
export const useNavigationLock = (isDirty: boolean, durationMs = 600) => {
  const [shouldShake, setShouldShake] = useState(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  const blockerRef = useRef(blocker);
  blockerRef.current = blocker;

  // Reset shake when dirty state is cleared (safe fallback)
  useEffect(() => {
    if (!isDirty) {
      setShouldShake(false);
    }
  }, [isDirty]);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setShouldShake(true);
      const timer = setTimeout(() => {
        setShouldShake(false);
        // Reset blocker so user can try again (triggering animation again)
        blockerRef.current?.reset?.();
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [blocker.state, durationMs]);

  return shouldShake;
};
