/**
 * Extract an image Blob from a ClipboardEvent. Returns null if none found.
 * Works synchronously off the event's `clipboardData.items`.
 */
export function imageFromPasteEvent(e: ClipboardEvent): Blob | null {
  const dt = e.clipboardData;
  if (!dt) return null;
  const items = dt.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/** Try to write a PNG blob to the system clipboard. Returns true on success. */
export async function writePngToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      return false;
    }
    const item = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

/** Read an image from the clipboard via the async API (Chrome/Edge). Returns null on failure. */
export async function readImageFromClipboard(): Promise<Blob | null> {
  try {
    if (!navigator.clipboard?.read) return null;
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          return await item.getType(type);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Trigger a download for the given blob with the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
