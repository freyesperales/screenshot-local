"use client";

import { useEffect, useRef, useState } from "react";
import type { Op, P, ToolKind } from "@/lib/types";
import { applyOp, replay } from "@/lib/ops";

type Props = {
  imageBitmap: ImageBitmap;
  ops: Op[];
  tool: ToolKind;
  color: string;
  thickness: number;
  blurStrength: number;
  rectFilled: boolean;
  textSize: number;
  onCommit: (op: Op) => void;
  onCropChange: (crop: { x: number; y: number; w: number; h: number } | null) => void;
  width: number;
  height: number;
};

type DragState =
  | { kind: "rect" | "arrow" | "ellipse" | "blur" | "crop"; start: P; end: P }
  | { kind: "pen"; points: P[] }
  | null;

export function CanvasEditor(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(
    null,
  );
  const [scale, setScale] = useState(1);

  // Fit the canvas display to its wrapper while keeping the canvas backing store at full resolution.
  useEffect(() => {
    function fit() {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const maxW = wrap.clientWidth - 16;
      const maxH = wrap.clientHeight - 16;
      const s = Math.min(1, maxW / props.width, maxH / props.height);
      setScale(s > 0 ? s : 1);
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [props.width, props.height]);

  // Repaint when ops or preview changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, props.width, props.height);
    ctx.drawImage(props.imageBitmap, 0, 0);
    replay(ctx, props.ops);

    // Preview for in-flight drag
    if (drag) {
      const previewOp = previewFromDrag(drag, props);
      if (previewOp) applyOp(ctx, previewOp);
      if (drag.kind === "crop") {
        ctx.save();
        ctx.strokeStyle = "rgba(15,23,42,0.8)";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1;
        const r = rectFromDrag(drag);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.restore();
      }
    }
  }, [drag, props.ops, props.imageBitmap, props.width, props.height, props]);

  function toCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>): P {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (props.width / rect.width);
    const y = (e.clientY - rect.top) * (props.height / rect.height);
    return { x, y };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (textInput) return; // let user finish typing
    const p = toCanvasCoords(e);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (props.tool === "text") {
      setTextInput({ x: p.x, y: p.y, value: "" });
      return;
    }
    if (props.tool === "pen") {
      setDrag({ kind: "pen", points: [p] });
      return;
    }
    if (
      props.tool === "arrow" ||
      props.tool === "rect" ||
      props.tool === "ellipse" ||
      props.tool === "blur" ||
      props.tool === "crop"
    ) {
      setDrag({ kind: props.tool, start: p, end: p });
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag) return;
    const p = toCanvasCoords(e);
    if (drag.kind === "pen") {
      setDrag({ kind: "pen", points: [...drag.points, p] });
    } else {
      setDrag({ ...drag, end: p });
    }
  }

  function onPointerUp() {
    if (!drag) return;

    if (drag.kind === "crop") {
      const r = rectFromDrag(drag);
      if (r.w > 4 && r.h > 4) {
        props.onCropChange(r);
      } else {
        props.onCropChange(null);
      }
      setDrag(null);
      return;
    }

    const op = previewFromDrag(drag, props);
    if (op) {
      // Skip degenerate zero-area shapes
      if (
        (op.type === "rect" || op.type === "blur") &&
        (Math.abs(op.w) < 2 || Math.abs(op.h) < 2)
      ) {
        // skip
      } else if (
        op.type === "ellipse" &&
        (Math.abs(op.rx) < 2 || Math.abs(op.ry) < 2)
      ) {
        // skip
      } else if (op.type === "pen" && op.points.length < 2) {
        // skip
      } else {
        props.onCommit(op);
      }
    }
    setDrag(null);
  }

  function commitText() {
    if (!textInput) return;
    if (textInput.value.trim().length > 0) {
      props.onCommit({
        type: "text",
        x: textInput.x,
        y: textInput.y,
        text: textInput.value,
        color: props.color,
        size: props.textSize,
      });
    }
    setTextInput(null);
  }

  const displayW = props.width * scale;
  const displayH = props.height * scale;

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-full w-full items-center justify-center overflow-auto bg-slate-100 p-4"
    >
      <div
        className="relative"
        style={{ width: displayW, height: displayH }}
      >
        <canvas
          ref={canvasRef}
          width={props.width}
          height={props.height}
          style={{
            width: displayW,
            height: displayH,
            cursor:
              props.tool === "text"
                ? "text"
                : props.tool === "select"
                  ? "default"
                  : "crosshair",
            display: "block",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            background: "#fff",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {textInput && (
          <input
            autoFocus
            value={textInput.value}
            onChange={(e) =>
              setTextInput({ ...textInput, value: e.target.value })
            }
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") setTextInput(null);
            }}
            placeholder="Type…"
            style={{
              position: "absolute",
              left: textInput.x * scale,
              top: textInput.y * scale,
              color: props.color,
              fontSize: props.textSize * scale,
              fontWeight: 600,
              background: "rgba(255,255,255,0.6)",
              border: "1px dashed #94a3b8",
              padding: "2px 4px",
              outline: "none",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          />
        )}
      </div>
    </div>
  );
}

function rectFromDrag(d: {
  kind: "rect" | "blur" | "crop" | "arrow" | "ellipse";
  start: P;
  end: P;
}) {
  const x = Math.min(d.start.x, d.end.x);
  const y = Math.min(d.start.y, d.end.y);
  const w = Math.abs(d.end.x - d.start.x);
  const h = Math.abs(d.end.y - d.start.y);
  return { x, y, w, h };
}

function previewFromDrag(
  d: NonNullable<DragState>,
  p: Pick<Props, "color" | "thickness" | "blurStrength" | "rectFilled">,
): Op | null {
  switch (d.kind) {
    case "arrow":
      return {
        type: "arrow",
        from: d.start,
        to: d.end,
        color: p.color,
        thickness: p.thickness,
      };
    case "rect": {
      const r = rectFromDrag(d);
      return {
        type: "rect",
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        color: p.color,
        thickness: p.thickness,
        filled: p.rectFilled,
      };
    }
    case "ellipse": {
      const cx = (d.start.x + d.end.x) / 2;
      const cy = (d.start.y + d.end.y) / 2;
      const rx = Math.abs(d.end.x - d.start.x) / 2;
      const ry = Math.abs(d.end.y - d.start.y) / 2;
      return {
        type: "ellipse",
        cx,
        cy,
        rx,
        ry,
        color: p.color,
        thickness: p.thickness,
      };
    }
    case "pen":
      return {
        type: "pen",
        points: d.points,
        color: p.color,
        thickness: p.thickness,
      };
    case "blur": {
      const r = rectFromDrag(d);
      return {
        type: "blur",
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        strength: p.blurStrength,
      };
    }
    case "crop":
      return null;
  }
}
