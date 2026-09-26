(function(root){
  'use strict';
  const VERSION=1, SURFACE_MAP_SCALE=1.5, WORLD_LIMIT=Math.round(1320*SURFACE_MAP_SCALE), TERRAIN_LIMIT=Math.round(1750*SURFACE_MAP_SCALE), TAU=Math.PI*2;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function rand(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  const PLANETS=[
    {id:'verdant',name:'베르단트',code:'VERDANT–01',kind:'온화한 숲 행성',temp:'21°C',seed:4201,x:-480,y:70,r:130,color:'#73bc91',light:'#b2ddb3',dark:'#245c57',ground:['#315f53','#356658','#3d7060','#497d63','#558668'],water:'#1e5055',flora:'#73b18c',accent:'#c3f379',species:['mossling','lumi','mistmoth'],resource:'바이오매스 풍부',description:'별빛을 머금은 숲, 느릿하게 걷는 작은 생명들과 안개 날개 요정이 머무는 곳. 당신의 첫 보금자리로 완벽한 행성입니다.',oxygen:.11},
    {id:'solara',name:'솔라라',code:'SOLARA–02',kind:'황금빛 사막 행성',temp:'38°C',seed:7129,x:470,y:-480,r:107,color:'#dbab6d',light:'#ffe1a2',dark:'#966344',ground:['#92724f','#a58257','#af8f60','#b69767','#bfa16e'],water:'#526968',flora:'#af9270',accent:'#fbd681',species:['dunecrab','sunwhorl'],resource:'철광석 풍부',description:'오래된 바람이 모래 언덕을 가로지르는 곳. 모래게와 황금빛 소용돌이 정령이 유적 주위를 맴돕니다.',oxygen:.19},
    {id:'nix',name:'닉스',code:'NIX–03',kind:'푸른 빙하 행성',temp:'−42°C',seed:9703,x:920,y:330,r:101,color:'#a2cfe2',light:'#e1f2ec',dark:'#497e98',ground:['#637f96','#7897aa','#8da9b9','#97b6c5','#a1bfcd'],water:'#315b7b',flora:'#becedb',accent:'#abedff',species:['snowpuff','aurorayne'],resource:'수정 풍부',description:'얼음 아래로 푸른 수정맥이 흐릅니다. 보송이와 오로라 뿔을 가진 신비한 존재가 차가운 밤을 밝힙니다.',oxygen:.2},
    {id:'ember',name:'엠버',code:'EMBER–04',kind:'붉은 화산 행성',temp:'67°C',seed:5183,x:250,y:1030,r:120,color:'#c47761',light:'#f7b290',dark:'#603f48',ground:['#53464c','#624b50','#73545a','#845c60','#926768'],water:'#ca674b',flora:'#b37b65',accent:'#ffa685',species:['emberling','cinderwisp'],resource:'철광석 · 수정',description:'붉은 균열 사이로 생명이 움틉니다. 불꽃이와 잿빛 정령이 용암빛 숨결로 어둠을 밀어냅니다.',oxygen:.26},
    {id:'prisma',name:'프리즈마',code:'PRISMA–05',kind:'보랏빛 수정 행성',temp:'12°C',seed:2207,x:-1010,y:880,r:106,color:'#aa97d5',light:'#e0c6f1',dark:'#594879',ground:['#514963','#5b526f','#695d7d','#73668a','#807196'],water:'#393f64',flora:'#a994c3',accent:'#e7b6fd',species:['prismite','veilfox'],resource:'수정 풍부',description:'땅과 하늘이 함께 빛나는 수정의 정원. 수정 수호자와 환영 여우가 빛의 길을 만들며 노닙니다.',oxygen:.14}
  ];
  const SPECIES={
    mossling:{name:'모스링',kind:'숲의 작은 정원사',color:'#bbe490',dark:'#66936f',planet:'verdant',shape:'sprout',gift:{biomass:5},lore:'등에서 자라는 새싹으로 햇빛을 모아요. 낯선 탐험가에게도 나뭇잎을 나누어 줍니다.',line:'안녕, 별에서 온 친구!\n이 작은 새싹이 네 집에서도 자랐으면 좋겠어.'},
    lumi:{name:'루미',kind:'별빛을 모으는 친구',color:'#a3e4e9',dark:'#549daf',planet:'verdant',shape:'float',gift:{crystal:4},lore:'해가 지면 은은하게 빛나는 생명체. 반짝이는 것을 선물하는 건 루미의 인사예요.',line:'반짝이는 걸 좋아해? 나도!\n우리가 만난 기념으로 이 별 조각을 가져가.'},
    mistmoth:{name:'미스트모스',kind:'안개 날개의 숲 요정',color:'#d7f5e8',dark:'#7fa8a2',planet:'verdant',shape:'moth',gift:{biomass:4,crystal:3},lore:'이른 새벽의 안개 속에서만 또렷하게 보이는 나비형 생명체예요. 날개에 묻은 빛가루가 숲길을 조용히 밝혀 줍니다.',line:'쉿, 숲이 너를 기억하도록 빛가루를 남겨 둘게.\n길을 잃더라도 별빛이 다시 널 이끌 거야.'},
    dunecrab:{name:'듄크랩',kind:'사막의 길잡이',color:'#f0be80',dark:'#aa7455',planet:'solara',shape:'crab',gift:{iron:8},lore:'여섯 개의 발로 뜨거운 모래를 성큼성큼 걸어요. 모래 속 금속을 모으는 취미가 있어요.',line:'사각사각! 모래 아래에는 보물이 많지.\n이 단단한 돌로 멋진 집을 지어봐!'},
    sunwhorl:{name:'선월',kind:'사막의 황금 소용돌이 정령',color:'#ffd98a',dark:'#d39a57',planet:'solara',shape:'sunwhorl',gift:{iron:5,crystal:3},lore:'유적 위를 맴도는 모래 정령. 몸을 둘러싼 고리가 바람의 방향과 비밀스러운 유적의 길을 알려 줍니다.',line:'바람은 늘 같은 길을 그리는 법이야.\n이 반짝임을 따라가면 너도 길을 찾을 수 있어.'},
    snowpuff:{name:'보송이',kind:'빙하의 솜뭉치',color:'#e4f0fa',dark:'#93b6d0',planet:'nix',shape:'fluff',gift:{crystal:6},lore:'폭신한 털에 공기를 가둬 추위를 견뎌요. 친구를 발견하면 귀를 쫑긋 세운답니다.',line:'후우, 오늘도 조금 쌀쌀하네!\n따뜻한 집을 짓는다면 나도 놀러 가도 될까?'},
    aurorayne:{name:'오로레인',kind:'오로라 뿔의 설원 정령',color:'#d8f8ff',dark:'#79a8c8',planet:'nix',shape:'aurorayne',gift:{crystal:8,biomass:2},lore:'머리 위의 유리 같은 뿔이 오로라를 머금으면 눈밭에 잔잔한 색빛이 번져요. 고요한 밤일수록 더 가까이 다가옵니다.',line:'차가운 별빛은 아프지 않아. 아주 조용할 뿐이야.\n이 작은 얼음결정이 너의 주머니에서도 노래할 거야.'},
    emberling:{name:'불꽃이',kind:'화산의 온기',color:'#ffa479',dark:'#be6460',planet:'ember',shape:'flame',gift:{iron:10},lore:'등의 작은 불꽃은 기분에 따라 달라져요. 반가운 친구를 만나면 불꽃이 춤을 춥니다.',line:'우와, 손님이다! 뜨거우니까 조심해.\n이 철은 용암이 나한테 준 선물이야.'},
    cinderwisp:{name:'신더위습',kind:'재와 불씨의 유영자',color:'#ffc48c',dark:'#b86057',planet:'ember',shape:'cinderwisp',gift:{iron:4,crystal:5},lore:'몸체보다 후광과 불씨가 먼저 보이는 작은 정령. 화산 틈의 속삭임을 따라 유영하며 잿빛 밤을 물들입니다.',line:'너의 심장도 작은 별처럼 타오르고 있구나.\n받아, 이 불씨는 길이 어두울 때 가장 환하게 빛나.'},
    prismite:{name:'프리즘',kind:'수정 정원의 수호자',color:'#d4b6f5',dark:'#8a70ac',planet:'prisma',shape:'prism',gift:{crystal:10},lore:'수정과 함께 자라는 신비한 생명체. 빛을 굴절시켜 무지개로 마음을 전합니다.',line:'멀리서 온 너의 빛이 느껴져.\n네가 머무는 곳도 이 수정처럼 빛나기를.'},
    veilfox:{name:'베일폭스',kind:'환영 꼬리의 수정 여우',color:'#efe2ff',dark:'#9077c2',planet:'prisma',shape:'veilfox',gift:{crystal:7,biomass:3},lore:'반투명한 꼬리가 여러 갈래로 번지며 공중에 빛의 흔적을 남겨요. 모습을 드러냈다가도 금세 유리 안개처럼 사라집니다.',line:'내 꼬리에 남은 잔광을 따라와 봐.\n너의 집에도 꿈처럼 빛나는 길이 이어질 거야.'}
  };
  const BUILDINGS={
    habitat:{name:'탐험가의 집',icon:'⌂',cost:{iron:12,biomass:8},description:'머무르면 산소를 충전해요.',radius:67},
    solar:{name:'태양광 충전기',icon:'▦',cost:{iron:8,crystal:6},description:'근처에서 우주선 연료를 충전해요.',radius:52},
    beacon:{name:'탐사 비콘',icon:'⌁',cost:{iron:6,crystal:4},description:'주변 자원과 생명체를 표시해요.',radius:32}
  };
  const RESOURCE_NAMES={iron:'철광석',crystal:'수정',biomass:'바이오매스'};
  class Game{
    constructor(saved){
      this.events=[];this.keys={};this.paused=false;this.moveTarget=null;this.selectedBuild=null;this.interactHeld=false;this.cooldown=0;this.scanCooldown=0;this.scanRing=null;this.beam=null;this.solarCharge=0;this.travel=null;this.pulse=0;
      this.state=this.fresh();
      if(saved){try{this.state=this.validate(saved);}catch(e){this.emit('message',{text:'저장 파일을 읽지 못했어요. 새 탐험을 시작합니다.',error:true});}}
      this.state.ship.altitude=clamp(Number.isFinite(this.state.ship.altitude)?this.state.ship.altitude:0,0,650);this.ensureWorld(this.state.planet);this.lastSave=0;this.boosting=false;
      this.velocity={x:0,y:0,z:0};this.motionMode=this.state.mode;this.pendingInteraction=null;this.waypoint=null;
    }
    fresh(){return{version:VERSION,mode:'surface',planet:'verdant',player:{x:90,y:100,angle:0},ship:{x:-480,y:245,angle:-Math.PI/2},oxygen:100,fuel:100,inventory:{iron:0,crystal:0,biomass:0},worlds:{},visited:['verdant'],discovered:[],met:[],friendship:{},creatureCare:{},companion:null,relics:[],time:0,stats:{mined:0,buildings:0,travel:0,collected:{iron:0,crystal:0,biomass:0}},rewarded:false};}
    validate(input){
      if(!input||input.version!==VERSION||!['surface','space'].includes(input.mode)||!PLANETS.some(p=>p.id===input.planet))throw Error('Invalid save');
      const s=this.fresh();
      for(const key of ['player','ship']){
        if(!input[key]||!Number.isFinite(input[key].x)||!Number.isFinite(input[key].y))throw Error('Invalid position');
        const limit=key==='player'?WORLD_LIMIT:2600;
        s[key]={x:clamp(input[key].x,-limit,limit),y:clamp(input[key].y,-limit,limit),angle:Number.isFinite(input[key].angle)?input[key].angle:0};
      }
      s.ship.altitude=0;s.mode=input.mode;s.planet=input.planet;s.oxygen=clamp(Number(input.oxygen)||100,1,100);s.fuel=clamp(Number(input.fuel)||0,0,100);s.time=clamp(Number(input.time)||0,0,1e9);
      for(const r of Object.keys(s.inventory))s.inventory[r]=clamp(Math.floor(Number(input.inventory?.[r])||0),0,99999);
      for(const key of ['discovered','met'])s[key]=[...new Set((Array.isArray(input[key])?input[key]:[]).filter(id=>SPECIES[id]))];
      s.visited=[...new Set((Array.isArray(input.visited)?input.visited:[]).filter(id=>PLANETS.some(p=>p.id===id)))];if(!s.visited.includes(s.planet))s.visited.push(s.planet);
      s.stats.mined=clamp(Number(input.stats?.mined)||0,0,1e9);s.stats.travel=clamp(Number(input.stats?.travel)||0,0,1e9);
      for(const r of Object.keys(s.inventory))s.stats.collected[r]=clamp(Number(input.stats?.collected?.[r])||0,0,1e9);
      s.rewarded=!!input.rewarded;
      for(const id of Object.keys(SPECIES)){
        s.friendship[id]=clamp(Math.floor(Number(input.friendship?.[id])||0),0,3);
        if(Number.isFinite(input.creatureCare?.[id]))s.creatureCare[id]=clamp(input.creatureCare[id],0,s.time);
      }
      s.relics=[...new Set((Array.isArray(input.relics)?input.relics:[]).filter(id=>PLANETS.some(p=>[0,1,2].some(i=>id===p.id+'-relic-'+i))))];
      s.companion=typeof input.companion==='string'&&input.companion.length<80?input.companion:null;
      if(input.worlds&&typeof input.worlds==='object')for(const p of PLANETS){
        const old=input.worlds[p.id];if(!old)continue;
        const w=this.makeWorld(p);
        if(Array.isArray(old.nodes))for(const n of w.nodes){const prior=old.nodes.find(v=>v.id===n.id);if(prior){n.hp=clamp(Number(prior.hp)||0,0,n.maxHp);n.respawnAt=clamp(Number(prior.respawnAt)||0,0,s.time+180);}}
        if(Array.isArray(old.buildings))w.buildings=old.buildings.slice(0,80).filter(b=>BUILDINGS[b.type]&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Math.abs(b.x)<WORLD_LIMIT&&Math.abs(b.y)<WORLD_LIMIT).map((b,i)=>({id:'building-'+i,type:b.type,x:b.x,y:b.y,level:b.level===2?2:1,lit:b.lit!==false}));
        s.worlds[p.id]=w;s.stats.buildings+=w.buildings.length;
      }
      return s;
    }
    emit(type,data={}){this.events.push({type,...data});}
    planet(){return PLANETS.find(p=>p.id===this.state.planet);}
    makeWorld(p){
      const random=rand(p.seed),nodes=[],creatures=[];
      const resourceRadius=970*SURFACE_MAP_SCALE, creatureSpread=1900*SURFACE_MAP_SCALE;
      const fixed=[{x:190,y:115,type:'iron'},{x:285,y:65,type:'iron'},{x:185,y:230,type:'biomass'},{x:65,y:265,type:'biomass'},{x:-155,y:90,type:'crystal'},{x:-260,y:-70,type:'crystal'}];
      for(let i=0;i<140;i++){
        const a=random()*TAU,d=330+Math.sqrt(random())*resourceRadius;
        const special=p.id==='solara'?'iron':(p.id==='nix'||p.id==='prisma')?'crystal':p.id==='verdant'?'biomass':'iron';
        fixed.push({x:Math.cos(a)*d,y:Math.sin(a)*d,type:random()<.36?special:['iron','crystal','biomass'][Math.floor(random()*3)]});
      }
      fixed.forEach((n,i)=>{const maxHp=n.type==='iron'?4:n.type==='crystal'?3:2;nodes.push({...n,id:p.id+'-node-'+i,hp:maxHp,maxHp,respawnAt:0,size:.8+random()*.5,rotation:random()*TAU,seed:Math.floor(random()*10000)});});
      p.species.forEach((species,i)=>{
        for(let j=0;j<3;j++){
          const x=j===0?([365,-420,430][i%3]):(random()-.5)*creatureSpread;
          const y=j===0?([225,-280,-330][i%3]):(random()-.5)*creatureSpread;
          creatures.push({id:p.id+'-life-'+i+'-'+j,species,x,y,homeX:x,homeY:y,phase:random()*TAU,angle:random()*TAU});
        }
      });
      const relics=[[-245,405],[720,-490],[-810,-710]].map(([x,y],i)=>({id:p.id+'-relic-'+i,x:x*SURFACE_MAP_SCALE,y:y*SURFACE_MAP_SCALE,name:['별빛 기록석','잊힌 항로 표식','공명 수정 유적'][i]}));
      return{nodes,creatures,buildings:[],relics};
    }
    ensureWorld(id){if(!this.state.worlds[id])this.state.worlds[id]=this.makeWorld(PLANETS.find(p=>p.id===id));return this.state.worlds[id];}
    world(){return this.ensureWorld(this.state.planet);}
    snapshot(){return JSON.parse(JSON.stringify(this.state));}
    nearest(range=140){
      if(this.state.mode==='space'){
        const p=PLANETS.map(p=>({kind:'planet',entity:p,d:Math.hypot(this.state.ship.x-p.x,this.state.ship.y-p.y)-p.r})).sort((a,b)=>a.d-b.d)[0];return p.d<105?p:null;
      }
      const p=this.state.player,w=this.world(),items=[];
      for(const n of w.nodes)if(n.hp>0)items.push({kind:'node',entity:n,d:dist(p,n)});
      for(const c of w.creatures)items.push({kind:'creature',entity:c,d:dist(p,c)});
      for(const b of w.buildings)items.push({kind:'building',entity:b,d:dist(p,b)-20});
      for(const r of w.relics)items.push({kind:'relic',entity:r,d:dist(p,r)});
      items.push({kind:'ship',entity:{x:0,y:0},d:dist(p,{x:0,y:0})-30});
      return items.filter(i=>i.d<range).sort((a,b)=>a.d-b.d)[0]||null;
    }
    tick(dt,input={}){
      if(this.paused)return;
      dt=clamp(dt,0,.05);const s=this.state;s.time+=dt;this.pulse+=dt;
      this.cooldown=Math.max(0,this.cooldown-dt);this.scanCooldown=Math.max(0,this.scanCooldown-dt);
      if(this.beam){this.beam.life-=dt;if(this.beam.life<=0)this.beam=null;}
      if(this.scanRing){this.scanRing.age+=dt;if(this.scanRing.age>2)this.scanRing=null;}
      if(this.travel){this.travel.age+=dt;if(this.travel.age>2.4)this.finishTravel();return;}
      if(this.solarCharge>0){this.solarCharge-=dt;if(this.solarCharge<=0){s.fuel=clamp(s.fuel+22,0,100);this.emit('message',{text:'비상 태양광 충전 완료! 연료 +22'});this.emit('save');}}
      const actor=s.mode==='surface'?s.player:s.ship;
      let dx=Number.isFinite(input.dx)?input.dx:(input.right?1:0)-(input.left?1:0),dy=Number.isFinite(input.dy)?input.dy:(input.down?1:0)-(input.up?1:0);
      if(dx||dy){this.moveTarget=null;this.pendingInteraction=null;}
      if(this.moveTarget&&!dx&&!dy){const d=dist(actor,this.moveTarget);if(d>7){dx=(this.moveTarget.x-actor.x)/d;dy=(this.moveTarget.y-actor.y)/d;}else{this.moveTarget=null;}}
      const len=Math.hypot(dx,dy),moving=len>.01;
      if(this.motionMode!==s.mode){this.motionMode=s.mode;this.velocity={x:0,y:0,z:0};this.pendingInteraction=null;this.waypoint=null;}
      const speed=s.mode==='surface'?(input.run?218:144):(s.fuel>0?(input.run?540:250):95);
      const response=1-Math.exp(-dt*(s.mode==='surface'?15:6));
      this.velocity.x+=((moving?dx/len*speed:0)-this.velocity.x)*response;
      this.velocity.y+=((moving?dy/len*speed:0)-this.velocity.y)*response;
      if(Math.hypot(this.velocity.x,this.velocity.y)<.2&&!moving){this.velocity.x=0;this.velocity.y=0;}
      actor.x+=this.velocity.x*dt;actor.y+=this.velocity.y*dt;
      if(moving){const difference=Math.atan2(Math.sin(Math.atan2(dy,dx)-actor.angle),Math.cos(Math.atan2(dy,dx)-actor.angle));actor.angle+=difference*(1-Math.exp(-dt*13));}
      const limit=s.mode==='surface'?WORLD_LIMIT:2300;actor.x=clamp(actor.x,-limit,limit);actor.y=clamp(actor.y,-limit,limit);
      this.moving=Math.hypot(this.velocity.x,this.velocity.y)>2;this.boosting=this.moving&&!!input.run;
      if(s.mode==='space'){
        s.ship.altitude=0;this.velocity.z=0;
        if(this.moving)s.fuel=clamp(s.fuel-dt*(input.run?.8:.28),0,100);
      }
      if(s.mode==='surface'){
        const w=this.world(),p=s.player;
        for(const c of w.creatures){
          const follow=s.companion===c.id,near=dist(c,p)<160;
          const tx=follow?p.x-Math.cos(p.angle)*72:c.homeX+Math.sin(s.time*.18+c.phase)*35;
          const ty=follow?p.y-Math.sin(p.angle)*72:c.homeY+Math.cos(s.time*.14+c.phase)*25;
          const f=1-Math.exp(-dt*(follow?3:near?.7:1.8));c.x+=(tx-c.x)*f;c.y+=(ty-c.y)*f;
        }
        // Slide along solid structures while keeping the interaction radius generous.
        const obstacles=[{x:0,y:0,r:65},...w.buildings.map(b=>({...b,r:b.type==='habitat'?56:30})),...w.nodes.filter(n=>n.hp>0&&n.type==='iron').map(n=>({...n,r:27}))];
        for(const o of obstacles){const d=dist(p,o),r=o.r+12;if(d>0&&d<r){p.x=o.x+(p.x-o.x)/d*r;p.y=o.y+(p.y-o.y)/d*r;}}
        if(this.pendingInteraction){
          const target=[...w.nodes,...w.creatures,...w.buildings,...w.relics].find(n=>n.id===this.pendingInteraction);
          if(!target||(target.hp!==undefined&&target.hp<=0)){this.pendingInteraction=null;this.moveTarget=null;}
          else if(dist(p,target)<110&&this.cooldown<=0){this.pendingInteraction=null;this.moveTarget=null;this.velocity.x=this.velocity.y=0;this.interact(target.id);}
          else this.moveTarget={x:target.x,y:target.y};
        }
        for(const n of w.nodes)if(n.hp<=0&&s.time>=n.respawnAt)n.hp=n.maxHp;
        const safe=dist(p,{x:0,y:0})<180||w.buildings.some(b=>b.type==='habitat'&&dist(p,b)<150);
        s.oxygen=clamp(s.oxygen+dt*(safe?15:-this.planet().oxygen*(input.run?1.6:1)),0,100);
        const solar=w.buildings.find(b=>b.type==='solar'&&dist(p,b)<200);if(solar)s.fuel=clamp(s.fuel+dt*(solar.level===2?7:3),0,100);
        if(s.oxygen<=0){s.player.x=90;s.player.y=90;s.oxygen=100;this.moveTarget=null;this.emit('message',{text:'산소가 부족해 우주선으로 긴급 귀환했어요. 자원은 안전합니다.',error:true});this.emit('save');}
      }else{s.oxygen=100;}
      if(input.interact&&this.cooldown<=0){const n=this.nearest();if(n?.kind==='node')this.interact();}
    }
    addResource(type,amount){this.state.inventory[type]+=amount;this.state.stats.collected[type]+=amount;}
    interact(targetId){
      if(this.paused||this.travel||this.cooldown>0)return{ok:false,reason:'잠시 기다려주세요.'};
      if(this.selectedBuild)return this.build(this.selectedBuild,this.state.player.x+Math.cos(this.state.player.angle)*105,this.state.player.y+Math.sin(this.state.player.angle)*105);
      let n=this.nearest();
      if(targetId&&this.state.mode==='surface'){
        const w=this.world(),target=[...w.nodes.filter(n=>n.hp>0).map(entity=>({kind:'node',entity})),...w.creatures.map(entity=>({kind:'creature',entity})),...w.buildings.map(entity=>({kind:'building',entity})),...w.relics.map(entity=>({kind:'relic',entity}))].find(v=>v.entity.id===targetId);
        if(target&&dist(target.entity,this.state.player)<160)n=target;else return{ok:false,reason:'더 가까이 이동하세요.'};
      }
      if(!n){this.emit('message',{text:this.state.mode==='surface'?'자원이나 생명체 가까이에서 E를 눌러주세요.':'행성 가까이로 비행하거나 M으로 항로를 설정하세요.'});return{ok:false,reason:'주변에 상호작용할 대상이 없습니다.'};}
      if(n.kind==='planet')return this.land(n.entity.id);
      if(n.kind==='node'){
        const node=n.entity;this.cooldown=.38;node.hp--;this.beam={x:node.x,y:node.y,life:.28};
        const nodeColor=node.type==='crystal'?'#bccfff':node.type==='biomass'?'#c3f379':'#cad9df',broken=node.hp<=0;
        this.emit('effect',{kind:'mine',x:node.x,y:node.y,color:nodeColor,nodeType:node.type,remaining:node.hp,maxHp:node.maxHp,broken});
        if(broken){const amount=node.type==='iron'?6:node.type==='biomass'?5:4;this.addResource(node.type,amount);this.state.stats.mined++;node.respawnAt=this.state.time+150;this.emit('message',{text:RESOURCE_NAMES[node.type]+' +'+amount});this.emit('effect',{kind:'break',x:node.x,y:node.y,color:nodeColor,nodeType:node.type,maxHp:node.maxHp});this.emit('effect',{kind:'collect',x:node.x,y:node.y,color:this.planet().accent,label:'+'+amount+' '+RESOURCE_NAMES[node.type]});this.emit('save');}
        return{ok:true,type:'mine',resource:node.type,remaining:node.hp};
      }
      if(n.kind==='creature')return this.befriend(n.entity);
      if(n.kind==='ship')return this.launch();
      if(n.kind==='building'){this.emit('building-menu',{id:n.entity.id});return{ok:true,type:'building'};}
      if(n.kind==='relic')return this.studyRelic(n.entity.id);
      return{ok:false};
    }
    discover(id,announce=true){if(this.state.discovered.includes(id))return false;this.state.discovered.push(id);if(announce)this.emit('discovery',{species:id});this.emit('save');return true;}
    befriend(c){
      const first=!this.state.met.includes(c.species),sp=SPECIES[c.species];this.discover(c.species,false);
      if(first){this.state.met.push(c.species);for(const [r,v]of Object.entries(sp.gift))this.addResource(r,v);}
      this.cooldown=.8;this.emit('dialogue',{species:c.species,id:c.id,first});this.emit('save');return{ok:true,type:'friend',species:c.species,first};
    }
    careForCreature(id,action){
      if(this.paused||this.travel||this.state.mode!=='surface')return{ok:false,reason:'탐험 중에 교류할 수 있어요.'};
      const s=this.state,c=this.world().creatures.find(v=>v.id===id);
      if(!c||dist(c,s.player)>160)return{ok:false,reason:'친구에게 더 가까이 다가가세요.'};
      if(!s.met.includes(c.species))return{ok:false,reason:'먼저 친구에게 인사해 주세요.'};
      const sp=SPECIES[c.species],bond=s.friendship[c.species]||0;
      if(action==='follow'){
        if(bond<2)return{ok:false,reason:'쓰다듬거나 먹이를 나누어 친밀도 2를 만들어 주세요.'};
        s.companion=s.companion===id?null:id;
        this.emit('message',{text:s.companion?sp.name+'이 함께 탐험합니다.':sp.name+'이 주변을 자유롭게 돌아다닙니다.'});
      }else if(action==='guide'){
        if(bond<2)return{ok:false,reason:'친밀도 2부터 길을 물어볼 수 있어요.'};
        const targets=this.world().relics.filter(r=>!s.relics.includes(r.id));
        const target=targets.sort((a,b)=>dist(a,s.player)-dist(b,s.player))[0];
        if(!target)return{ok:false,reason:'이 행성의 유적을 모두 발견했어요!'};
        this.waypoint={x:target.x,y:target.y,label:target.name};
        this.emit('message',{text:sp.name+'이 '+target.name+'의 방향을 알려줬어요. 목표 표시를 따라가세요.'});
        this.emit('effect',{kind:'scan',x:c.x,y:c.y});
      }else if(action==='pet'||action==='feed'){
        if(action==='pet'&&s.creatureCare[c.species]!==undefined&&s.time-s.creatureCare[c.species]<10)return{ok:false,reason:'조금 뒤 다시 쓰다듬어 주세요 · '+Math.ceil(10-(s.time-s.creatureCare[c.species]))+'초'};
        if(bond>=3)return{ok:false,reason:'이미 가장 친한 친구예요. 함께 탐험해 보세요!'};
        if(action==='feed'&&s.inventory.biomass<2)return{ok:false,reason:'먹이를 나누려면 바이오매스 2개가 필요해요.'};
        if(action==='feed')s.inventory.biomass-=2;
        s.friendship[c.species]=Math.min(3,bond+1);if(action==='pet')s.creatureCare[c.species]=s.time;
        this.emit('effect',{kind:'friend',x:c.x,y:c.y,color:sp.color});
        this.emit('message',{text:sp.name+(action==='feed'?'과 먹이를 나눴어요.':'을 쓰다듬었어요.')+' 친밀도 '+s.friendship[c.species]+' / 3'});
      }else return{ok:false,reason:'알 수 없는 교류예요.'};
      this.emit('save');return{ok:true,bond:s.friendship[c.species]||0,companion:s.companion};
    }
    useBuilding(id,action){
      if(this.paused||this.travel||this.state.mode!=='surface')return{ok:false,reason:'탐험 중에 사용할 수 있어요.'};
      const s=this.state,b=this.world().buildings.find(v=>v.id===id);
      if(!b||dist(b,s.player)>180)return{ok:false,reason:'건물 가까이로 이동하세요.'};
      if(action==='upgrade'){
        if(b.level===2)return{ok:false,reason:'이미 업그레이드한 건물이에요.'};
        if(s.inventory.iron<6||s.inventory.crystal<4)return{ok:false,reason:'철광석 6개와 수정 4개가 필요해요.'};
        s.inventory.iron-=6;s.inventory.crystal-=4;b.level=2;
        this.emit('effect',{kind:'build',x:b.x,y:b.y,color:'#c3f379'});
        this.emit('message',{text:BUILDINGS[b.type].name+' Lv.2 · 설비를 업그레이드했어요.'});
      }else if(action==='lights'&&b.type==='habitat'){
        b.lit=b.lit===false;this.emit('message',{text:b.lit?'집의 조명을 켰어요.':'집의 조명을 껐어요.'});
      }else if(action==='rest'&&b.type==='habitat'){
        s.oxygen=100;if(b.level===2)s.fuel=clamp(s.fuel+10,0,100);
        this.emit('effect',{kind:'rest',x:b.x,y:b.y,color:'#b2f6da'});
        this.emit('message',{text:'집에서 숨을 골랐어요. 산소 100%'+(b.level===2?' · 연료 +10':'')});
      }else if(action==='charge'&&b.type==='solar'){
        this.waypoint={x:b.x,y:b.y,label:'태양광 충전 중'};this.emit('message',{text:'이곳에 머무르면 연료가 초당 '+(b.level===2?7:3)+'% 충전됩니다.'});
      }else if(action==='scan'&&b.type==='beacon'){
        this.scanCooldown=0;const result=this.scan();
        const target=this.world().relics.filter(r=>!s.relics.includes(r.id)).sort((a,c)=>dist(a,b)-dist(c,b))[0];
        if(target)this.waypoint={x:target.x,y:target.y,label:target.name};
        if(b.level===2)for(const c of this.world().creatures)this.discover(c.species);
        this.emit('message',{text:target?'비콘이 미탐사 유적의 위치를 표시했어요.':'이 행성의 모든 유적을 조사했어요.'});
        if(!result.ok)return result;
      }else return{ok:false,reason:'이 건물에서 사용할 수 없는 기능이에요.'};
      this.emit('save');return{ok:true};
    }
    studyRelic(id){
      if(this.paused||this.travel||this.state.mode!=='surface')return{ok:false,reason:'착륙 후 조사하세요.'};
      const r=this.world().relics.find(v=>v.id===id),s=this.state;
      if(!r||dist(r,s.player)>160)return{ok:false,reason:'유적 가까이로 이동하세요.'};
      if(s.relics.includes(id)){this.emit('message',{text:'이미 조사한 '+r.name+'입니다. 다음 별빛 기록을 찾아보세요.'});return{ok:false,reason:'조사 완료'};}
      s.relics.push(id);this.addResource('crystal',5);this.addResource('iron',4);this.cooldown=.8;
      if(this.waypoint&&dist(this.waypoint,r)<2)this.waypoint=null;
      this.emit('effect',{kind:'relic',x:r.x,y:r.y,color:this.planet().accent});
      this.emit('message',{text:r.name+' 조사 완료 · 수정 +5 · 철광석 +4'});
      this.emit('relic-story',{name:r.name,text:this.planet().name+'의 오래된 탐험가들은 별빛을 모아 길을 남겼습니다. 이 행성의 생명체들도 그 길을 기억하고 있어요.'});
      this.emit('save');return{ok:true,type:'relic',id};
    }
    scan(){
      if(this.paused||this.travel)return{ok:false,reason:'탐험 중에 스캔할 수 있어요.'};
      if(this.scanCooldown>0){this.emit('message',{text:'스캐너 충전 중 · '+Math.ceil(this.scanCooldown)+'초'});return{ok:false,reason:'스캐너 충전 중'};}
      this.scanCooldown=5;const pos=this.state.mode==='surface'?this.state.player:this.state.ship;this.scanRing={x:pos.x,y:pos.y,age:0};this.emit('effect',{kind:'scan',scanAction:true});
      if(this.state.mode==='space'){this.emit('message',{text:'행성 5개 감지. M 키로 성계 지도를 열어보세요.'});return{ok:true,planets:PLANETS.length};}
      const nearby=this.world().creatures.filter(c=>dist(c,pos)<650);let found=0;for(const c of nearby)if(this.discover(c.species))found++;
      const nodes=this.world().nodes.filter(n=>n.hp>0&&dist(n,pos)<650).length;
      this.emit('message',{text:'스캔 완료 · 자원 '+nodes+'곳 · 생명체 '+nearby.length+'마리'+(found?' · 새 도감 +'+found:'')});return{ok:true,nodes,creatures:nearby.length,discovered:found};
    }
    canAfford(type){return!!BUILDINGS[type]&&Object.entries(BUILDINGS[type].cost).every(([r,n])=>this.state.inventory[r]>=n);}
    canPlace(type,x,y){
      if(this.state.mode!=='surface')return{ok:false,reason:'행성에 착륙한 뒤 건설하세요.'};
      const def=BUILDINGS[type];if(!def||!Number.isFinite(x)||!Number.isFinite(y))return{ok:false,reason:'건물을 선택하세요.'};
      if(!this.canAfford(type))return{ok:false,reason:'자원이 부족해요. 비용을 확인하고 더 모아주세요.'};
      if(this.world().buildings.length>=80)return{ok:false,reason:'이 행성에는 건물을 80개까지 지을 수 있어요.'};
      if(Math.abs(x)>WORLD_LIMIT-100||Math.abs(y)>WORLD_LIMIT-100)return{ok:false,reason:'행성의 가장자리에는 건설할 수 없어요.'};
      if(dist({x,y},this.state.player)>260)return{ok:false,reason:'조금 더 가까이 이동해서 건설하세요.'};
      if(dist({x,y},{x:0,y:0})<165)return{ok:false,reason:'우주선 착륙 공간을 조금 비워주세요.'};
      if(this.world().buildings.some(b=>dist(b,{x,y})<def.radius+BUILDINGS[b.type].radius+30))return{ok:false,reason:'다른 건물과 조금 떨어진 곳을 선택하세요.'};
      if(this.world().nodes.some(n=>n.hp>0&&dist(n,{x,y})<def.radius+18))return{ok:false,reason:'이 자리를 먼저 채굴하거나 빈 땅을 선택하세요.'};
      return{ok:true};
    }
    build(type,x,y){
      if(this.paused||this.travel)return{ok:false,reason:'탐험 중에 건설할 수 있어요.'};
      const result=this.canPlace(type,x,y);if(!result.ok){this.emit('message',{text:result.reason,error:true});return result;}
      for(const[r,n]of Object.entries(BUILDINGS[type].cost))this.state.inventory[r]-=n;
      this.world().buildings.push({id:'building-'+Math.round(this.state.time*1000)+'-'+this.world().buildings.length,type,x,y});this.state.stats.buildings++;
      this.emit('effect',{kind:'build',x,y,color:'#c3f379',buildingType:type});this.emit('message',{text:BUILDINGS[type].name+' 완성! 이곳이 당신의 새로운 보금자리예요.'});this.selectedBuild=null;this.emit('save');return{ok:true,type};
    }
    launch(){
      if(this.paused||this.travel)return{ok:false,reason:'잠시 기다려주세요.'};
      if(this.state.mode==='space')return this.land();
      if(dist(this.state.player,{x:0,y:0})>190){this.moveTarget={x:80,y:60};this.emit('message',{text:'우주선으로 이동합니다. 도착하면 F를 눌러 이륙하세요.'});return{ok:false,reason:'우주선으로 이동 중'};}
      const p=this.planet();this.state.mode='space';this.state.ship={x:p.x,y:p.y+p.r+155,angle:-Math.PI/2,altitude:0};this.state.oxygen=100;this.moveTarget=null;this.selectedBuild=null;this.emit('launch');this.emit('message',{text:'이륙 완료! 방향키로 비행하거나 M 키로 성계 지도를 열어보세요.'});this.emit('save');return{ok:true,mode:'space'};
    }
    land(id){
      if(this.paused||this.travel)return{ok:false,reason:'잠시 기다려주세요.'};
      if(this.state.mode!=='space')return{ok:false,reason:'이미 행성에 착륙해 있어요.'};
      const target=id?PLANETS.find(p=>p.id===id):this.nearest()?.entity;
      if(!target||Math.hypot(target.x-this.state.ship.x,target.y-this.state.ship.y)>target.r+105){this.emit('message',{text:'행성에 더 가까이 다가가거나 M으로 항로를 설정하세요.'});return{ok:false,reason:'착륙 범위 밖입니다.'};}
      this.state.planet=target.id;this.state.mode='surface';this.state.player={x:90,y:100,angle:0};this.state.oxygen=100;this.ensureWorld(target.id);this.moveTarget=null;
      if(!this.state.visited.includes(target.id)){this.state.visited.push(target.id);this.emit('planet-discovery',{planet:target.id});}
      this.emit('land');this.emit('message',{text:target.name+'에 착륙했어요. 새로운 탐험을 시작하세요!'});this.emit('save');return{ok:true,planet:target.id};
    }
    warp(id){
      if(this.paused||this.travel)return{ok:false,reason:'잠시 기다려주세요.'};
      const target=PLANETS.find(p=>p.id===id);if(!target)return{ok:false,reason:'알 수 없는 행성이에요.'};
      if(this.state.mode!=='space')return{ok:false,reason:'우주선에서 이륙한 뒤 항로를 설정하세요.'};
      if(this.state.fuel<18){this.emit('message',{text:'연료가 18 필요해요. 연료 합성 또는 비상 충전을 이용하세요.',error:true});return{ok:false,reason:'연료 부족'};}
      this.state.fuel-=18;this.state.stats.travel++;this.travel={planet:id,age:0};this.moveTarget=null;this.emit('effect',{kind:'warp'});this.emit('message',{text:target.name+' 궤도로 이동 중…'});return{ok:true,planet:id,cost:18};
    }
    finishTravel(){const target=PLANETS.find(p=>p.id===this.travel.planet);this.state.ship={x:target.x,y:target.y+target.r+65,angle:-Math.PI/2,altitude:0};this.travel=null;this.emit('message',{text:target.name+' 궤도 도착. E 또는 착륙 버튼을 눌러주세요.'});this.emit('save');}
    refuel(){
      if(this.paused||this.travel)return{ok:false,reason:'잠시 기다려주세요.'};
      if(this.state.fuel>=99){this.emit('message',{text:'연료가 충분해요!'});return{ok:false,reason:'연료 가득'};}
      if(this.solarCharge>0)return{ok:false,reason:'비상 충전 중'};
      if(this.state.inventory.biomass>=3){this.state.inventory.biomass-=3;this.state.fuel=clamp(this.state.fuel+40,0,100);this.emit('message',{text:'바이오 연료 합성 완료 · 연료 +40'});this.emit('save');return{ok:true,amount:40};}
      this.solarCharge=6;this.emit('message',{text:'바이오매스가 부족해요. 6초 동안 비상 태양광 충전을 진행합니다.'});return{ok:true,emergency:true};
    }
    goals(){const s=this.state;return[{text:'철광석 12개, 바이오매스 8개 모으기',done:s.stats.collected.iron>=12&&s.stats.collected.biomass>=8},{text:'나만의 집 한 채 짓기',done:Object.values(s.worlds).some(w=>w.buildings.some(b=>b.type==='habitat'))},{text:'낯선 생명체와 친구 되기',done:s.met.length>0},{text:'우주선을 타고 두 번째 행성 탐험',done:s.visited.length>=2}];}
    nearbyState(){return{mode:this.state.mode,planet:this.planet().name,player:{...this.state.player},ship:{...this.state.ship},inventory:{...this.state.inventory},oxygen:Math.round(this.state.oxygen),fuel:Math.round(this.state.fuel),visited:[...this.state.visited],discovered:[...this.state.discovered],met:[...this.state.met],goals:this.goals(),nearby:this.state.mode==='surface'?{resources:this.world().nodes.filter(n=>n.hp>0&&dist(n,this.state.player)<350).map(n=>({id:n.id,type:n.type,x:n.x,y:n.y,hp:n.hp})),creatures:this.world().creatures.filter(c=>dist(c,this.state.player)<500).map(c=>({id:c.id,species:c.species,x:c.x,y:c.y})),buildings:this.world().buildings}:null};}
  }
  const exports={Game,PLANETS,SPECIES,BUILDINGS,RESOURCE_NAMES,SURFACE_MAP_SCALE,WORLD_LIMIT,TERRAIN_LIMIT,rand,clamp,dist};
  if(typeof module!=='undefined'&&module.exports)module.exports=exports;
  root.OrbitCore=exports;
})(typeof globalThis!=='undefined'?globalThis:this);
