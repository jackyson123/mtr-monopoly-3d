import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';

const dir = 'packed';
if (existsSync(dir)) {
  const groups = new Map();
  for (const file of readdirSync(dir)) {
    const m = file.match(/^(.*?)\.b64(?:\.(\d+))?$/);
    if (!m) continue;
    if (!groups.has(m[1])) groups.set(m[1], []);
    groups.get(m[1]).push({ part: Number(m[2] || 0), file });
  }
  for (const [target, parts] of groups) {
    parts.sort((a, b) => a.part - b.part);
    const b64 = parts.map((p) => readFileSync(join(dir, p.file), 'utf8').trim()).join('');
    const out = gunzipSync(Buffer.from(b64, 'base64'));
    writeFileSync(join('src', target), out);
    console.log('unpacked src/' + target + ' (' + out.length + ' bytes)');
  }
}
