import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exportSpaceship } from './export-spaceship.mjs';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
export async function build() {
  const renderer=await read('game/renderer-3d.js'),model=await read('patch/model-pack-v2.txt');
  const start=renderer.indexOf('  function spaceshipModel(b,time,space,moving){'),end=renderer.indexOf('  function lifeModel(b,id,time,met){',start);
  if(start<0||end<0||renderer.slice(start,end).trim()!==model.trim())throw new Error('Spaceship source and Worker model patch differ');
  const ship=await exportSpaceship();
  let html = await read('game/shell.html');
  const css = await read('game/style.css');
  html = html.replace(/<link[^>]*href="style.css"[^>]*>/, () => `<style>${css}</style>`);
  for (const name of ['core', 'portraits', 'renderer-3d', 'app']) {
    const js = await read(`game/${name}.js`);
    if (/<\/script/i.test(js)) throw new Error(`Unsafe closing script tag in ${name}`);
    html = html.replace(`<script src="${name}.js"></script>`, () => `<script>\n${js}\n</script>`);
  }
  await writeFile(new URL('game/play.txt', root), html);
  const patches = await Promise.all(['start-screen-side-ad', 'share-feature', 'adsense-ready'].map(name => read(`patch/${name}.txt`)));
  let preview = html.replace('</body>', () => patches.join('\n') + '\n</body>');
  preview = preview.replace(/<aside class="orbit-ad-rail"[\s\S]*?<\/aside>/, '').replace(/^[\t ]+$/gm, '');
  await writeFile(new URL('index.html', root), preview);
  return { htmlBytes: Buffer.byteLength(html), previewBytes: Buffer.byteLength(preview),ship };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await build());
