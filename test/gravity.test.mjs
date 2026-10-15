import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {Game,PLANETS}=createRequire(import.meta.url)('../game/core.js');
const expected={verdant:1,solara:1.25,nix:10/7,ember:10/13,prisma:5/3};
function clearGround(planet,training=false){
  const g=new Game();g.state.planet=planet;g.state.training=training;
  g.state.player={x:200,y:400,angle:0};g.world().nodes=[];g.world().buildings=[];
  return g;
}
function step(g,input,seconds=1,dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++)g.tick(dt,input);}

test('every planet scales actual ground displacement for walking, running, diagonal and touch input',()=>{
  for(const input of [{right:true},{right:true,run:true},{right:true,down:true},{dx:.4,dy:.8}]){
    const baseline=clearGround('verdant');step(baseline,input);
    const distance=Math.hypot(baseline.state.player.x-200,baseline.state.player.y-400);
    for(const p of PLANETS){
      const g=clearGround(p.id);step(g,input);
      const actual=Math.hypot(g.state.player.x-200,g.state.player.y-400);
      assert.ok(Math.abs(actual/distance-expected[p.id])<1e-9,p.id);
      step(g,{},1);assert.ok(Math.hypot(g.velocity.x,g.velocity.y)<.2);
    }
  }
});

test('click movement reaches its destination on every planet at low and normal frame rates',()=>{
  for(const p of PLANETS)for(const dt of [1/60,.05])for(const run of [false,true]){
    const g=clearGround(p.id);g.moveTarget={x:600,y:400};
    step(g,{run},6,dt);
    assert.equal(g.moveTarget,null,p.id);
    assert.ok(Math.abs(g.state.player.x-600)<25,p.id+' settles near destination');
    assert.equal(g.velocity.x,0);
  }
});

test('gravity is applied in mock landing areas and does not change space flight',()=>{
  for(const p of PLANETS){
    const normal=clearGround(p.id),training=clearGround(p.id,true);
    step(normal,{right:true},.4);step(training,{right:true},.4);
    assert.equal(normal.state.player.x,training.state.player.x);
    for(const fuel of [0,100])for(const run of [false,true]){
      const g=clearGround(p.id),base=clearGround('verdant');
      for(const item of [g,base]){item.state.mode='space';item.state.fuel=fuel;step(item,{right:true,run});}
      assert.deepEqual(g.state.ship,base.state.ship);
    }
  }
});
