import React from "react";

interface Box {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  boxes: Box[];
  color?: string; // replaces theme.goldDeep
  bg?: string;    // replaces theme.black
}

export default function BoundingBoxOverlay({
  boxes,
  color = "#FFD700",
  bg = "#000000",
}: Props) {
  return (
    <>
      {boxes.map((box, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
            border: `2px solid ${color}`,
            borderRadius: 6,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              color,
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: `${bg}AA`,
              padding: "2px 4px",
              borderRadius: 4,
            }}
          >
            {box.label} ({Math.round(box.confidence * 100)}%)
          </span>
        </div>
      ))}
    </>
  );
}
