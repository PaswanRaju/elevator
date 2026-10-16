import { ImageResponse } from "next/og";
export const alt = "THE ELEVATOR — Some doors lead somewhere else.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(115deg, #080d14, #272b2c)",
        color: "#e6dfcc",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        border: "1px solid #4c493f",
      }}
    >
      <div style={{ fontSize: 18, letterSpacing: 10, color: "#b5a273" }}>
        AN EXPERIENCE ABOVE THE ORDINARY
      </div>
      <div style={{ fontSize: 108, letterSpacing: -5, marginTop: 25 }}>
        THE ELEVATOR
      </div>
      <div style={{ fontSize: 23, marginTop: 30, color: "#aaa99c" }}>
        Some doors lead somewhere else.
      </div>
      <div style={{ fontSize: 25, color: "#c4ac74", marginTop: 50 }}>
        XIII &nbsp; / &nbsp; STEP INSIDE
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
