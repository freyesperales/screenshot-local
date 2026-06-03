/**
 * In-place box blur applied to an ImageData region.
 * Strength = radius in pixels. Simple separable two-pass implementation,
 * fast enough for screenshot annotation regions up to a few megapixels.
 */
export function boxBlurRegion(data: ImageData, radius: number): ImageData {
  const r = Math.max(1, Math.floor(radius));
  const { width, height } = data;
  const src = new Uint8ClampedArray(data.data);
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);

  // Horizontal pass: src -> tmp
  blurPass(src, tmp, width, height, r, true);
  // Vertical pass: tmp -> out
  blurPass(tmp, out, width, height, r, false);

  return new ImageData(out, width, height);
}

function blurPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const lineLen = horizontal ? width : height;
  const otherLen = horizontal ? height : width;
  const window = radius * 2 + 1;

  for (let o = 0; o < otherLen; o++) {
    let sumR = 0,
      sumG = 0,
      sumB = 0,
      sumA = 0;
    // Prime window with edge clamping
    for (let k = -radius; k <= radius; k++) {
      const i = clamp(k, 0, lineLen - 1);
      const idx = horizontal ? (o * width + i) * 4 : (i * width + o) * 4;
      sumR += src[idx]!;
      sumG += src[idx + 1]!;
      sumB += src[idx + 2]!;
      sumA += src[idx + 3]!;
    }
    for (let p = 0; p < lineLen; p++) {
      const outIdx = horizontal ? (o * width + p) * 4 : (p * width + o) * 4;
      dst[outIdx] = sumR / window;
      dst[outIdx + 1] = sumG / window;
      dst[outIdx + 2] = sumB / window;
      dst[outIdx + 3] = sumA / window;

      // Slide window
      const removeI = clamp(p - radius, 0, lineLen - 1);
      const addI = clamp(p + radius + 1, 0, lineLen - 1);
      const remIdx = horizontal ? (o * width + removeI) * 4 : (removeI * width + o) * 4;
      const addIdx = horizontal ? (o * width + addI) * 4 : (addI * width + o) * 4;
      sumR += src[addIdx]! - src[remIdx]!;
      sumG += src[addIdx + 1]! - src[remIdx + 1]!;
      sumB += src[addIdx + 2]! - src[remIdx + 2]!;
      sumA += src[addIdx + 3]! - src[remIdx + 3]!;
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
