// Prints the BUILD hash of the checkout this file is in: the same FNV-1a over js/*.js that index.html computes and
// debug snapshots carry ("build"). If a snapshot's build differs, the game that took it was not running this code.
//   node js/build-hash.mjs
import {readFileSync} from 'node:fs';
const root = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const FILES = JSON.parse(html.match(/const FILES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
let h = 0x811c9dc5;
for(const f of FILES){ const t = readFileSync(new URL('js/' + f + '.js', root), 'utf8');
  for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } }
console.log((h >>> 0).toString(16).padStart(8, '0'));
