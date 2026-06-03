"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CanvasEditor } from "@/components/Canvas";
import { Toolbar } from "@/components/Toolbar";
import type { HistoryState, Op, ToolKind } from "@/lib/types";
import { emptyHistory, pushOp, redo, replay, undo } from "@/lib/ops";
import {
  downloadBlob,
  writePngToClipboard,
} from "@/lib/clipboard";
import { clearDraft, loadDraft, saveDraft } from "@/lib/persistence";

const MAX_DIM = 4000;

export default function EditPage() {
  const router = useRouter();
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [history, setHistory] = useState<HistoryState>(emptyHistory());
  const [tool, setTool] = useState<ToolKind>("arrow");
  const [color, setColor] = useState("#dc2626");
  const [thickness, setThickness] = useState(4);
  const [blurStrength, setBlurStrength] = useState(15);
  const [rectFilled, setRectFilled] = useState(false);
  const [textSize, setTextSize] = useState(28);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [downscalePrompt, setDownscalePrompt] = useState<Blob | null>(null);
  const originalBlobRef = useRef<Blob | null>(null);

  // Load draft from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const draft = await loadDraft();
      if (!draft) {
        router.replace("/");
        return;
      }
      if (cancelled) return;
      if (draft.width > MAX_DIM || draft.height > MAX_DIM) {
        setDownscalePrompt(draft.imageBlob);
        return;
      }
      await bootstrapFromBlob(draft.imageBlob, draft.ops);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function bootstrapFromBlob(blob: Blob, ops: Op[] = []) {
    originalBlobRef.current = blob;
    const bm = await createImageBitmap(blob);
    setBitmap(bm);
    setDims({ w: bm.width, h: bm.height });
    setHistory({ ops, redo: [] });
  }

  async function continueWithDownscale(scale: number) {
    const blob = downscalePrompt;
    if (!blob) return;
    const bm = await createImageBitmap(blob);
    const w = Math.round(bm.width * scale);
    const h = Math.round(bm.height * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(bm, 0, 0, w, h);
    const smaller: Blob = await new Promise((res) =>
      c.toBlob((b) => res(b!), "image/png"),
    );
    bm.close?.();
    setDownscalePrompt(null);
    await bootstrapFromBlob(smaller);
  }

  // Autosave on history changes
  useEffect(() => {
    if (!originalBlobRef.current || !dims) return;
    saveDraft({
      imageBlob: originalBlobRef.current,
      ops: history.ops,
      width: dims.w,
      height: dims.h,
    });
  }, [history, dims]);

  const commitOp = useCallback(
    (op: Op) => setHistory((h) => pushOp(h, op)),
    [],
  );

  const doUndo = useCallback(() => setHistory((h) => undo(h)), []);
  const doRedo = useCallback(() => setHistory((h) => redo(h)), []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "u") {
        e.preventDefault();
        doUndo();
        return;
      }
      const map: Record<string, ToolKind> = {
        v: "select",
        a: "arrow",
        r: "rect",
        e: "ellipse",
        p: "pen",
        t: "text",
        b: "blur",
        c: "crop",
      };
      if (map[key]) setTool(map[key]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doUndo, doRedo]);

  // Render to a fresh canvas and return as blob.
  const renderToBlob = useCallback(async (): Promise<Blob | null> => {
    if (!bitmap || !dims) return null;
    const c = document.createElement("canvas");
    c.width = dims.w;
    c.height = dims.h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    replay(ctx, history.ops);
    return await new Promise((res) => c.toBlob((b) => res(b), "image/png"));
  }, [bitmap, dims, history.ops]);

  async function onCopy() {
    const blob = await renderToBlob();
    if (!blob) return;
    const ok = await writePngToClipboard(blob);
    if (ok) {
      setCopyMsg("Copied to clipboard");
    } else {
      downloadBlob(blob, "screenshot.png");
      setCopyMsg("Clipboard unavailable — downloaded instead");
    }
    setTimeout(() => setCopyMsg(null), 3000);
  }

  async function onDownload() {
    const blob = await renderToBlob();
    if (!blob) return;
    downloadBlob(blob, "screenshot.png");
  }

  async function onApplyCrop() {
    if (!bitmap || !dims || !crop) return;
    // Bake current image + ops, then crop the result, then reset history.
    const baked = document.createElement("canvas");
    baked.width = dims.w;
    baked.height = dims.h;
    const bctx = baked.getContext("2d")!;
    bctx.drawImage(bitmap, 0, 0);
    replay(bctx, history.ops);

    const w = Math.max(1, Math.floor(crop.w));
    const h = Math.max(1, Math.floor(crop.h));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(
      baked,
      Math.floor(crop.x),
      Math.floor(crop.y),
      w,
      h,
      0,
      0,
      w,
      h,
    );
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
    bitmap.close?.();
    const newBm = await createImageBitmap(blob);
    originalBlobRef.current = blob;
    setBitmap(newBm);
    setDims({ w, h });
    setHistory(emptyHistory());
    setCrop(null);
    setTool("select");
  }

  function onReset() {
    setHistory(emptyHistory());
    setCrop(null);
  }

  const canUndo = history.ops.length > 0;
  const canRedo = history.redo.length > 0;

  const memoTool = useMemo(() => tool, [tool]);

  if (downscalePrompt) {
    return (
      <div className="mx-auto max-w-md p-8">
        <h2 className="text-lg font-semibold">Large image detected</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your image is bigger than 4000px. Annotating at full size can be slow.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => continueWithDownscale(0.5)}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Downsize to 50%
          </button>
          <button
            onClick={() => continueWithDownscale(1)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Keep full size
          </button>
        </div>
      </div>
    );
  }

  if (!bitmap || !dims) {
    return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <Toolbar
        tool={memoTool}
        onTool={setTool}
        color={color}
        onColor={setColor}
        thickness={thickness}
        onThickness={setThickness}
        blurStrength={blurStrength}
        onBlurStrength={setBlurStrength}
        rectFilled={rectFilled}
        onRectFilled={setRectFilled}
        textSize={textSize}
        onTextSize={setTextSize}
        onUndo={doUndo}
        onRedo={doRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCopy={onCopy}
        onDownload={onDownload}
        onReset={onReset}
        onApplyCrop={onApplyCrop}
        canApplyCrop={!!crop}
        copyMessage={copyMsg}
      />
      <div className="flex-1 overflow-hidden">
        <CanvasEditor
          imageBitmap={bitmap}
          ops={history.ops}
          tool={tool}
          color={color}
          thickness={thickness}
          blurStrength={blurStrength}
          rectFilled={rectFilled}
          textSize={textSize}
          onCommit={commitOp}
          onCropChange={setCrop}
          width={dims.w}
          height={dims.h}
        />
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
        <span>
          {dims.w}×{dims.h}px · {history.ops.length} op{history.ops.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={async () => {
            await clearDraft();
            router.push("/");
          }}
          className="text-slate-500 hover:text-slate-900"
        >
          ← New screenshot
        </button>
      </div>
    </div>
  );
}
