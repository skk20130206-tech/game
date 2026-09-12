import p1 from "./data/orbit-1.txt";
import p2 from "./data/orbit-2.txt";
import p3 from "./data/orbit-3.txt";
import p4 from "./data/orbit-4.txt";
import p5 from "./data/orbit-5.txt";
import p6 from "./data/orbit-6.txt";

const b64 = [p1, p2, p3, p4, p5, p6].map((x) => x.trim()).join("");

export default {
  async fetch() {
    if (b64.length !== 47024) {
      return new Response(`ORBIT data error: expected 47024 chars, got ${b64.length}`, {
        status: 500,
        headers: { "content-type": "text/plain; charset=UTF-8", "cache-control": "no-store" }
      });
    }

    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ORBIT</title><style>html,body{margin:0;background:#050816;color:white;min-height:100%}</style></head><body><script>
(async()=>{try{const b64=${JSON.stringify(b64)};const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));if(!('DecompressionStream' in window))throw new Error('Chrome 또는 Edge 최신 버전을 사용해 주세요.');const ds=new DecompressionStream('gzip');const game=await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();document.open();document.write(game);document.close();}catch(e){document.body.innerHTML='<pre style="padding:20px;white-space:pre-wrap">게임 로딩 실패: '+e+'\n데이터 길이: '+b64.length+'</pre>';console.error(e);}})();
<\/script></body></html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store, max-age=0",
        "x-orbit-build": "complete-47024-v2"
      }
    });
  }
};
