import { describe, expect, it, vi } from "vitest";
import {
  emptyHistory,
  pushOp,
  redo,
  undo,
  replay,
  applyOp,
} from "@/lib/ops";
import type { Op } from "@/lib/types";
import { imageFromPasteEvent } from "@/lib/clipboard";
import { boxBlurRegion } from "@/lib/blur";

/**
 * Build a stub 2D context that records every call. Enough to exercise applyOp / replay
 * without needing a real canvas backend.
 */
function makeStubCtx() {
  const calls: { method: string; args: unknown[] }[] = [];
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(target, prop: string) {
      if (prop === "__calls") return calls;
      if (prop in target) return target[prop];
      const fn = (...args: unknown[]) => {
        calls.push({ method: prop, args });
      };
      target[prop] = fn;
      return fn;
    },
    set(target, prop: string, value: unknown) {
      target[prop] = value;
      calls.push({ method: `set:${prop}`, args: [value] });
      return true;
    },
  };
  return new Proxy({} as Record<string, unknown>, handler) as unknown as CanvasRenderingContext2D & {
    __calls: { method: string; args: unknown[] }[];
  };
}

describe("history", () => {
  it("pushOp clears redo and appends in order", () => {
    let s = emptyHistory();
    const a: Op = { type: "pen", points: [{ x: 0, y: 0 }], color: "#000", thickness: 1 };
    const b: Op = { type: "pen", points: [{ x: 1, y: 1 }], color: "#000", thickness: 1 };
    s = pushOp(s, a);
    s = pushOp(s, b);
    expect(s.ops.length).toBe(2);
    expect(s.redo.length).toBe(0);
    // Once we undo and push again, redo should be reset
    s = undo(s);
    expect(s.redo.length).toBe(1);
    s = pushOp(s, a);
    expect(s.redo.length).toBe(0);
  });

  it("undo/redo are inverses while no new op is pushed", () => {
    let s = emptyHistory();
    const a: Op = {
      type: "rect",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      color: "#f00",
      thickness: 2,
      filled: false,
    };
    s = pushOp(s, a);
    const undone = undo(s);
    expect(undone.ops.length).toBe(0);
    expect(undone.redo.length).toBe(1);
    const redone = redo(undone);
    expect(redone.ops).toEqual(s.ops);
    expect(redone.redo.length).toBe(0);
  });

  it("undo on empty is a no-op (referential return is fine)", () => {
    const s = emptyHistory();
    const u = undo(s);
    expect(u.ops.length).toBe(0);
    expect(u.redo.length).toBe(0);
  });

  it("redo on empty is a no-op", () => {
    const s = emptyHistory();
    expect(redo(s).ops.length).toBe(0);
  });
});

describe("applyOp / replay", () => {
  it("replays each op against the stub context", () => {
    const ctx = makeStubCtx();
    const ops: Op[] = [
      {
        type: "rect",
        x: 0,
        y: 0,
        w: 5,
        h: 5,
        color: "#f00",
        thickness: 1,
        filled: false,
      },
      {
        type: "pen",
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        color: "#000",
        thickness: 1,
      },
    ];
    replay(ctx, ops);
    const methods = ctx.__calls.map((c) => c.method);
    expect(methods).toContain("strokeRect");
    expect(methods).toContain("beginPath");
    expect(methods).toContain("lineTo");
    expect(methods).toContain("stroke");
  });

  it("filled rect uses fillRect, hollow uses strokeRect", () => {
    const ctx1 = makeStubCtx();
    applyOp(ctx1, {
      type: "rect",
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      color: "#f00",
      thickness: 1,
      filled: true,
    });
    expect(ctx1.__calls.map((c) => c.method)).toContain("fillRect");

    const ctx2 = makeStubCtx();
    applyOp(ctx2, {
      type: "rect",
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      color: "#f00",
      thickness: 1,
      filled: false,
    });
    const methods = ctx2.__calls.map((c) => c.method);
    expect(methods).toContain("strokeRect");
    expect(methods).not.toContain("fillRect");
  });
});

describe("imageFromPasteEvent", () => {
  it("extracts an image file from a synthetic clipboard event", () => {
    const file = new File(["x"], "x.png", { type: "image/png" });
    const item = {
      kind: "file",
      type: "image/png",
      getAsFile: () => file,
    } as unknown as DataTransferItem;
    const fakeEvent = {
      clipboardData: {
        items: [item] as unknown as DataTransferItemList,
      },
    } as unknown as ClipboardEvent;
    const out = imageFromPasteEvent(fakeEvent);
    expect(out).toBe(file);
  });

  it("returns null when no image item is present", () => {
    const item = {
      kind: "string",
      type: "text/plain",
      getAsFile: () => null,
    } as unknown as DataTransferItem;
    const fakeEvent = {
      clipboardData: {
        items: [item] as unknown as DataTransferItemList,
      },
    } as unknown as ClipboardEvent;
    expect(imageFromPasteEvent(fakeEvent)).toBeNull();
  });

  it("returns null when clipboardData is absent", () => {
    const fakeEvent = { clipboardData: null } as unknown as ClipboardEvent;
    expect(imageFromPasteEvent(fakeEvent)).toBeNull();
  });
});

describe("boxBlurRegion", () => {
  it("preserves dimensions and clamps a flat-colored image", () => {
    // happy-dom may not expose ImageData natively; polyfill is fine for our usage.
    const Ctor: typeof ImageData =
      typeof ImageData !== "undefined"
        ? ImageData
        : (class {
            data: Uint8ClampedArray;
            width: number;
            height: number;
            constructor(arr: Uint8ClampedArray, w: number, h: number) {
              this.data = arr;
              this.width = w;
              this.height = h;
            }
            colorSpace = "srgb" as const;
          } as unknown as typeof ImageData);
    // expose for blur.ts which does `new ImageData(...)`
    (globalThis as { ImageData: typeof ImageData }).ImageData = Ctor;

    const w = 6;
    const h = 6;
    const pixels = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 200;
      pixels[i + 1] = 100;
      pixels[i + 2] = 50;
      pixels[i + 3] = 255;
    }
    const data = new Ctor(pixels, w, h);
    const out = boxBlurRegion(data, 2);
    expect(out.width).toBe(w);
    expect(out.height).toBe(h);
    // flat-colored input must remain (close to) the same color after blur
    expect(Math.abs(out.data[0]! - 200)).toBeLessThan(2);
    expect(Math.abs(out.data[1]! - 100)).toBeLessThan(2);
    expect(Math.abs(out.data[2]! - 50)).toBeLessThan(2);
    expect(out.data[3]).toBe(255);
  });
});

// Sanity: ensure vi doesn't get tree-shaken if needed in future tests
vi.fn();
