(function(root){
  'use strict';
  const STEPS=[
    {title:'첫걸음을 내디뎌요',text:'WASD·방향키 또는 화면의 이동 패드로 60m를 걸어 보세요. 빈 땅을 눌러도 이동해요.',note:'화면 드래그: 지도 둘러보기 · V: 확대 보기',controls:['touch-pad']},
    {title:'자원 하나를 채굴해요',text:'표시한 자원 가까이에서 E 또는 ‘채굴 / 교류’를 꾹 누르세요. 블록이 부서지면 자원을 얻어요.',note:'자원을 직접 누르면 다가가서 한 번 채굴해요.',controls:['interact-button']},
    {title:'주변을 스캔해요',text:'Q 또는 ‘스캔’을 눌러 주변의 자원과 생명체를 찾아보세요.',note:'스캐너는 사용한 뒤 5초 동안 충전해요.',controls:['scan-button']},
    {title:'첫 번째 집을 지어요',text:'철광석 12개와 바이오매스 8개를 모은 뒤 B 또는 ‘건설’ → 집을 선택하세요. 빈 땅 클릭 또는 ‘여기에 건설’로 완성해요.',note:'우주선과 자원에서 조금 떨어진 빈 땅에 지으세요.',controls:['build-button']},
    {title:'생명체에게 인사해요',text:'생명체 가까이에서 E 또는 ‘채굴 / 교류’를 눌러 인사하세요. 첫 만남에는 선물도 받아요.',note:'만난 뒤에는 쓰다듬기와 먹이 나누기도 가능해요.',controls:['interact-button']},
    {title:'우주로 이륙해요',text:'우주선 근처로 돌아가 F 또는 ‘우주선’을 누르세요. 멀리 있으면 먼저 우주선으로 이동해요.',note:'집이나 우주선 근처에 머무르면 산소가 충전돼요.',controls:['ship-button']},
    {title:'다른 행성에 착륙해요',text:'M 또는 ‘성계 지도’에서 다른 행성의 항로를 선택하세요. 도착하면 E 또는 ‘착륙’을 누르세요.',note:'항로 이동에는 연료 18이 필요해요. R로 충전할 수 있어요.',controls:['map-tab','ship-button']}
  ];
  class Tutorial{
    constructor(saved){
      this.done=STEPS.map((_,i)=>saved?.done?.[i]===true);
      this.walked=Number.isFinite(saved?.walked)?Math.max(0,Math.min(60,saved.walked)):0;
      this.skipped=saved?.skipped===true;this.dismissed=saved?.dismissed===true;
      this.launchPlanet=typeof saved?.launchPlanet==='string'?saved.launchPlanet:null;
      this.previous=null;
    }
    get step(){const n=this.done.indexOf(false);return n<0?STEPS.length:n;}
    get active(){return !this.skipped&&this.step<STEPS.length;}
    get complete(){return this.step===STEPS.length;}
    tick(game){
      const s=game.state,p=s.player;
      if(!this.active||game.paused||s.mode!=='surface'){this.previous=null;return;}
      if(this.previous&&this.previous.planet===s.planet){
        const d=Math.hypot(p.x-this.previous.x,p.y-this.previous.y);
        // Ignore teleports, landings and emergency returns.
        if(game.moving&&d<12)this.walked=Math.min(60,this.walked+d);
      }
      this.previous={x:p.x,y:p.y,planet:s.planet};
      if(this.walked>=60)this.done[0]=true;
    }
    event(e,game){
      if(!this.active)return;
      if(e.type==='effect'&&e.kind==='break')this.done[1]=true;
      if(e.type==='effect'&&e.kind==='scan'&&e.scanAction&&game.state.mode==='surface')this.done[2]=true;
      if(e.type==='effect'&&e.kind==='build'&&e.buildingType==='habitat')this.done[3]=true;
      if(e.type==='dialogue')this.done[4]=true;
      if(e.type==='launch'){this.done[5]=true;this.launchPlanet=game.state.planet;this.previous=null;}
      if(e.type==='land'){
        if(this.launchPlanet&&game.state.planet!==this.launchPlanet)this.done[6]=true;
        this.previous=null;
      }
    }
    snapshot(){return{done:[...this.done],walked:this.walked,skipped:this.skipped,dismissed:this.dismissed,launchPlanet:this.launchPlanet};}
    guide(game){
      const s=game.state,info={...(STEPS[this.step]||{}),controls:[...(STEPS[this.step]?.controls||[])]};
      if(!this.active)return info;
      if(s.mode==='space'){
        const canLand=game.nearest()?.kind==='planet'&&!game.travel;
        if(this.step<5)Object.assign(info,{title:'행성에 착륙해 이어가요',text:'이 단계는 행성 위에서 진행해요. 가까운 행성에 착륙하거나 성계 지도에서 항로를 선택하세요.'});
        if(game.travel){info.action=null;info.note='항로 이동 중이에요. 도착하면 착륙 버튼이 나타나요.';info.controls=[];}
        else if(canLand){info.action='land';info.label='이 행성에 착륙';info.controls=['ship-button'];}
        else {info.action='map';info.label='성계 지도 열기';info.controls=['map-tab'];}
        return info;
      }
      if(this.step===6){info.text='우주선으로 돌아가 F 또는 ‘우주선’으로 이륙한 뒤, 성계 지도에서 다른 행성으로 떠나세요.';info.controls=['ship-button'];}
      const nearest=list=>list.reduce((a,b)=>!a||Math.hypot(b.x-s.player.x,b.y-s.player.y)<Math.hypot(a.x-s.player.x,a.y-s.player.y)?b:a,null);
      const w=game.world();let target=null;
      if(this.step===0)info.note=Math.floor(this.walked)+' / 60m · '+info.note;
      if(this.step===1)target=nearest(w.nodes.filter(n=>n.hp>0));
      if(this.step===3){
        info.note='철광석 '+s.inventory.iron+' / 12 · 바이오매스 '+s.inventory.biomass+' / 8';
        const type=s.inventory.iron<12?'iron':s.inventory.biomass<8?'biomass':null;
        if(type){target=nearest(w.nodes.filter(n=>n.hp>0&&n.type===type));info.controls=['interact-button'];}
        else {info.action='build';info.label='건설 메뉴 열기';}
      }
      if(this.step===4)target=nearest(w.creatures);
      if(this.step>=5)target={x:80,y:60};
      if(target){info.target={x:target.x,y:target.y};info.action='mark';info.label=this.step>=5?'우주선 위치 표시':'목표 위치 표시';info.distance=Math.round(Math.hypot(target.x-s.player.x,target.y-s.player.y));}
      else if([1,4].includes(this.step)||this.step===3&&!game.canAfford('habitat'))info.note+=' · 주변을 둘러보세요. 채굴한 자원은 150초 뒤 다시 자라요.';
      return info;
    }
  }
  root.OrbitTutorial={Tutorial,STEPS};
  if(typeof module!=='undefined')module.exports=root.OrbitTutorial;
})(typeof globalThis!=='undefined'?globalThis:this);
