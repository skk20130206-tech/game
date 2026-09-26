import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Game,PLANETS,SPECIES}=require('../game/core.js');require('../game/portraits.js');
const {Renderer,ship}=require('../game/renderer-2d.js');
function canvas(width=1280,height=720){
 const ops=[];const gradient={addColorStop(){}};
 const ctx=new Proxy({},{get(_,key){return(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),key+' must not receive NaN');ops.push(key);return key.startsWith('create')?gradient:undefined;};},set(){return true;}});
 return{width,height,ops,getBoundingClientRect:()=>({width,height}),getContext:type=>{assert.equal(type,'2d');return ctx;}};
}
test('Canvas renderer draws all biomes, species, ships and building previews without WebGL',()=>{
 const g=new Game(),c=canvas(),r=new Renderer(c,canvas(160,126),g);
 for(const p of PLANETS){g.state.planet=p.id;g.ensureWorld(p.id);for(const type of ['habitat','solar','beacon'])g.world().buildings.push({x:160,y:160,type,level:2});g.state.inventory={iron:100,biomass:100,crystal:100};g.selectedBuild='habitat';r.reset();r.draw(.016);}
 for(const id of Object.keys(SPECIES))globalThis.OrbitPortraits.creature(c.getContext('2d'),id,1,1,true);
 g.state.mode='space';r.draw(.016);ship(c.getContext('2d'),1,true,true);assert.ok(c.ops.includes('fill'));assert.ok(c.ops.includes('lineTo'));assert.ok(c.ops.includes('drawImage')===false);
});
test('screen and world coordinates round trip after camera pan, zoom and mode changes',()=>{
 const g=new Game(),r=new Renderer(canvas(),null,g);
 for(const mode of ['surface','space'])for(const zoom of [.5,.8,1.7]){g.state.mode=mode;r.reset();r.zoom=zoom;r.orbit(75,-40);r.draw(.016);const p=r.project(245,-78),w=r.unproject(p.x,p.y);assert.ok(Math.abs(w.x-245)<1e-7);assert.ok(Math.abs(w.y+78)<1e-7);}
 assert.deepEqual(r.input({right:true,up:true,ascend:true}),{up:true,down:false,left:false,right:true,run:false,interact:false});
});
test('old high-altitude space saves load in 2D and can land at a nearby planet',()=>{
 const g=new Game();g.launch();const saved=g.snapshot(),p=PLANETS[0];saved.ship={x:p.x,y:p.y+p.r+65,altitude:640,angle:0};saved.inventory.iron=24;saved.met=['mossling'];saved.friendship.mossling=2;
 const loaded=new Game(saved);assert.equal(loaded.state.ship.altitude,0);assert.equal(loaded.state.inventory.iron,24);assert.equal(loaded.state.friendship.mossling,2);assert.ok(loaded.land(p.id).ok);
});
test('particles stop while paused and expire when resumed; effects stay bounded',()=>{
 const g=new Game(),r=new Renderer(canvas(),null,g);for(let n=0;n<30;n++)r.effect({kind:'break',x:90,y:90});assert.ok(r.particles.length<=160);g.paused=true;const n=r.particles.length;for(let i=0;i<100;i++)r.draw(.016);assert.equal(r.particles.length,n);g.paused=false;for(let i=0;i<100;i++)r.draw(.016);assert.equal(r.particles.length,0);
});
