// Compares two PNG screenshots pixel by pixel inside Chrome (canvas), so no image library is
// needed. Used by the screenshot baseline tests.
import type { Page } from 'playwright-core';

export type Comparison = {
  /** "WxH" of each image. */
  sizes: [string, string];
  /** Pixels where some channel differs by more than the tolerance. */
  different: number;
  total: number;
  /** A PNG: changed pixels in red over a faded copy of the baseline. Only when something differs. */
  diff?: Buffer;
};

/** Compares `baseline` with `actual`; channels within `tolerance` (0–255) count as equal. */
export async function comparePngs(page: Page, baseline: Buffer, actual: Buffer, tolerance = 8): Promise<Comparison> {
  const result = await page.evaluate(
    async ({ a, b, tolerance }) => {
      const load = async (base64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
      };
      const [base, next] = await Promise.all([load(a), load(b)]);
      const sizes: [string, string] = [`${base.canvas.width}x${base.canvas.height}`, `${next.canvas.width}x${next.canvas.height}`];
      const total = base.canvas.width * base.canvas.height;
      if (sizes[0] !== sizes[1]) return { sizes, different: total, total, diff: '' };
      const out = base.ctx.createImageData(base.canvas.width, base.canvas.height);
      let different = 0;
      for (let i = 0; i < base.data.length; i += 4) {
        let changed = false;
        for (let c = 0; c < 4; c++) if (Math.abs(base.data[i + c] - next.data[i + c]) > tolerance) changed = true;
        if (changed) different++;
        const grey = (base.data[i] + base.data[i + 1] + base.data[i + 2]) / 3;
        out.data.set(changed ? [255, 0, 0, 255] : [grey, grey, grey, 60], i);
      }
      if (different === 0) return { sizes, different, total, diff: '' };
      base.ctx.putImageData(out, 0, 0);
      return { sizes, different, total, diff: base.canvas.toDataURL('image/png').split(',')[1] };
    },
    { a: baseline.toString('base64'), b: actual.toString('base64'), tolerance },
  );
  return { ...result, diff: result.diff ? Buffer.from(result.diff, 'base64') : undefined };
}
