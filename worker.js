import immersiveGame from "./game/play.txt";
import startScreen from "./patch/start-screen-side-ad.txt";
import shareFeature from "./patch/share-feature.txt";
import siteReady from "./patch/adsense-ready.txt";
import modelPackV2 from "./patch/model-pack-v2.txt";
import {homePage,guidePage,aboutPage,updatesPage,privacyPage,termsPage,contactPage,notFoundPage,robots,sitemap} from "./site.js";

const BUILD="justgame-industrial-lander-20260914-v13";
const ADSENSE_CLIENT="ca-pub-6073295964667681";
const ADSENSE_SNIPPET=`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`;
let gameHtmlPromise;

const securityHeaders={
  "x-content-type-options":"nosniff",
  "referrer-policy":"strict-origin-when-cross-origin",
  "x-frame-options":"SAMEORIGIN",
  "permissions-policy":"camera=(), microphone=(), geolocation=()"
};

function injectAdSense(html){
  if(!html||html.includes(`client=${ADSENSE_CLIENT}`)) return html;
  const headEnd=html.indexOf("</head>");
  if(headEnd<0) return html;
  return html.slice(0,headEnd)+ADSENSE_SNIPPET+html.slice(headEnd);
}

function htmlResponse(html,status=200,cache="public, max-age=300",withAdSense=true){
  const body=withAdSense?injectAdSense(html):html;
  return new Response(body,{status,headers:{"content-type":"text/html; charset=UTF-8","content-language":"ko","cache-control":cache,...securityHeaders}});
}

function cleanHomeHtml(){
  return homePage().replace(/<div class="adbox"[\s\S]*?<\/div><\/div>/,"");
}

function injectModelPack(html){
  const shipStart=html.indexOf("  function spaceshipModel(b,time,space,moving){");
  const shipEnd=html.indexOf("  function lifeModel(b,id,time,met){",shipStart);
  if(shipStart<0||shipEnd<0||shipEnd<=shipStart) throw new Error("3D spaceship model markers not found");
  html=html.slice(0,shipStart)+modelPackV2.trimEnd()+"\n"+html.slice(shipEnd);

  // Keep gameplay exhaust aligned with the industrial lander's twin rear engine cores.
  html=html.replace(
    "for(const side of[-1,1])b.cone(side*39,23,-54,5,0,-(32+Math.sin(t*30)*6)*(g.boosting?2:1),'#adeffe',7,1);",
    "for(const side of[-1,1]){b.tube([side*54,45,-123],[side*54,45,-168-(g.boosting?28:0)-Math.sin(t*30)*6],9,0,'#8cecff',9,1);b.tube([side*54,45,-123],[side*54,45,-150],4,0,'#fff1c6',7,1);}"
  );
  if(!html.includes("ORBIT Explorer Mk II")||!html.includes("#e89a45")||!html.includes("heavy industrial survey lander")) throw new Error("3D model pack injection failed");
  return html;
}

async function loadGameHtml(){
  let html=injectModelPack(immersiveGame);

  const headEnd=html.indexOf("</head>");
  if(headEnd<0) throw new Error("HTML head closing tag not found");
  const reviewMeta=`<meta name="description" content="justgame은 낯선 행성을 탐험하고 자원을 수집해 거점을 건설하며 신비로운 생명체를 발견하는 브라우저 우주 탐험 게임입니다."><meta name="robots" content="index,follow"><meta name="theme-color" content="#07131b"><link rel="canonical" href="/play"><meta property="og:type" content="website"><meta property="og:title" content="justgame | 우주 탐험 게임"><meta property="og:description" content="행성을 탐험하고 자원을 모아 개척지를 세우는 브라우저 우주 탐험 게임.">`;
  html=html.slice(0,headEnd)+reviewMeta+html.slice(headEnd);
  html=html.replace(/<title>[^<]*<\/title>/i,"<title>justgame | 입체 우주 탐험 게임</title>");

  const bodyEnd=html.lastIndexOf("</body>");
  if(bodyEnd<0) throw new Error("HTML body closing tag not found");
  html=html.slice(0,bodyEnd)+startScreen.trim()+"\n"+shareFeature.trim()+"\n"+siteReady.trim()+"\n"+html.slice(bodyEnd);
  html=html.replace(/<aside class="orbit-ad-rail"[\s\S]*?<\/aside>/,"");

  const required=["mistmoth","sunwhorl","aurorayne","cinderwisp","veilfox"];
  for(const id of required) if(!html.includes(id)) throw new Error(`Mystic creature missing after patch: ${id}`);
  if(!html.includes("orbit-start-screen")||!html.includes("orbit-site-links")) throw new Error("AdSense-ready start screen patch failed");
  if(!html.includes("orbit-share-button")||!html.includes("navigator.share")) throw new Error("Share feature injection failed");
  if(!html.toLowerCase().includes("<!doctype html")||!html.includes("ORBIT")) throw new Error("ORBIT HTML validation failed");
  return html;
}

export default {
  async fetch(request){
    const url=new URL(request.url);
    const path=url.pathname!=="/"?url.pathname.replace(/\/+$/,""):"/";
    const origin=url.origin;

    if(path==="/health"){
      try{
        if(!gameHtmlPromise) gameHtmlPromise=loadGameHtml();
        const html=await gameHtmlPromise;
        return new Response(JSON.stringify({ok:true,build:BUILD,rendering:"WebGL 3D",modelSystem:"procedural-reference-v3",spaceshipModel:"ORBIT Explorer Mk II",spaceshipStyle:"heavy industrial survey lander",external3DDependency:false,immersive:true,creatureCare:true,companions:true,relics:15,htmlLength:html.length,creatures:11,mystic:true,startScreen:true,share:true,adsenseReviewReady:true,adsenseClient:ADSENSE_CLIENT,adsenseSnippetOnContentPages:true,gameRoute:"/play",contentPages:["/","/guide","/about","/updates","/privacy","/terms","/contact"],playAds:false,preApprovalAdPlaceholders:false}),{headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store",...securityHeaders}});
      }catch(error){
        gameHtmlPromise=undefined;
        return new Response(JSON.stringify({ok:false,build:BUILD,error:error instanceof Error?error.message:String(error)}),{status:500,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store",...securityHeaders}});
      }
    }

    if(path==="/robots.txt") return new Response(robots(origin),{headers:{"content-type":"text/plain; charset=UTF-8","cache-control":"public, max-age=3600",...securityHeaders}});
    if(path==="/sitemap.xml") return new Response(sitemap(origin),{headers:{"content-type":"application/xml; charset=UTF-8","cache-control":"public, max-age=3600",...securityHeaders}});
    if(path==="/favicon.ico") return new Response(null,{status:204,headers:{"cache-control":"public, max-age=86400",...securityHeaders}});

    if(path==="/") return htmlResponse(cleanHomeHtml());
    if(path==="/guide") return htmlResponse(guidePage());
    if(path==="/about") return htmlResponse(aboutPage());
    if(path==="/updates") return htmlResponse(updatesPage());
    if(path==="/privacy") return htmlResponse(privacyPage());
    if(path==="/terms") return htmlResponse(termsPage());
    if(path==="/contact") return htmlResponse(contactPage());

    if(path==="/play"){
      try{
        if(!gameHtmlPromise) gameHtmlPromise=loadGameHtml();
        const html=await gameHtmlPromise;
        return new Response(html,{headers:{"content-type":"text/html; charset=UTF-8","content-language":"ko","cache-control":"no-store, no-cache, must-revalidate, max-age=0","pragma":"no-cache","x-orbit-build":BUILD,...securityHeaders}});
      }catch(error){
        gameHtmlPromise=undefined;
        const message=error instanceof Error?(error.stack||error.message):String(error);
        const safe=message.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
        return htmlResponse(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>ORBIT deployment error</title><body style="margin:0;background:#050816;color:#fff;font:16px/1.6 monospace;padding:24px"><h1>ORBIT 배포 오류</h1><pre style="white-space:pre-wrap">${safe}</pre><p>build: ${BUILD}</p><p><a href="/" style="color:#c3f379">홈으로 돌아가기</a></p></body>`,500,"no-store",false);
      }
    }

    return htmlResponse(notFoundPage(),404,"no-store");
  }
};
