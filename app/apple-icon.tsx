import { ImageResponse } from "next/og";

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
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "24%",
            background: "#f97316",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 72,
            fontWeight: 700,
            color: "#0a0e17",
          }}
        >
          H
        </div>
      </div>
    ),
    { ...size }
  );
}
