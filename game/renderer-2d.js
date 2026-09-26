(function(root){
  'use strict';
  const {Game,PLANETS,SPECIES,BUILDINGS,RESOURCE_NAMES,WORLD_LIMIT,rand,dist,clamp}=root.OrbitCore;
  const {creature,drawPlanet}=root.OrbitPortraits,TAU=Math.PI*2;
  const oval=(c,x,y,rx,ry,color)=>{c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.fillStyle=color;c.fill();};
  const path=(c,points,fill,stroke)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
  const box=(c,x,y,w,h,r,color,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(color){c.fillStyle=color;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
  const line=(c,x,y,a,b,color,width=2)=>{c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
  const ring=(c,x,y,r,color,width=2)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
  const glow=(c,x,y,r,color)=>{const g=c.createRadialGradient(x,y,0,x,y,Math.max(1,r));g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.beginPath();c.arc(x,y,Math.max(1,r),0,TAU);c.fill();};
  const gradient=(c,x1,y1,x2,y2,stops)=>{const g=c.createLinearGradient(x1,y1,x2,y2);for(const [at,color] of stops)g.addColorStop(at,color);return g;};
  function astronaut(c,time,moving,angle,action){
    const walk=moving?Math.sin(time*12)*5:0,breath=Math.sin(time*2)*.8;
    glow(c,0,5,34,'#07192340');c.save();c.translate(0,breath);
    // Life-support pack and articulated shadow layer.
    box(c,-25,-33,50,28,8,'#304b58','#193542');box(c,-20,-30,40,21,6,'#456d76');
    line(c,-17,-26,17,-26,'#81a9a2',2);line(c,-15,-19,15,-19,'#193845',2);
    box(c,-12,-5+walk,10,16,4,'#263e50','#172f3d');box(c,3,-5-walk,10,16,4,'#263e50','#172f3d');
    box(c,-14,-35,28,34,9,gradient(c,-14,-35,14,0,[[0,'#ffffff'],[.42,'#e7f0df'],[1,'#b1c8b9']]),'#5c8987');
    box(c,-3,-31,6,24,2,'#f3ba65');line(c,-11,-5,10,-5,'#6d9990',1);line(c,-10,-1,9,-1,'#9db9ae',1);
    // Shoulder armor, chest badge and utility belt add small readable forms.
    box(c,-22,-30,8,15,3,'#d6e4d8','#71938d');box(c,14,-30,8,15,3,'#d6e4d8','#71938d');
    box(c,-8,-21,16,7,2,'#5c8b8b','#294f5c');oval(c,0,-17,3,2,'#c7f79f');
    box(c,-16,-8,32,5,2,'#405a63');line(c,-8,-8,-8,-3,'#e8cf8e',1);line(c,8,-8,8,-3,'#e8cf8e',1);
    const reach=action==='mine'?Math.sin(time*26)*9:0;
    box(c,-23,-29-walk*.7,9,24,4,'#d2e0d6','#718c87');box(c,15,-29+walk*.7-reach,9,24,4,'#d2e0d6','#718c87');
    box(c,-22,-20-walk*.7,7,8,2,'#7ca59b');box(c,16,-20+walk*.7-reach,7,8,2,'#7ca59b');
    oval(c,0,-43,21,20,'#edf6df','#');
    const visor=gradient(c,-15,-54,15,-33,[[0,'#6ed1d4'],[.45,'#2d6676'],[1,'#102e43']]);oval(c,Math.cos(angle)*2,-44+Math.sin(angle)*1.5,16,13,visor);
    oval(c,-5,-49,8,3,'#d9ffff55');line(c,-11,-55,6,-55,'#f6ffe7',2);line(c,12,-48,16,-42,'#ffffffaa',1.2);box(c,-6,-24,12,6,2,'#6bcbd0');
    // Boots catch the planet light and make the walking cycle easier to read.
    box(c,-13,9+walk,12,6,2,'#1c3443');box(c,2,9-walk,12,6,2,'#1c3443');line(c,-12,12+walk,-3,12+walk,'#d4e4d8',1);line(c,4,12-walk,13,12-walk,'#d4e4d8',1);
    if(action==='mine'){box(c,20,-16-reach,7,18,2,'#345065');oval(c,23,-20-reach,5,3,'#b8f783');}
    c.restore();
  }
  function ship(c,time,flying,moving){
    glow(c,0,25,105,'#081c2735');c.save();if(flying)c.scale(.8,.8);
    if(moving){for(const x of[-38,38]){glow(c,x,56,25,'#68ddf855');path(c,[[x-10,40],[x,81+Math.sin(time*31)*10],[x+10,40]],'#73ddf8aa');path(c,[[x-5,40],[x,63],[x+5,40]],'#fff5bc');}}
    path(c,[[-61,-19],[-82,29],[-50,26],[-32,-20]],'#759790','#294b54');path(c,[[61,-19],[82,29],[50,26],[32,-20]],'#759790','#294b54');
    line(c,-63,14,-49,7,'#b8d8c4',2);line(c,63,14,49,7,'#b8d8c4',2);
    for(const x of[-39,39]){box(c,x-15,-44,30,92,10,'#344e5d','#183844');box(c,x-12,-38,24,62,8,gradient(c,x-12,-38,x+12,24,[[0,'#f4f5e5'],[.6,'#d6ddca'],[1,'#9ab4aa']]),'#6e908b');box(c,x-13,8,26,10,2,'#edaf5f');oval(c,x,40,11,7,'#172e40');oval(c,x,41,7,4,moving?'#c6f9ff':'#75d6dc');line(c,x-8,-27,x+8,-27,'#ffffff77',1);}
    path(c,[[-29,31],[-31,-28],[-15,-66],[15,-66],[31,-28],[29,31]],gradient(c,-29,-50,29,28,[[0,'#f7f6e5'],[.5,'#e3e8d5'],[1,'#a8c0b5']]),'#507576');
    line(c,-27,25,27,25,'#6d918b',2);line(c,-31,-10,-22,-10,'#d9e7d9',2);line(c,31,-10,22,-10,'#b7cdbb',2);
    path(c,[[-22,-29],[-12,-55],[12,-55],[22,-29],[16,-16],[-16,-16]],gradient(c,-18,-54,18,-17,[[0,'#4a9aa1'],[.5,'#204e63'],[1,'#102b43']]),'#88c9c6');line(c,-8,-48,8,-48,'#d6fbf3',3);line(c,-16,-23,16,-23,'#9ee4df66',1);
    box(c,-19,-6,38,21,5,'#9aada5','#607d79');box(c,-10,-2,20,12,2,'#bdcebd');line(c,-6,2,6,2,'#e9f4d5',1);box(c,-4,20,8,9,2,'#eab465');
    line(c,18,-42,27,-77,'#739a98',3);oval(c,28,-78,4,4,'#e5f8b7');line(c,28,-78,28,-66,'#efffc3',1);
    if(!flying)for(const x of[-47,47]){line(c,x,37,x*1.23,55,'#3b5760',6);box(c,x*1.23-12,52,24,7,3,'#c3d3be');oval(c,x*1.23,55,9,2,'#dcf6be77');}
    c.restore();
  }
  function resource(c,n,time){
    const damaged=n.hp<n.maxHp;c.save();c.scale(n.size||1,n.size||1);oval(c,0,6,27,10,'#10292836');
    if(n.type==='iron'){
      // Flat illustrated facets, mineral seams and chips keep small deposits readable.
      c.lineWidth=1.2;
      path(c,[[-29,0],[-25,-18],[-16,-31],[-4,-37],[15,-32],[28,-16],[30,-3],[23,9],[3,15],[-19,10]],'#778c91','#344e58');
      path(c,[[-25,-18],[-16,-31],[-4,-37],[7,-26],[-4,-13]],'#b8c8c0');
      path(c,[[-4,-37],[15,-32],[28,-16],[10,-18],[7,-26]],'#9fb4b0');
      path(c,[[-25,-18],[-4,-13],[-11,3],[-19,10],[-29,0]],'#8eaaa7');
      path(c,[[-4,-13],[7,-26],[10,-18],[20,-7],[6,4],[-11,3]],'#718d92');
      path(c,[[28,-16],[30,-3],[23,9],[6,4],[20,-7],[10,-18]],'#536f7a');
      path(c,[[-19,10],[-11,3],[6,4],[23,9],[3,15]],'#47636d');
      line(c,-16,-30,-5,-34,'#e0e2cd',1.3);line(c,-25,-17,-28,-3,'#b9cbc0',1);
      // Warm metallic seams contrast with the cool host rock.
      for(const [x,y,a,b] of[[-18,-21,-10,-17],[-10,-17,-3,-20],[-10,-17,-12,-9],[-12,-9,-5,-5],[7,-9,14,-13],[14,-13,20,-10]]){
        line(c,x,y,a,b,'#465c64',4);line(c,x,y,a,b,'#d1b780',2);line(c,x,y-.6,a,b-.6,'#efe1b0',.7);
      }
      for(const [x,y,r] of[[-17,-25,2.5],[2,-26,2],[17,-18,2.5],[-19,-5,1.6],[11,0,2.2],[3,-10,1.4]]){
        path(c,[[x-r,y],[x,y-r],[x+r,y-.4],[x+.7,y+r]],'#c9c6a6');line(c,x-r,y,x,y-r,'#f2e6b8',.8);
      }
      for(const [x,y] of[[-21,-12],[-3,5],[23,-4],[5,-30],[-8,-28]]){oval(c,x,y,1.1,.7,'#425e69');line(c,x-.7,y+1,x+.8,y+1,'#a5bbb1',.6);}
      path(c,[[-27,9],[-33,7],[-36,12],[-30,15]],'#738f91','#45616b');
      path(c,[[20,14],[27,11],[31,15],[25,18]],'#91a6a0','#45616b');
    }else if(n.type==='crystal'){
      c.lineWidth=1;
      path(c,[[-27,3],[-16,-5],[10,-4],[27,4],[20,13],[-5,16],[-25,11]],'#526878','#354e61');
      for(const [x,y,s,tilt] of[[-18,1,.62,-.22],[16,3,.76,.19],[0,0,1,0]]){
        c.save();c.translate(x,y);c.rotate(tilt);c.scale(s,s);
        path(c,[[0,-53],[13,-32],[11,2],[0,12],[-11,3],[-13,-32]],'#8caee0','#3e5b89');
        path(c,[[0,-53],[-3,-28],[-4,7],[-11,3],[-13,-32]],'#ccebf4');
        path(c,[[0,-53],[13,-32],[4,-26],[-3,-28]],'#e3f6f7');
        path(c,[[4,-26],[13,-32],[11,2],[0,12]],'#638bc5');
        path(c,[[-3,-28],[4,-26],[0,12],[-4,7]],'#a5d5ef');
        path(c,[[-12,-16],[-3,-22],[3,-19],[-12,-8]],'#edfaff55');
        path(c,[[4,-9],[12,-16],[11,-10],[2,1]],'#d6edff45');
        line(c,0,-50,-3,-28,'#ffffff',1.1);line(c,-3,-28,-4,5,'#ecffff',1);line(c,4,-25,1,7,'#bfdfff',.8);
        line(c,-10,-6,-6,-9,'#8eb2d7',.8);line(c,5,-18,9,-21,'#4d78b2',.8);
        c.restore();
      }
      path(c,[[-24,9],[-20,-3],[-15,5],[-16,13]],'#b6dbef','#5879a3');
      path(c,[[15,10],[22,0],[26,8],[21,14]],'#92b5dc','#5879a3');
      const glint=.55+.3*Math.sin(time*2.1+(n.x||0)*.13+(n.y||0)*.07);
      c.globalAlpha*=glint;line(c,-5,-38,-5,-28,'#f5ffff',1.2);line(c,-9,-33,-1,-33,'#f5ffff',1.2);oval(c,-5,-33,1.8,1.8,'#ffffff');
      line(c,19,-24,19,-18,'#e1f9ff',1);line(c,16,-21,22,-21,'#e1f9ff',1);c.globalAlpha/=glint;
    }else{
      line(c,0,4,0,-41,'#457959',4);for(const [x,y]of[[-13,-14],[12,-25],[-9,-37]]){c.save();c.translate(x,y);c.rotate(x<0?.45:-.45);oval(c,0,0,13,7,x<0?'#8eca91':'#bae09b');c.restore();}oval(c,1,-47,8,9,'#ddeeb0');
    }
    if(damaged){line(c,-7,-23,3,-11,'#244343',2);line(c,3,-11,-2,0,'#244343',2);box(c,-22,17,44,4,2,'#122b39');box(c,-22,17,44*n.hp/n.maxHp,4,2,'#d3f795');}
    c.restore();
  }
  function building(c,b,time){
    const definition=BUILDINGS[b.type];oval(c,0,14,definition.radius||50,16,'#09283142');
    if(b.type==='habitat'){
      box(c,-50,-30,100,58,9,'#d8e3cb','#70928b');box(c,-57,-52,114,34,8,'#739d91','#365967');line(c,-46,-44,45,-44,'#a3c7aa',3);
      box(c,-37,-12,24,22,4,b.lit===false?'#315169':'#edce88','#6b8a7e');line(c,-25,-12,-25,10,'#9f9c70',2);box(c,18,-9,21,36,4,'#315161');box(c,14,27,31,7,3,'#a0bb9d');
      line(c,27,-52,27,-70,'#799b90',3);oval(c,27,-72,4,4,'#d5f1ae');
    }else if(b.type==='solar'){
      line(c,-23,-2,-23,27,'#80938d',7);line(c,24,-2,24,27,'#80938d',7);box(c,-52,-45,104,50,4,'#2c5879','#9bbfbc');for(let x=-44;x<50;x+=23)line(c,x,-39,x,0,'#5685a0',1.5);for(let y=-29;y<0;y+=14)line(c,-49,y,49,y,'#5685a0',1.5);box(c,-16,16,32,17,4,'#d3dbc4');
    }else{
      box(c,-18,5,36,16,5,'#a2bbae');path(c,[[-11,4],[-6,-54],[6,-54],[11,4]],'#c8d8c2','#628d90');oval(c,0,-55,15,8,'#a6e0d6');ring(c,0,-55,19+Math.sin(time*2)*3,'#baf9e477',2);oval(c,0,-55,6,5,'#e6ffc4');
    }
    if(b.level===2){c.fillStyle='#e2edb0';c.font='bold 10px sans-serif';c.textAlign='center';c.fillText('II',0,39);}
  }
  class Renderer{
    constructor(canvas,radar,game){
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('Canvas 2D 화면을 사용할 수 없어요. 최신 브라우저로 열어주세요.');
      this.radar=radar;this.rctx=radar?.getContext('2d');this.game=game;this.width=1;this.height=1;this.dpr=1;this.zoom=1;this.pan={x:0,y:0};this.camera={...game.state.player};this.mode=game.state.mode;this.mouse=null;this.particles=[];this.rings=[];this.time=0;this.frameMs=16.67;this.jumpHeight=0;this.yaw=0;this.shake=0;this.radarTime=0;this.decoration=new Map();
      this.immersive=!(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);this.intensity=.55;this.haptics=false;
      try{const prefs=JSON.parse(root.localStorage?.getItem('justgame-2d-effects')||'null');if(prefs){this.immersive=prefs.enabled!==false;this.intensity=clamp(Number(prefs.intensity)||0,0,1);this.haptics=prefs.haptics===true;}}catch(e){}
      this.resize();this.reset();
    }
    resize(){const rect=this.canvas.getBoundingClientRect?.()||{width:this.canvas.width,height:this.canvas.height};this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);this.dpr=clamp(root.devicePixelRatio||1,1,2);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.zoom=this.width<600?.8:1;}
    reset(){this.mode=this.game.state.mode;this.camera={...(this.mode==='space'?this.game.state.ship:this.game.state.player)};this.pan={x:0,y:0};this.mouse=null;this.particles=[];this.rings=[];this.shake=0;}
    get scale(){return this.zoom*(this.mode==='space'?.7:1);}
    project(x,y){const a=(x-this.camera.x)*this.scale+this.width*.5,b=(y-this.camera.y)*this.scale+this.height*.53;return{x:a,y:b,visible:a>-100&&a<this.width+100&&b>-100&&b<this.height+100,depth:y};}
    unproject(x,y){return{x:(x-this.width*.5)/this.scale+this.camera.x,y:(y-this.height*.53)/this.scale+this.camera.y};}
    input(keys){return{up:!!keys.up,down:!!keys.down,left:!!keys.left,right:!!keys.right,run:!!keys.run,interact:!!keys.interact};}
    orbit(dx,dy){this.pan.x=clamp(this.pan.x-dx/this.scale,-650,650);this.pan.y=clamp(this.pan.y-dy/this.scale,-650,650);}
    zoomBy(delta){this.zoom=clamp(this.zoom*Math.exp(-delta*.001),.5,1.7);}
    toggleView(){this.pan={x:0,y:0};this.zoom=this.zoom>1?.8:1.3;return this.zoom>1;}
    setImmersive(value){this.immersive=!!value;this.storeSettings();}
    storeSettings(){try{root.localStorage?.setItem('justgame-2d-effects',JSON.stringify({enabled:this.immersive,intensity:this.intensity,haptics:this.haptics}));}catch(e){}}
    pulse(pattern){if(this.immersive&&this.haptics)try{root.navigator?.vibrate?.(pattern);}catch(e){}}
    stopHaptics(){if(this.haptics)try{root.navigator?.vibrate?.(0);}catch(e){}}
    effect(e){
      const s=this.game.state,a=s.mode==='surface'?s.player:s.ship,x=e.x??a.x,y=e.y??a.y;
      if(['scan','friend','build','rest','relic','land','launch'].includes(e.kind))this.rings.push({x,y,age:0,kind:e.kind,color:e.color||'#c3f379'});
      if(['mine','break','collect','build','friend','relic'].includes(e.kind))for(let i=0;i<(e.kind==='break'?20:8);i++){const angle=i*2.4+this.time;this.particles.push({x,y:y-14,vx:Math.cos(angle)*55,vy:Math.sin(angle)*45-25,age:0,color:e.color||'#ddfcb5',size:e.kind==='break'?5:3});}
      if(this.particles.length>160)this.particles.splice(0,this.particles.length-160);if(this.rings.length>16)this.rings.shift();
      if(e.kind==='break'){this.shake=3;this.pulse(25);}if(e.kind==='land'||e.kind==='launch')this.reset();
    }
    getDecor(p){
      if(this.decoration.has(p.id))return this.decoration.get(p.id);const random=rand(p.seed+713),items=[];
      for(let i=0;i<700;i++)items.push({x:(random()-.5)*WORLD_LIMIT*2.1,y:(random()-.5)*WORLD_LIMIT*2.1,r:8+random()*75,type:i%7,angle:random()*TAU});this.decoration.set(p.id,items);return items;
    }
    worldTransform(c){c.translate(this.width*.5,this.height*.53);c.scale(this.scale,this.scale);c.translate(-this.camera.x,-this.camera.y);}
    surface(c,dt){
      const g=this.game,s=g.state,p=g.planet(),w=g.world();
      const ground=c.createRadialGradient(this.width*.45,this.height*.35,20,this.width*.5,this.height*.48,Math.max(this.width,this.height)*.86);
      ground.addColorStop(0,p.ground[3]);ground.addColorStop(.5,p.ground[1]);ground.addColorStop(1,p.ground[0]);c.fillStyle=ground;c.fillRect(0,0,this.width,this.height);
      c.save();this.worldTransform(c);
      for(const d of this.getDecor(p)){
        if(!this.project(d.x,d.y).visible)continue;
        if(d.type===0){
          c.save();c.translate(d.x,d.y);c.rotate(d.angle);oval(c,0,5,d.r*2.1,d.r*.72,p.dark+'35');
          path(c,[[-d.r*1.7,0],[-d.r*1.1,-d.r*.65],[d.r*.15,-d.r],[d.r*1.7,-d.r*.42],[d.r*1.9,.25*d.r],[d.r*.55,.72*d.r],[-d.r*1.2,.55*d.r]],p.ground[0]+'aa',p.dark+'75');
          path(c,[[-d.r*1.1,-d.r*.65],[d.r*.15,-d.r],[d.r*.75,-.25*d.r],[-.05*d.r,.15*d.r]],p.ground[4]+'88');
          line(c,-d.r*.6,-d.r*.38,d.r*.25,-d.r*.55,p.light+'66',1);c.restore();
        }else if(d.type<4){
          oval(c,d.x,d.y+4,d.r*.7,d.r*.28,p.dark+'25');
          for(let k=0;k<4;k++){const bx=d.x+(k-1.5)*d.r*.35,lean=(k%2?-1:1)*(2+d.r*.04);line(c,bx,d.y+3,bx+lean,d.y-d.r*.3-k*2,p.flora+'bb',1.4);}
          if(d.type===1){oval(c,d.x-4,d.y-d.r*.45,3,2,p.light+'99');oval(c,d.x+5,d.y-d.r*.55,2.5,1.8,p.accent+'88');}
        }else if(d.type===4){
          oval(c,d.x,d.y+3,11,4,p.dark+'25');oval(c,d.x,d.y,4,2.5,p.accent+'77');oval(c,d.x+8,d.y+4,2,2,p.light+'66');
          line(c,d.x,d.y+1,d.x-1,d.y+8,p.flora+'99',1);
        }else{
          oval(c,d.x,d.y+2,7,4,p.ground[0]+'77');path(c,[[d.x-4,d.y+1],[d.x-2,d.y-5],[d.x+2,d.y-7],[d.x+5,d.y+1]],p.ground[2]+'88',p.dark+'55');
        }
      }
      // World boundary and safe landing circle are drawn below all sprites.
      c.setLineDash([12,10]);c.strokeStyle=p.light+'66';c.lineWidth=2;c.strokeRect(-WORLD_LIMIT,-WORLD_LIMIT,WORLD_LIMIT*2,WORLD_LIMIT*2);c.setLineDash([]);
      oval(c,0,15,111,72,p.ground[0]);ring(c,0,0,155,p.accent+'24',1.5);c.fillStyle=p.light+'99';c.font='10px sans-serif';c.textAlign='center';c.fillText('LANDING ZONE',0,91);
      if(g.moveTarget){ring(c,g.moveTarget.x,g.moveTarget.y,10+Math.sin(this.time*5)*2,'#edf7c7',1.5);}
      const nearest=g.nearest(),actors=[{kind:'ship',x:0,y:0},...w.nodes.filter(n=>n.hp>0).map(n=>({...n,kind:'node'})),...w.buildings.map(b=>({...b,kind:'building'})),...w.relics.map(r=>({...r,kind:'relic'})),...w.creatures.map(v=>({...v,kind:'creature'})),{...s.player,kind:'player'}];
      actors.sort((a,b)=>a.y-b.y);
      for(const a of actors){if(!this.project(a.x,a.y).visible)continue;c.save();c.translate(a.x,a.y);
        if(a.kind==='node'&&(a.type==='crystal'||a.type==='iron'))glow(c,0,-18,a.type==='crystal'?78:45,a.type==='crystal'?p.accent+'16':p.light+'0c');
        if(a.kind==='creature')glow(c,0,-20,48,p.light+'0a');
        if(nearest?.entity?.id===a.id&&a.id){ring(c,0,2,a.kind==='building'?66:35,p.accent+'bb',1.5);}
        if(a.kind==='ship')ship(c,this.time,false,false);
        if(a.kind==='node')resource(c,a,this.time);
        if(a.kind==='building')building(c,a,this.time);
        if(a.kind==='creature')creature(c,a.species,this.time+a.phase,1,s.met.includes(a.species));
        if(a.kind==='player')astronaut(c,this.time,g.moving,s.player.angle,g.beam?'mine':null);
        if(a.kind==='relic'){oval(c,0,8,31,12,'#102b3740');path(c,[[-25,4],[-20,-45],[0,-64],[22,-46],[25,4]],p.dark,p.light+'55');line(c,-8,-32,0,-45,p.accent,3);line(c,0,-45,10,-31,p.accent,3);line(c,10,-31,0,-20,p.accent,3);if(!s.relics.includes(a.id))ring(c,0,-32,22+Math.sin(this.time*2)*2,p.accent+'50');}
        c.restore();}
      if(g.beam){line(c,s.player.x+23,s.player.y-30,g.beam.x,g.beam.y-20,'#d6ffc488',7);line(c,s.player.x+23,s.player.y-30,g.beam.x,g.beam.y-20,'#f8ffe0',2);}
      if(g.scanRing){const t=g.scanRing.age;c.globalAlpha=Math.max(0,1-t/2);ring(c,g.scanRing.x,g.scanRing.y,t*330,p.accent,3);c.globalAlpha=1;}
      if(g.waypoint){const t=g.waypoint;ring(c,t.x,t.y,36+Math.sin(this.time*3)*4,p.accent,3);line(c,t.x,t.y-11,t.x,t.y-78,p.accent,2);path(c,[[t.x-8,t.y-76],[t.x+8,t.y-76],[t.x,t.y-66]],p.accent);c.fillStyle='#f2ffd7';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText(t.label||'목표',t.x,t.y-87);}
      if(g.selectedBuild){const target=this.mouse||{x:s.player.x+Math.cos(s.player.angle)*105,y:s.player.y+Math.sin(s.player.angle)*105},valid=g.canPlace(g.selectedBuild,target.x,target.y).ok;c.globalAlpha=.65;c.save();c.translate(target.x,target.y);building(c,{type:g.selectedBuild},this.time);ring(c,0,5,BUILDINGS[g.selectedBuild].radius+8,valid?'#d2ff99':'#ff9b8e',3);c.restore();c.globalAlpha=1;}
      this.drawEffects(c,dt);c.restore();this.waypointArrow(c);
    }
    space(c,dt){
      const g=this.game,s=g.state;
      const sky=c.createLinearGradient(0,0,0,this.height);sky.addColorStop(0,'#050b1b');sky.addColorStop(.55,'#0d1730');sky.addColorStop(1,'#080d20');c.fillStyle=sky;c.fillRect(0,0,this.width,this.height);
      const nebula=c.createRadialGradient(this.width*.63,this.height*.3,0,this.width*.63,this.height*.3,this.width*.8);nebula.addColorStop(0,'#29477b25');nebula.addColorStop(.42,'#4b2e7720');nebula.addColorStop(1,'transparent');c.fillStyle=nebula;c.fillRect(0,0,this.width,this.height);
      const nebula2=c.createRadialGradient(this.width*.18,this.height*.78,0,this.width*.18,this.height*.78,this.width*.5);nebula2.addColorStop(0,'#2d8a8b14');nebula2.addColorStop(1,'transparent');c.fillStyle=nebula2;c.fillRect(0,0,this.width,this.height);
      const random=rand(831);for(let i=0;i<250;i++){const x=((random()*3500-this.camera.x*.12)%this.width+this.width)%this.width,y=((random()*2300-this.camera.y*.12)%this.height+this.height)%this.height,major=i%11===0;major&&glow(c,x,y,8,'#d1e8ff20');oval(c,x,y,major?1.8:.8,major?1.8:.8,i%4?'#aec8d088':'#edf5df');}
      c.save();c.globalAlpha=.16;c.strokeStyle='#7aa2d2';c.lineWidth=1;c.beginPath();c.moveTo(-40,this.height*.28);c.bezierCurveTo(this.width*.28,this.height*.08,this.width*.64,this.height*.4,this.width+40,this.height*.17);c.stroke();c.restore();
      c.save();this.worldTransform(c);const near=g.nearest();
      for(const p of PLANETS){c.setLineDash([4,9]);ring(c,p.x,p.y,p.r+90,p.color+'35',1);c.setLineDash([]);glow(c,p.x,p.y,p.r*1.55,p.color+'12');drawPlanet(c,p,p.x,p.y,p.r,this.time);if(near?.entity?.id===p.id)ring(c,p.x,p.y,p.r+17,'#daffad',2.5);c.textAlign='center';c.fillStyle='#eff6df';c.font='bold 16px sans-serif';c.fillText(p.name,p.x,p.y+p.r+36);c.font='11px sans-serif';c.fillStyle='#a9c3c5';c.fillText(s.visited.includes(p.id)?'탐험한 행성':'새로운 목적지',p.x,p.y+p.r+54);}
      c.save();c.translate(s.ship.x,s.ship.y);c.rotate(s.ship.angle+Math.PI/2);ship(c,this.time,true,g.moving||!!g.travel);c.restore();
      if(g.moveTarget)ring(c,g.moveTarget.x,g.moveTarget.y,12,'#d9ffb0');this.drawEffects(c,dt);c.restore();
      if(g.travel&&this.immersive){const a=g.travel.age;c.globalAlpha=Math.sin(a/2.4*Math.PI)*this.intensity;for(let i=0;i<34;i++){const angle=i*2.4+1.2;line(c,this.width/2+Math.cos(angle)*100,this.height/2+Math.sin(angle)*80,this.width/2+Math.cos(angle)*this.width,this.height/2+Math.sin(angle)*this.height,'#a0e8ff',1.5);}c.globalAlpha=1;}
    }
    drawEffects(c,dt){
      const step=this.game.paused?0:dt;
      for(const p of this.particles){p.age+=step;p.x+=p.vx*step;p.y+=p.vy*step;p.vy+=55*step;if(this.immersive){c.globalAlpha=Math.max(0,1-p.age/.85);box(c,p.x,p.y,p.size,p.size,1,p.color);}}c.globalAlpha=1;this.particles=this.particles.filter(p=>p.age<.85);
      for(const r of this.rings){r.age+=step;if(this.immersive){c.globalAlpha=Math.max(0,1-r.age);ring(c,r.x,r.y,20+r.age*80,r.color,2);}}c.globalAlpha=1;this.rings=this.rings.filter(r=>r.age<1);
    }
    waypointArrow(c){const w=this.game.waypoint;if(!w)return;const p=this.project(w.x,w.y);if(p.x>50&&p.x<this.width-50&&p.y>165&&p.y<this.height-145)return;const dx=p.x-this.width/2,dy=p.y-this.height/2,angle=Math.atan2(dy,dx),x=clamp(this.width/2+Math.cos(angle)*this.width*.39,42,this.width-42),y=clamp(this.height/2+Math.sin(angle)*this.height*.29,180,this.height-150);c.save();c.translate(x,y);c.rotate(angle);path(c,[[12,0],[-8,-7],[-4,0],[-8,7]],'#edffc4','#548976');c.restore();c.fillStyle='#ebf8de';c.font='11px sans-serif';c.textAlign='center';c.fillText(Math.round(dist(this.game.state.player,w))+'m',x,y+23);}
    screenFx(c,mode){
      // A restrained vignette and horizon bloom unify the flat illustrations.
      const horizon=c.createLinearGradient(0,0,0,this.height);horizon.addColorStop(0,mode==='space'?'#6fa4e00b':'#f4e7b30b');horizon.addColorStop(.38,'transparent');horizon.addColorStop(1,mode==='space'?'#02081716':'#071b2018');c.fillStyle=horizon;c.fillRect(0,0,this.width,this.height);
      const edge=c.createRadialGradient(this.width*.5,this.height*.46,Math.min(this.width,this.height)*.2,this.width*.5,this.height*.46,Math.max(this.width,this.height)*.75);edge.addColorStop(0,'transparent');edge.addColorStop(.7,'transparent');edge.addColorStop(1,mode==='space'?'#02071648':'#04191d30');c.fillStyle=edge;c.fillRect(0,0,this.width,this.height);
    }
    drawRadar(){if(!this.rctx)return;const c=this.rctx,w=this.radar.width,h=this.radar.height,g=this.game,s=g.state,a=s.mode==='space'?s.ship:s.player,k=s.mode==='space'?.045:.095;c.clearRect(0,0,w,h);box(c,0,0,w,h,10,'#0e252f');c.save();c.beginPath();c.rect(0,0,w,h);c.clip();const point=(x,y,r,color)=>oval(c,w/2+(x-a.x)*k,h/2+(y-a.y)*k,r,r,color);if(s.mode==='space')for(const p of PLANETS)point(p.x,p.y,Math.max(3,p.r*k),p.color);else{point(0,0,4,'#fff4b3');for(const n of g.world().nodes)if(n.hp>0)point(n.x,n.y,1.5,n.type==='crystal'?'#b9d4f3':'#91ae99');for(const v of g.world().creatures)point(v.x,v.y,2.5,'#d5eea0');for(const b of g.world().buildings)point(b.x,b.y,3,'#84d5e1');if(g.waypoint)point(g.waypoint.x,g.waypoint.y,4,'#f5cc85');}point(a.x,a.y,3.5,'#efffda');c.restore();}
    draw(dt=.016){
      dt=clamp(Number(dt)||.016,0,.1);this.frameMs=this.frameMs*.94+dt*1000*.06;const s=this.game.state;if(this.mode!==s.mode)this.reset();if(!this.game.paused)this.time+=dt;
      const actor=s.mode==='space'?s.ship:s.player;if(this.game.moving){this.pan.x*=Math.exp(-dt*3);this.pan.y*=Math.exp(-dt*3);}const response=1-Math.exp(-dt*10);this.camera.x+=(actor.x+this.pan.x-this.camera.x)*response;this.camera.y+=(actor.y+this.pan.y-this.camera.y)*response;
      const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.save();if(this.immersive&&this.shake>0){c.translate(Math.sin(this.time*50)*this.shake*this.intensity,Math.cos(this.time*63)*this.shake*this.intensity);this.shake=Math.max(0,this.shake-dt*12);}
      if(s.mode==='surface')this.surface(c,dt);else this.space(c,dt);this.screenFx(c,s.mode);c.restore();this.radarTime+=dt;if(this.radarTime>.15){this.drawRadar();this.radarTime=0;}
    }
  }
  function drawPreview(canvas){const g=new Game();g.state.player={x:70,y:115,angle:0};g.world().buildings.push({type:'habitat',x:220,y:0,level:1},{type:'solar',x:270,y:120});const friend=g.world().creatures[0];friend.x=130;friend.y=150;g.state.met.push(friend.species);const r=new Renderer(canvas,null,g);r.zoom=.9;r.camera={x:80,y:60};r.time=1.2;r.draw(0);return r;}
  root.OrbitRenderer={Renderer,drawPlanet,creature,drawPreview};
  root.Orbit2D={Renderer,ship,astronaut,building,resource,drawPreview};
  if(typeof module!=='undefined')module.exports=root.Orbit2D;
})(typeof globalThis!=='undefined'?globalThis:this);
