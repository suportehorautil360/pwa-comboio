import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HORA ÚTIL 360",
    short_name: "Hora Útil",
    description:
      "Plataforma SaaS de gestão operacional de frotas e equipamentos.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e17",
    theme_color: "#f97316",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
