import type { HistoryState, Op, P } from "./types";
import { boxBlurRegion } from "./blur";

export function emptyHistory(): HistoryState {
  return { ops: [], redo: [] };
}

/** Push a new operation; clears the redo stack. Returns a new state (immutable). */
export function pushOp(state: HistoryState, op: Op): HistoryState {
  return { ops: [...state.ops, op], redo: [] };
}

/** Undo last op. No-op if empty. */
export function undo(state: HistoryState): HistoryState {
  if (state.ops.length === 0) return state;
  const ops = state.ops.slice(0, -1);
  const last = state.ops[state.ops.length - 1]!;
  return { ops, redo: [...state.redo, last] };
}

/** Redo last undone op. No-op if redo stack empty. */
export function redo(state: HistoryState): HistoryState {
  if (state.redo.length === 0) return state;
  const last = state.redo[state.redo.length - 1]!;
  const redoStack = state.redo.slice(0, -1);
  return { ops: [...state.ops, last], redo: redoStack };
}

/** Replay every op onto a 2D context. The context should already have the base image painted. */
export function replay(ctx: CanvasRenderingContext2D, ops: Op[]): void {
  for (const op of ops) {
    applyOp(ctx, op);
  }
}

export function applyOp(ctx: CanvasRenderingContext2D, op: Op): void {
  ctx.save();
  switch (op.type) {
    case "arrow":
      drawArrow(ctx, op.from, op.to, op.color, op.thickness);
      break;
    case "rect":
      ctx.lineWidth = op.thickness;
      ctx.strokeStyle = op.color;
      if (op.filled) {
        ctx.fillStyle = op.color;
        ctx.fillRect(op.x, op.y, op.w, op.h);
      } else {
        ctx.strokeRect(op.x, op.y, op.w, op.h);
      }
      break;
    case "ellipse":
      ctx.lineWidth = op.thickness;
      ctx.strokeStyle = op.color;
      ctx.beginPath();
      ctx.ellipse(op.cx, op.cy, Math.abs(op.rx), Math.abs(op.ry), 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "pen":
      if (op.points.length === 0) break;
      ctx.lineWidth = op.thickness;
      ctx.strokeStyle = op.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(op.points[0]!.x, op.points[0]!.y);
      for (let i = 1; i < op.points.length; i++) {
        ctx.lineTo(op.points[i]!.x, op.points[i]!.y);
      }
      ctx.stroke();
      break;
    case "text":
      ctx.fillStyle = op.color;
      ctx.font = `600 ${op.size}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(op.text, op.x, op.y);
      break;
    case "blur": {
      const x = Math.max(0, Math.floor(op.x));
      const y = Math.max(0, Math.floor(op.y));
      const w = Math.max(1, Math.floor(op.w));
      const h = Math.max(1, Math.floor(op.h));
      try {
        const data = ctx.getImageData(x, y, w, h);
        const blurred = boxBlurRegion(data, op.strength);
        ctx.putImageData(blurred, x, y);
      } catch {
        // getImageData can fail if dimensions are off-canvas in some engines.
      }
      break;
    }
  }
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: P,
  to: P,
  color: string,
  thickness: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(10, thickness * 3.5);
  const headAngle = Math.PI / 6;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // shaft (stop short of the head so the tip looks clean)
  const shaftEndX = to.x - Math.cos(angle) * headLen * 0.6;
  const shaftEndY = to.y - Math.sin(angle) * headLen * 0.6;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(shaftEndX, shaftEndY);
  ctx.stroke();

  // head triangle
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLen * Math.cos(angle - headAngle),
    to.y - headLen * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    to.x - headLen * Math.cos(angle + headAngle),
    to.y - headLen * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();
}
