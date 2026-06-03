"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { imageFromPasteEvent } from "@/lib/clipboard";
import { saveDraft } from "@/lib/persistence";

async function handoffBlob(blob: Blob, router: ReturnType<typeof useRouter>): Promise<void> {
  // Decode dimensions before navigating so the editor opens to a sized canvas.
  const bitmap = await createImageBitmap(blob);
  await saveDraft({
    imageBlob: blob,
    ops: [],
    width: bitmap.width,
    height: bitmap.height,
  });
  bitmap.close?.();
  router.push("/edit");
}

export function PasteZone() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const onPaste = useCallback(
    async (e: ClipboardEvent) => {
      if (busy) return;
      const blob = imageFromPasteEvent(e);
      if (!blob) {
        setHint("No image found on clipboard. Take a screenshot first.");
        return;
      }
      e.preventDefault();
      setBusy(true);
      try {
        await handoffBlob(blob, router);
      } catch {
        setHint("Could not read that image.");
        setBusy(false);
      }
    },
    [busy, router],
  );

  useEffect(() => {
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPaste]);

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (busy) return;
      const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
      if (!file) {
        setHint("Drop an image file.");
        return;
      }
      setBusy(true);
      try {
        await handoffBlob(file, router);
      } catch {
        setHint("Could not read that image.");
        setBusy(false);
      }
    },
    [busy, router],
  );

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        await handoffBlob(file, router);
      } catch {
        setHint("Could not read that image.");
        setBusy(false);
      }
    },
    [router],
  );

  return (
    <div
      className="paste-zone flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-8 py-20 text-center shadow-sm transition hover:border-brand"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5h6M8 5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3M9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2H9V5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        Press{" "}
        <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-base font-mono">
          Ctrl
        </kbd>{" "}
        +{" "}
        <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-base font-mono">
          V
        </kbd>{" "}
        to paste a screenshot
      </h1>
      <p className="mt-3 text-sm text-slate-500">
        or drop an image here / pick one below
      </p>
      <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-hover">
        Choose file
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>
      {hint && <p className="mt-4 text-sm text-amber-700">{hint}</p>}
      {busy && <p className="mt-4 text-sm text-slate-500">Loading editor…</p>}
    </div>
  );
}
