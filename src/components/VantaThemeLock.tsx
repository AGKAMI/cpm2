"use client";

import { useEffect } from "react";

/**
 * VANTA Garage runs its own fixed identity — gold metallic, black, dark steel.
 * Fleet Ledger themes (data-theme/data-palette from localStorage) must never
 * bleed into store pages. This lock forces the VANTA palette for as long as
 * any /store route is mounted, and neutralises any component that re-applies
 * the global theme while the store is open.
 */
export function VantaThemeLock() {
  useEffect(() => {
    const root = document.documentElement;
    const force = () => {
      if (root.getAttribute("data-theme") !== "night") {
        root.setAttribute("data-theme", "night");
      }
      if (root.getAttribute("data-palette") !== "vanta") {
        root.setAttribute("data-palette", "vanta");
      }
    };
    force();
    const observer = new MutationObserver(force);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-palette"],
    });
    return () => observer.disconnect();
  }, []);

  return null;
}
