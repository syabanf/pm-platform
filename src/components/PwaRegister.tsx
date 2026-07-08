"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // registration is best-effort in the prototype
      });
    }
  }, []);
  return null;
}
