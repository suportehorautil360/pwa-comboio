import { ImageResponse } from "next/og";

import { SIMBOLO_GESTIVA_DATA_URL } from "@/lib/design-system/simbolo-gestiva";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        {/* Símbolo Gestiva 360 do kit da marca. */}
        <img alt="" src={SIMBOLO_GESTIVA_DATA_URL} width={120} height={120} style={{ borderRadius: "16%" }} />
      </div>
    ),
    { ...size }
  );
}
