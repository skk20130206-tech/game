import p1 from "./data/orbit-1.txt";
import p2 from "./data/orbit-2.txt";
import p3 from "./data/orbit-3.txt";
import p4 from "./data/orbit-4.txt";
import p5 from "./data/orbit-5.txt";
import p6 from "./data/orbit-6.txt";
import newMeta from "./patch/new-meta.txt";
import newCreature from "./patch/new-creature.txt";
import startScreen from "./patch/start-screen.txt";

const b64=[p1,p2,p3,p4,p5,p6].map(x=>x.trim()).join("");
const BUILD="game-mystic-start-screen-20260912-v4";
let gameHtmlPromise;

async function loadGameHtml(){
  if(b64.length!==47024) throw new Error(`ORBIT data length mismatch: expected 47024, got ${b64.length}`);

  const binary=atob(b64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);

  const decompressed=new Response(bytes).body.pipeThrough(new DecompressionStream("gzip"));
  let html=await new Response(decompressed).text();

  const metaStart=html.indexOf("  const PLANETS=[");
  const metaEnd=html.indexOf("  const BUILDINGS={",metaStart);
  if(metaStart<0||metaEnd<0||metaEnd<=metaStart) throw new Error("Planet/species section markers not found");
  html=html.slice(0,metaStart)+newMeta.trimEnd()+"\n"+html.slice(metaEnd);

  const creatureStart=html.indexOf("  function creature(c,id,t=0,scale=1,met=false){");
  const creatureEnd=html.indexOf("  function astronaut(c,t,angle,moving){",creatureStart);
  if(creatureStart<0||creatureEnd<0||creatureEnd<=creatureStart) throw new Error("Creature renderer section markers not found");
  html=html.slice(0,creatureStart)+newCreature.trimEnd()+"\n"+html.slice(creatureEnd);

  const bodyEnd=html.lastIndexOf("</body>");
  if(bodyEnd<0) throw new Error("HTML body closing tag not found");
  html=html.slice(0,bodyEnd)+startScreen.trim()+"\n"+html.slice(bodyEnd);

  const required=["mistmoth","sunwhorl","aurorayne","cinderwisp","veilfox"];
  for(const id of required) if(!html.includes(id)) throw new Error(`Mystic creature missing after patch: ${id}`);
  if(!html.includes("orbit-start-screen")||!html.includes("orbit-shop-panel")||!html.includes("orbit-ad-slot")) throw new Error("Start screen monetization UI injection failed");
  if(!html.toLowerCase().includes("<!doctype html")||!html.includes("ORBIT")) throw new Error("ORBIT HTML validation failed");
  return html;
}

export default {
  async fetch(request){
    const url=new URL(request.url);

    if(url.pathname==="/health"){
      try{
        if(!gameHtmlPromise) gameHtmlPromise=loadGameHtml();
        const html=await gameHtmlPromise;
        return new Response(JSON.stringify({ok:true,build:BUILD,dataLength:b64.length,htmlLength:html.length,creatures:11,mystic:true,startScreen:true,shopUI:true,adSlot:true,supportUI:true}),{headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
      }catch(error){
        gameHtmlPromise=undefined;
        return new Response(JSON.stringify({ok:false,build:BUILD,error:error instanceof Error?error.message:String(error)}),{status:500,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store"}});
      }
    }

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