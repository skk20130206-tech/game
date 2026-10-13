import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorker } from '../scripts/load-worker.mjs';

const origin='https://game.test';
const worker=await loadWorker();
const request=path=>worker.fetch(new Request(origin+path));
const paths=['/','/guide','/guide/resources','/guide/planets','/guide/motion','/guide/saves','/about','/updates','/privacy','/terms','/contact'];

test('all public information pages are readable without scripts and have unique metadata',async()=>{
  const titles=new Set(),descriptions=new Set();
  for(const path of paths){
    const response=await request(path),html=await response.text();
    assert.equal(response.status,200,path);
    assert.match(html,/<html lang="ko">/);
    assert.equal((html.match(/<h1>/g)||[]).length,1,path);
    assert.match(html,/<main id="main"/);
    assert.ok(html.includes(`<link rel="canonical" href="${origin+path}">`),path);
    assert.match(html,/<meta name="google-adsense-account" content="ca-pub-6073295964667681">/);
    assert.doesNotMatch(html,/<script|adsbygoogle|광고 예정 영역/);
    const title=html.match(/<title>(.*?)<\/title>/)[1];
    const description=html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(title),path);assert.ok(!descriptions.has(description),path);
    titles.add(title);descriptions.add(description);
  }
});

test('all internal content links and anchors reach actual pages',async()=>{
  const cache=new Map();
  for(const p of [...paths,'/play'])cache.set(p,await (await request(p)).text());
  for(const [page,html]of cache){
    if(page==='/play')continue;
    for(const match of html.matchAll(/href="([^"<>]+)"/g)){
      const url=new URL(match[1].replaceAll('&amp;','&'),origin+page);
      if(url.origin!==origin)continue;
      assert.ok(cache.has(url.pathname),`${page} -> ${url.pathname}`);
      if(url.hash)assert.ok(cache.get(url.pathname).includes(`id="${url.hash.slice(1)}"`),`${page} -> ${url.pathname+url.hash}`);
    }
  }
});

test('crawler endpoints expose the publisher and every public page',async()=>{
  const ads=await request('/ads.txt');
  assert.equal(ads.status,200);assert.match(ads.headers.get('content-type'),/text\/plain/);
  assert.equal(await ads.text(),'google.com, pub-6073295964667681, DIRECT, f08c47fec0942fa0\n');
  const robots=await (await request('/robots.txt')).text();
  assert.match(robots,/User-agent: \*\nAllow: \//);
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  const sitemap=await (await request('/sitemap.xml')).text();
  for(const path of [...paths,'/play'])assert.ok(sitemap.includes(`<loc>${origin+path}</loc>`),path);
  assert.doesNotMatch(sitemap,/<loc>[^<]*(?:health|ads.txt|404)/);
});

test('game and error pages cannot execute advertising; error pages remain noindex',async()=>{
  const game=await (await request('/play?motion=1')).text();
  assert.match(game,/OrbitMotionEditor/);assert.match(game,/<noscript>/);
  assert.doesNotMatch(game,/pagead2\.googlesyndication|<ins[^>]*adsbygoogle/);
  assert.equal((game.match(/rel="canonical"/g)||[]).length,1);
  assert.ok(game.includes(`href="${origin}/play"`));
  for(const path of ['/not-a-page','/guide/missing','/constructor']){
    const response=await request(path),html=await response.text();
    assert.equal(response.status,404);assert.match(html,/noindex,follow/);
    assert.doesNotMatch(html,/google-adsense-account|adsbygoogle|<script/);
  }
  const health=await (await request('/health')).json();
  assert.equal(health.adServingEnabled,false);
  assert.equal(health.adsenseVerification,'meta-and-ads.txt');
  assert.equal(health.adsenseReviewReady,undefined);
});

test('HTTPS and canonical trailing slashes redirect without losing intended navigation',async()=>{
  const http=await worker.fetch(new Request('http://game.test/guide?from=home'));
  assert.equal(http.status,301);assert.equal(http.headers.get('location'),'https://game.test/guide?from=home');
  const slash=await request('/guide/resources/?from=home');
  assert.equal(slash.status,301);assert.equal(slash.headers.get('location'),origin+'/guide/resources?from=home');
  assert.equal((await request('/missing/')).status,404);
});
