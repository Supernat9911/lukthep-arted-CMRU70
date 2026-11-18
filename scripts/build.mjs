// Wraps src/app.html (written as an Artifact page body) into a standalone dist/index.html.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const body = readFileSync(new URL('../src/app.html', import.meta.url), 'utf8');
const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>[hidden]{display:none!important}img{max-width:100%}</style></head><body>
${body}</body></html>
`;
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/index.html', import.meta.url), html);
console.log('dist/index.html', html.length, 'bytes');
