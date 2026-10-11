import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../game/motion.js');
const {Game}=require('../game/core.js');
require('../game/portraits.js');
const {astronaut,animatedShip}=require('../game/renderer-2d.js');
const tick=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*100);i++)g.tick(.01);};
function mining(config){const g=new Game(null,config);g.collectStarterTools();const n=g.world().nodes.find(n=>n.type==='iron');g.state.player={x:n.x-65,y:n.y,angle:0};g.events=[];return{g,n};}

test('motion profiles validate every field, round trip, and reject unrelated files',()=>{
  const profile=M.normalize({pickaxe:{duration:Infinity,impact:2,windup:-99},land:{height:9999,thrust:'1'}});
  assert.equal(profile.pickaxe.duration,.56);assert.equal(profile.pickaxe.impact,.7);assert.equal(profile.pickaxe.windup,0);assert.equal(profile.land.height,480);assert.equal(profile.land.thrust,1);
  assert.deepEqual(M.parse(JSON.stringify(profile)),profile);
  assert.throws(()=>M.parse(JSON.stringify(new Game().snapshot())));
  assert.throws(()=>M.parse('{"version":900}'));assert.throws(()=>M.parse('x'.repeat(65537)));
  const other=M.normalize(profile);other.axe.body=0;assert.notEqual(other.axe.body,profile.axe.body);
});

test('custom impact time gates damage and all impact events, once per swing',()=>{
  const config=M.normalize();config.pickaxe.duration=1;config.pickaxe.impact=.7;
  const {g,n}=mining(config);assert.ok(g.interact(n.id).ok);
  tick(g,.68);assert.equal(n.hp,n.maxHp);assert.equal(g.events.filter(e=>e.kind==='mine').length,0);
  tick(g,.03);assert.equal(n.hp,n.maxHp-1);assert.equal(g.events.filter(e=>e.kind==='mine').length,1);
  tick(g,.8);assert.equal(n.hp,n.maxHp-1);assert.equal(g.beam,null);
});

test('swing pauses with the game and settings only change the next swing',()=>{
  const config=M.normalize();config.pickaxe.duration=1;config.pickaxe.impact=.7;
  const {g,n}=mining(config);g.interact(n.id);tick(g,.2);g.paused=true;tick(g,2);assert.equal(n.hp,n.maxHp);assert.ok(g.beam.life>.79);
  config.pickaxe.duration=.35;config.pickaxe.impact=.25;g.setMotion(config);g.paused=false;tick(g,.46);assert.equal(n.hp,n.maxHp);tick(g,.05);assert.equal(n.hp,n.maxHp-1);
  tick(g,.5);g.interact(n.id);tick(g,.1);assert.equal(n.hp,n.maxHp-2);
});

test('leaving range or changing tools before contact cannot award a delayed hit',()=>{
  for(const change of ['range','tool']){const {g,n}=mining();g.interact(n.id);if(change==='range')g.state.player.x=n.x-300;else g.equipTool('axe');tick(g,1);assert.equal(n.hp,n.maxHp);assert.equal(g.state.inventory.iron,0);}
});

test('saving before contact cannot replay a pending attack; saving after contact keeps damage',()=>{
  const {g,n}=mining();g.interact(n.id);tick(g,.1);const before=new Game(g.snapshot());tick(before,1);assert.equal(before.world().nodes.find(v=>v.id===n.id).hp,n.maxHp);
  tick(g,.3);const after=new Game(g.snapshot());tick(after,1);assert.equal(after.world().nodes.find(v=>v.id===n.id).hp,n.maxHp-1);
});

test('custom flight duration and curves survive save/reload and complete once',()=>{
  const config=M.normalize();config.launch.duration=5;config.launch.height=480;config.launch.mark=.4;const g=new Game(null,config);g.launch();tick(g,2);
  config.launch.duration=1.5;g.setMotion(config);assert.equal(g.flight.duration,5);
  const loaded=new Game(g.snapshot(),config);assert.equal(loaded.flight.motion.height,480);assert.equal(loaded.flight.motion.mark,.4);tick(loaded,2.9);assert.equal(loaded.state.mode,'surface');tick(loaded,.2);assert.equal(loaded.state.mode,'space');assert.equal(loaded.events.filter(e=>e.type==='launch').length,1);
  const p=loaded.planet();loaded.state.ship={x:p.x,y:p.y+p.r+60,angle:0};config.land.duration=4;loaded.setMotion(config);loaded.land(p.id);tick(loaded,3);assert.equal(loaded.flight.kind,'land');tick(loaded,1.1);assert.equal(loaded.flight,null);
});

test('all editable extrema produce finite shared preview/game poses and drawings',()=>{
  const gradient={addColorStop(){}};const c=new Proxy({},{get:(_,key)=>(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),key);return String(key).startsWith('create')?gradient:undefined;},set:()=>true});
  for(const id of Object.keys(M.GROUPS))for(const bound of ['min','max']){
    const p=Object.fromEntries(M.fields(id).map(f=>[f.key,f[bound]]));
    for(let i=0;i<=100;i++){const t=i/100;if('impact'in p){const pose=M.toolPose(id,p,t);assert.ok(Number.isFinite(pose.angle));astronaut(c,t,false,0,{tool:id,motion:p,duration:p.duration,life:(1-t)*p.duration},id);}else animatedShip(c,{kind:id,motion:p,age:t*p.duration,duration:p.duration},t);}
  }
});
