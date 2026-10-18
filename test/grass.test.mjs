import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {Game,PLANETS}=require('../game/core.js');
const tick=(g,seconds)=>{for(let i=0;i<seconds*60;i++)g.tick(1/60,{});};

test('grass grows only on Verdant, including landing practice, and remains harvestable and renewable',()=>{
  const g=new Game();
  for(const training of [false,true])for(const p of PLANETS){
    const world=g.makeWorld(p,training);
    assert.equal(world.nodes.some(n=>n.type==='biomass'),p.id==='verdant',`${p.id}, training=${training}`);
    assert.ok(world.nodes.some(n=>n.type==='iron'));
    assert.ok(world.nodes.some(n=>n.type==='crystal'));
  }
  g.collectStarterTools();g.equipTool('axe');
  const grass=g.world().nodes.find(n=>n.type==='biomass');
  g.state.player={x:grass.x-55,y:grass.y,angle:0};
  for(let i=0;i<grass.maxHp;i++){g.cooldown=0;assert.ok(g.interact(grass.id).ok);tick(g,1);}
  assert.equal(g.state.inventory.biomass,5);assert.equal(grass.hp,0);
  tick(g,151);assert.equal(grass.hp,grass.maxHp);
});

test('old worlds lose non-Verdant grass while inventory, depleted ore, buildings and quest progress survive',()=>{
  const g=new Game();
  for(const p of PLANETS)g.ensureWorld(p.id);
  const old=g.snapshot();old.time=100;old.planet='nix';old.visited=PLANETS.map(p=>p.id);
  old.inventory.biomass=27;old.stats.collected.biomass=42;
  old.probeQuest={stage:'collecting',age:0};
  for(const p of PLANETS.filter(p=>p.id!=='verdant')){
    old.worlds[p.id].nodes.push({id:p.id+'-node-2',type:'biomass',x:185,y:230,hp:2,maxHp:2,respawnAt:0});
    old.worlds[p.id].nodes[0].hp=0;old.worlds[p.id].nodes[0].respawnAt=240;
    old.worlds[p.id].buildings.push({id:'old-home',type:'habitat',x:600,y:600,level:2,lit:false});
  }
  const loaded=new Game(old),resumed=new Game(loaded.snapshot());
  assert.equal(resumed.state.inventory.biomass,27);assert.equal(resumed.state.stats.collected.biomass,42);
  assert.deepEqual(resumed.state.probeQuest,old.probeQuest);
  for(const p of PLANETS.filter(p=>p.id!=='verdant')){
    const w=resumed.ensureWorld(p.id);
    assert.equal(w.nodes.some(n=>n.type==='biomass'),false);
    assert.equal(w.nodes[0].id,p.id+'-node-0');assert.equal(w.nodes[0].hp,0);assert.equal(w.nodes[0].respawnAt,240);
    assert.deepEqual(w.nodes.slice(0,2).map(n=>[n.x,n.y]),[[190,115],[285,65]]);
    assert.equal(w.buildings.length,1);assert.equal(w.buildings[0].level,2);assert.equal(w.buildings[0].lit,false);
  }
  resumed.state.fuel=10;assert.ok(resumed.refuel().ok);
  assert.equal(resumed.state.inventory.biomass,24,'carried grass can still be used on other planets');
});

test('first-contact gifts provide grass only on Verdant and cannot be claimed twice',()=>{
  for(const p of PLANETS){
    const g=new Game();g.state.planet=p.id;
    for(const species of p.species){
      const c=g.world().creatures.find(c=>c.species===species);
      g.state.player={x:c.x,y:c.y,angle:0};g.cooldown=0;
      assert.ok(g.befriend(c).ok);
      const inventory={...g.state.inventory};g.cooldown=0;g.befriend(c);
      assert.deepEqual(g.state.inventory,inventory);
    }
    assert.equal(g.state.inventory.biomass,p.id==='verdant'?9:0,p.id);
    assert.ok(g.state.inventory.iron+g.state.inventory.crystal>0);
  }
});
