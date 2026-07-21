import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WIT Sprint OS",
    short_name: "Sprint OS",
    description:
      "AI-native Agile delivery platform for multi-client consulting teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#000000",
    // Deliberately unlocked: a phone is used portrait, but a tablet is just as
    // often landscape — and the two-pane layouts at md are designed for it.
    orientation: "any",
    shortcuts: [
      {
        name: "Needs Attention",
        url: "/#triage",
        description: "Blocked items, overdue actions, open decisions",
      },
      {
        name: "Report Queue",
        url: "/reports",
        description: "Reports due across all clients",
      },
      {
        name: "New MoM",
        url: "/documents/mom",
        description: "Draft minutes of meeting from bullets",
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
