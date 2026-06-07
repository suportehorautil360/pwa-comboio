import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "20%",
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: "24%",
            background: "#f97316",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 180,
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
