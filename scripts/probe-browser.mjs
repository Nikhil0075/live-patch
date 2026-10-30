import fs from 'node:fs';
import { chromium } from '@playwright/test';

const executable = chromium.executablePath();
try {
  const browser = await chromium.launch({ headless: true, timeout: 10000 });
  await browser.close();
  process.stdout.write(`Browser launched: ${executable}\n`);
} catch (error) {
  const resolved = /Executable doesn't exist at ([^\r\n]+)/.exec(String(error))?.[1] ?? executable;
  let fileState;
  try { const stat = fs.statSync(resolved); fileState = `size=${stat.size}, mode=${stat.mode.toString(8)}`; }
  catch (statError) { fileState = `stat=${String(statError)}`; }
  process.stderr.write(`Browser launch failed: ${resolved}; ${fileState}; ${String(error)}\n`);
  process.exitCode = 1;
}
