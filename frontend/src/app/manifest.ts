import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Campo Academic Portal",
    short_name: "Academic Portal",
    description: "Campo Group Academic Portal",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f3a5f",
    icons: [
      {
        src: "/campo-logos/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/campo-logos/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/campo-logos/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/campo-logos/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
