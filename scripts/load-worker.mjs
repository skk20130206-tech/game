// Run the same Worker module under Node, treating Wrangler Text imports as text.
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
export async function loadWorker() {
  let source = await readFile(new URL('worker.js', root), 'utf8');
  for (const match of source.matchAll(/import (\w+) from "(\.\/.+?\.txt)";/g)) {
    const value = await readFile(new URL(match[2], root), 'utf8');
    source = source.replace(match[0], () => `const ${match[1]}=${JSON.stringify(value)};`);
  }
  const site = await readFile(new URL('site.js', root), 'utf8');
  const siteUrl = 'data:text/javascript;base64,' + Buffer.from(site).toString('base64');
  source = source.replace('from "./site.js"', () => `from "${siteUrl}"`);
  return (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
}
