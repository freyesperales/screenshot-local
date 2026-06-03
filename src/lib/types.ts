export type P = { x: number; y: number };

export type Op =
  | { type: "arrow"; from: P; to: P; color: string; thickness: number }
  | {
      type: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      thickness: number;
      filled: boolean;
    }
  | {
      type: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      color: string;
      thickness: number;
    }
  | { type: "pen"; points: P[]; color: string; thickness: number }
  | { type: "text"; x: number; y: number; text: string; color: string; size: number }
  | { type: "blur"; x: number; y: number; w: number; h: number; strength: number };

export type ToolKind =
  | "select"
  | "arrow"
  | "rect"
  | "ellipse"
  | "pen"
  | "text"
  | "blur"
  | "crop";

export type HistoryState = {
  ops: Op[];
  redo: Op[];
};

export type DraftRecord = {
  id: "current";
  imageBlob: Blob;
  ops: Op[];
  width: number;
  height: number;
  updatedAt: number;
};
