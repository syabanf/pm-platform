"use client";

import { useEffect } from "react";
import { usePrototype } from "@/lib/store";

/** PWA nicety: tell the user when the connection drops or comes back. */
export function OnlineStatus() {
  const { showToast } = usePrototype();

  useEffect(() => {
    const onOffline = () =>
      showToast(
        "You're offline — visited pages keep working from cache.",
        "warning"
      );
    const onOnline = () => showToast("Back online.", "success");
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [showToast]);

  return null;
}
