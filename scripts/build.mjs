import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exportSpaceship } from './export-spaceship.mjs';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
export async function build() {
  const rendererSource=await read('game/renderer-3d.js'),model=await read('patch/model-pack-v2.txt'),playerImage=await readFile(new URL('assets/player-k17.webp',root));
  const imageData=`data:image/webp;base64,${playerImage.toString('base64')}`;
  const renderer=rendererSource.replace("'__PLAYER_IMAGE_DATA__'",JSON.stringify('/assets/player-k17.webp?v=20260919'));
  await writeFile(new URL('assets/player-k17.webp.txt',root),playerImage.toString('base64')+'\n');
  if(renderer===rendererSource)throw new Error('Player image placeholder missing from renderer');
  const start=rendererSource.indexOf('  function spaceshipModel(b,time,space,moving){'),end=rendererSource.indexOf('  function lifeModel(b,id,time,met){',start);
  if(start<0||end<0||rendererSource.slice(start,end).trim()!==model.trim())throw new Error('Spaceship source and Worker model patch differ');
  const ship=await exportSpaceship();
  let html = await read('game/shell.html');
  const css = await read('game/style.css');
  html = html.replace(/<link[^>]*href="style.css"[^>]*>/, () => `<style>${css}</style>`);
  for (const name of ['core', 'portraits', 'player-rig', 'tutorial', 'renderer-3d', 'app']) {
    const js = name==='renderer-3d'?renderer:await read(`game/${name}.js`);
    if (/<\/script/i.test(js)) throw new Error(`Unsafe closing script tag in ${name}`);
    html = html.replace(`<script src="${name}.js"></script>`, () => `<script>\n${js}\n</script>`);
  }
  await writeFile(new URL('game/play.txt', root), html);
  const patches = await Promise.all(['start-screen-side-ad', 'share-feature', 'adsense-ready'].map(name => read(`patch/${name}.txt`)));
  let preview = html.replace('/assets/player-k17.webp?v=20260919',()=>imageData).replace('</body>', () => patches.join('\n') + '\n</body>');
  preview = preview.replace(/<aside class="orbit-ad-rail"[\s\S]*?<\/aside>/, '').replace(/^[\t ]+$/gm, '');
  await writeFile(new URL('index.html', root), preview);
  return { htmlBytes: Buffer.byteLength(html), previewBytes: Buffer.byteLength(preview),ship };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(await build());
