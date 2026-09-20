(function(root){
  'use strict';
  class Tutorial{
    constructor(saved){this.done=Array.from({length:5},(_,i)=>saved?.done?.[i]===true);this.walked=Math.max(0,Math.min(60,Number(saved?.walked)||0));this.skipped=saved?.skipped===true;this.previous=null;}
    get step(){const n=this.done.indexOf(false);return n<0?5:n;}
    get active(){return !this.skipped&&this.step<5;}
    tick(game){
      const s=game.state,p=s.player;
      if(!this.active||game.paused||s.mode!=='surface'){this.previous=null;return;}
      if(this.previous&&this.previous.planet===s.planet){const d=Math.hypot(p.x-this.previous.x,p.y-this.previous.y);if(d<12)this.walked=Math.min(60,this.walked+d);}
      this.previous={x:p.x,y:p.y,planet:s.planet};if(this.walked>=60)this.done[0]=true;
    }
    event(e){
      if(!this.active)return;
      if(e.type==='effect'&&e.kind==='break')this.done[1]=true;
      if(e.type==='player-action'){
        if(e.kind==='scan')this.done[2]=true;
        if(e.kind==='build'&&e.buildingType==='habitat')this.done[3]=true;
        if(e.kind==='greet')this.done[4]=true;
      }
    }
    snapshot(){return{done:[...this.done],walked:this.walked,skipped:this.skipped};}
  }
  root.OrbitTutorial={Tutorial};if(typeof module!=='undefined')module.exports=root.OrbitTutorial;
})(typeof globalThis!=='undefined'?globalThis:this);
