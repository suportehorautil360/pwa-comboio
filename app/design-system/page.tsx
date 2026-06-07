import type { Metadata } from "next";

import { DesignSystemShowcase } from "@/components/design-system/showcase";

export const metadata: Metadata = {
  title: "Design System — HORA ÚTIL 360",
  description:
    "Documentação completa do Design System enterprise da plataforma HORA ÚTIL 360.",
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
