(function(root){
  'use strict';
  const STORAGE_KEY='justgame-motion-v1',VERSION=1;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const DEFAULTS={
    pickaxe:{duration:.56,impact:.48,windup:40,swing:115,body:9,recoil:5},
    axe:{duration:.62,impact:.5,windup:55,swing:130,body:13,recoil:7},
    sword:{duration:.42,impact:.42,windup:30,swing:150,body:7,recoil:3},
    launch:{duration:2.8,mark:.18,height:340,ease:1.65,recoil:2,thrust:1},
    land:{duration:2.8,mark:.87,height:340,ease:2,recoil:4,thrust:1}
  };
  const GROUPS={pickaxe:{name:'곡괭이',detail:'철광석 · 내려찍기',icon:'⛏'},axe:{name:'도끼',detail:'풀 · 대각선 찍기',icon:'◩'},sword:{name:'칼',detail:'수정 · 가로 베기',icon:'⚔'},launch:{name:'이륙',detail:'점화 · 상승 · 궤도 진입',icon:'↗'},land:{name:'착륙',detail:'접근 · 감속 · 착지',icon:'↘'}};
  const TOOL_FIELDS=[
    {key:'duration',label:'전체 동작 시간',min:.35,max:1.4,step:.01,unit:'초',hint:'준비부터 원래 자세로 돌아올 때까지'},
    {key:'impact',label:'타격 시점',min:.25,max:.7,step:.01,unit:'%',percent:true,hint:'이 순간에 피해·파편·효과음이 발생해요'},
    {key:'windup',label:'준비 각도',min:0,max:100,step:1,unit:'°',hint:'휘두르기 전에 뒤로 젖히는 크기'},
    {key:'swing',label:'휘두르는 각도',min:60,max:170,step:1,unit:'°',hint:'도구가 타격 지점까지 움직이는 각도'},
    {key:'body',label:'몸 기울기',min:0,max:22,step:1,unit:'°',hint:'어깨와 허리가 도구를 따라 움직여요'},
    {key:'recoil',label:'타격 반동',min:0,max:12,step:.5,unit:'',hint:'타격 직후 몸이 되돌아오는 힘'}
  ];
  const fields=id=>Object.hasOwn(DEFAULTS,id)?(['launch','land'].includes(id)?[
    {key:'duration',label:'전체 비행 시간',min:1.5,max:6,step:.1,unit:'초',hint:'모션이 끝나면 조작을 다시 시작해요'},
    {key:'mark',label:id==='launch'?'상승 시작 시점':'지면에 닿는 시점',min:id==='launch'?.05:.65,max:id==='launch'?.4:.92,step:.01,unit:'%',percent:true,hint:id==='launch'?'점화를 마치고 떠오르는 순간':'남은 시간 동안 착지 충격을 흡수해요'},
    {key:'height',label:'비행 높이',min:180,max:480,step:10,unit:'',hint:'화면에서 이동하는 높이'},
    {key:'ease',label:id==='launch'?'상승 가속':'하강 감속',min:1.1,max:3,step:.05,unit:'',hint:'값을 높이면 속도 변화가 더 뚜렷해져요'},
    {key:'recoil',label:id==='launch'?'점화 진동':'착지 충격',min:0,max:12,step:.5,unit:'',hint:id==='launch'?'이륙 준비 중 선체의 작은 떨림':'착륙 다리가 눌렸다가 회복하는 크기'},
    {key:'thrust',label:'엔진 분사 세기',min:.3,max:1.8,step:.05,unit:'×',hint:'불꽃의 길이와 밝기'}
  ]:TOOL_FIELDS):[];
  function normalizeGroup(id,input){
    const result={};for(const f of fields(id)){const n=input?.[f.key];result[f.key]=typeof n==='number'&&Number.isFinite(n)?Number(clamp(f.min+Math.round((clamp(n,f.min,f.max)-f.min)/f.step)*f.step,f.min,f.max).toFixed(4)):DEFAULTS[id][f.key];}return result;
  }
  function normalize(input){const result={version:VERSION};for(const id of Object.keys(DEFAULTS))result[id]=normalizeGroup(id,input?.[id]);return result;}
  function parse(text){
    if(typeof text!=='string'||text.length>65536)throw Error('64KB 이하의 모션 설정 파일을 선택해 주세요.');
    const data=JSON.parse(text);if(!data||data.version!==VERSION||Object.keys(DEFAULTS).some(id=>!data[id]||fields(id).some(f=>typeof data[id][f.key]!=='number'||!Number.isFinite(data[id][f.key]))))throw Error('Justgame 모션 설정 파일이 아니에요.');
    return normalize(data);
  }
  function preset(id,name){
    const v={...DEFAULTS[id]};if(name==='light'){v.duration*=.8;v.recoil*=.5;if('windup'in v){v.windup*=.7;v.body*=.7;}else v.ease=1.4;}
    if(name==='heavy'){v.duration*=1.25;v.recoil*=1.5;if('windup'in v){v.windup*=1.3;v.body*=1.3;}else{v.ease=2.6;v.thrust=1.3;}}
    return normalizeGroup(id,v);
  }
  function toolPose(id,p,progress){
    const t=clamp(progress,0,1),hit=p.impact,ready=hit*.64,finish=hit+(1-hit)*.26;
    let angle,load,phase;
    if(t<ready){const q=smooth(t/ready);angle=-p.windup*q;load=-q*.45;phase='준비';}
    else if(t<hit){const q=Math.pow((t-ready)/(hit-ready),2);angle=mix(-p.windup,p.swing,q);load=mix(-.45,1,q);phase='휘두르기';}
    else if(t<finish){const q=smooth((t-hit)/(finish-hit));angle=p.swing+Math.sin(q*Math.PI)*p.recoil*1.7;load=1-q*.25;phase='타격 · 반동';}
    else{const q=smooth((t-finish)/(1-finish));angle=mix(p.swing,0,q);load=.75*(1-q);phase='자세 복귀';}
    const pulse=t>=hit&&t<hit+.2?Math.sin((t-hit)/.2*Math.PI):0;
    return{angle:(angle-16)*Math.PI/180,body:load*p.body*Math.PI/180,crouch:Math.max(0,load)*p.recoil*.4,reach:Math.max(0,load)*(id==='sword'?12:7),pulse,phase,contact:t>=hit};
  }
  function flightPose(kind,p,progress){
    const t=clamp(progress,0,1),launch=kind==='launch';
    const rise=launch?Math.pow(clamp((t-p.mark)/(1-p.mark),0,1),p.ease):Math.pow(1-clamp(t/p.mark,0,1),p.ease);
    const settled=clamp((t-p.mark)/(1-p.mark),0,1);
    const compression=launch?0:Math.sin(settled*Math.PI)*Math.exp(-settled*2)*p.recoil;
    const thrust=(launch?(.25+.75*smooth(t/p.mark))*(1-smooth((t-.97)/.03)):(.6+.4*smooth(t/p.mark))*(1-smooth((t-p.mark)/(1-p.mark))))*p.thrust;
    return{rise,height:rise*p.height,scale:1-rise*.36,compression,thrust,alpha:launch?1-smooth((t-.94)/.06):smooth(t/.09),jitter:launch&&t<p.mark?Math.sin(t*170)*p.recoil*.32*(1-t/p.mark):0,
      dust:launch?Math.sin(clamp(t/.65,0,1)*Math.PI):Math.sin(clamp((t-(p.mark-.22))/(1-p.mark+.22),0,1)*Math.PI),
      phase:launch?(t<p.mark?'엔진 점화':t<.85?'상승 중':'궤도 진입'):(t<p.mark*.72?'착륙장 접근':t<p.mark?'하강 중':'착지 · 엔진 정지')};
  }
  const api={VERSION,STORAGE_KEY,DEFAULTS,GROUPS,fields,normalizeGroup,normalize,parse,preset,toolPose,flightPose};root.OrbitMotion=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
