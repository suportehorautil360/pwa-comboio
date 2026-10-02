import { ImageResponse } from "next/og";

import { SIMBOLO_GESTIVA_DATA_URL } from "@/lib/design-system/simbolo-gestiva";

export const contentType = "image/png";

/**
 * Gera os ícones do PWA: 192 e 512 (purpose `any`) + um 512 `maskable` com
 * fundo full-bleed e símbolo Gestiva 360 dentro da safe-area (~50%), para a tela inicial
 * do Android não cortar o símbolo. Servidos em /icon/192, /icon/512 e /icon/maskable.
 */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
    { id: "maskable", size: { width: 512, height: 512 }, contentType },
  ];
}

export default function Icon({ id }: { id: string }) {
  const px = id === "192" ? 192 : 512;
  const maskable = id === "maskable";
  // maskable: logo menor (cabe na safe-area) e fundo sem cantos arredondados.
  const logo = Math.round(px * (maskable ? 0.5 : 0.58));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0e17",
          borderRadius: maskable ? 0 : "20%",
        }}
      >
        <img alt="" src={SIMBOLO_GESTIVA_DATA_URL} width={logo} height={logo} style={{ borderRadius: "16%" }} />
      </div>
    ),
    { width: px, height: px },
  );
}
