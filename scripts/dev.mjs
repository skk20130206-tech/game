import http from 'node:http';
import { build } from './build.mjs';
import { loadWorker } from './load-worker.mjs';
await build();
const worker = await loadWorker();
const port = Number(process.env.PORT || 8000);
http.createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request(new URL(req.url, `http://localhost:${port}`), {method:req.method}));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
}).listen(port, '0.0.0.0', () => console.log(`justgame: http://localhost:${port}/play`));
