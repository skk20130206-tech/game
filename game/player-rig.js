(function(root){
  'use strict';
  // K-17: original reference pixels, skinned in the 3D scene. No generated face.
  // A front-view image cannot supply a real back view; this is an articulated billboard.
  const HEIGHT=96, SCALE=HEIGHT/1536, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const BONES=[
    ['hips',-1,512,753],['waist',0,512,639],['chest',1,511,452],['head',2,510,278],
    ['leftArm',2,360,335],['leftForearm',4,333,527],['leftHand',5,277,716],
    ['rightArm',2,652,335],['rightForearm',7,682,529],['rightHand',8,738,728],
    ['leftThigh',0,430,758],['leftShin',10,423,1029],['leftFoot',11,416,1324],
    ['rightThigh',0,588,757],['rightShin',13,650,1036],['rightFoot',14,685,1335]
  ];
  const point=(x,y,z=0)=>[(x-512)*SCALE,(1536-y)*SCALE,z];
  const REST=BONES.map(b=>point(b[2],b[3]));
  const DURATIONS={mine:.38,scan:1.15,build:1.35,upgrade:1.35,greet:.95,pet:1.35,feed:1.25,follow:.95,guide:1.05,relic:1.4,rest:1.6,use:.75,lights:.75,charge:.95};
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function multiply(a,b,out){for(let j=0;j<4;j++)for(let i=0;i<4;i++)out[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];return out;}
  function transform(m,p){return[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
  function blend(a,b,t){return[a,b,clamp(t,0,1)];}
  function weights(x,y,region){
    const left=400-(clamp(y,285,745)-285)*.17,right=628+(clamp(y,285,745)-285)*.18;
    if(region==='leftArm'||region==='rightArm'||(!region&&y>=285&&y<856&&(x<left||x>right))){
      const arm=region==='leftArm'?4:region==='rightArm'?7:x<512?4:7;
      if(y<350)return blend(2,arm,smooth(285,342,y));
      if(y<605)return blend(arm,arm+1,smooth(490,570,y));
      return blend(arm+1,arm+2,smooth(691,748,y));
    }
    if(y<315)return blend(3,2,smooth(266,311,y));
    if(y<580)return blend(2,1,smooth(470,570,y));
    if(y<760)return blend(1,0,smooth(620,726,y));
    const leg=x<514?10:13;
    if(y<834)return blend(0,leg,smooth(760,827,y));
    if(y<1190)return blend(leg,leg+1,smooth(983,1082,y));
    return blend(leg+1,leg+2,smooth(1280,1370,y));
  }
  function mesh(columns=48,rows=72){
    // Separate topology at the arm/body silhouettes. Sharing triangles across a
    // cutout's transparent gaps would stretch torso pixels when a hand is raised.
    const cuts=[[280,398,628],[340,400,642],[400,394,636],[430,390,630],[480,384.5,625],[500,381,624],[520,385,628],[540,378,644],[560,368,652],[580,352,656],[600,345,663],[630,340,669],[660,337,682],[690,327,691],[710,326,698],[740,313,702],[770,314,682],[800,318,681],[830,316,689],[850,316,688],[880,320,685]];
    const edge=(y,side)=>{let i=0;while(i<cuts.length-2&&y>cuts[i+1][0])i++;const a=cuts[i],b=cuts[i+1],t=clamp((y-a[0])/(b[0]-a[0]),0,1);return a[side]+(b[side]-a[side])*t;};
    const data=[],vertex=(x,y,region)=>{data.push(...point(x,y),x/1024,1-y/1536,...weights(x,y,region));};
    const strip=(from,to,left,right,region)=>{
      const levels=[from,to,...cuts.map(c=>c[0]).filter(y=>y>from&&y<to)];
      for(let y=from+1536/rows;y<to;y+=1536/rows)levels.push(y);levels.sort((a,b)=>a-b);
      for(let j=0;j<levels.length-1;j++){
        const y=levels[j],yy=levels[j+1],lo=left(y),hi=right(y),loo=left(yy),hii=right(yy),n=Math.max(1,Math.ceil(Math.max(hi-lo,hii-loo)/1024*columns));
        for(let i=0;i<n;i++){const x=lo+(hi-lo)*i/n,xx=lo+(hi-lo)*(i+1)/n,bx=loo+(hii-loo)*i/n,bxx=loo+(hii-loo)*(i+1)/n;
          vertex(x,y,region);vertex(xx,y,region);vertex(bxx,yy,region);vertex(x,y,region);vertex(bxx,yy,region);vertex(bx,yy,region);
        }
      }
    };
    strip(0,280,()=>0,()=>1024,'body');
    strip(280,880,()=>0,y=>edge(y,1),'leftArm');
    strip(280,880,y=>edge(y,2),()=>1024,'rightArm');
    strip(280,880,y=>edge(y,1),()=>514,'body');
    strip(280,880,()=>514,y=>edge(y,2),'body');
    strip(880,1536,()=>0,()=>514,'body');strip(880,1536,()=>514,()=>1024,'body');
    return new Float32Array(data);
  }
  class Animator{
    constructor(){this.palette=new Float32Array(16*16);this.matrices=BONES.map(identity);this.local=identity();this.angles=new Float32Array(16);this.previous=new Float32Array(16);this.action=null;this.walk=0;this.clock=0;this.phase=0;this.rootX=0;this.rootY=0;this.targetSide=1;this.hand=point(741,790);this.leftHand=point(278,786);this.evaluate(0,{state:{mode:'surface',time:0,player:{x:0,y:0}},velocity:{x:0,y:0}},0);}
    start(event){if(!DURATIONS[event.kind])return false;this.previous.set(this.angles);this.action={...event,age:0,duration:DURATIONS[event.kind]};return true;}
    reset(){this.action=null;this.walk=0;this.phase=0;this.rootX=this.rootY=0;this.angles.fill(0);this.previous.fill(0);}
    evaluate(dt,game,yaw=0){
      const frozen=!!game.paused,step=frozen?0:clamp(dt,0,.1),s=game.state,p=s.player;
      if(s.mode!=='surface'){this.reset();return this;}
      this.clock+=step;const speed=Math.hypot(game.velocity?.x||0,game.velocity?.y||0),walkTarget=clamp(speed/144,0,1.35);
      this.walk+=(walkTarget-this.walk)*(1-Math.exp(-step*13));this.phase+=step*(speed/144)*8.8;
      if(this.action){this.action.age+=step;if(this.action.age>=this.action.duration)this.action=null;}
      const a=this.angles;a.fill(0);const swing=Math.sin(this.phase)*this.walk,bob=Math.abs(Math.cos(this.phase))*this.walk;
      a[1]=Math.sin(this.clock*1.7)*.009;a[2]=Math.sin(this.clock*1.7+.6)*.012;a[3]=-a[2]*.5;
      a[4]=swing*.09;a[7]=-swing*.09;a[5]=-.025-Math.max(0,swing)*.07;a[8]=.025+Math.max(0,-swing)*.07;
      a[10]=swing*.1;a[13]=-swing*.1;a[11]=Math.max(0,-swing)*.16;a[14]=-Math.max(0,swing)*.16;a[12]=-a[11]*.55;a[15]=-a[14]*.55;
      this.rootX=Math.sin(this.phase*.5)*.22*this.walk;this.rootY=bob*.85;
      const action=this.action;
      if(action){
        const t=action.age/action.duration,envelope=smooth(0,.15,t)*(1-smooth(.7,1,t));
        const projected=(Number.isFinite(action.x)?action.x-p.x:40)*Math.cos(yaw)-(Number.isFinite(action.y)?action.y-p.y:0)*Math.sin(yaw);
        this.targetSide=projected<-3?-1:1;const side=this.targetSide,arm=side>0?7:4,fore=arm+1,hand=arm+2;
        const reach=(upper,lower)=>{a[arm]+=side*upper*envelope;a[fore]+=side*lower*envelope;};
        const bend=amount=>{a[1]-=side*amount*envelope;a[3]+=side*amount*.65*envelope;this.rootX+=side*envelope*1.7;};
        switch(action.kind){
          case 'mine':{
            // Tool starts extended on contact, recoils, then recovers before the next hit.
            const hit=1-smooth(.38,1,t);a[arm]+=side*(.52+.15*Math.sin(t*6.28))*hit;a[fore]+=side*(.64-.38*smooth(0,.25,t))*hit;bend(.055);break;
          }
          case 'scan':a[4]+=.22*envelope;a[5]+=1.65*envelope;a[7]-=.20*envelope;a[8]-=1.15*envelope;a[3]-=.1*envelope;break;
          case 'build':case 'upgrade':reach(.52,.68+Math.sin(t*18)*.12);a[side>0?4:7]-=side*.25*envelope;bend(.07);this.rootY-=envelope*2;break;
          case 'pet':reach(.45,.3+Math.sin(t*13)*.22);a[hand]+=side*Math.sin(t*13)*.14*envelope;bend(.17);this.rootY-=envelope*3;break;
          case 'feed':reach(.5,.56+Math.sin(t*Math.PI)*.27);a[hand]+=side*.18*envelope;bend(.1);break;
          case 'greet':case 'follow':reach(.95,1.45+Math.sin(t*22)*.17);a[hand]+=side*Math.sin(t*22)*.18*envelope;break;
          case 'guide':reach(1.1,.05);a[3]+=side*.09*envelope;break;
          case 'relic':reach(.5,.6);bend(.17);a[10]+=.10*envelope;a[13]-=.10*envelope;this.rootY-=3*envelope;break;
          case 'rest':a[4]-=.17*envelope;a[7]+=.17*envelope;a[3]+=.06*envelope;this.rootY-=2.4*envelope;break;
          default:reach(.62,.62);a[hand]+=side*Math.sin(t*16)*.08*envelope;bend(.06);
        }
        const mix=smooth(0,.07,action.age);for(let i=0;i<16;i++)a[i]=this.previous[i]+(a[i]-this.previous[i])*mix;
      }
      for(let i=0;i<16;i++){
        const m=this.local,c=Math.cos(a[i]),sn=Math.sin(a[i]),v=REST[i];m.set([c,sn,0,0,-sn,c,0,0,0,0,1,0,v[0]-c*v[0]+sn*v[1],v[1]-sn*v[0]-c*v[1],0,1]);
        // Lift articulated arms slightly toward the viewer so a wrist held over
        // the chest is visible instead of failing the torso's depth test.
        if(i===4||i===7)m[14]=.7;else if(i===5||i===8)m[14]=.2;else if(i===6||i===9)m[14]=.2;
        if(i===0){m[12]+=this.rootX;m[13]+=this.rootY;this.matrices[i].set(m);}else multiply(this.matrices[BONES[i][1]],m,this.matrices[i]);
        this.palette.set(this.matrices[i],i*16);
      }
      this.leftHand=transform(this.matrices[6],point(278,786));this.rightHand=transform(this.matrices[9],point(741,790));this.hand=this.targetSide<0?this.leftHand:this.rightHand;
      return this;
    }
  }
  root.OrbitPlayer={HEIGHT,SCALE,BONES,REST,DURATIONS,mesh,weights,point,transform,Animator};
  if(typeof module!=='undefined')module.exports=root.OrbitPlayer;
})(typeof globalThis!=='undefined'?globalThis:this);
