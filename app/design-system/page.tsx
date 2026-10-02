import type { Metadata } from "next";

import { DesignSystemShowcase } from "@/components/design-system/showcase";

export const metadata: Metadata = {
  title: "Design System — Gestiva 360",
  description:
    "Documentação completa do Design System enterprise da plataforma Gestiva 360.",
};

export default function DesignSystemPage() {
  return <DesignSystemShowcase />;
}
