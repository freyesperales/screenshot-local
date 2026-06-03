"use client";

import type { ToolKind } from "@/lib/types";

const TOOLS: { kind: ToolKind; label: string; key: string; icon: string }[] = [
  { kind: "select", label: "Select (V)", key: "v", icon: "↖" },
  { kind: "arrow", label: "Arrow (A)", key: "a", icon: "↗" },
  { kind: "rect", label: "Rectangle (R)", key: "r", icon: "▭" },
  { kind: "ellipse", label: "Ellipse (E)", key: "e", icon: "◯" },
  { kind: "pen", label: "Pen (P)", key: "p", icon: "✎" },
  { kind: "text", label: "Text (T)", key: "t", icon: "T" },
  { kind: "blur", label: "Blur (B)", key: "b", icon: "▒" },
  { kind: "crop", label: "Crop (C)", key: "c", icon: "⌐" },
];

const PALETTE = ["#dc2626", "#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#0f172a", "#ffffff"];

type Props = {
  tool: ToolKind;
  onTool: (t: ToolKind) => void;
  color: string;
  onColor: (c: string) => void;
  thickness: number;
  onThickness: (n: number) => void;
  blurStrength: number;
  onBlurStrength: (n: number) => void;
  rectFilled: boolean;
  onRectFilled: (v: boolean) => void;
  textSize: number;
  onTextSize: (n: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onReset: () => void;
  onApplyCrop: () => void;
  canApplyCrop: boolean;
  copyMessage: string | null;
};

export function Toolbar(p: Props) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.kind}
            title={t.label}
            onClick={() => p.onTool(t.kind)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-semibold transition ${
              p.tool === t.kind
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
            }`}
          >
            {t.icon}
          </button>
        ))}

        {p.tool === "crop" && (
          <button
            onClick={p.onApplyCrop}
            disabled={!p.canApplyCrop}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-slate-300"
          >
            Apply crop
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {p.tool === "blur" ? (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Strength
            <select
              value={p.blurStrength}
              onChange={(e) => p.onBlurStrength(Number(e.target.value))}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            >
              <option value={5}>Light (5)</option>
              <option value={15}>Medium (15)</option>
              <option value={30}>Heavy (30)</option>
            </select>
          </label>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => p.onColor(c)}
                  title={c}
                  className={`h-6 w-6 rounded-full border-2 ${
                    p.color === c ? "border-slate-900" : "border-slate-200"
                  }`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={p.color}
                onChange={(e) => p.onColor(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border border-slate-300"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Thickness
              <input
                type="range"
                min={1}
                max={20}
                value={p.thickness}
                onChange={(e) => p.onThickness(Number(e.target.value))}
              />
              <span className="w-6 text-right tabular-nums">{p.thickness}</span>
            </label>
          </>
        )}

        {p.tool === "rect" && (
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={p.rectFilled}
              onChange={(e) => p.onRectFilled(e.target.checked)}
            />
            Filled
          </label>
        )}

        {p.tool === "text" && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Size
            <input
              type="number"
              min={10}
              max={120}
              value={p.textSize}
              onChange={(e) => p.onTextSize(Number(e.target.value))}
              className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={p.onUndo}
            disabled={!p.canUndo}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            onClick={p.onRedo}
            disabled={!p.canRedo}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
          >
            Redo
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={p.onCopy}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            Copy
          </button>
          <button
            onClick={p.onDownload}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-500"
          >
            Download
          </button>
          <button
            onClick={p.onReset}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Reset
          </button>
        </div>
        {p.copyMessage && (
          <span className="text-xs text-slate-500">{p.copyMessage}</span>
        )}
      </div>
    </div>
  );
}
