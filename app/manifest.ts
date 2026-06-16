import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "HORA ÚTIL 360",
    short_name: "Hora Útil",
    description:
      "Plataforma SaaS de gestão operacional de frotas e equipamentos.",
    start_url: "/",
    scope: "/",
    lang: "pt-BR",
    dir: "ltr",
    display: "standalone",
    background_color: "#0a0e17",
    theme_color: "#f97316",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
