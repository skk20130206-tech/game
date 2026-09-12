import orbitData from "./data/orbit-1.txt";

export default {
  async fetch(request) {
    const b64 = orbitData.trim();
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ORBIT</title><style>html,body{margin:0;background:#050816;color:white;min-height:100%}</style></head><body><script>
(async()=>{try{const b64=${JSON.stringify(b64)};const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));if(!('DecompressionStream' in window))throw new Error('Chrome 또는 Edge 최신 버전을 사용해 주세요.');const ds=new DecompressionStream('gzip');const game=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();document.open();document.write(game);document.close();}catch(e){document.body.innerHTML='<pre style="padding:20px;white-space:pre-wrap">게임 로딩 실패: '+e+'</pre>';console.error(e);}})();
<\/script></body></html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store"
      }
    });
  }
};
