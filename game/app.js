(function(){
  'use strict';
  const {Game,PLANETS,SPECIES,BUILDINGS,RESOURCE_NAMES,WORLD_LIMIT,dist,clamp}=window.OrbitCore;
  const {Renderer,drawPlanet,creature}=window.OrbitRenderer;
  const $=id=>document.getElementById(id),SAVE_KEY='orbit-frontier-save-v1',SOUND_KEY='orbit-frontier-sound',TUTORIAL_KEY='justgame-tutorial-v2';
  let saved=null,storageAvailable=true;
  try{const raw=localStorage.getItem(SAVE_KEY);if(raw)saved=JSON.parse(raw);}catch(e){storageAvailable=false;}
  let game=new Game(saved);
  let renderer;
  try{renderer=new Renderer($('world'),$('radar'),game);}catch(error){
    const message=document.createElement('div');message.className='graphics-error';
    const title=document.createElement('h2');title.textContent='3D 화면을 시작할 수 없어요';
    const detail=document.createElement('p');detail.textContent=error.message;
    const reload=document.createElement('button');reload.className='primary-button';reload.textContent='다시 시작';reload.onclick=()=>location.reload();
    message.append(title,detail,reload);$('game-area').appendChild(message);return;
  }
  const keys={};let startOpen=true;game.paused=true;
  const modal=$('modal');let buildOpen=false,missionOpen=true,lastHud=0,lastSave=0,lastFrame=performance.now(),missionSignature='',locationSignature='',bannerTimer=null,lowOxygenWarned=false;
  let tutorialData=null;try{tutorialData=JSON.parse(localStorage.getItem(TUTORIAL_KEY)||'null');}catch(e){}
  let tutorial=new window.OrbitTutorial.Tutorial(tutorialData),tutorialStep=tutorial.step,tutorialCollapsed=false,tutorialWaypoint=null;
  const tutorialControls=['touch-pad','interact-button','scan-button','build-button','ship-button','map-tab'];
  function saveTutorial(){try{localStorage.setItem(TUTORIAL_KEY,JSON.stringify(tutorial.snapshot()));}catch(e){}}
  function clearTutorialWaypoint(){if(game.waypoint===tutorialWaypoint)game.waypoint=null;tutorialWaypoint=null;}
  function restartTutorial(){clearTutorialWaypoint();tutorial=new window.OrbitTutorial.Tutorial();tutorialStep=0;tutorialCollapsed=false;saveTutorial();closeModal();hud(true);}
  function updateTutorial(){
    if(tutorial.step!==tutorialStep){
      tutorialStep=tutorial.step;clearTutorialWaypoint();saveTutorial();
      toast(tutorial.complete?'튜토리얼 완료! 이제 자유롭게 우주를 탐험하세요.':'목표 달성! 다음 안내를 확인하세요.');
    }
    const visible=!startOpen&&!modal.open&&!buildOpen&&!tutorial.skipped&&(tutorial.active||tutorial.complete&&!tutorial.dismissed);
    $('tutorial-card').hidden=!visible;$('game-area').classList.toggle('tutorial-visible',visible);
    tutorialControls.forEach(id=>$(id).classList.remove('tutorial-focus'));
    if(!visible)return;
    const info=tutorial.guide(game),count=tutorial.done.filter(Boolean).length;
    setText('tutorial-step',tutorial.complete?'7 / 7 · 완료':(tutorial.step+1)+' / 7');
    setText('tutorial-title',tutorial.complete?'첫 탐험을 마쳤어요!':info.title);
    setText('tutorial-description',tutorial.complete?'이제 다른 행성을 탐험하고 기지를 넓히며 새로운 친구를 만나보세요.':info.text);
    setText('tutorial-note',tutorial.complete?'? 조작 방법에서 언제든 튜토리얼을 다시 시작할 수 있어요.':info.note+(info.distance!==undefined?' · 목표까지 '+info.distance+'m':''));
    $('tutorial-body').hidden=tutorialCollapsed;$('tutorial-toggle').setAttribute('aria-expanded',String(!tutorialCollapsed));
    $('tutorial-toggle').setAttribute('aria-label',tutorialCollapsed?'튜토리얼 펼치기':'튜토리얼 접기');setText('tutorial-toggle',tutorialCollapsed?'+':'−');
    setText('tutorial-skip',tutorial.complete?'닫기':'건너뛰기');
    $('tutorial-action').hidden=!info.action&&!tutorial.complete;setText('tutorial-action',tutorial.complete?'자유 탐험 시작':info.label||'목표 위치 표시');
    const refuel=tutorial.active&&game.state.mode==='space'&&game.state.fuel<18;
    $('tutorial-refuel').hidden=!refuel;$('tutorial-refuel').disabled=game.solarCharge>0||!!game.travel;
    setText('tutorial-refuel',game.solarCharge>0?'비상 충전 중 · '+Math.ceil(game.solarCharge)+'초':game.state.inventory.biomass>=3?'연료 합성 · 바이오매스 3개':'비상 태양광 충전 · 6초');
    $('tutorial-progress').setAttribute('aria-valuenow',String(count));$('tutorial-progress-bar').style.width=(count/7*100)+'%';
    if(tutorial.active)for(const id of info.controls)$(id).classList.add('tutorial-focus');
  }
  function dismissTutorial(){clearTutorialWaypoint();if(tutorial.complete)tutorial.dismissed=true;else tutorial.skipped=true;saveTutorial();hud(true);$('world').focus({preventScroll:true});}
  $('tutorial-skip').onclick=dismissTutorial;
  $('tutorial-toggle').onclick=()=>{tutorialCollapsed=!tutorialCollapsed;updateTutorial();};
  $('tutorial-action').onclick=()=>{
    if(tutorial.complete){dismissTutorial();return;}
    const info=tutorial.guide(game);
    if(info.action==='mark'&&info.target){tutorialWaypoint={...info.target,label:'튜토리얼 목표'};game.waypoint=tutorialWaypoint;toast('목표에 빛 기둥을 표시했어요. 화면을 드래그해 찾아보세요.');}
    else if(info.action==='build')toggleBuild(true);
    else if(info.action==='map')showMap();
    else if(info.action==='land'){game.land();processEvents();}
    hud(true);
  };
  $('tutorial-refuel').onclick=()=>{game.refuel();processEvents();hud(true);};
  let audioContext=null,soundEnabled=true,audioBus=null,engineSound=null,lastFootstep=0;
  try{soundEnabled=localStorage.getItem(SOUND_KEY)!=='off';}catch(e){}
  function setText(id,text){const e=$(id);if(e.textContent!==String(text))e.textContent=text;}
  function clearInput(){Object.keys(keys).forEach(k=>delete keys[k]);game.interactHeld=false;if(game.velocity)game.velocity={x:0,y:0,z:0};}
  function toast(text,error=false){
    const box=$('toast-stack'),el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=text;box.appendChild(el);
    while(box.children.length>3)box.firstChild.remove();setTimeout(()=>{el.classList.add('fade-out');setTimeout(()=>el.remove(),320);},4300);
  }
  function ensureAudio(){
    if(!soundEnabled)return;
    try{
      if(!audioContext){
        audioContext=new(window.AudioContext||window.webkitAudioContext)();audioBus=audioContext.createGain();audioBus.gain.value=.5;audioBus.connect(audioContext.destination);
        const o=audioContext.createOscillator(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter();o.type='sawtooth';o.frequency.value=47;filter.type='lowpass';filter.frequency.value=170;gain.gain.value=0;o.connect(filter);filter.connect(gain);gain.connect(audioBus);o.start();engineSound={o,gain,filter};
      }
      if(audioContext.state==='suspended')void audioContext.resume().catch(()=>{});
    }catch(e){soundEnabled=false;updateSoundButton();}
  }
  function sound(kind,event){
    if(!soundEnabled)return;ensureAudio();if(!audioContext||!audioBus)return;
    try{
      const map={mine:[190,.13,'triangle'],collect:[640,.22,'sine'],build:[140,.48,'triangle'],scan:[460,.65,'sine'],warp:[70,1.1,'sawtooth'],launch:[56,.85,'sawtooth'],land:[48,.55,'triangle'],click:[390,.06,'sine'],discovery:[720,.48,'sine'],step:[92,.065,'triangle'],friend:[520,.35,'sine'],relic:[850,.8,'sine'],rest:[280,.7,'sine']},spec=map[kind]||map.click,now=audioContext.currentTime;
      const o=audioContext.createOscillator(),gain=audioContext.createGain();o.type=spec[2];o.frequency.setValueAtTime(spec[0],now);o.frequency.exponentialRampToValueAtTime(Math.max(25,spec[0]*(kind==='warp'?6:kind==='land'?.5:1.45)),now+spec[1]);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='step'?.025:.12,now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+spec[1]);o.connect(gain);
      if(audioContext.createStereoPanner){const pan=audioContext.createStereoPanner();const position=event&&Number.isFinite(event.x)?event:null;pan.pan.value=position?clamp(((position.x-game.state.player.x)*Math.cos(renderer.yaw)-(position.y-game.state.player.y)*Math.sin(renderer.yaw))/230,-.9,.9):0;gain.connect(pan);pan.connect(audioBus);}else gain.connect(audioBus);
      o.start(now);o.stop(now+spec[1]+.03);
      if(['launch','land','warp','mine'].includes(kind)){
        const duration=kind==='mine'?.09:.55,buffer=audioContext.createBuffer(1,Math.ceil(audioContext.sampleRate*duration),audioContext.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
        const noise=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter(),volume=audioContext.createGain();noise.buffer=buffer;filter.type='lowpass';filter.frequency.value=kind==='mine'?1100:360;volume.gain.value=kind==='mine'?.035:.09;noise.connect(filter);filter.connect(volume);volume.connect(audioBus);noise.start();
      }
    }catch(e){}
  }
  function updateEngineAudio(){
    if(!audioContext||!engineSound)return;const s=game.state,active=soundEnabled&&!game.paused;
    audioBus.gain.setTargetAtTime(soundEnabled?.5:0,audioContext.currentTime,.06);
    const thrust=active&&s.mode==='space'?(game.travel?.075:game.moving?(game.boosting?.05:.025):.008):0;
    engineSound.gain.gain.setTargetAtTime(thrust,audioContext.currentTime,.12);engineSound.o.frequency.setTargetAtTime(game.travel?140:game.boosting?90:game.moving?62:39,audioContext.currentTime,.15);
    if(active&&s.mode==='surface'&&game.moving&&s.time-lastFootstep>.33&&renderer.jumpHeight===0){sound('step');lastFootstep=s.time;}
  }
  function updateSoundButton(){const b=$('sound-button');b.setAttribute('aria-pressed',String(soundEnabled));b.setAttribute('aria-label',soundEnabled?'소리 끄기':'소리 켜기');b.title=soundEnabled?'소리 끄기':'소리 켜기';b.style.color=soundEnabled?'var(--accent)':'';}
  function toggleCamera(){const first=renderer.toggleView();$('view-button').innerHTML=(first?'1인칭':'3인칭')+' <kbd>V</kbd>';toast(first?'1인칭 시점 · 드래그로 둘러보고 WASD로 이동하세요.':'3인칭 시점 · 드래그로 회전, 휠로 거리를 조절하세요.');}
  function updateImmersionButton(){setText('immersion-button',renderer.immersive?'몰입 효과 ON':'몰입 효과 OFF');$('immersion-button').classList.toggle('enabled',renderer.immersive);}
  function showImmersion(){
    showModal('나에게 맞는 몰입감','3D EXPERIENCE / 체험 설정','<p class="modal-intro">입체 공간에 채굴 충격, 비행 속도감, 이륙·착륙 효과를 더합니다. 아래에서 효과의 세기를 조절하세요.</p><div class="experience-settings"><label class="setting-row"><span><strong>화면 몰입 효과</strong><small>카메라 흔들림 · 가속 시야 · 워프 잔상 · 날씨</small></span><input type="checkbox" id="fx-enabled" '+(renderer.immersive?'checked':'')+'></label><label class="setting-range" for="fx-intensity"><span>효과 강도 <output id="intensity-value">'+Math.round(renderer.intensity*100)+'%</output></span><input type="range" min="0" max="100" value="'+Math.round(renderer.intensity*100)+'" id="fx-intensity"><small>화면 움직임이 부담스럽다면 낮추거나 꺼주세요.</small></label><label class="setting-row"><span><strong>효과음과 엔진 소리</strong><small>자원의 방향에 따라 좌우로 들리는 소리</small></span><input type="checkbox" id="fx-sound" '+(soundEnabled?'checked':'')+'></label><label class="setting-row"><span><strong>기기 진동</strong><small>'+(typeof navigator.vibrate==='function'?'진동 기능이 있는 지원 기기에서 작동합니다.':'이 브라우저는 진동 API를 지원하지 않습니다.')+'</small></span><input type="checkbox" id="fx-haptics" '+(renderer.haptics?'checked':'')+' '+(typeof navigator.vibrate==='function'?'':'disabled')+'></label></div><p class="experience-note">실제 4DX 영화관 장비를 연결하는 기능은 아닙니다. 좌석 움직임·바람·물 효과는 제공하지 않으며, 브라우저에서 3D와 시청각·지원 기기 진동 효과를 체험합니다.</p><button id="fx-resume" class="primary-button">이 설정으로 탐험하기</button>');
    $('fx-enabled').onchange=e=>{renderer.setImmersive(e.target.checked);updateImmersionButton();};
    $('fx-intensity').oninput=e=>{renderer.intensity=clamp(Number(e.target.value)/100,0,1);setText('intensity-value',Math.round(renderer.intensity*100)+'%');renderer.storeSettings();};
    $('fx-sound').onchange=e=>{soundEnabled=e.target.checked;try{localStorage.setItem(SOUND_KEY,soundEnabled?'on':'off');}catch(err){}updateSoundButton();ensureAudio();updateEngineAudio();};
    $('fx-haptics').onchange=e=>{renderer.haptics=e.target.checked;renderer.storeSettings();if(renderer.haptics)renderer.pulse([30,40,45]);else renderer.stopHaptics();};
    $('fx-resume').onclick=closeModal;
  }
  function save(silent=true){
    saveTutorial();
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(game.snapshot()));storageAvailable=true;setText('save-indicator','자동 저장됨');if(!silent)toast('이 브라우저에 탐험 기록을 저장했어요.');return true;}catch(e){storageAvailable=false;setText('save-indicator','저장 불가 · 파일로 백업');if(!silent)toast('브라우저 저장 공간을 사용할 수 없어요. 저장 파일을 내보내 주세요.',true);return false;}
  }
  function showModal(title,eyebrow,html){
    clearInput();game.paused=true;renderer.stopHaptics();updateEngineAudio();game.moveTarget=null;$('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;$('modal-content').innerHTML=html;if(!modal.open)modal.showModal();updateTutorial();
  }
  function closeModal(){if(modal.open)modal.close();game.paused=startOpen||document.hidden;clearInput();$('map-tab').classList.remove('active');$('journal-tab').classList.remove('active');$('explore-tab').classList.add('active');if(!startOpen)$('world').focus({preventScroll:true});}
  modal.addEventListener('close',()=>{game.paused=startOpen||document.hidden;clearInput();$('map-tab').classList.remove('active');$('journal-tab').classList.remove('active');$('explore-tab').classList.add('active');});
  window.addEventListener('orbit:start',()=>{startOpen=false;game.paused=startOpen||modal.open||document.hidden;lastFrame=performance.now();clearInput();ensureAudio();hud(true);});
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  $('modal-close').onclick=closeModal;
  function planetName(id){return PLANETS.find(p=>p.id===id)?.name||id;}
  function showMap(){
    const s=game.state,space=s.mode==='space';
    showModal('다음엔, 어떤 세계로 갈까요?','SIGMA SYSTEM / 성계 지도',
      '<p class="modal-intro">'+(space?'행성을 선택해 궤도로 이동한 뒤 착륙하세요. 자유 비행은 방향키 또는 WASD로 할 수 있어요.':'지금은 '+planetName(s.planet)+'의 지표면에 있어요. 우주선 가까이에서 <kbd>F</kbd>로 이륙하면 다른 행성으로 떠날 수 있어요.')+'</p><div class="planet-list">'+
      PLANETS.map((p,i)=>'<article class="planet-card'+(s.planet===p.id?' current':'')+'"><canvas class="planet-thumb" id="planet-thumb-'+p.id+'" width="132" height="132" aria-label="'+p.name+' 행성"></canvas><div><h3>'+p.name+'</h3><p>'+p.kind+'<br>'+p.resource+'</p></div><div class="planet-bottom"><span>'+(s.visited.includes(p.id)?'✓ 탐험 완료':'미탐사')+' · '+p.temp+'</span><button class="small-button" data-warp="'+p.id+'" '+(!space||s.fuel<18||game.travel?'disabled':'')+'>'+(space?'궤도로 이동 · 연료 18':s.planet===p.id?'현재 행성':'이륙 후 이동')+'</button></div></article>').join('')+'</div><div class="map-note"><span>탐험한 행성 '+s.visited.length+' / '+PLANETS.length+'</span><span>남은 연료 '+Math.floor(s.fuel)+' / 100</span></div>'+(space&&s.fuel<18?'<button class="primary-button" id="map-refuel" style="margin-top:18px">연료 합성 / 비상 충전</button>':'')+(!space?'<button class="primary-button" id="map-return-ship" style="margin-top:18px">우주선으로 돌아가기</button>':''));
    $('explore-tab').classList.remove('active');$('map-tab').classList.add('active');
    for(const p of PLANETS){const c=$('planet-thumb-'+p.id).getContext('2d');drawPlanet(c,p,66,66,44);}
    modal.querySelectorAll('[data-warp]').forEach(b=>b.onclick=()=>{const id=b.dataset.warp;closeModal();game.warp(id);processEvents();});
    if($('map-return-ship'))$('map-return-ship').onclick=()=>{closeModal();game.launch();processEvents();};
    if($('map-refuel'))$('map-refuel').onclick=()=>{closeModal();game.refuel();processEvents();};
  }
  function showJournal(){
    const s=game.state;showModal('우리가 만난 작은 우주','FIELD NOTES / 생명체 도감','<p class="modal-intro">발견한 생명체 '+s.discovered.length+' / '+Object.keys(SPECIES).length+' · 친구가 된 생명체 '+s.met.length+'종<br>가까이에서 <kbd>Q</kbd>로 스캔하고 <kbd>E</kbd>로 인사해 보세요.</p><div class="species-grid">'+Object.entries(SPECIES).map(([id,sp])=>{const known=s.discovered.includes(id),met=s.met.includes(id);return'<article class="species-card'+(known?'':' unknown')+'"><canvas id="species-'+id+'" width="140" height="160" aria-label="'+(known?sp.name:'아직 발견하지 못한 생명체')+'"></canvas><div><h3>'+(known?sp.name:'???')+'</h3><p>'+(known?sp.lore:planetName(sp.planet)+'에서 발견할 수 있어요.')+'</p><span class="tag">'+(met?'♥ 친구가 되었어요':known?'발견 완료 · 다가가서 인사해 보세요':'미발견')+'</span></div></article>';}).join('')+'</div>');
    $('explore-tab').classList.remove('active');$('journal-tab').classList.add('active');
    for(const[id,sp]of Object.entries(SPECIES)){const c=$('species-'+id).getContext('2d');c.translate(70,123);c.scale(1.7,1.7);if(s.discovered.includes(id))creature(c,id,0,1,s.met.includes(id));else{c.fillStyle='#9eb2aa';c.font='28px system-ui';c.textAlign='center';c.fillText('?',0,-12);}}
  }
  function showHelp(){
    showModal('탐험가를 위한 작은 안내서','FLIGHT MANUAL / 조작 방법','<p class="modal-intro">서두르지 않아도 괜찮아요. 자원을 모으고 작은 집을 지으며 나만의 속도로 우주를 탐험하세요.</p><div class="help-grid"><div class="help-item"><strong>걷기 · 달리기</strong><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 방향키<br><kbd>Shift</kbd>를 누르면 더 빠르게 이동해요.<br>빈 땅 클릭으로 이동, 드래그로 시점 회전<br>휠로 거리 조절, V로 1인칭 전환, Space로 점프</div><div class="help-item"><strong>채굴 · 생명체와 교류</strong>가까이 다가가 <kbd>E</kbd>를 누르세요.<br>계속 누르면 자원을 연속 채굴해요.<br>터치 화면에서는 ‘채굴 / 교류’를 누르세요.</div><div class="help-item"><strong>나만의 집 짓기</strong><kbd>B</kbd> → 건물 선택 → 빈 땅 클릭<br>또는 이동 후 ‘여기에 건설’을 누르세요.<br>집: 철광석 12개 + 바이오매스 8개</div><div class="help-item"><strong>새로운 행성으로 떠나기</strong>우주선 근처에서 <kbd>F</kbd>로 이륙<br><kbd>M</kbd> → 행성 선택 → <kbd>E</kbd> 착륙<br>Space / C로 상승·하강, Shift로 가속<br>드래그로 시점을 돌리며 직접 비행할 수 있어요.</div><div class="help-item"><strong>스캔 · 도감</strong><kbd>Q</kbd>로 주변 자원과 생명체 탐지<br>발견한 생명체는 도감에 기록됩니다.<br>교류하면 첫 만남 선물을 받아요.</div><div class="help-item"><strong>산소 · 연료</strong>우주선과 집 근처에서는 산소 충전<br><kbd>R</kbd>로 바이오 연료 합성<br>재료가 없으면 6초 비상 충전이 가능해요.</div></div><p class="help-tips">진행 상황은 이 기기의 브라우저에 자동 저장돼요. 다른 기기로 옮기려면 ‘저장 관리’에서 저장 파일을 내보내세요. 산소가 떨어지면 자원을 보존한 채 우주선으로 돌아옵니다. 채굴한 자원은 150초 후 다시 자랍니다.</p><button class="primary-button" id="help-resume" style="margin-top:22px">탐험으로 돌아가기</button>');$('help-resume').onclick=closeModal;const replay=document.createElement('button');replay.id='tutorial-replay';replay.className='subtle-button';replay.textContent='튜토리얼 다시 시작';replay.onclick=restartTutorial;$('modal-content').append(replay);
  }
  function toggleBuild(force){
    if(game.state.mode!=='surface'){toast('행성에 착륙한 뒤 건설할 수 있어요.');return;}
    buildOpen=typeof force==='boolean'?force:!buildOpen;$('build-panel').hidden=!buildOpen;$('build-button').classList.toggle('selected',buildOpen);$('interact-button').classList.toggle('selected',!buildOpen);
    if(!buildOpen){game.selectedBuild=null;renderer.mouse=null;}renderBuildOptions();
  }
  function renderBuildOptions(){
    if(!buildOpen)return;
    $('build-options').innerHTML=Object.entries(BUILDINGS).map(([id,b])=>'<button class="build-option'+(game.selectedBuild===id?' active':'')+'" data-building="'+id+'" aria-pressed="'+(game.selectedBuild===id)+'"><span class="building-icon">'+b.icon+'</span><span><strong>'+b.name+'</strong><small>'+b.description+'</small><small class="cost">'+Object.entries(b.cost).map(([r,n])=>RESOURCE_NAMES[r]+' '+n).join(' · ')+'</small></span></button>').join('');
    $('build-options').querySelectorAll('[data-building]').forEach(b=>b.onclick=()=>{game.selectedBuild=b.dataset.building;renderer.mouse=null;renderBuildOptions();if(!game.canAfford(game.selectedBuild))toast('자원이 부족해요. 비용을 확인하고 조금 더 모아주세요.',true);else toast('빈 땅을 클릭하거나, 이동 후 ‘여기에 건설’을 누르세요.');});
    const chosen=game.selectedBuild;$('place-building').disabled=!chosen||!game.canAfford(chosen);setText('place-building',chosen?'여기에 건설':'건물을 먼저 선택하세요');
  }
  function placeBuilding(){
    if(!game.selectedBuild)return;const p=game.state.player,result=game.build(game.selectedBuild,p.x+Math.cos(p.angle)*105,p.y+Math.sin(p.angle)*105);if(result.ok)toggleBuild(false);processEvents();
  }
  function showSettings(){
    showModal('소중한 탐험 기록','SAVE DATA / 저장 관리','<p class="modal-intro">행성 '+game.state.visited.length+'개 탐험 · 건물 '+game.state.stats.buildings+'개 · 생명체 '+game.state.discovered.length+'종 발견<br>진행 상황은 <strong>현재 기기의 이 브라우저</strong>에 저장됩니다. 사이트 주소나 기기가 바뀌면 저장 파일을 가져와 이어서 할 수 있어요.</p><div class="settings-actions"><button id="save-now">지금 저장</button><button id="export-save">저장 파일 내보내기</button><button id="import-save">저장 파일 가져오기</button><button id="new-game" class="danger">새 탐험 시작</button></div><input id="save-file" type="file" accept="application/json,.json" hidden><p class="modal-content-note">자동 저장은 탐험 중 8초마다, 그리고 채굴·건설·착륙 직후 실행됩니다. 브라우저 데이터를 삭제하기 전에 저장 파일을 내보내 두세요.</p>'+(!storageAvailable?'<p class="inline-warning">브라우저 저장 공간을 사용할 수 없습니다. 진행 상황을 보관하려면 저장 파일을 내보내 주세요.</p>':''));
    $('save-now').onclick=()=>save(false);$('export-save').onclick=exportSave;$('import-save').onclick=()=>$('save-file').click();$('save-file').onchange=importSave;
    $('new-game').onclick=()=>{showModal('새로운 우주에서 시작할까요?','NEW EXPEDITION','<p class="modal-intro">현재 브라우저의 탐험 기록이 새 기록으로 바뀝니다. 지금까지의 탐험을 보관하려면 먼저 저장 파일을 내보내세요.</p><div class="settings-actions"><button id="backup-before-reset">현재 기록 내보내기</button><button id="confirm-new-game" class="danger">기록을 지우고 새로 시작</button><button id="cancel-new-game">돌아가기</button></div>');$('backup-before-reset').onclick=exportSave;$('cancel-new-game').onclick=showSettings;$('confirm-new-game').onclick=()=>{replaceGame(new Game());closeModal();save();toast('새로운 탐험이 시작됐어요. 우주에 나만의 집을 지어보세요.');};};
  }
  function exportSave(){
    const blob=new Blob([JSON.stringify(game.snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='orbit-save-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('저장 파일을 내보냈어요. 다른 기기에서 가져올 수 있어요.');
  }
  async function importSave(event){
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>1500000)throw Error('파일이 너무 큽니다.');const raw=JSON.parse(await file.text()),valid=game.validate(raw);
      showModal('이 탐험 기록을 가져올까요?','RESTORE EXPEDITION','<p class="modal-intro">행성 '+valid.visited.length+'개 · 건물 '+valid.stats.buildings+'개 · 생명체 '+valid.discovered.length+'종<br>현재 브라우저의 기록을 선택한 저장 파일로 바꿉니다.</p><div class="settings-actions"><button id="confirm-import">이 기록으로 이어서 탐험</button><button id="cancel-import">취소</button></div>');
      $('confirm-import').onclick=()=>{replaceGame(new Game(valid));closeModal();save();toast('저장 기록을 가져왔어요. 탐험을 이어가세요!');};$('cancel-import').onclick=showSettings;
    }catch(e){toast('올바른 오르빗 저장 파일이 아니에요. JSON 파일을 확인해 주세요.',true);}
  }
  function replaceGame(next){clearTutorialWaypoint();tutorial=new window.OrbitTutorial.Tutorial();tutorialStep=0;tutorialCollapsed=false;saveTutorial();game=next;renderer.game=next;renderer.reset();buildOpen=false;$('build-panel').hidden=true;$('build-button').classList.remove('selected');$('interact-button').classList.add('selected');missionSignature='';locationSignature='';clearInput();hud(true);}
  function showDialogue(e){
    const sp=SPECIES[e.species],bond=game.state.friendship[e.species]||0;
    showModal(sp.name+'와의 만남','FIRST CONTACT / '+sp.kind,'<div class="dialogue"><p class="speaker">'+sp.name+' <span class="bond">'+('♥'.repeat(bond)+'♡'.repeat(3-bond))+'</span></p><blockquote>'+sp.line.replace(/\n/g,'<br>')+'</blockquote>'+(e.first?'<div class="reward">첫 만남 선물 · '+Object.entries(sp.gift).map(([r,n])=>RESOURCE_NAMES[r]+' +'+n).join(' · ')+'</div>':'<p class="modal-intro">친밀도 '+bond+' / 3 · 친밀도 2부터 동행과 길 안내가 열려요.</p>')+'<div class="interaction-grid"><button data-care="pet">♡ 쓰다듬기<small>친밀도 +1 · 10초 간격</small></button><button data-care="feed">❋ 먹이 나누기<small>바이오매스 2 · 친밀도 +1</small></button><button data-care="follow" '+(bond<2?'disabled':'')+'>'+(game.state.companion===e.id?'동행 마치기':'함께 탐험하기')+'<small>내 뒤를 따라오는 친구</small></button><button data-care="guide" '+(bond<2?'disabled':'')+'>유적 길 물어보기<small>미탐사 유적의 위치 표시</small></button></div><button class="primary-button" id="dialogue-close">탐험으로 돌아가기</button></div>');
    $('dialogue-close').onclick=closeModal;
    modal.querySelectorAll('[data-care]').forEach(button=>button.onclick=()=>{const action=button.dataset.care;closeModal();const result=game.careForCreature(e.id,action);if(!result.ok)toast(result.reason,true);processEvents();hud(true);});sound('discovery');
  }
  function showBuilding(id){
    const b=game.world().buildings.find(v=>v.id===id);if(!b)return;
    const definition=BUILDINGS[b.type],level=b.level===2?2:1;
    const primary=b.type==='habitat'?['rest','집에서 쉬기','산소를 가득 채워요']:b.type==='solar'?['charge','충전 상태 확인','주변에서 초당 '+(level===2?7:3)+'% 충전']:['scan','주변 탐색','미탐사 유적의 방향을 표시해요'];
    showModal(definition.name,'MY OUTPOST / Lv.'+level,'<p class="modal-intro">'+definition.description+'</p><div class="interaction-grid"><button data-building-action="'+primary[0]+'">'+primary[1]+'<small>'+primary[2]+'</small></button>'+(b.type==='habitat'?'<button data-building-action="lights">조명 '+(b.lit===false?'켜기':'끄기')+'<small>집 창문의 불빛을 바꿔요</small></button>':'')+'<button data-building-action="upgrade" '+(level===2?'disabled':'')+'>설비 업그레이드<small>'+(level===2?'업그레이드 완료':'철광석 6 · 수정 4')+'</small></button></div><p class="modal-intro">Lv.2: 집은 휴식 시 연료 10%도 보충하고, 충전기는 더 빠르게 충전하며, 비콘은 행성의 모든 생명체를 탐지합니다.</p><button class="primary-button" id="building-close">탐험으로 돌아가기</button>');
    $('building-close').onclick=closeModal;modal.querySelectorAll('[data-building-action]').forEach(button=>button.onclick=()=>{closeModal();const result=game.useBuilding(id,button.dataset.buildingAction);if(!result.ok)toast(result.reason,true);processEvents();hud(true);});
  }
  function discovery(title,detail){clearTimeout(bannerTimer);$('discovery-title').textContent=title;$('discovery-detail').textContent=detail;$('discovery-banner').hidden=false;bannerTimer=setTimeout(()=>$('discovery-banner').hidden=true,4300);sound('discovery');}
  function processEvents(){
    while(game.events.length){const e=game.events.shift();if(e.type==='launch'||e.type==='land')clearTutorialWaypoint();tutorial.event(e,game);
      if(e.type==='message')toast(e.text,e.error);
      else if(e.type==='effect'){renderer.effect(e);sound(e.kind,e);}
      else if(e.type==='save'){save();if(buildOpen)renderBuildOptions();}
      else if(e.type==='dialogue')showDialogue(e);
      else if(e.type==='building-menu')showBuilding(e.id);
      else if(e.type==='relic-story'){showModal(e.name,'ANCIENT SIGNAL / 별빛 기록','<p class="relic-story">'+e.text+'</p><div class="reward">수정 +5 · 철광석 +4</div><button id="relic-close" class="primary-button">다음 기록을 찾아서</button>');$('relic-close').onclick=closeModal;}
      else if(e.type==='discovery'){discovery(SPECIES[e.species].name,SPECIES[e.species].kind+' · 도감에 기록했어요');}
      else if(e.type==='planet-discovery'){const p=PLANETS.find(p=>p.id===e.planet);discovery(p.name,p.kind+' · 새로운 세계에 온 걸 환영해요');}
      else if(e.type==='launch'||e.type==='land'){if(buildOpen){buildOpen=false;$('build-panel').hidden=true;game.selectedBuild=null;$('build-button').classList.remove('selected');$('interact-button').classList.add('selected');}locationSignature='';renderer.effect({kind:e.type});sound(e.type);}
    }
  }
  function hud(force=false){
    const s=game.state,p=game.planet(),space=s.mode==='space',nearest=game.nearest();
    for(const r of ['iron','crystal','biomass'])setText(r+'-count',s.inventory[r]);
    setText('oxygen-text',Math.ceil(s.oxygen)+'%');$('oxygen-bar').style.width=s.oxygen+'%';$('oxygen-bar').style.background=s.oxygen<25?'#ffb196':'';setText('fuel-text',Math.floor(s.fuel)+'%');$('fuel-bar').style.width=s.fuel+'%';setText('journal-count',s.discovered.length);
    const loc=space?'space':p.id;if(locationSignature!==loc||force){locationSignature=loc;setText('location-code',space?'SIGMA SYSTEM / OPEN SPACE':'시그마 성계 / '+String(PLANETS.indexOf(p)+1).padStart(2,'0'));$('location-name').innerHTML=(space?'시그마 성계':p.name)+'<span class="planet-tag">'+(space?'비행 중':'탐험 중')+'</span>';$('location-description').innerHTML=space?'새로운 행성으로 향하는 중':p.kind+' <span>·</span> '+p.temp;setText('ship-label',space?'착륙':'우주선');$('scan-button').title=space?'주변 행성 스캔':'주변 자원과 생명체 스캔';}
    updateTutorial();$('space-action').hidden=!space||!$('tutorial-card').hidden;$('mission-card').hidden=space||!$('tutorial-card').hidden;$('vertical-controls').hidden=!space;
    if(space){const target=nearest?.kind==='planet'?nearest.entity:null;setText('space-target-name',target?target.name+' 궤도':'다음 목적지를 찾아보세요');setText('space-target-help',target?'착륙해 새로운 자원과 생명체를 만나보세요.':'방향키로 비행하거나 성계 지도에서 항로를 설정하세요.');$('land-button').disabled=!target||!!game.travel;setText('land-button',target?target.name+'에 착륙':'행성 가까이에서 착륙');setText('refuel-button',game.solarCharge>0?'태양광 비상 충전 · '+Math.ceil(game.solarCharge)+'초':s.inventory.biomass>=3?'연료 합성 · 바이오매스 3개':'비상 태양광 충전 · 6초');}
    let hint='자원 가까이에서 E를 누르세요',key='E';
    if(game.selectedBuild){hint='빈 땅 클릭 또는 E · 건설 배치';key='B';}
    else if(space){hint=game.travel?'워프 항로를 따라 이동하고 있어요':nearest?'E 또는 F · '+nearest.entity.name+'에 착륙':'WASD 비행 · M 성계 지도';key=nearest?'E':'M';}
    else if(nearest){if(nearest.kind==='node')hint=RESOURCE_NAMES[nearest.entity.type]+' 채굴 · 길게 누르기';else if(nearest.kind==='creature')hint=SPECIES[nearest.entity.species].name+'에게 인사하기';else if(nearest.kind==='ship')hint='우주선 탑승 · 이륙';else if(nearest.kind==='relic')hint=nearest.entity.name+' · 별빛 기록 조사';else hint=BUILDINGS[nearest.entity.type].name+' · 사용하기';}
    $('interaction-hint').querySelector('kbd').textContent=key;$('interaction-hint').querySelector('span').textContent=hint;
    setText('interact-label',space?'착륙':nearest?.kind==='creature'?'인사하기':nearest?.kind==='ship'?'탑승하기':nearest?.kind==='relic'?'조사하기':nearest?.kind==='building'?'사용하기':'채굴 / 교류');
    setText('field-status','유적 '+s.relics.length+' / 15'+(s.companion?' · 동행 중':'')+' · '+Math.round(1000/renderer.frameMs)+' FPS');const actor=space?s.ship:s.player;setText('coordinate-label','X '+String(Math.round(actor.x)).padStart(4,'0')+' / Y '+String(Math.round(actor.y)).padStart(4,'0'));setText('day-label','탐험 '+(Math.floor(s.time/600)+1)+'일째');
    const nearHome=!space&&(dist(s.player,{x:0,y:0})<180||game.world().buildings.some(b=>b.type==='habitat'&&dist(s.player,b)<150));
    setText('status-label',game.paused?'탐험 일시 정지':nearHome?'안전 구역 · 산소 충전 중':s.oxygen<25?'산소 부족 · 집이나 우주선으로 돌아가세요':space?'항법 장치 정상':'3D 탐사 장비 정상');
    if(s.oxygen<25&&!lowOxygenWarned){toast('산소가 얼마 남지 않았어요. 집이나 우주선 근처에서 충전하세요.',true);lowOxygenWarned=true;}if(s.oxygen>50)lowOxygenWarned=false;
    const goals=game.goals(),signature=goals.map(v=>v.done?'1':'0').join('');if(signature!==missionSignature||force){missionSignature=signature;$('mission-list').innerHTML=goals.map(v=>'<li class="'+(v.done?'done':'')+'">'+v.text+'</li>').join('');const completed=goals.filter(v=>v.done).length;$('mission-progress-bar').style.width=(completed/goals.length*100)+'%';if(completed===goals.length){setText('mission-title','이제 당신도 우주 개척자');setText('mission-description','남은 행성을 탐험하고 더 큰 기지를 만들어보세요.');setText('mission-note','모든 첫 탐험 목표를 달성했어요!');}else{setText('mission-title','작은 발걸음, 새로운 세계');setText('mission-description','우주에 첫 번째 나만의 집을 지어보세요.');setText('mission-note','천천히 둘러보세요. 모험은 이제 시작이에요.');}}
    if(nearest&&!space&&!game.selectedBuild&&nearest.kind!=='ship'){
      const e=nearest.entity,pt=renderer.project(e.x,e.y);$('world-label').hidden=pt.x<40||pt.x>renderer.width-40||pt.y<100||pt.y>renderer.height-100;$('world-label').style.left=pt.x+'px';$('world-label').style.top=(pt.y-12)+'px';setText('world-label',nearest.kind==='node'?RESOURCE_NAMES[e.type]:nearest.kind==='creature'?SPECIES[e.species].name:nearest.kind==='relic'?e.name:BUILDINGS[e.type].name);
    }else $('world-label').hidden=true;
  }
  function interact(){sound('click');const wasBuilding=!!game.selectedBuild;const result=game.interact();if(wasBuilding&&result.ok)toggleBuild(false);processEvents();}
  $('explore-tab').onclick=()=>{if(modal.open)closeModal();};$('map-tab').onclick=showMap;$('radar-button').onclick=showMap;$('journal-tab').onclick=showJournal;$('help-button').onclick=showHelp;$('settings-button').onclick=showSettings;
  $('view-button').onclick=toggleCamera;$('immersion-button').onclick=showImmersion;
  $('fullscreen-button').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('game-area').requestFullscreen)await $('game-area').requestFullscreen();else toast('이 브라우저에서는 전체 화면 버튼을 사용할 수 없어요.');}catch(e){toast('전체 화면을 열지 못했어요. 브라우저 설정을 확인해주세요.');}};
  $('pause-button').onclick=()=>{showModal('잠시, 별을 바라보세요','EXPEDITION PAUSED','<div class="pause-content"><p>탐험을 잠시 멈췄어요.<br>준비가 되면 언제든 다시 떠나세요.</p><button id="resume-button" class="primary-button">이어서 탐험하기</button></div>');$('resume-button').onclick=closeModal;save();};
  $('sound-button').onclick=()=>{soundEnabled=!soundEnabled;try{localStorage.setItem(SOUND_KEY,soundEnabled?'on':'off');}catch(e){}updateSoundButton();sound('click');updateEngineAudio();};
  $('scan-button').onclick=()=>{game.scan();processEvents();};$('build-button').onclick=()=>toggleBuild();$('build-close').onclick=()=>toggleBuild(false);$('place-building').onclick=placeBuilding;
  $('ship-button').onclick=()=>{game.launch();processEvents();};$('land-button').onclick=()=>{game.land();processEvents();};$('refuel-button').onclick=()=>{game.refuel();processEvents();};
  let touchInteracted=false;
  $('interact-button').addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();touchInteracted=true;keys.interact=true;interact();$('interact-button').setPointerCapture?.(e.pointerId);});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('interact-button').addEventListener(ev,()=>{keys.interact=false;});
  $('interact-button').onclick=()=>{if(touchInteracted){touchInteracted=false;return;}interact();};
  $('mission-toggle').onclick=()=>{missionOpen=!missionOpen;$('mission-body').hidden=!missionOpen;$('mission-card').classList.toggle('collapsed',!missionOpen);setText('mission-toggle',missionOpen?'−':'+');$('mission-toggle').setAttribute('aria-label',missionOpen?'탐험 목표 접기':'탐험 목표 펼치기');};
  const moveMap={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'run',ShiftRight:'run',KeyE:'interact',Space:'ascend',KeyC:'descend'};
  window.addEventListener('keydown',e=>{
    if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
    if(modal.open)return;
    ensureAudio();
    if(moveMap[e.code]){e.preventDefault();keys[moveMap[e.code]]=true;}
    if(e.repeat)return;
    if(e.code==='KeyE'){e.preventDefault();interact();}
    else if(e.code==='KeyQ'){e.preventDefault();game.scan();processEvents();}
    else if(e.code==='Space'){e.preventDefault();if(game.state.mode==='surface')renderer.jump();}
    else if(e.code==='KeyV'){e.preventDefault();toggleCamera();}
    else if(e.code==='KeyX'){e.preventDefault();showImmersion();}
    else if(e.code==='KeyB'){e.preventDefault();toggleBuild();}
    else if(e.code==='KeyF'){e.preventDefault();game.launch();processEvents();}
    else if(e.code==='KeyM'){e.preventDefault();showMap();}
    else if(e.code==='KeyJ'){e.preventDefault();showJournal();}
    else if(e.code==='KeyR'){e.preventDefault();game.refuel();processEvents();}
    else if(e.code==='Escape'){e.preventDefault();if(buildOpen)toggleBuild(false);else $('pause-button').click();}
  });
  window.addEventListener('keyup',e=>{if(moveMap[e.code])delete keys[moveMap[e.code]];});
  window.addEventListener('blur',()=>{clearInput();game.paused=true;renderer.stopHaptics();updateEngineAudio();save();});window.addEventListener('focus',()=>{game.paused=startOpen||modal.open||document.hidden;});
  document.addEventListener('visibilitychange',()=>{clearInput();game.paused=startOpen||document.hidden||modal.open;if(document.hidden){renderer.stopHaptics();updateEngineAudio();save();}});window.addEventListener('pagehide',()=>{renderer.stopHaptics();save();});
  document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();keys[b.dataset.move]=true;b.setPointerCapture?.(e.pointerId);});for(const ev of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{delete keys[b.dataset.move];});});
  let viewDrag=null;
  function clickWorld(event){
    if(game.paused||game.travel)return;const r=$('world').getBoundingClientRect(),p=renderer.unproject(event.clientX-r.left,event.clientY-r.top);$('world').focus({preventScroll:true});
    if(game.selectedBuild){const result=game.build(game.selectedBuild,p.x,p.y);if(result.ok)toggleBuild(false);processEvents();return;}
    if(game.state.mode==='surface'){
      const candidates=[...game.world().nodes.filter(n=>n.hp>0),...game.world().creatures,...game.world().buildings,...game.world().relics];
      const target=candidates.map(n=>({n,point:renderer.project(n.x,n.y)})).filter(v=>v.point.visible&&Math.hypot(v.point.x-(event.clientX-r.left),v.point.y-(event.clientY-r.top))<42).sort((a,b)=>a.point.depth-b.point.depth)[0]?.n;
      if(target&&dist(target,game.state.player)<145){game.interact(target.id);processEvents();return;}
      if(target){game.pendingInteraction=target.id;game.moveTarget={x:target.x,y:target.y};toast('대상에게 다가가 상호작용합니다.');return;}
    }
    game.pendingInteraction=null;const limit=game.state.mode==='surface'?WORLD_LIMIT-40:2250;game.moveTarget={x:clamp(p.x,-limit,limit),y:clamp(p.y,-limit,limit)};
  }
  $('world').addEventListener('pointerdown',e=>{
    if(e.button!==0||game.paused)return;ensureAudio();viewDrag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragged:false};$('world').setPointerCapture?.(e.pointerId);
  });
  $('world').addEventListener('pointermove',e=>{
    if(viewDrag&&viewDrag.id===e.pointerId){const dx=e.clientX-viewDrag.x,dy=e.clientY-viewDrag.y;if(Math.hypot(e.clientX-viewDrag.startX,e.clientY-viewDrag.startY)>6)viewDrag.dragged=true;if(viewDrag.dragged){renderer.orbit(dx,dy);renderer.mouse=null;}viewDrag.x=e.clientX;viewDrag.y=e.clientY;}
    if(game.selectedBuild&&!viewDrag?.dragged){const r=$('world').getBoundingClientRect();renderer.mouse=renderer.unproject(e.clientX-r.left,e.clientY-r.top);}
  });
  $('world').addEventListener('pointerup',e=>{if(viewDrag?.id===e.pointerId){const clicked=!viewDrag.dragged;viewDrag=null;if(clicked)clickWorld(e);}});
  $('world').addEventListener('pointercancel',()=>{viewDrag=null;renderer.mouse=null;});$('world').addEventListener('lostpointercapture',()=>{viewDrag=null;});
  $('world').addEventListener('pointerleave',()=>{if(!viewDrag)renderer.mouse=null;});
  $('world').addEventListener('wheel',e=>{e.preventDefault();if(!game.paused)renderer.zoomBy(e.deltaY);},{passive:false});
  document.addEventListener('pointerdown',()=>ensureAudio(),{capture:true});
  for(const[id,key]of[['ascend-button','ascend'],['descend-button','descend']]){const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;b.setPointerCapture?.(e.pointerId);});for(const event of['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>delete keys[key]);}
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>renderer.resize()).observe($('game-area'));else window.addEventListener('resize',()=>renderer.resize());
  let accumulator=0,previousDraw=0;
  function frame(now){
    const elapsed=Math.max(0,Math.min(.1,(now-lastFrame)/1000));lastFrame=now;
    if(document.hidden){accumulator=0;requestAnimationFrame(frame);return;}
    if(game.paused)accumulator=0;else accumulator+=elapsed;
    let steps=0;while(accumulator>=1/60&&steps++<6){game.tick(1/60,renderer.input(keys));tutorial.tick(game);processEvents();accumulator-=1/60;if(game.paused){accumulator=0;break;}}
    if(!game.paused||now-previousDraw>66){renderer.draw(elapsed);previousDraw=now;}
    updateEngineAudio();if(now-lastHud>110){hud();lastHud=now;}
    if(now-lastSave>8000){if(!game.paused)save();lastSave=now;}requestAnimationFrame(frame);
  }
  updateSoundButton();updateImmersionButton();hud(true);processEvents();
  if(saved)toast('다시 오신 걸 환영해요. 지난 탐험에서 이어서 시작합니다.');else toast('베르단트에 착륙했어요! 화면을 드래그해 둘러보고 WASD로 이동하세요. E는 채굴이에요.');
  if(!storageAvailable)toast('자동 저장을 사용할 수 없어요. 저장 관리에서 파일을 내보내 주세요.',true);
  requestAnimationFrame(frame);
  // Optional browser-native agent tools share exactly the same game actions as the interface.
  const context=document.modelContext;
  if(context?.registerTool){
    const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
    const register=tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch(e){}};
    register({name:'read_exploration_state',title:'탐험 상태 읽기',description:'현재 행성, 위치, 자원, 목표와 가까운 생명체를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){return game.nearbyState();}});
    register({name:'start_explorer_movement',title:'탐험가 이동 시작',description:'현재 지역 안의 좌표로 이동을 시작합니다. 도착 완료를 의미하지 않습니다.',inputSchema:{type:'object',properties:{x:{type:'number'},y:{type:'number'}},required:['x','y'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.x!=='number'||typeof input.y!=='number'||!Number.isFinite(input.x)||!Number.isFinite(input.y))return{ok:false,reason:'유한한 x, y 좌표가 필요합니다.'};if(game.paused||game.travel)return{ok:false,reason:'일시 정지 또는 항해 중입니다.'};const limit=game.state.mode==='surface'?WORLD_LIMIT-40:2250;if(Math.abs(input.x)>limit||Math.abs(input.y)>limit)return{ok:false,reason:'이동 가능 범위 밖입니다.'};game.moveTarget={x:input.x,y:input.y};hud();return{ok:true,status:'이동 시작',destination:{...game.moveTarget}};}});
    register({name:'perform_exploration_action',title:'탐험 행동 실행',description:'주변 대상과 한 번 상호작용하거나 스캔, 이륙, 착륙, 연료 충전을 실행합니다. 자원·연료 등은 화면과 같은 규칙으로 바뀝니다.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['interact','scan','launch','land','refuel']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||!['interact','scan','launch','land','refuel'].includes(input.action))return{ok:false,reason:'지원하지 않는 행동입니다.'};const result=game[input.action]();processEvents();hud();return result;}});
  }
})();
