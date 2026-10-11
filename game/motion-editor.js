(function(root){
  'use strict';
  const M=root.OrbitMotion;
  const copy=v=>M.normalize(v),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  class MotionEditor{
    constructor(container,config,{apply,close}){
      this.el=container;this.config=copy(config);this.baseline=copy(config);this.apply=apply;this.close=close;
      this.id='pickaxe';this.progress=0;this.playing=!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;this.rate=1;this.loop=true;this.mirror=false;this.disposed=false;
      container.innerHTML=this.markup();this.bind();this.select('pickaxe');this.changed();
    }
    $(id){return this.el.querySelector('#'+id);}
    get dirty(){return !same(this.config,this.baseline);}
    markup(){return `
      <p class="motion-intro">움직임을 직접 다듬어 보세요. 미리보기에서 확인한 뒤 게임에 적용할 수 있어요.</p>
      <div class="motion-workspace">
        <aside class="motion-library" aria-label="편집할 모션"><span class="motion-caption">MOTION LIBRARY</span>
          ${Object.entries(M.GROUPS).map(([id,g],i)=>`<button data-motion="${id}" aria-pressed="false"><span class="motion-item-icon" aria-hidden="true">${g.icon}</span><span><strong>${g.name}</strong><small>${g.detail}</small></span><em>0${i+1}</em></button>`).join('')}
          <div class="motion-library-note"><span>✦</span>실제 게임의 캐릭터와<br>우주선으로 미리 봅니다.</div>
        </aside>
        <section class="motion-preview" aria-label="모션 미리보기">
          <div class="motion-stage"><div class="motion-stage-top"><span><i></i> LIVE PREVIEW</span><button id="motion-mirror" aria-pressed="false">좌우 반전 ⇄</button></div>
            <canvas id="motion-canvas" aria-label="곡괭이 모션 미리보기"></canvas>
            <div class="motion-stage-bottom"><span id="motion-phase">준비</span><small>미리보기에서는 자원을 소모하지 않아요</small></div>
          </div>
          <div class="motion-transport"><div><button id="motion-restart" aria-label="처음부터 재생" title="처음부터 재생">↺</button><button id="motion-prev" aria-label="이전 프레임" title="이전 프레임">Ⅰ‹</button><button id="motion-play" class="motion-play">일시정지</button><button id="motion-next" aria-label="다음 프레임" title="다음 프레임">›Ⅰ</button></div><label class="motion-speed">속도 <select id="motion-speed" aria-label="미리보기 재생 속도"><option value=".25">0.25배</option><option value=".5">0.5배</option><option value="1" selected>1배</option></select></label></div>
          <div class="motion-timeline-head"><label for="motion-scrub">타임라인</label><output id="motion-clock">0.00 / 0.56초</output></div>
          <div class="motion-scrub-wrap"><input type="range" id="motion-scrub" min="0" max="1000" step="1" value="0" aria-label="모션 타임라인"><i id="motion-marker" aria-hidden="true"></i></div>
          <div class="motion-timeline-foot"><span id="motion-contact">● 타격</span><label><input type="checkbox" id="motion-loop" checked> 반복 재생</label></div>
          <p class="motion-preview-tip">타임라인을 움직여 자세를 확인하세요. 프레임 버튼은 1/30초씩 이동합니다.</p>
        </section>
        <section class="motion-inspector" aria-label="모션 상세 설정"><div class="motion-inspector-heading"><span class="motion-caption">PARAMETERS</span><h3 id="motion-parameter-title">곡괭이 설정</h3></div>
          <div class="motion-presets" role="group" aria-label="모션 프리셋"><button data-preset="balanced">균형</button><button data-preset="light">경쾌</button><button data-preset="heavy">묵직</button></div>
          <div id="motion-fields"></div><button id="motion-reset" class="motion-reset">이 모션을 기본값으로 ↺</button>
        </section>
      </div>
      <div id="motion-exit" class="motion-exit" hidden role="alert"><span>적용하지 않은 변경이 있어요.</span><button id="motion-keep">계속 편집</button><button id="motion-discard">변경 버리고 닫기</button></div>
      <div class="motion-footer"><div class="motion-file-actions"><button id="motion-export">설정 내보내기 ↗</button><button id="motion-import">설정 불러오기</button><input id="motion-file" type="file" accept=".json,application/json" hidden></div><div class="motion-footer-actions"><button id="motion-close">닫기</button><button id="motion-apply" class="primary-button">게임에 적용 · 저장</button></div></div>
      <div class="motion-save-line"><span id="motion-save-state" role="status" aria-live="polite">게임에 적용된 설정</span><small>이 브라우저에 저장 · 다른 기기에서는 설정 파일을 불러오세요</small></div>`;
    }
    bind(){
      this.el.querySelectorAll('[data-motion]').forEach(b=>b.onclick=()=>this.select(b.dataset.motion));
      this.el.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{this.config[this.id]=M.preset(this.id,b.dataset.preset);this.progress=0;this.controls();this.changed();});
      this.$('motion-reset').onclick=()=>{this.config[this.id]=M.normalizeGroup(this.id);this.progress=0;this.controls();this.changed();};
      this.$('motion-play').onclick=()=>{if(this.progress>=1)this.progress=0;this.playing=!this.playing;this.transport();};
      this.$('motion-restart').onclick=()=>{this.progress=0;this.playing=true;this.transport();};
      for(const [id,sign] of [['motion-prev',-1],['motion-next',1]])this.$(id).onclick=()=>{this.progress=clamp(this.progress+sign/(30*this.config[this.id].duration),0,1);this.playing=false;this.transport();};
      this.$('motion-speed').onchange=e=>{this.rate=Number(e.target.value);};
      this.$('motion-loop').onchange=e=>{this.loop=e.target.checked;};
      this.$('motion-mirror').onclick=()=>{this.mirror=!this.mirror;this.$('motion-mirror').setAttribute('aria-pressed',String(this.mirror));};
      this.$('motion-scrub').oninput=e=>{this.progress=Number(e.target.value)/1000;this.playing=false;this.transport();};
      this.$('motion-apply').onclick=()=>{
        const result=this.apply(copy(this.config));if(!result.ok){this.status(result.reason,true);return;}
        this.baseline=copy(this.config);this.changed();this.status('저장 완료 · 다음 동작부터 적용됩니다.');this.$('motion-exit').hidden=true;
      };
      this.$('motion-close').onclick=()=>this.requestClose();
      this.$('motion-keep').onclick=()=>{this.$('motion-exit').hidden=true;this.$('motion-close').focus();};
      this.$('motion-discard').onclick=()=>{this.baseline=copy(this.config);this.close();};
      this.$('motion-export').onclick=()=>this.export();
      this.$('motion-import').onclick=()=>this.$('motion-file').click();
      this.$('motion-file').onchange=async e=>{
        const file=e.target.files?.[0];if(!file)return;
        try{if(file.size>65536)throw Error('64KB 이하의 설정 파일을 선택해 주세요.');const data=M.parse(await file.text());if(this.disposed)return;this.config=data;this.progress=0;this.controls();this.changed();this.status('설정을 불러왔어요. 확인한 뒤 게임에 적용해 주세요.');}
        catch(err){if(!this.disposed)this.status(err instanceof SyntaxError?'JSON 형식의 모션 설정 파일을 선택해 주세요.':err.message,true);}
        finally{if(!this.disposed)e.target.value='';}
      };
    }
    select(id){
      this.id=id;this.progress=0;this.el.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===id)));
      this.$('motion-parameter-title').textContent=M.GROUPS[id].name+' 설정';this.$('motion-canvas').setAttribute('aria-label',M.GROUPS[id].name+' 모션 미리보기');this.controls();this.transport();
    }
    controls(){
      this.$('motion-fields').innerHTML=M.fields(this.id).map(f=>{
        const factor=f.percent?100:1,value=Number((this.config[this.id][f.key]*factor).toFixed(2));
        return `<div class="motion-field"><div><label for="motion-${f.key}">${f.label}</label><span><input type="number" id="motion-number-${f.key}" data-number="${f.key}" min="${f.min*factor}" max="${f.max*factor}" step="${f.step*factor}" value="${value}" aria-label="${f.label} 값"><small>${f.unit}</small></span></div><input type="range" id="motion-${f.key}" data-range="${f.key}" min="${f.min*factor}" max="${f.max*factor}" step="${f.step*factor}" value="${value}"><p>${f.hint}</p></div>`;
      }).join('');
      for(const f of M.fields(this.id)){
        const slider=this.$('motion-'+f.key),number=this.$('motion-number-'+f.key),factor=f.percent?100:1;
        const update=(input,other)=>{if(input.value===''||!Number.isFinite(input.valueAsNumber))return;const value=M.normalizeGroup(this.id,{...this.config[this.id],[f.key]:input.valueAsNumber/factor})[f.key];this.config[this.id][f.key]=Number(value.toFixed(4));other.value=String(Number((value*factor).toFixed(2)));this.changed();};
        slider.oninput=()=>update(slider,number);number.oninput=()=>update(number,slider);number.onblur=()=>{number.value=String(Number((this.config[this.id][f.key]*factor).toFixed(2)));};
      }
      this.presets();this.marker();
    }
    marker(){const p=this.config[this.id],flight='mark'in p,at=flight?p.mark:p.impact;this.$('motion-marker').style.left=(at*100)+'%';this.$('motion-contact').textContent='● '+(flight?this.id==='launch'?'상승 시작':'착지':'타격')+' '+(p.duration*at).toFixed(2)+'초';}
    presets(){this.el.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(same(this.config[this.id],M.preset(this.id,b.dataset.preset)))));}
    changed(){this.$('motion-apply').disabled=!this.dirty;this.status(this.dirty?'● 적용하지 않은 변경':'게임에 적용된 설정');this.marker();this.presets();}
    status(text,error=false){const el=this.$('motion-save-state');el.textContent=text;el.classList.toggle('error',error);}
    transport(){this.$('motion-play').textContent=this.playing?'Ⅱ 일시정지':'▶ 재생';this.$('motion-play').setAttribute('aria-label',this.playing?'미리보기 일시정지':'미리보기 재생');}
    requestClose(){if(this.dirty){this.$('motion-exit').hidden=false;this.$('motion-keep').focus();}else this.close();}
    export(){const blob=new Blob([JSON.stringify(this.config,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='justgame-motion.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);this.status('현재 편집 중인 모션 설정을 내보냈어요.');}
    draw(dt){
      if(this.disposed)return;const p=this.config[this.id],flight='mark'in p;
      if(this.playing){this.progress+=Math.min(dt,.05)*this.rate/p.duration;if(this.progress>1+(this.loop?.4/p.duration:0)){this.progress=this.loop?0:1;if(!this.loop){this.playing=false;this.transport();}}}
      const t=clamp(this.progress,0,1);this.$('motion-clock').textContent=(t*p.duration).toFixed(2)+' / '+p.duration.toFixed(2)+'초';this.$('motion-scrub').value=String(Math.round(t*1000));
      const pose=flight?M.flightPose(this.id,p,t):M.toolPose(this.id,p,t);this.$('motion-phase').textContent=pose.phase;
      const canvas=this.$('motion-canvas'),rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const dpr=Math.min(root.devicePixelRatio||1,2),w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      const c=canvas.getContext('2d');c.setTransform(w/640,0,0,h/420,0,0);c.clearRect(0,0,640,420);
      const bg=c.createRadialGradient(320,220,10,320,220,420);bg.addColorStop(0,'#253d40');bg.addColorStop(1,'#0b1822');c.fillStyle=bg;c.fillRect(0,0,640,420);
      c.strokeStyle='#8cafb510';c.lineWidth=1;for(let x=-300;x<900;x+=50){c.beginPath();c.moveTo(320+(x-320)*.45,190);c.lineTo(x,420);c.stroke();}for(let y=205;y<420;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(640,y);c.stroke();}
      c.save();c.translate(320,flight?333:298);if(this.mirror)c.scale(-1,1);
      if(flight){
        const scale=Math.min(1.15,275/(p.height+55));c.scale(scale,scale);c.strokeStyle='#91d9d04a';c.lineWidth=2;c.beginPath();c.ellipse(0,35,117,32,0,0,Math.PI*2);c.stroke();
        c.fillStyle='#0005';c.beginPath();c.ellipse(0,28,72-pose.rise*30,22-pose.rise*9,0,0,Math.PI*2);c.fill();
        root.Orbit2D.animatedShip(c,{kind:this.id,motion:p,age:t*p.duration,duration:p.duration},t*p.duration);
      }else{
        c.scale(2.7,2.7);const type={pickaxe:'iron',axe:'biomass',sword:'crystal'}[this.id];
        c.save();c.translate(39+Math.sin(t*90)*pose.pulse*2,6);root.Orbit2D.resource(c,{type,hp:3,maxHp:4,size:.72,seed:4,rotation:0},t);c.restore();
        c.save();c.translate(-31,0);root.Orbit2D.astronaut(c,t*p.duration,false,0,{tool:this.id,motion:p,duration:p.duration,life:(1-t)*p.duration},this.id);c.restore();
        const elapsed=(t-p.impact)*p.duration;if(elapsed>=0&&elapsed<.22){const q=elapsed/.22;c.save();c.globalAlpha=1-q;c.strokeStyle='#ffdc98';c.lineWidth=1.5;for(let i=0;i<9;i++){const a=i*Math.PI*2/9;c.beginPath();c.moveTo(30+Math.cos(a)*(5+q*8),-14+Math.sin(a)*(5+q*8));c.lineTo(30+Math.cos(a)*(10+q*20),-14+Math.sin(a)*(10+q*20));c.stroke();}c.restore();}
      }
      c.restore();
    }
    destroy(){this.disposed=true;}
  }
  root.OrbitMotionEditor={MotionEditor};
})(typeof globalThis!=='undefined'?globalThis:this);
