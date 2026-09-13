import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { loadWorker } from '../scripts/load-worker.mjs';
const require = createRequire(import.meta.url);
const {Game, PLANETS, SPECIES, dist} = require('../game/core.js');
const tick = (g, seconds, input={}) => { for(let i=0;i<Math.round(seconds*60);i++)g.tick(1/60,input); };

test('all five existing planets and eleven species survive v1 saves', () => {
  const old = new Game().snapshot();
  old.discovered=Object.keys(SPECIES);old.met=Object.keys(SPECIES);
  delete old.friendship;delete old.creatureCare;delete old.companion;delete old.relics;
  old.worlds.verdant.buildings.push({id:'legacy-house',type:'habitat',x:500,y:300});
  old.ship.altitude=0;
  const g=new Game(old);
  assert.equal(PLANETS.length,5);assert.equal(g.state.discovered.length,11);
  assert.equal(g.state.ship.altitude,0);assert.equal(g.world().buildings.length,1);
  assert.equal(g.world().buildings[0].level,1);
  assert.deepEqual(g.state.relics,[]);
  assert.equal(new Game(g.snapshot()).state.met.length,11);
});

test('movement accelerates, stops and does not jump through a building', () => {
  const g=new Game();g.state.player={x:600,y:200,angle:0};
  g.tick(1/60,{right:true});const first=g.state.player.x-600;
  tick(g,.5,{right:true});const x=g.state.player.x;
  g.tick(1/60,{right:true});assert.ok(g.state.player.x-x>first*2);
  tick(g,1);assert.ok(Math.hypot(g.velocity.x,g.velocity.y)<.2);
  g.world().buildings.push({id:'wall',type:'habitat',x:800,y:200});
  tick(g,2,{right:true});assert.ok(g.state.player.x<750);
});

test('mining still awards once, requires range, and depleted nodes regrow', () => {
  const g=new Game(),n=g.world().nodes[0];g.state.player={x:n.x-65,y:n.y,angle:0};
  for(let i=0;i<n.maxHp;i++){g.cooldown=0;assert.ok(g.interact(n.id).ok);}
  assert.equal(g.state.inventory.iron,6);assert.equal(g.state.stats.mined,1);
  g.cooldown=0;assert.equal(g.interact(n.id).ok,false);
  tick(g,151);assert.equal(n.hp,n.maxHp);
  g.state.player.x=-1000;assert.equal(g.interact(n.id).ok,false);
});

test('friendship has costs, cooldowns, unlocks and persistent companion state', () => {
  const g=new Game(),c=g.world().creatures[0];g.state.player={x:c.x,y:c.y,angle:0};
  g.befriend(c);const gift=g.state.inventory.biomass;g.befriend(c);assert.equal(g.state.inventory.biomass,gift);
  assert.equal(g.careForCreature(c.id,'follow').ok,false);
  assert.ok(g.careForCreature(c.id,'pet').ok);assert.equal(g.careForCreature(c.id,'pet').ok,false);
  assert.ok(g.careForCreature(c.id,'feed').ok);assert.equal(g.state.inventory.biomass,gift-2);
  assert.ok(g.careForCreature(c.id,'follow').ok);assert.equal(g.state.companion,c.id);
  assert.ok(g.careForCreature(c.id,'guide').ok);assert.ok(g.waypoint);
  g.state.player.x+=220;tick(g,2);assert.ok(dist(c,g.state.player)<110);
  const resumed=new Game(g.snapshot());assert.equal(resumed.state.companion,c.id);assert.equal(resumed.state.friendship[c.species],2);
  g.paused=true;assert.equal(g.careForCreature(c.id,'feed').ok,false);
});

test('relic rewards are once per relic and remain claimed after loading', () => {
  const g=new Game(),r=g.world().relics[0];g.state.player={x:r.x,y:r.y,angle:0};
  assert.ok(g.studyRelic(r.id).ok);assert.equal(g.state.inventory.crystal,5);
  assert.equal(g.studyRelic(r.id).ok,false);assert.equal(g.state.inventory.crystal,5);
  const loaded=new Game(g.snapshot());assert.equal(loaded.studyRelic(r.id).ok,false);
  assert.equal(PLANETS.reduce((sum,p)=>sum+g.ensureWorld(p.id).relics.length,0),15);
});

test('building placement, upgrade costs, light and charging survive saving', () => {
  const g=new Game();g.state.inventory={iron:50,crystal:30,biomass:30};
  g.state.player={x:500,y:400,angle:0};g.world().nodes=[];
  assert.ok(g.build('habitat',600,400).ok);const house=g.world().buildings[0];
  assert.equal(g.state.inventory.iron,38);assert.equal(g.canPlace('habitat',605,400).ok,false);
  g.state.oxygen=20;assert.ok(g.useBuilding(house.id,'rest').ok);assert.equal(g.state.oxygen,100);
  assert.ok(g.useBuilding(house.id,'lights').ok);assert.equal(house.lit,false);
  assert.ok(g.useBuilding(house.id,'upgrade').ok);assert.equal(g.state.inventory.iron,32);
  assert.equal(g.useBuilding(house.id,'upgrade').ok,false);
  const loaded=new Game(g.snapshot()),h=loaded.world().buildings[0];assert.equal(h.lit,false);assert.equal(h.level,2);
  loaded.world().buildings.push({id:'solar',type:'solar',x:530,y:400,level:2});
  loaded.state.fuel=20;tick(loaded,1);assert.ok(loaded.state.fuel>=26.9);
});

test('launch, boost, altitude, warp, landing and emergency refuel remain playable', () => {
  const g=new Game();assert.ok(g.launch().ok);tick(g,.5,{right:true,run:true,ascend:true});
  assert.ok(g.state.ship.altitude>45);assert.ok(g.state.fuel<100);
  for(const p of PLANETS){g.state.fuel=100;assert.ok(g.warp(p.id).ok);tick(g,2.5);assert.equal(g.travel,null);assert.ok(g.land(p.id).ok);assert.equal(g.state.planet,p.id);assert.ok(g.launch().ok);}
  g.state.fuel=0;g.state.inventory.biomass=0;assert.ok(g.refuel().ok);tick(g,6.1);assert.ok(g.state.fuel>=22);
});

test('every species and biome produces finite 3D mesh data', async () => {
  const context=vm.createContext({OrbitCore:{Game,PLANETS,SPECIES,...require('../game/core.js')},Float32Array,Math});
  vm.runInContext(await readFile(new URL('../game/renderer-3d.js',import.meta.url),'utf8'),context);
  const {Batch,lifeModel,terrainBatch}=context.Orbit3D;
  for(const id of Object.keys(SPECIES)){const b=new Batch();lifeModel(b,id,1,true);const data=b.array();assert.ok(data.length>100);assert.ok(data.every(Number.isFinite),id);}
  for(const p of PLANETS)assert.ok(terrainBatch(p).every(Number.isFinite),p.id);
});

test('Worker serves current game, all content pages, existing ads separation and health', async () => {
  const worker=await loadWorker();
  for(const path of ['/','/play','/guide','/about','/updates','/privacy','/terms','/contact','/robots.txt','/sitemap.xml'])assert.equal((await worker.fetch(new Request('https://game.test'+path))).status,200,path);
  const health=await (await worker.fetch(new Request('https://game.test/health'))).json();
  assert.equal(health.ok,true);assert.equal(health.creatures,11);assert.equal(health.rendering,'WebGL 3D');
  const html=await (await worker.fetch(new Request('https://game.test/play'))).text();
  assert.ok(html.includes('orbit-share-button'));assert.ok(html.includes('orbit:start'));
  assert.equal(html.includes('pagead/js/adsbygoogle.js'),false);
  assert.ok((await (await worker.fetch(new Request('https://game.test/'))).text()).includes('pagead/js/adsbygoogle.js'));
  assert.equal((await worker.fetch(new Request('https://game.test/missing'))).status,404);
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});
