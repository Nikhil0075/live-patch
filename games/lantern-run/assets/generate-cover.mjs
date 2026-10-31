import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const directory = path.dirname(fileURLToPath(import.meta.url));
const trees = Array.from({ length: 19 }, (_, index) => {
  const x = index * 47 - 45, height = 150 + (index * 43) % 130;
  return `<g transform="translate(${x} ${430 - height})" opacity="${.46 + index % 3 * .12}"><rect x="-4" y="70" width="8" height="${height}" fill="#182642"/><path d="M0 0 L-34 88 L-23 84 L-45 134 L0 119 L45 134 L23 84 L34 88Z" fill="${index % 2 ? '#19364a' : '#243453'}"/></g>`;
}).join('');
const stars = Array.from({ length: 38 }, (_, index) => `<circle cx="${(index * 191 + 31) % 768}" cy="${(index * 79 + 23) % 260}" r="${index % 5 ? 1.4 : 2.5}" fill="#f8edcf" opacity="${index % 4 ? .6 : .95}"/>`).join('');
const flies = Array.from({ length: 17 }, (_, index) => {
  const angle = index * .57, radius = 25 + index * 11;
  const x = 350 + Math.cos(angle) * radius, y = 255 + Math.sin(angle) * radius * .65;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${index % 4 ? 4 : 7}" fill="#e6ff78" filter="url(#glow)"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="#fffed1"/>`;
}).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="512" viewBox="0 0 768 512">
<defs>
  <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#172455"/><stop offset=".58" stop-color="#58477f"/><stop offset="1" stop-color="#ef9c61"/></linearGradient>
  <linearGradient id="fur" x2=".7" y2="1"><stop stop-color="#ffb24c"/><stop offset=".55" stop-color="#f07a2a"/><stop offset="1" stop-color="#9b4523"/></linearGradient>
  <radialGradient id="halo"><stop stop-color="#ffe2a1" stop-opacity=".64"/><stop offset="1" stop-color="#ffe2a1" stop-opacity="0"/></radialGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<rect width="768" height="512" fill="url(#sky)"/>
<ellipse cx="376" cy="186" rx="215" ry="170" fill="url(#halo)"/>
<circle cx="376" cy="184" r="112" fill="#ffdc9f"/><circle cx="347" cy="155" r="110" fill="#fff0c2" opacity=".4"/>
${stars}
<path d="M0 350 Q200 290 386 350 Q548 282 768 340 L768 512 L0 512Z" fill="#3b416a" opacity=".65"/>
${trees}
<path d="M0 455 Q220 424 410 461 Q585 424 768 443 L768 512 L0 512Z" fill="#152c39"/>
<path d="M0 488 Q200 464 380 490 Q593 458 768 475 L768 512 L0 512Z" fill="#101e31"/>
<g transform="translate(120 160)">
  <path d="M17 77 Q-3 45 17 19 L37 2 L42 31 L65 15 L83 43 L99 52 L113 22 L136 43 L118 70 Q116 111 73 116 Q35 120 17 77Z" fill="#3a4666"/>
  <path d="M16 62 Q-20 60 -29 85 Q3 70 25 81 M105 71 Q137 55 162 85 Q127 75 111 85" fill="#2b3a59"/>
  <ellipse cx="50" cy="58" rx="14" ry="17" fill="#ffbc52"/><ellipse cx="89" cy="58" rx="14" ry="17" fill="#ffbc52"/>
  <circle cx="52" cy="58" r="6" fill="#17243c"/><circle cx="87" cy="58" r="6" fill="#17243c"/>
  <path d="M64 83 L76 84 L70 95Z" fill="#d79742"/>
</g>
${flies}
<g transform="translate(422 221) rotate(-13 155 124)">
  <path d="M65 168 Q1 180 0 131 Q35 150 72 130" fill="#a84f2a" stroke="#743c25" stroke-width="5"/>
  <path d="M10 127 Q40 95 89 115 Q110 154 73 168 Q37 158 10 127Z" fill="url(#fur)"/>
  <path d="M18 145 Q34 153 47 148 Q39 164 16 159Z" fill="#fff0d4"/>
  <path d="M79 120 Q104 91 135 88 L175 106 Q180 136 137 145 L96 145Z" fill="url(#fur)" stroke="#9a4628" stroke-width="4"/>
  <path d="M115 91 L116 39 L143 76 L164 42 L176 106Z" fill="#dc6b2b"/>
  <path d="M123 84 L125 58 L138 79 M161 75 L164 59 L171 89" fill="#fbe9d0"/>
  <path d="M132 120 Q153 141 193 119 L207 125 Q169 157 127 143Z" fill="#fbe9d0"/>
  <circle cx="159" cy="108" r="7" fill="#241f26"/><circle cx="161" cy="105" r="2" fill="white"/>
  <circle cx="205" cy="123" r="5" fill="#2b1c1c"/>
  <path d="M84 153 L68 198 L91 195 L110 163 M116 158 L137 191 L160 183 L146 143" fill="#833c25" stroke="#633020" stroke-width="5"/>
  <path d="M153 139 L159 166" stroke="#6d432a" stroke-width="5"/>
  <rect x="147" y="158" width="25" height="30" rx="4" fill="#7c4b32" stroke="#ffc36d" stroke-width="3"/>
  <circle cx="159" cy="172" r="10" fill="#ffe477" filter="url(#glow)"/><circle cx="159" cy="172" r="6" fill="#ffe477"/>
</g>
<g opacity=".8"><path d="M35 468 Q155 431 275 465 M529 468 Q655 444 747 457" stroke="#6a9b53" stroke-width="10" fill="none"/></g>
</svg>`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 768, height: 512 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:#172455">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: path.join(directory, 'cover-generated.png') });
} finally { await browser.close(); }
console.log('Generated original Lantern Run cover');
