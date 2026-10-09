(function(root){
  'use strict';
  const STEPS=[
    {short:'루미',zone:'01 · 도착 / 접수대',title:'루미에게 첫인사를 건네요',text:'빛나는 안내 로봇을 클릭해 다가가세요. 가까이에서는 E로 대화할 수 있어요.',note:'WASD·방향키로 이동 · 빈 땅 클릭으로 이동',line:'어서 와요! 저는 교관 루미예요. 제 쪽으로 걸어와 인사해 주세요. 함께 첫 탐험을 준비해요.',controls:['touch-pad','interact-button']},
    {short:'채굴',zone:'02 · 자원 실습실',title:'곡괭이로 철광석을 채굴해요',text:'1번 곡괭이를 장착하고, 표시된 철광석 가까이에서 E 또는 ‘채굴 / 교류’를 꾹 누르세요.',note:'철광석 → 곡괭이 · 바이오매스 → 도끼 · 수정 → 칼',line:'탐사 도구 3개를 지급했어요! 철광석은 곡괭이, 바이오매스는 도끼, 수정은 칼로만 부술 수 있어요. 먼저 곡괭이를 사용해 볼까요?',controls:['interact-button']},
    {short:'스캔',zone:'02 · 자원 실습실',title:'스캐너를 작동시켜요',text:'Q 또는 아래 ‘스캔’을 누르세요. 주변 자원과 생명체를 감지해요.',note:'스캔을 마치면 집 짓기에 필요한 재료를 지급해요.',line:'첫 자원을 얻었네요! 이번에는 스캐너로 주변을 살펴봐요. 다음 실습에 쓸 건설 재료도 준비해 둘게요.',controls:['scan-button']},
    {short:'건설',zone:'03 · 건설 실습실',title:'나만의 첫 집을 지어요',text:'금색 건설장으로 이동해 B → ‘탐험가의 집’을 선택하고, 테두리 안의 빈 땅을 클릭하세요.',note:'철광석 12개 + 바이오매스 8개 · 건설 재료 지급 완료',line:'건설 재료를 받았죠? 금색 실습장에 집을 지어 보세요. 실제 탐험에서는 집 근처에서 산소를 채울 수 있어요.',controls:['build-button']},
    {short:'교류',zone:'04 · 생태 실습실',title:'모스링과 친구가 돼요',text:'초록빛 생태실의 생명체를 클릭하거나 가까이에서 E를 눌러 인사하세요.',note:'스캔은 발견, 대화는 교류예요. 직접 인사를 건네 보세요.',line:'멋진 집이에요! 이제 왼쪽 생태실로 가 볼까요? 모스링에게 인사하면 작은 선물을 받을 수 있어요.',controls:['interact-button']},
    {short:'이륙',zone:'05 · 비행 격납고',title:'우주선을 타고 출발해요',text:'중앙 격납고의 우주선으로 돌아가 F 또는 ‘우주선’을 누르세요.',note:'우주선에 다가간 뒤 한 번 더 눌러 이륙해요.',line:'지상 훈련을 모두 마쳤어요! 중앙 격납고에서 비행 연습을 시작해요. 제가 무전으로 계속 안내할게요.',controls:['ship-button']},
    {short:'착륙',zone:'06 · 비행 시뮬레이터',title:'다른 행성에 착륙해요',text:'M → 다른 행성의 항로를 선택하세요. 도착한 뒤 E 또는 ‘착륙’을 누르면 훈련 완료!',note:'현재 행성이 아닌 다른 행성을 선택하세요.',line:'마지막 실습이에요! 성계 지도에서 새로운 목적지를 고르고 착륙해 보세요. 여기까지 마치면 정식 탐험가가 됩니다.',controls:['map-tab','ship-button']}
  ];
  class Tutorial{
    constructor(saved){
      this.done=STEPS.map((_,i)=>saved?.done?.[i]===true);
      this.walked=Number.isFinite(saved?.walked)?Math.max(0,Math.min(60,saved.walked)):0;
      this.skipped=saved?.skipped===true;this.dismissed=saved?.dismissed===true;
      this.launchPlanet=typeof saved?.launchPlanet==='string'?saved.launchPlanet:null;this.previous=null;
    }
    get step(){const n=this.done.indexOf(false);return n<0?STEPS.length:n;}
    get active(){return !this.skipped&&this.step<STEPS.length;}
    get complete(){return this.step===STEPS.length;}
    sync(game){game.trainingStep=this.step;}
    tick(game){
      this.sync(game);const s=game.state,p=s.player;
      if(!this.active||game.paused||game.flight||s.mode!=='surface'){this.previous=null;return;}
      if(this.previous&&this.previous.planet===s.planet){const d=Math.hypot(p.x-this.previous.x,p.y-this.previous.y);if(game.moving&&d<12)this.walked=Math.min(60,this.walked+d);}
      this.previous={x:p.x,y:p.y,planet:s.planet};
      // The new station starts with a real NPC encounter; legacy free-world guides still support walking.
      if(!s.training&&this.walked>=60)this.done[0]=true;
    }
    event(e,game){
      if(!this.active)return;
      const stage=this.step,training=game.state.training,allowed=n=>!training||stage===n;
      if(training&&e.type==='instructor'&&stage===0)this.done[0]=true;
      if(allowed(1)&&e.type==='effect'&&e.kind==='break')this.done[1]=true;
      if(allowed(2)&&e.type==='effect'&&e.kind==='scan'&&e.scanAction&&game.state.mode==='surface'){
        this.done[2]=true;
        if(training){for(const [r,n]of Object.entries({iron:12,biomass:8}))if(game.state.inventory[r]<n)game.addResource(r,n-game.state.inventory[r]);game.emit('message',{text:'루미: 건설 재료 도착! 철광석 12개와 바이오매스 8개가 준비됐어요.'});game.emit('save');}
      }
      if(allowed(3)&&e.type==='effect'&&e.kind==='build'&&e.buildingType==='habitat')this.done[3]=true;
      if(allowed(4)&&e.type==='dialogue')this.done[4]=true;
      if(e.type==='launch'){if(allowed(5))this.done[5]=true;this.launchPlanet=game.state.planet;this.previous=null;}
      if(e.type==='land'){if(allowed(6)&&this.launchPlanet&&game.state.planet!==this.launchPlanet)this.done[6]=true;this.previous=null;}
      this.sync(game);
    }
    snapshot(){return{done:[...this.done],walked:this.walked,skipped:this.skipped,dismissed:this.dismissed,launchPlanet:this.launchPlanet};}
    guide(game){
      const s=game.state,info={...(STEPS[this.step]||{}),controls:[...(STEPS[this.step]?.controls||[])]};
      if(!this.active)return info;
      if(game.flight){Object.assign(info,{title:game.flight.kind==='launch'?'이륙 준비 · 궤도로 출발':'착륙 중 · 착륙장을 확인해요',text:'자동 조종 중이에요. 우주선의 움직임이 끝나면 다음 행동을 할 수 있어요.',note:'잠시 기다려주세요.',controls:[],action:null});return info;}
      if(s.mode==='space'){
        const canLand=game.nearest()?.kind==='planet'&&!game.travel;
        if(this.step<5)Object.assign(info,{title:'훈련장에 착륙해 이어가요',text:'이 단계는 지상에서 진행해요. 가까운 행성에 착륙하거나 성계 지도에서 항로를 선택하세요.'});
        if(game.travel){info.action=null;info.note='이동 중이에요. 도착하면 착륙 버튼이 나타나요.';info.controls=[];}
        else if(canLand){info.action='land';info.label='이 행성에 착륙';info.controls=['ship-button'];}
        else{info.action='map';info.label='성계 지도 열기';info.controls=['map-tab'];}
        return info;
      }
      if(this.step===6){info.text='우주선으로 돌아가 이륙한 뒤, 성계 지도에서 다른 행성으로 떠나세요.';info.controls=['ship-button'];}
      const nearest=list=>list.reduce((a,b)=>!a||Math.hypot(b.x-s.player.x,b.y-s.player.y)<Math.hypot(a.x-s.player.x,a.y-s.player.y)?b:a,null);
      const w=game.world();let target=null;
      if(this.step===0){target=game.trainingNpc();if(!target)info.note=Math.floor(this.walked)+' / 60m · '+info.note;}
      if(this.step===1)target=nearest(w.nodes.filter(n=>n.hp>0&&n.type==='iron'));
      if(this.step===3){
        info.note='철광석 '+s.inventory.iron+' / 12 · 바이오매스 '+s.inventory.biomass+' / 8';
        const type=s.inventory.iron<12?'iron':s.inventory.biomass<8?'biomass':null;
        if(type){target=nearest(w.nodes.filter(n=>n.hp>0&&n.type===type));info.controls=['interact-button'];}
        else if(s.training&&Math.hypot(s.player.x-450,s.player.y-480)>210){target={x:450,y:370};info.label='건설장으로 이동';}
        else{info.action='build';info.label='집 건설하기';if(s.training)info.target={x:450,y:480};}
      }
      if(this.step===4)target=nearest(w.creatures);
      if(this.step>=5)target={x:80,y:80};
      if(target){info.target={x:target.x,y:target.y};info.targetId=target.id;info.action='mark';info.label=info.label||(this.step===0?'루미에게 이동':this.step>=5?'우주선으로 이동':'목표로 이동');info.distance=Math.round(Math.hypot(target.x-s.player.x,target.y-s.player.y));}
      else if([1,4].includes(this.step)||this.step===3&&!game.canAfford('habitat'))info.note+=' · 채굴한 자원은 150초 뒤 다시 자라요.';
      if(target?.type&&root.OrbitCore.RESOURCE_TOOLS[target.type]){const id=root.OrbitCore.RESOURCE_TOOLS[target.type],tool=root.OrbitCore.TOOLS[id];if(!s.tools.includes(id)){info.action='kit';info.label='탐사 도구 받기';info.note='루미 또는 우주선 근처에서 도구를 받으세요.';}else if(s.equippedTool!==id){info.action='equip';info.tool=id;info.label=tool.name+' 장착하기';info.note=tool.key+' 키 또는 아래 도구 버튼으로 장착하세요.';}}
      return info;
    }
  }
  class TrainingSession{
    constructor(main,record){
      this.main=main||null;
      const resume=[1,2].includes(record?.version)&&record.active===true&&record.game?.player&&record.game?.worlds;
      this.active=!!resume||!this.main;this.state=resume?record.game:this.main;
      if(this.active){
        this.state=JSON.parse(JSON.stringify(this.state||new root.OrbitCore.Game().snapshot()));
        if(!this.state.training||this.state.trainingLayout!==2){
          this.state.training=true;this.state.trainingLayout=2;this.state.mode='surface';this.state.planet='verdant';this.state.player={x:-610,y:140,angle:0};this.state.worlds={};
        }
      }
      this.tutorial=this.active?new Tutorial(resume?record.tutorial:null):new Tutorial({done:STEPS.map(()=>true),dismissed:true});
      if(this.active){this.tutorial.skipped=false;this.tutorial.dismissed=false;}
    }
    snapshot(game){return{version:2,active:this.active,game:game.snapshot(),tutorial:this.tutorial.snapshot()};}
    destination(game){
      if(!this.active||!this.tutorial.complete)return null;
      if(this.main)return this.main;
      const next=new root.OrbitCore.Game().snapshot();next.training=false;next.inventory={iron:12,biomass:8,crystal:4};next.tools=[...game.state.tools];next.equippedTool=game.state.equippedTool;return next;
    }
    finish(){this.active=false;this.tutorial.dismissed=true;}
  }
  root.OrbitTutorial={Tutorial,STEPS,TrainingSession};
  if(typeof module!=='undefined')module.exports=root.OrbitTutorial;
})(typeof globalThis!=='undefined'?globalThis:this);
