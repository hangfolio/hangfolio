// Draws the demo person's files in starter/public/example/ (SPEC 5.11): the avatar, the social
// preview image, a one-page CV and the example paper. Everything is fictional and CC0 1.0; the PDFs
// embed subsets of the theme's own fonts (SIL OFL 1.1), which the OFL allows.
//
// Run it after changing a template here: `node tools/starter-assets/build.mjs`. It uses the
// installed Google Chrome through playwright-core (set CHROME_PATH elsewhere), and the fonts from
// node_modules, so nothing is downloaded.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = new URL('./', import.meta.url);
const OUT = new URL('../../starter/public/example/', import.meta.url);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const require = createRequire(new URL('../../packages/theme/package.json', import.meta.url));

// The design's tokens (packages/theme/src/styles/tokens.css, light theme).
const T = { bg: '#f5f7fa', fg: '#121826', muted: '#4b5567', faint: '#5f6a7c', rule: '#d8dee7', tint: '#e9eef5', accent: '#2c5aa0' };

const font = (pkg, file) => readFileSync(require.resolve(`${pkg}/files/${file}`)).toString('base64');
const face = (family, pkg, file, weight, style = 'normal') =>
  `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${font(pkg, file)}) format('woff2');font-weight:${weight};font-style:${style}}`;
const FONTS = [
  face('Newsreader', '@fontsource-variable/newsreader', 'newsreader-latin-opsz-normal.woff2', '200 800'),
  face('Newsreader', '@fontsource-variable/newsreader', 'newsreader-latin-opsz-italic.woff2', '200 800', 'italic'),
  face('Plex Sans', '@fontsource/ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff2', 400),
  face('Plex Sans', '@fontsource/ibm-plex-sans', 'ibm-plex-sans-latin-400-italic.woff2', 400, 'italic'),
  face('Plex Sans', '@fontsource/ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff2', 600),
  face('Plex Mono', '@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff2', 400),
].join('\n');

const page = (title, css, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${FONTS}
*{box-sizing:border-box;margin:0;padding:0}
body{color:${T.fg};font-family:'Plex Sans',sans-serif;-webkit-font-smoothing:antialiased}
${css}</style></head><body>${body}</body></html>`;

const avatar = readFileSync(new URL('avatar.svg', HERE), 'utf8');

const og = page(
  'Rowan Vale',
  `body{width:1200px;height:630px;background:${T.bg};display:flex;align-items:center;gap:64px;padding:0 96px;position:relative}
  .pic{width:300px;height:300px;border-radius:50%;overflow:hidden;flex:none;border:6px solid #fff;box-shadow:0 0 0 1px ${T.rule}}
  .pic svg{width:100%;height:100%;display:block}
  .text{border-left:3px solid ${T.accent};padding-left:40px}
  h1{font-family:Newsreader,serif;font-weight:500;font-size:84px;line-height:1;letter-spacing:-0.01em}
  .role{font-size:30px;color:${T.muted};margin-top:20px}
  .tag{font-family:Newsreader,serif;font-style:italic;font-size:34px;line-height:1.25;margin-top:28px;max-width:640px}
  .foot{position:absolute;left:96px;right:96px;bottom:40px;font-family:'Plex Mono',monospace;font-size:20px;color:${T.faint};display:flex;justify-content:space-between}`,
  `<div class="pic">${avatar}</div>
  <div class="text"><h1>Rowan Vale</h1><p class="role">PhD student in Computer Science<br>Example University</p>
  <p class="tag">I build storage systems that stay correct when machines fail.</p></div>
  <div class="foot"><span>An example site made with hangfolio</span><span>Fictional person</span></div>`,
);

// Letter pages, printed with these margins.
const PRINT = `@page{size:Letter;margin:0.7in 0.75in}
body{font-size:10pt;line-height:1.4}
h2{font-family:'Plex Sans',sans-serif;font-weight:600;font-size:8.5pt;letter-spacing:0.12em;text-transform:uppercase;color:${T.accent};margin:14pt 0 5pt;padding-bottom:3pt;border-bottom:0.75pt solid ${T.rule}}
.row{display:flex;justify-content:space-between;gap:12pt}
.when{color:${T.muted};white-space:nowrap;font-variant-numeric:tabular-nums}
.org{color:${T.muted}}
ul{margin:2pt 0 6pt 14pt}
li{margin:1pt 0}
.note{margin-top:16pt;font-size:8pt;color:${T.faint}}`;

const cv = page(
  'Rowan Vale: CV',
  `${PRINT}
  h1{font-family:Newsreader,serif;font-weight:500;font-size:26pt;line-height:1}
  .contact{margin-top:5pt;color:${T.muted}}
  .entry{margin-bottom:6pt}
  .entry b{font-weight:600}`,
  `<h1>Rowan Vale</h1>
  <p class="contact">PhD student in Computer Science · Example University · Port Alder, WA<br>rowan@example.edu · github.com/hangfolio · ORCID 0000-0002-1825-0097</p>
  <h2>Education</h2>
  <div class="entry"><div class="row"><span><b>PhD, Computer Science</b>, <span class="org">Example University</span></span><span class="when">2025 – 2029 (expected)</span></div>
  <p>Storage systems and crash consistency. Advisor: Dr. Ada Advisor.</p></div>
  <div class="entry"><div class="row"><span><b>BS, Computer Science</b>, <span class="org">Example College</span></span><span class="when">2020 – 2024</span></div></div>
  <h2>Research</h2>
  <div class="entry"><div class="row"><span><b>Graduate Research Assistant</b>, <span class="org">Example University</span></span><span class="when">Jan 2025 – present</span></div>
  <ul><li>Built a fault-injection harness for key-value stores.</li><li>Tidepool: replays crash points to find lost writes; found 12 of 12 seeded bugs with no false positives.</li></ul></div>
  <h2>Experience</h2>
  <div class="entry"><div class="row"><span><b>Software Engineering Intern</b>, <span class="org">Example Corp</span></span><span class="when">Jun – Aug 2024</span></div>
  <ul><li>Cut API latency from 3 s to 300 ms with a read-through cache for the orders API.</li></ul></div>
  <h2>Publications</h2>
  <div class="entry"><p>A. Author*, <u>Rowan Vale</u>*, and P. Investigator. <i>Bounded Staleness for Edge Caches.</i> Proceedings of the Example Conference (EXC '24), Lisbon, 2024. doi:10.5555/exc24.0001</p>
  <p class="org">* Equal contribution</p></div>
  <div class="entry"><p><u>Rowan Vale</u>. <i>Finding Lost Writes by Replaying Crash Points.</i> In preparation.</p></div>
  <h2>Teaching</h2>
  <div class="entry"><div class="row"><span><b>Teaching Assistant, Distributed Systems</b>, <span class="org">Example University</span></span><span class="when">Fall 2025</span></div>
  <ul><li>Ran weekly labs for 60 students; wrote the lab notes on quorum reads and writes.</li></ul></div>
  <h2>Skills</h2>
  <p>Rust, Go, C, Python · Linux storage stack, fault injection, TLA+ · Benchmarking and tracing</p>
  <p class="note">Rowan Vale is a made-up person, and this CV is an example file for the hangfolio demo site. It is dedicated to the public domain (CC0 1.0).</p>`,
);

const paper = page(
  'Bounded Staleness for Edge Caches',
  `${PRINT}
  body{font-family:Newsreader,serif;font-size:10.5pt;line-height:1.4}
  .star{color:${T.muted}}
  .fiction{font-style:italic}
  h1{font-weight:500;font-size:20pt;line-height:1.15;text-align:center}
  .authors,.venue{text-align:center;font-family:'Plex Sans',sans-serif}
  .authors{margin-top:8pt;font-size:10pt}
  .venue{margin-top:4pt;font-size:8.5pt;color:${T.muted}}
  .abstract{margin:14pt 0 4pt;padding:8pt 12pt;background:${T.tint};font-size:9.5pt}
  .abstract b{font-family:'Plex Sans',sans-serif;font-weight:600;font-size:8.5pt;letter-spacing:0.08em;text-transform:uppercase;color:${T.accent};margin-right:6pt}
  h2{font-family:'Plex Sans',sans-serif;font-size:9pt;margin-top:12pt}
  p+p{text-indent:1.5em}
  table{border-collapse:collapse;margin:8pt auto;font-family:'Plex Sans',sans-serif;font-size:8.5pt}
  th,td{padding:3pt 10pt;border-bottom:0.75pt solid ${T.rule};text-align:right}
  th:first-child,td:first-child{text-align:left}
  caption{caption-side:bottom;padding-top:4pt;color:${T.muted}}
  ol{margin-left:14pt;font-size:8.5pt}
  code{font-family:'Plex Mono',monospace;font-size:0.9em}`,
  `<h1>Bounded Staleness for Edge Caches</h1>
  <p class="authors">A. Author*, Rowan Vale*, P. Investigator · Example University · <span class="star">* Equal contribution</span></p>
  <p class="venue">Proceedings of the Example Conference (EXC '24), Lisbon, May 13–17, 2024, pp. 1–12 · doi:10.5555/exc24.0001</p>
  <p class="venue fiction">An example paper for the hangfolio demo site: the authors, venue and results are made up. Public domain (CC0 1.0).</p>
  <div class="abstract"><b>Abstract</b>Edge caches answer reads close to users, but a cache that misses an invalidation can serve stale data for as long as it likes. We bound that staleness. Each replica holds a lease that expires before it can fall more than a configured bound behind, and a replica whose lease has lapsed sends reads to the origin until it catches up. On a synthetic edge workload across three regions, this lowers p99 read latency by up to 40% compared with strong reads, while no read is more than 250 ms stale.</div>
  <h2>1 Introduction</h2>
  <p>Caching at the edge trades freshness for latency, and most deployments leave the trade implicit: a value stays until an invalidation arrives, and invalidations can be delayed or lost. Applications that need fresh data then bypass the cache and pay the full round trip on every read.</p>
  <p>We ask for less than strong consistency and more than none: a bound on how stale any read can be, which the operator sets per key space. Section 2 describes the lease protocol that enforces it, and Section 3 measures what it costs.</p>
  <h2>2 Design</h2>
  <p>The origin grants each replica a lease of length <i>L</i> and promises not to acknowledge a write until every replica holding a lease has seen it or the lease has expired. A replica serves reads locally only while its lease is valid, so with clock skew at most <i>d</i>, no read is older than <i>L</i> + <i>d</i>. Renewals ride on the invalidation stream, so a healthy replica never pauses.</p>
  <h2>3 Evaluation</h2>
  <p>We replayed a synthetic read-heavy workload against three regions with the bound set to 250 ms.</p>
  <table><caption>Table 1. Read latency in milliseconds (lower is better).</caption>
  <tr><th>Configuration</th><th>p50</th><th>p99</th><th>Max staleness</th></tr>
  <tr><td>Strong reads (origin)</td><td>21</td><td>48</td><td>0 ms</td></tr>
  <tr><td>Invalidation only</td><td>3</td><td>18</td><td>unbounded</td></tr>
  <tr><td>Bounded staleness</td><td>4</td><td>29</td><td>250 ms</td></tr></table>
  <h2>4 Conclusion</h2>
  <p>A lease per replica turns "eventually fresh" into "fresh within a bound the operator chose", at a fraction of the latency of strong reads. The code and traces are released with the paper.</p>
  <h2>References</h2>
  <ol><li>A. Author and P. Investigator. Leases for replicated caches. <i>Journal of Example Systems</i>, 2021.</li>
  <li>P. Investigator. Measuring staleness in the wild. In <i>Proc. EXC '22</i>, 2022.</li></ol>`,
);

const browser = await chromium.launch({ executablePath: CHROME });
try {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const tab = await ctx.newPage();
  const shoot = async (html, size, file, options) => {
    await tab.setViewportSize(size);
    await tab.setContent(html, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    writeFileSync(new URL(file, OUT), await tab.screenshot(options));
  };
  await shoot(page('Avatar', 'body{width:400px;height:400px}svg{display:block}', avatar), { width: 400, height: 400 }, 'avatar.jpg', { type: 'jpeg', quality: 88 });
  await shoot(og, { width: 1200, height: 630 }, 'og.png', { type: 'png' });
  for (const [html, file] of [[cv, 'cv.pdf'], [paper, 'vale2024bounded.pdf']]) {
    await tab.setContent(html, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    writeFileSync(new URL(file, OUT), await tab.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true }));
  }
} finally {
  await browser.close();
}
console.log(`wrote avatar.jpg, og.png, cv.pdf and vale2024bounded.pdf to ${fileURLToPath(OUT)}`);
