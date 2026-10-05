// Text contrast in a page, checked in the browser (WCAG 2 contrast ratio, sRGB). Pass the function
// to page.evaluate(contrastFailures, 4.5).

/**
 * Runs in the page: each element with its own text, compared against the background painted
 * behind it (its own and its ancestors' background colours, blended). Returns those below `min`.
 */
export function contrastFailures(min: number): string[] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  type RGBA = [number, number, number, number];
  // The canvas reads any CSS colour the browser computes, color(srgb …) included.
  const rgba = (css: string): RGBA => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'transparent';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const over = (top: RGBA, below: RGBA): RGBA => [0, 1, 2].map((i) => top[i] * top[3] + below[i] * (1 - top[3])).concat(1) as RGBA;
  const background = (el: Element): RGBA => {
    const layers: RGBA[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      if (color[3] > 0) layers.unshift(color);
      if (color[3] === 1) break;
    }
    return layers.reduce((below, top) => over(top, below), [255, 255, 255, 1] as RGBA);
  };
  const luminance = ([r, g, b]: RGBA) => {
    const linear = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const failures: string[] = [];
  for (const el of document.querySelectorAll('body *')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();
    if (!text || el.closest('.visually-hidden, .skip') || el.getClientRects().length === 0) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden') continue;
    const bg = background(el);
    const [a, b] = [luminance(over(rgba(style.color), bg)), luminance(bg)].sort((x, y) => y - x);
    const ratio = (a + 0.05) / (b + 0.05);
    if (ratio < min) failures.push(`${el.tagName.toLowerCase()}.${el.className} "${text.slice(0, 40)}": ${ratio.toFixed(2)}`);
  }
  return failures;
}
