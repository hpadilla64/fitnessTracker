// Screenshot dashboard cards with headless Chromium; prints console errors.
// Usage: node .agents/tools/snap.mjs <outDir> "<Card title>" ["<Card title>" ...]
//   env: URL (default http://localhost:3000/), TAB (tab label to click first),
//        RANGE (timeline filter label to click, e.g. "30 Days")
// Needs Playwright resolvable from the project: `npm i -D playwright && npx playwright install chromium`.
import { chromium } from 'playwright';

const [outDir, ...titles] = process.argv.slice(2);
if (!outDir || titles.length === 0) {
  console.error('usage: node .agents/tools/snap.mjs <outDir> "<Card title>" [...]');
  process.exit(2);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const ignore = /deprecated/i; // antd deprecation warnings are informational
page.on('console', (m) => m.type() === 'error' && !ignore.test(m.text()) && console.log('CONSOLE ERROR:', m.text()));
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(process.env.URL || 'http://localhost:3000/', { waitUntil: 'networkidle' });
if (process.env.TAB) await page.getByRole('tab', { name: process.env.TAB }).click();
if (process.env.RANGE) await page.locator('.ant-segmented-item', { hasText: process.env.RANGE }).click();

for (const title of titles) {
  const card = page.locator('.ant-card', { hasText: title }).first();
  await card.waitFor({ timeout: 20000 });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); // chart animation
  const file = `${outDir}/${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  await card.screenshot({ path: file });
  console.log('SAVED', file);
}
await browser.close();
