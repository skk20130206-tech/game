import immersiveGame from "./game/play.txt";
import ironOreBase64 from "./assets/iron-ore-base64.txt";
import startScreen from "./patch/start-screen-side-ad.txt";
import shareFeature from "./patch/share-feature.txt";
import siteReady from "./patch/adsense-ready.txt";
import {homePage,guidePage,resourcesPage,planetsPage,motionPage,savesPage,aboutPage,updatesPage,privacyPage,termsPage,contactPage,notFoundPage,robots,sitemap,CONTENT_PATHS,SITE_PATHS} from "./site.js";

const BUILD="justgame-verdant-plants-20261018-v32";
const ADSENSE_CLIENT="ca-pub-6073295964667681";
// Ownership verification does not require loading an advertising script.
// Ad serving remains off until approval, placement and CMP configuration are reviewed.
const ADSENSE_META=`<meta name="google-adsense-account" content="${ADSENSE_CLIENT}">`;
const ADS_TXT=`google.com, ${ADSENSE_CLIENT.slice(3)}, DIRECT, f08c47fec0942fa0\n`;
const pages={"/":homePage,"/guide":guidePage,"/guide/resources":resourcesPage,"/guide/planets":planetsPage,"/guide/motion":motionPage,"/guide/saves":savesPage,"/about":aboutPage,"/updates":updatesPage,"/privacy":privacyPage,"/terms":termsPage,"/contact":contactPage};
let gameHtmlPromise;

const securityHeaders={
  "x-content-type-options":"nosniff",
  "referrer-policy":"strict-origin-when-cross-origin",
  "x-frame-options":"SAMEORIGIN",
  "permissions-policy":"camera=(), microphone=(), geolocation=()"
};

function pageMetadata(html,canonical){
  const safe=canonical.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;");
  return html.replace("</head>",`${ADSENSE_META}<link rel="canonical" href="${safe}"><meta property="og:url" content="${safe}"></head>`);
}

function htmlResponse(html,status=200,cache="public, max-age=300"){
  return new Response(html,{status,headers:{"content-type":"text/html; charset=UTF-8","content-language":"ko","cache-control":cache,"x-orbit-build":BUILD,...securityHeaders}});
}

async function loadGameHtml(){
  let html=immersiveGame;

  const headEnd=html.indexOf("</head>");
  if(headEnd<0) throw new Error("HTML head closing tag not found");
  const reviewMeta=`<meta name="description" content="justgame은 낯선 행성을 탐험하고 자원을 수집해 거점을 건설하며 신비로운 생명체를 발견하는 브라우저 우주 탐험 게임입니다."><meta name="robots" content="index,follow"><meta name="theme-color" content="#07131b"><meta property="og:type" content="website"><meta property="og:title" content="justgame | 우주 탐험 게임"><meta property="og:description" content="행성을 탐험하고 자원을 모아 개척지를 세우는 브라우저 우주 탐험 게임.">`;
  html=html.slice(0,headEnd)+reviewMeta+html.slice(headEnd);
  html=html.replace(/<title>[^<]*<\/title>/i,"<title>justgame | 2D 우주 탐험 게임</title>");

  const bodyEnd=html.lastIndexOf("</body>");
  if(bodyEnd<0) throw new Error("HTML body closing tag not found");
  html=html.slice(0,bodyEnd)+startScreen.trim()+"\n"+shareFeature.trim()+"\n"+siteReady.trim()+"\n"+html.slice(bodyEnd);
  html=html.replace(/<aside class="orbit-ad-rail"[\s\S]*?<\/aside>/,"");
  html=html.replace("</body>",'<noscript><div style="position:fixed;inset:0;z-index:99999;background:#081411;color:#eef5e7;padding:32px;font:18px/1.8 system-ui"><h1>justgame 2D 우주 탐험</h1><p>플레이하려면 브라우저에서 JavaScript를 허용해 주세요. 게임 소개와 가이드는 JavaScript 없이 읽을 수 있습니다.</p><a href="/">게임 소개 홈</a> · <a href="/guide">탐험 가이드</a> · <a href="/privacy">개인정보처리방침</a></div></noscript></body>');

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
    if(url.protocol==="http:"&&!['localhost','127.0.0.1'].includes(url.hostname)){
      url.protocol="https:";
      return Response.redirect(url.href,301);
    }
    if(SITE_PATHS.includes(path)&&path!==url.pathname){
      url.pathname=path;
      return Response.redirect(url.href,301);
    }

    if(path==="/assets/iron-ore-20261001-v22.png"||path==="/assets/iron-ore-20261001.png"){
      const bytes=Uint8Array.from(atob(ironOreBase64.trim()),char=>char.charCodeAt(0));
      return new Response(bytes,{headers:{"content-type":"image/png","cache-control":"public, max-age=31536000, immutable",...securityHeaders}});
    }

    if(path==="/health"){
      try{
        if(!gameHtmlPromise) gameHtmlPromise=loadGameHtml();
        const html=await gameHtmlPromise;
        return new Response(JSON.stringify({ok:true,build:BUILD,rendering:"Canvas 2D",perspective:"top-down",webglRequired:false,immersive:true,tutorialSteps:7,motionEditor:true,creatureCare:true,companions:true,relics:15,htmlLength:html.length,creatures:11,mystic:true,startScreen:true,share:true,adsenseClient:ADSENSE_CLIENT,adsenseVerification:"meta-and-ads.txt",adsenseSnippetOnContentPages:false,adServingEnabled:false,gameRoute:"/play",contentPages:CONTENT_PATHS,playAds:false,preApprovalAdPlaceholders:false}),{headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store","x-robots-tag":"noindex",...securityHeaders}});
      }catch(error){
        gameHtmlPromise=undefined;
        return new Response(JSON.stringify({ok:false,build:BUILD,error:error instanceof Error?error.message:String(error)}),{status:500,headers:{"content-type":"application/json; charset=UTF-8","cache-control":"no-store",...securityHeaders}});
      }
    }

    if(path==="/robots.txt") return new Response(robots(origin),{headers:{"content-type":"text/plain; charset=UTF-8","cache-control":"public, max-age=3600",...securityHeaders}});
    if(path==="/sitemap.xml") return new Response(sitemap(origin),{headers:{"content-type":"application/xml; charset=UTF-8","cache-control":"public, max-age=3600",...securityHeaders}});
    if(path==="/ads.txt") return new Response(ADS_TXT,{headers:{"content-type":"text/plain; charset=UTF-8","cache-control":"public, max-age=3600",...securityHeaders}});
    if(path==="/favicon.ico") return new Response(null,{status:204,headers:{"cache-control":"public, max-age=86400",...securityHeaders}});

    if(Object.hasOwn(pages,path)) return htmlResponse(pageMetadata(pages[path](),origin+path));

    if(path==="/play"){
      try{
        if(!gameHtmlPromise) gameHtmlPromise=loadGameHtml();
        const html=await gameHtmlPromise;
        return new Response(pageMetadata(html,origin+"/play"),{headers:{"content-type":"text/html; charset=UTF-8","content-language":"ko","cache-control":"no-store, no-cache, must-revalidate, max-age=0","pragma":"no-cache","x-orbit-build":BUILD,...securityHeaders}});
      }catch(error){
        gameHtmlPromise=undefined;
        console.error("Game page unavailable",error);
        return htmlResponse('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>잠시 게임을 열 수 없어요 | justgame</title></head><body style="margin:0;background:#081411;color:#eef5e7;font:18px/1.8 system-ui;padding:32px"><h1>잠시 게임을 열 수 없어요.</h1><p>잠시 후 다시 시도해 주세요. 브라우저의 탐험 기록은 삭제되지 않습니다.</p><a href="/" style="color:#d5ef93">홈으로 돌아가기</a> · <a href="/contact" style="color:#d5ef93">문제 문의하기</a></body></html>',500,"no-store");
      }
    }

    return htmlResponse(notFoundPage(),404,"no-store");
  }
};
