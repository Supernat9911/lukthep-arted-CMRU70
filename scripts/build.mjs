// Builds the standalone site in docs/ from the page bodies in src/ (written as Artifact page bodies).
//   index.html   ← src/home.html   (home page with the two login links)
//   teacher.html ← src/app.html    (teacher login + system)
//   student.html ← src/app.html    (student login + student view)
//   guide.html   ← src/guide.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const src = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const portal = (body, kind, title) => {
  const tag = '<title>ลูกเทพศิลปศึกษา</title>';
  if (!body.includes(tag)) throw new Error('app.html title changed; update build.mjs');
  return body.replace(tag, `<title>${title}</title>\n<meta name="lukthep-portal" content="${kind}">`);
};
const pages = {
  'index.html': src('home.html'),
  'teacher.html': portal(src('app.html'), 'teacher', 'ลูกเทพศิลปศึกษา · อาจารย์'),
  'student.html': portal(src('app.html'), 'student', 'ลูกเทพศิลปศึกษา · นักศึกษา'),
  'guide.html': src('guide.html'),
};
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
for (const [out, body] of Object.entries(pages)) {
  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>[hidden]{display:none!important}img{max-width:100%}</style></head><body>
${body}</body></html>
`;
  writeFileSync(new URL('../docs/' + out, import.meta.url), html);
  console.log('docs/' + out, html.length, 'bytes');
}
