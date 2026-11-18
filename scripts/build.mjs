// Wraps each page in src/ (written as an Artifact page body) into a standalone page in docs/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const pages = { 'app.html': 'index.html', 'guide.html': 'guide.html' };
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
for (const [src, out] of Object.entries(pages)) {
  const body = readFileSync(new URL('../src/' + src, import.meta.url), 'utf8');
  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>[hidden]{display:none!important}img{max-width:100%}</style></head><body>
${body}</body></html>
`;
  writeFileSync(new URL('../docs/' + out, import.meta.url), html);
  console.log('docs/' + out, html.length, 'bytes');
}
