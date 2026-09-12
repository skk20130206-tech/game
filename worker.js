import p1 from "./data/orbit-1.txt";
import p2 from "./data/orbit-2.txt";
import p3 from "./data/orbit-3.txt";
import p4 from "./data/orbit-4.txt";
import p5 from "./data/orbit-5.txt";
import p6 from "./data/orbit-6.txt";
import oldMeta from "./patch/old-meta.txt";
import newMeta from "./patch/new-meta.txt";
import oldCreature from "./patch/old-creature.txt";
import newCreature from "./patch/new-creature.txt";

const b64=[p1,p2,p3,p4,p5,p6].map(x=>x.trim()).join("");
const BUILD="game-mystic-creatures-20260912-v1";
let gameHtmlPromise;

async function loadGameHtml(){
  if(b64.length!==47024) throw new Error(`ORBIT data length mismatch: expected 47024, got ${b64.length}`);
  const binary=atob(b64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  const decompressed=new Response(bytes).body.pipeThrough(new DecompressionStream("gzip"));
  let html=await new Response(decompressed).text();
  if(!html.includes(oldMeta)) throw new Error("Mystic creature metadata patch target not found");
  if(!html.includes(oldCreature)) throw new Error("Mystic creature renderer patch target not found");
  html=html.replace(oldMeta,newMeta).replace(oldCreature,newCreature);
  if(!html.includes("mistmoth")||!html.includes("veilfox")||!html.includes("ORBIT")) throw new Error("Mystic creature patch validation failed");
  return html;
}

export default {
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/health") return new Response(JSON.stringify({ok:true,build:BUILD,dataLength:b64.length,creatures:11,mystic:true}),{headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
    try{
      if(!gameHtmlPromise) gameHtmlPromise=loadGameHtml();
      const html=await gameHtmlPromise;
      return new Response(html,{headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store, no-cache, must-revalidate, max-age=0","pragma":"no-cache","x-orbit-build":BUILD}});
    }catch(error){
      gameHtmlPromise=undefined;
      const message=error instanceof Error?(error.stack||error.message):String(error);
      const safe=message.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
      return new Response(`<!doctype html><meta charset="utf-8"><title>ORBIT deployment error</title><body style="margin:0;background:#050816;color:#fff;font:16px/1.6 monospace;padding:24px"><h1>ORBIT 배포 오류</h1><pre style="white-space:pre-wrap">${safe}</pre><p>build: ${BUILD}</p></body>`,{status:500,headers:{"content-type":"text/html; charset=UTF-8","cache-control":"no-store","x-orbit-build":BUILD}});
    }
  }
};
