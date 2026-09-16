(function(root){
  'use strict';
  const{PLANETS,SPECIES,BUILDINGS,SURFACE_MAP_SCALE,TERRAIN_LIMIT,rand,clamp,dist}=root.OrbitCore,TAU=Math.PI*2;
  const rgb=h=>{if(Array.isArray(h))return h;let n=parseInt(h.slice(1,7),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];};
  const tint=(h,f)=>rgb(h).map(v=>clamp(v*f,0,1));
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function modelMatrix(x,y,z,scale=1,yaw=0){const c=Math.cos(yaw)*scale,s=Math.sin(yaw)*scale;return[c,0,-s,0,0,scale,0,0,s,0,c,0,x,y,z,1];}
  function multiply(a,b){const c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)c[j*4+i]=a[i]*b[j*4]+a[4+i]*b[j*4+1]+a[8+i]*b[j*4+2]+a[12+i]*b[j*4+3];return c;}
  function transform(m,p){const[x,y,z]=p;return[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];}
  function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
  function lookAt(eye,target){const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
  function heightAt(x,z,p){const t=clamp((Math.hypot(x,z)-310)/380,0,1),clear=t*t*(3-2*t);return clear*(Math.sin(x*.008+p.seed)*Math.cos(z*.007)*37+Math.sin(x*.019+z*.014)*11+Math.cos(z*.015-x*.009)*9);}
  function terrainNormal(x,z,p){return norm([heightAt(x-1,z,p)-heightAt(x+1,z,p),2,heightAt(x,z-1,p)-heightAt(x,z+1,p)]);}
  function terrainColor(x,z,p){
    const wave=.5+Math.sin(x*.0031+p.seed)*Math.cos(z*.0027)*.24+Math.sin(x*.007-z*.005+p.seed*.7)*.13;
    const t=clamp(wave,0,1)*(p.ground.length-1),i=Math.min(p.ground.length-2,Math.floor(t)),f=t-i,a=rgb(p.ground[i]),b=rgb(p.ground[i+1]);
    return a.map((v,k)=>v+(b[k]-v)*f);
  }
  class Batch{
    constructor(){this.data=[];this.shadowData=[];this.mat=identity();}
    at(x,y,z,scale,yaw,fn){const old=this.mat,c=Math.cos(yaw),s=Math.sin(yaw);this.mat=multiply(old,[c*scale,0,-s*scale,0,0,scale,0,0,s*scale,0,c*scale,0,x,y,z,1]);fn();this.mat=old;}
    tri(a,b,c,color,emissive=0,normals=null,colors=null,emissions=null){
      const points=[a,b,c].map(p=>transform(this.mat,p)),face=normals?null:norm(cross(sub(points[1],points[0]),sub(points[2],points[0]))),co=rgb(color),m=this.mat;
      for(let i=0;i<3;i++){const n=normals?norm([m[0]*normals[i][0]+m[4]*normals[i][1]+m[8]*normals[i][2],m[1]*normals[i][0]+m[5]*normals[i][1]+m[9]*normals[i][2],m[2]*normals[i][0]+m[6]*normals[i][1]+m[10]*normals[i][2]]):face;this.data.push(...points[i],...n,...(colors?colors[i]:co),emissions?emissions[i]:emissive);}
    }
    quad(a,b,c,d,color,e=0){this.tri(a,b,c,color,e);this.tri(a,c,d,color,e);}
    box(x,y,z,w,h,d,color,e=0){
      const p=[[-w/2,-h/2,-d/2],[w/2,-h/2,-d/2],[w/2,h/2,-d/2],[-w/2,h/2,-d/2],[-w/2,-h/2,d/2],[w/2,-h/2,d/2],[w/2,h/2,d/2],[-w/2,h/2,d/2]].map(a=>[a[0]+x,a[1]+y,a[2]+z]);
      for(const f of[[4,5,6,7],[1,0,3,2],[0,4,7,3],[5,1,2,6],[7,6,2,3],[0,1,5,4]])this.quad(...f.map(i=>p[i]),color,e);
    }
    roundedBox(x,y,z,w,h,d,r,color,e=0){
      const half=[w/2,h/2,d/2];r=Math.min(r,...half);const inner=half.map(v=>v-r),grid=half.map((v,i)=>[-v,-inner[i],inner[i],v]);
      for(let axis=0;axis<3;axis++)for(const sign of[-1,1]){const u=(axis+1)%3,v=(axis+2)%3;
        const pt=(i,j)=>{const q=[0,0,0];q[axis]=half[axis]*sign;q[u]=grid[u][i];q[v]=grid[v][j];const center=q.map((n,k)=>clamp(n,-inner[k],inner[k])),normal=norm(sub(q,center));return{p:center.map((n,k)=>n+normal[k]*r+[x,y,z][k]),n:normal};};
        for(let j=0;j<3;j++)for(let i=0;i<3;i++){const a=pt(i,j),b=pt(i+1,j),c=pt(i+1,j+1),d=pt(i,j+1),quad=sign>0?[a,b,c,d]:[a,d,c,b];this.tri(quad[0].p,quad[1].p,quad[2].p,color,e,quad.slice(0,3).map(v=>v.n));this.tri(quad[0].p,quad[2].p,quad[3].p,color,e,[quad[0].n,quad[2].n,quad[3].n]);}
      }
    }
    sphere(x,y,z,rx,ry,rz,color,segments=10,rings=7,e=0,smooth=true){
      if(smooth&&Math.max(rx,ry,rz)>2.5){segments=Math.max(segments,Math.max(rx,ry,rz)>10?12:8);rings=Math.max(rings,Math.max(rx,ry,rz)>10?7:5);}
      const pt=(i,j)=>{const a=i/segments*TAU,b=j/rings*Math.PI,s=Math.sin(b),dir=[s*Math.cos(a),Math.cos(b),s*Math.sin(a)];return{p:[x+dir[0]*rx,y+dir[1]*ry,z+dir[2]*rz],n:norm([dir[0]/rx,dir[1]/ry,dir[2]/rz])};};
      const grid=Array.from({length:rings+1},(_,j)=>Array.from({length:segments+1},(_,i)=>pt(i,j)));
      for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i+1],d=grid[j+1][i];if(j>0)this.tri(a.p,b.p,c.p,color,e,smooth?[a.n,b.n,c.n]:null);if(j<rings-1)this.tri(a.p,c.p,d.p,color,e,smooth?[a.n,c.n,d.n]:null);}
    }
    tube(a,b,r1,r2,color,sides=8,e=0){
      const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),v=cross(axis,u),smooth=sides>=6;
      if(smooth)sides=Math.max(12,sides);
      const pt=(center,r,i)=>{const t=i/sides*TAU;return center.map((n,k)=>n+r*(Math.cos(t)*u[k]+Math.sin(t)*v[k]));};
      const slope=(r1-r2)/Math.max(.001,Math.hypot(...sub(b,a))),normal=i=>{const t=i/sides*TAU;return norm(axis.map((n,k)=>Math.cos(t)*u[k]+Math.sin(t)*v[k]+n*slope));};
      for(let i=0;i<sides;i++){const aa=pt(a,r1,i),ab=pt(a,r1,i+1),ba=pt(b,r2,i),bb=pt(b,r2,i+1),na=normal(i),nb=normal(i+1);if(r1)this.tri(aa,ab,bb,color,e,smooth?[na,nb,nb]:null);if(r2)this.tri(aa,bb,ba,color,e,smooth?[na,nb,na]:null);if(r1)this.tri(a,ab,aa,color,e);if(r2)this.tri(b,ba,bb,color,e);}
    }
    cone(x,y,z,r1,r2,h,color,sides=8,e=0){this.tube([x,y,z],[x,y+h,z],r1,r2,color,sides,e);}
    ring(x,y,z,r,w,color,e=1){for(let i=0;i<64;i++){const a=i/64*TAU,b=(i+1)/64*TAU;this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*(r+w),y,z+Math.sin(b)*(r+w)],[x+Math.cos(a)*(r+w),y,z+Math.sin(a)*(r+w)],color,e);}}
    array(){const data=new Float32Array(this.data);if(this.shadowData.length)data.shadows=new Float32Array(this.shadowData);return data;}
  }
  const shaders={
    vertex:`precision highp float;
      attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor; attribute float aEmission;
      uniform mat4 uVP; uniform mat4 uModel; uniform vec3 uEye;
      varying vec3 vColor; varying vec3 vNormal; varying vec3 vView; varying float vEmission;
      void main(){vec3 position=(uModel*vec4(aPosition,1.0)).xyz;vNormal=normalize(mat3(uModel)*aNormal);vColor=aColor;vEmission=aEmission;vView=(uEye-position)/6500.0;gl_Position=uVP*vec4(position,1.0);}`,
    fragment:`#ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec3 vColor; varying vec3 vNormal; varying vec3 vView; varying float vEmission; uniform vec3 uFog; uniform vec2 uFogRange;
      void main(){
        float fog=smoothstep(uFogRange.x,uFogRange.y,length(vView)*6500.0);
        if(vEmission<0.0){gl_FragColor=vec4(vColor,clamp(-vEmission-1.0,0.0,1.0)*(1.0-fog));return;}
        vec3 normal=normalize(vNormal),view=normalize(vView),light=normalize(vec3(-0.5,0.85,0.4));
        float diffuse=max(dot(normal,light),0.0),emission=clamp(vEmission,0.0,1.0);
        vec3 ambient=mix(vec3(0.32,0.36,0.38),vec3(0.70,0.77,0.79),normal.y*0.5+0.5);
        vec3 color=vColor*(ambient+vec3(1.0,0.95,0.86)*diffuse*0.44);
        float highlight=pow(max(dot(normal,normalize(light+view)),0.0),32.0)*0.09;
        float rim=pow(1.0-max(dot(normal,view),0.0),3.0)*0.045;
        color=mix(color+vec3(highlight)+vec3(0.65,0.85,1.0)*rim,vColor*1.12,emission);
        gl_FragColor=vec4(mix(color,uFog,fog),1.0);
      }`,
    skyVertex:`attribute vec2 aPosition; varying vec2 vUV;void main(){vUV=aPosition*0.5+0.5;gl_Position=vec4(aPosition,0.9999,1.0);}`,
    skyFragment:`#ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec2 vUV;uniform vec3 uTop;uniform vec3 uBottom;uniform float uTime;uniform float uSpace;uniform float uYaw;
      float hash(vec2 p){return fract(sin(dot(mod(p,64.0),vec2(127.1,311.7)))*43758.5453);}
      void main(){vec3 col=mix(uBottom,uTop,smoothstep(0.05,1.0,vUV.y));vec2 grid=(vUV+vec2(uYaw*0.12,0.0))*vec2(220.0,125.0);float r=hash(floor(grid));float star=(1.0-smoothstep(0.0,0.10,length(fract(grid)-0.5)))*step(0.982,r);col+=star*(0.35+uSpace*0.65)*(0.7+0.3*sin(uTime+r*100.0));float haze=exp(-length((vUV-vec2(0.66,0.54))*vec2(1.2,2.0))*3.5);col+=vec3(0.02,0.06,0.08)*haze;gl_FragColor=vec4(col,1.0);}`,
    // An edge-only pass preserves surface detail and never filters the HTML HUD.
    postFragment:`#ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      varying vec2 vUV;uniform sampler2D uScene;uniform vec2 uPixel;
      void main(){
        vec3 center=texture2D(uScene,vUV).rgb,luma=vec3(0.299,0.587,0.114);
        float nw=dot(texture2D(uScene,vUV+vec2(-1.0,1.0)*uPixel).rgb,luma),ne=dot(texture2D(uScene,vUV+vec2(1.0,1.0)*uPixel).rgb,luma);
        float sw=dot(texture2D(uScene,vUV+vec2(-1.0,-1.0)*uPixel).rgb,luma),se=dot(texture2D(uScene,vUV+vec2(1.0,-1.0)*uPixel).rgb,luma),mid=dot(center,luma);
        float low=min(mid,min(min(nw,ne),min(sw,se))),high=max(mid,max(max(nw,ne),max(sw,se)));
        if(high-low<max(0.035,high*0.10)){gl_FragColor=vec4(center,1.0);return;}
        vec2 direction=vec2(-((nw+ne)-(sw+se)),(nw+sw)-(ne+se));
        float reduce=max((nw+ne+sw+se)*0.03125,0.0078125);
        direction=clamp(direction/(min(abs(direction.x),abs(direction.y))+reduce),vec2(-6.0),vec2(6.0))*uPixel;
        vec3 a=0.5*(texture2D(uScene,vUV-direction/6.0).rgb+texture2D(uScene,vUV+direction/6.0).rgb);
        vec3 b=a*0.5+0.25*(texture2D(uScene,vUV-direction*0.5).rgb+texture2D(uScene,vUV+direction*0.5).rgb);
        float value=dot(b,luma);gl_FragColor=vec4(value<low||value>high?a:b,1.0);
      }`
  };
  class GLScene{
    constructor(canvas){
      this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false})||canvas.getContext('experimental-webgl',{alpha:false,antialias:true});
      if(!this.gl)throw Error('WebGL 3D 그래픽을 사용할 수 없어요. 브라우저의 하드웨어 가속을 켜고 최신 Chrome 또는 Edge에서 다시 열어주세요.');
      const gl=this.gl;this.program=this.programFor(shaders.vertex,shaders.fragment);this.skyProgram=this.programFor(shaders.skyVertex,shaders.skyFragment);this.uniforms={};
      for(const n of['uVP','uModel','uEye','uFog','uFogRange'])this.uniforms[n]=gl.getUniformLocation(this.program,n);
      this.attributes={};for(const n of['aPosition','aNormal','aColor','aEmission'])this.attributes[n]=gl.getAttribLocation(this.program,n);
      this.skyUniforms={};for(const n of['uTop','uBottom','uTime','uSpace','uYaw'])this.skyUniforms[n]=gl.getUniformLocation(this.skyProgram,n);
      this.skyAttribute=gl.getAttribLocation(this.skyProgram,'aPosition');this.buffers={};
      this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      this.shadowQueue=[];this.postSize='';this.postReady=false;
      try{this.postProgram=this.programFor(shaders.skyVertex,shaders.postFragment);this.postAttribute=gl.getAttribLocation(this.postProgram,'aPosition');this.postPixel=gl.getUniformLocation(this.postProgram,'uPixel');this.postScene=gl.getUniformLocation(this.postProgram,'uScene');}catch(e){this.postProgram=null;}
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    }
    programFor(vs,fs){const gl=this.gl,compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const e=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error('3D 셰이더 오류: '+e);}return s;};const v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('3D 그래픽 연결 오류');return p;}
    upload(name,data,dynamic=false){const gl=this.gl;let b=this.buffers[name];if(!b)b=this.buffers[name]={buffer:gl.createBuffer(),count:0,capacity:0};b.count=data.length/10;gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);if(dynamic){if(data.byteLength>b.capacity){b.capacity=2**Math.ceil(Math.log2(Math.max(1024,data.byteLength)));gl.bufferData(gl.ARRAY_BUFFER,b.capacity,gl.DYNAMIC_DRAW);}if(data.byteLength)gl.bufferSubData(gl.ARRAY_BUFFER,0,data);}else gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);if(data.shadows?.length){b.shadow=name+'-shadow';this.upload(b.shadow,data.shadows,dynamic);}else b.shadow=null;}
    resizeTarget(w,h){
      const gl=this.gl,size=w+'x'+h;if(!this.postProgram||size===this.postSize)return;this.postSize=size;this.postReady=false;
      // Reuse the framebuffer and resize its attachments only when resolution changes.
      if(!this.framebuffer){this.framebuffer=gl.createFramebuffer();this.sceneTexture=gl.createTexture();this.sceneDepth=gl.createRenderbuffer();}
      if(!this.framebuffer||!this.sceneTexture||!this.sceneDepth)return;
      gl.bindTexture(gl.TEXTURE_2D,this.sceneTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      // Packed depth/stencil preserves depth precision where curved surfaces meet.
      gl.bindRenderbuffer(gl.RENDERBUFFER,this.sceneDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_STENCIL,w,h);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.sceneTexture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,this.sceneDepth);
      this.postReady=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
      gl.bindTexture(gl.TEXTURE_2D,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    begin(w,h,vp,eye,space,p,time,yaw){
      const gl=this.gl;this.resizeTarget(w,h);this.shadowQueue.length=0;this.width=w;this.height=h;gl.bindFramebuffer(gl.FRAMEBUFFER,this.postReady?this.framebuffer:null);gl.depthMask(true);gl.disable(gl.BLEND);gl.viewport(0,0,w,h);gl.clearColor(.04,.08,.12,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);for(const a of Object.values(this.attributes))gl.disableVertexAttribArray(a);gl.useProgram(this.skyProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.enableVertexAttribArray(this.skyAttribute);gl.vertexAttribPointer(this.skyAttribute,2,gl.FLOAT,false,8,0);
      const bottom=space?[.025,.05,.1]:p.id==='ember'?[.28,.17,.18]:p.id==='nix'?[.43,.59,.69]:p.id==='solara'?[.55,.45,.32]:p.id==='prisma'?[.37,.31,.53]:[.34,.5,.48];this.fog=bottom;
      gl.uniform3fv(this.skyUniforms.uTop,space?[.018,.025,.065]:[.045,.105,.17]);gl.uniform3fv(this.skyUniforms.uBottom,bottom);gl.uniform1f(this.skyUniforms.uTime,time);gl.uniform1f(this.skyUniforms.uSpace,space?1:0);gl.uniform1f(this.skyUniforms.uYaw,yaw);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(this.skyAttribute);
      gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);gl.uniformMatrix4fv(this.uniforms.uVP,false,vp);gl.uniform3fv(this.uniforms.uEye,eye);gl.uniform3fv(this.uniforms.uFog,bottom);gl.uniform2fv(this.uniforms.uFogRange,space?[1800,5500]:[650,2600*SURFACE_MAP_SCALE]);
    }
    draw(name,model=identity()){const b=this.buffers[name];if(!b)return;if(b.shadow)this.shadowQueue.push([b.shadow,model]);if(!b.count)return;const gl=this.gl,a=this.attributes;gl.uniformMatrix4fv(this.uniforms.uModel,false,model);gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);for(const[n,size,offset]of[['aPosition',3,0],['aNormal',3,12],['aColor',3,24],['aEmission',1,36]]){gl.enableVertexAttribArray(a[n]);gl.vertexAttribPointer(a[n],size,gl.FLOAT,false,40,offset);}gl.drawArrays(gl.TRIANGLES,0,b.count);}
    end(){
      const gl=this.gl;gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-1);
      for(const[name,model]of this.shadowQueue)this.draw(name,model);
      gl.disable(gl.POLYGON_OFFSET_FILL);gl.depthMask(true);gl.disable(gl.BLEND);
      if(!this.postReady)return;
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.disable(gl.DEPTH_TEST);for(const a of Object.values(this.attributes))gl.disableVertexAttribArray(a);
      gl.useProgram(this.postProgram);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.enableVertexAttribArray(this.postAttribute);gl.vertexAttribPointer(this.postAttribute,2,gl.FLOAT,false,8,0);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.sceneTexture);gl.uniform1i(this.postScene,0);gl.uniform2f(this.postPixel,1/this.width,1/this.height);gl.drawArrays(gl.TRIANGLES,0,6);gl.bindTexture(gl.TEXTURE_2D,null);gl.disableVertexAttribArray(this.postAttribute);gl.enable(gl.DEPTH_TEST);
    }
  }
  function shadow(b,x,y,z,r,p){
    const opaque=b.data;b.data=b.shadowData;const levels=[0,.32,.66,1],alpha=[.3,.24,.09,0],sides=16,co=tint(p.dark,.42),up=[0,1,0];
    const pt=(level,i)=>{const a=i/sides*TAU,xx=x+Math.cos(a)*r*1.3*level,zz=z+Math.sin(a)*r*1.3*level;return[xx,heightAt(xx,zz,p)+.65,zz];};
    // Reuse samples across triangles; keep shadows in a pass with no depth writes.
    const grid=levels.map(level=>Array.from({length:sides+1},(_,i)=>pt(level,i)));
    for(let j=0;j<3;j++)for(let i=0;i<sides;i++){const a=grid[j][i],bb=grid[j][i+1],c=grid[j+1][i+1],d=grid[j+1][i],inner=-1-alpha[j],outer=-1-alpha[j+1];
      if(j)b.tri(a,c,bb,co,0,[up,up,up],null,[inner,outer,inner]);b.tri(a,d,c,co,0,[up,up,up],null,[inner,outer,outer]);
    }b.data=opaque;
  }
  function resourceModel(b,n,p){
    const x=n.x,z=n.y,y=heightAt(x,z,p),s=n.size||1;shadow(b,x,y,z,27*s,p);
    b.at(x,y,z,s,n.rotation||0,()=>{
      if(n.type==='iron'){b.sphere(0,20,0,31,25,27,'#a0b8b3',7,4);b.sphere(-15,9,19,13,10,12,'#819b92',6,3);b.box(7,36,8,10,3,9,'#d7e5df',.18);if(n.hp<n.maxHp)b.box(-2,29,22,4,18,3,'#45575b');}
      else if(n.type==='crystal'){for(const[x,z,h,r]of[[-18,5,36,10],[16,-6,47,12],[0,8,67,15]]){b.cone(x,0,z,r,r,h*.6,'#a5b7f1',5,.25);b.cone(x,h*.6,z,r,0,h*.4,'#d1e6ff',5,.35);}b.ring(0,1,0,27,1,'#8196c9',.3);}
      else{b.cone(0,0,0,4,2,43,'#748c5e',6);const leaf=p.id==='ember'?'#e5a46f':p.id==='prisma'?'#d2afe7':'#b9dc8f';b.sphere(-13,22,0,18,6,10,p.flora,7,4);b.sphere(15,34,0,19,7,12,leaf,7,4);b.sphere(0,49,1,12,18,11,leaf,8,5);b.sphere(0,55,5,5,7,4,'#e4fca6',6,4,.2);}
    });
  }
  function blockBreakModel(b,fx,p,time){
    const age=clamp(fx.age/Math.max(.01,fx.duration),0,1),fade=1-age,ground=heightAt(fx.x,fx.z,p),type=fx.nodeType||'iron',seed=fx.seed||0;
    const base=fx.color||'#cad9df',dark=type==='crystal'?'#566a9c':type==='biomass'?'#476446':'#263a42';
    b.ring(fx.x,ground+1.4,fx.z,10+age*48,1.8,base,.4+.45*fade);
    if(!fx.destroyed){
      const wobble=Math.sin(time*54+seed)*2.8*fade;
      b.at(fx.x,ground+wobble,fx.z,1,fx.rotation||0,()=>{
        b.tube([-19,41,24],[-2,28,25],2.2,1.1,dark,5,.25+.4*fade);
        b.tube([-2,28,25],[9,37,25],1.1,.7,dark,5,.25+.4*fade);
        b.tube([9,37,25],[20,25,24],1.5,.8,dark,5,.25+.4*fade);
        b.tube([1,27,-23],[8,18,-23],1.4,.8,dark,5,.2+.35*fade);
      });
      for(let i=0;i<4;i++){
        const a=seed+i*1.57,r=10+age*(8+i*2),px=fx.x+Math.sin(a)*r,pz=fx.z+Math.cos(a)*r,py=ground+15+Math.sin(a*2)*5+age*(14+i*4);
        b.at(px,py,pz,.7+fade*.3,a+time*2,()=>b.roundedBox(0,0,0,3+i%2*2,4+i%3*2,3,1,base,.25+.35*fade));
      }
      return;
    }
    for(let i=0;i<8;i++){
      const a=seed+i*0.785,rad=5+age*(17+(i%3)*7),px=fx.x+Math.sin(a)*rad,pz=fx.z+Math.cos(a)*rad,py=ground+10+(i%4)*8+age*(27+(i%3)*12),scale=1-age*.24;
      b.at(px,py,pz,scale,a+time*(1.5+i*.13),()=>{
        if(type==='crystal')b.cone(0,0,0,3.5+(i%3),1,10+(i%4)*3,base,5,.25+.35*fade);
        else if(type==='biomass')b.sphere(0,0,0,4+(i%3),3+(i%2),3+(i%4)*.5,base,7,4,.2+.3*fade);
        else b.roundedBox(0,0,0,6+(i%3)*2,7+(i%2)*3,5+(i%4),1.2,dark,.2+.35*fade);
      });
    }
  }
  function treeModel(b,d,p){
    const y=heightAt(d.x,d.z,p);shadow(b,d.x,y,d.z,36*d.s,p);
    b.at(d.x,y,d.z,d.s,d.a,()=>{
      if(p.id==='nix'||p.id==='prisma'){b.cone(0,0,0,20,15,100,p.id==='nix'?'#8faac5':'#ad8dcd',5);b.cone(0,100,0,15,0,43,p.light,5);b.cone(20,0,7,13,0,80,p.color,5);}
      else if(d.kind===0){b.cone(0,0,0,8,5,92,'#849889',12);b.sphere(0,86,0,46,8,44,tint(p.flora,.83),18,8);b.sphere(0,100,0,49,21,48,p.flora,20,12);b.sphere(-14,116,6,12,3,11,p.light,10,5);b.sphere(15,118,-10,8,3,8,p.light,10,5);}
      else if(d.kind===1){b.cone(0,0,0,9,4,73,'#788e76',7);b.sphere(0,86,0,41,40,40,p.flora,8,5);b.sphere(-23,74,5,25,29,27,tint(p.flora,.88),8,5);b.sphere(26,93,-9,29,26,29,p.light,8,5);}
      else{for(let i=0;i<5;i++){const a=i/5*TAU;b.tube([0,0,0],[Math.sin(a)*20,40+i%2*13,Math.cos(a)*20],3,1,p.flora,4);b.sphere(Math.sin(a)*20,40+i%2*13,Math.cos(a)*20,8,16,8,p.light,6,4);}}
    });
  }
  function astronautModel(b,time,moving){
    const step=moving?Math.sin(time*12)*5:0;
    b.roundedBox(-8,8+step,0,10,17,13,3,'#b8c9ca');b.roundedBox(8,8-step,0,10,17,13,3,'#d8e2db');
    b.roundedBox(0,30,0,29,30,21,5,'#e8ece2');b.roundedBox(0,33,-16,21,24,12,3,'#93ad9e');b.box(0,37,-23,13,8,2,'#c0ec94',.4);
    b.tube([-19,38,0],[-22,19,-step],5,5,'#d7e3d5',7);b.tube([19,37,0],[22,22,step],5,5,'#edf2e5',7);
    b.sphere(0,56,0,21,21,20,'#f1f3e8',24,14);b.sphere(0,57,15,16,12,9,'#367d91',24,14,.18);b.box(-4,62,23,13,2,1,'#b6eeeb',.6);b.box(0,37,11.1,13,8,2,'#66857e');b.box(1,38,12.5,4,3,1,'#bff28d',.5);
    b.tube([24,23,8],[24,26,24],4,2,'#759b9f',6);
  }
  function spaceshipModel(b,time,space,moving){
    // PioneerEX7-Mesh-v4: reference-modelled solid 3D geometry, +Z is forward.
    // Terralink Pioneer EX-7 / heavy industrial survey lander.
    const C={ivory:'#c9c7be',white:'#e0ddd2',edge:'#969b96',dark:'#20272b',metal:'#465055',rubber:'#11191d',glass:'#17272e',orange:'#d97627',light:'#ffbd61',rust:'#736253'};
    const TAU=Math.PI*2;
    const part=(name,fn)=>b.part?b.part(name,fn):fn();
    const mix=(a,c,t)=>a.map((n,i)=>n+(c[i]-n)*t);
    const unit=v=>{const d=Math.hypot(...v)||1;return v.map(n=>n/d);};
    const cross=(a,c)=>[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];
    const plate=(points,color,edge=1.3)=>{b.quad(...points,color);for(let i=0;i<4;i++)b.tube(points[i],points[(i+1)%4],edge,edge,C.edge,6);};
    const loft=(sections,color)=>{
      const loop=([z,w,bottom,top,bevel])=>[[-w+bevel,bottom,z],[w-bevel,bottom,z],[w,bottom+bevel,z],[w,top-bevel,z],[w-bevel,top,z],[-w+bevel,top,z],[-w,top-bevel,z],[-w,bottom+bevel,z]];
      const rings=sections.map(loop);
      for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8;b.quad(rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i],color);}
      for(const [j,flip]of[[0,true],[rings.length-1,false]]){const r=rings[j],center=[0,(sections[j][2]+sections[j][3])/2,sections[j][0]];for(let i=0;i<8;i++){const k=(i+1)%8;b.tri(center,r[flip?k:i],r[flip?i:k],color);}}
    };
    const annulus=(x,y,z,outer,inner,color,emission=0)=>{
      for(let i=0;i<32;i++){const a=i/32*TAU,c=(i+1)/32*TAU;const pt=(r,t)=>[x+Math.cos(t)*r,y+Math.sin(t)*r,z];b.quad(pt(outer,a),pt(outer,c),pt(inner,c),pt(inner,a),color,emission);}
    };
    const barrel=(x,y,z0,z1,r0,r1,color,segments=32)=>{
      for(let i=0;i<segments;i++){const a=i/segments*TAU,c=(i+1)/segments*TAU,pt=(z,r,t)=>[x+Math.cos(t)*r,y+Math.sin(t)*r,z],slope=(r0-r1)/(z1-z0),na=unit([Math.cos(a),Math.sin(a),slope]),nc=unit([Math.cos(c),Math.sin(c),slope]);
        const p=pt(z0,r0,a),q=pt(z0,r0,c),r=pt(z1,r1,c),s=pt(z1,r1,a);b.tri(p,q,r,color,0,[na,nc,nc]);b.tri(p,r,s,color,0,[na,nc,na]);}
    };
    const glyphs={T:['11111','00100','00100','00100','00100','00100','00100'],E:['11111','10000','10000','11110','10000','10000','11111'],R:['11110','10001','10001','11110','10100','10010','10001'],A:['01110','10001','10001','11111','10001','10001','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],I:['111','010','010','010','010','010','111'],N:['10001','11001','11001','10101','10011','10011','10001'],K:['10001','10010','10100','11000','10100','10010','10001'],P:['11110','10001','10001','11110','10000','10000','10000'],O:['01110','10001','10001','10001','10001','10001','01110'],X:['10001','10001','01010','00100','01010','10001','10001'],'7':['11111','00001','00010','00100','01000','01000','01000'],'-':['000','000','000','111','000','000','000']};
    const lettering=(word,sign,x,y,z,scale)=>{let offset=0;for(const ch of word){const g=glyphs[ch];if(!g){offset+=3*scale;continue;}for(let row=0;row<7;row++)for(let col=0;col<g[row].length;col++)if(g[row][col]==='1')b.box(sign*x,y-row*scale,z-sign*(offset+col*scale),.18,scale*.8,scale*.8,C.dark);offset+=(g[0].length+1)*scale;}};
    part('Armoured fuselage',()=>{
      loft([[-88,39,35,84,7],[-62,52,31,95,7],[35,52,32,99,7],[57,48,33,99,7]],C.ivory);
      b.roundedBox(0,33,-15,91,12,137,3,C.dark);b.roundedBox(0,27,12,70,10,89,3,C.metal);
      b.roundedBox(0,97,-18,84,5,100,2,C.white);
      for(const sign of[-1,1]){
        b.roundedBox(sign*52.2,68,-8,3,44,78,1,C.dark);
        for(let i=0;i<3;i++)b.roundedBox(sign*54,69,-33+i*27,3.2,39,25,1,C.ivory);
        b.box(sign*55.7,85,-6,1,2.5,73,C.orange);
        for(const z of[-43,-18,10,28])for(const y of[52,84])b.sphere(sign*56.1,y,z,.8,.8,.8,C.metal,6,4);
        b.roundedBox(sign*53.3,64,39,3.5,28,18,1,C.dark);
        for(let i=0;i<6;i++)b.box(sign*55.3,54+i*3.5,39,.5,1.5,13,C.metal);
        b.roundedBox(sign*43,43,-71,20,22,24,2,C.metal);
        b.box(sign*55.8,60,21,.6,13,8,C.dark);b.box(sign*56.3,61,21,.4,8,3,C.orange);
        lettering('TERRALINK',sign,55.85,77,22*sign,.72);
        lettering('EX-7',sign,55.85,66,20*sign,.5);
      }
      for(const x of[-26,26]){b.tube([x,28,-74],[x,28,40],8,8,C.metal,16);for(const z of[-58,-21,24])b.tube([x,28,z-2],[x,28,z+2],8.7,8.7,C.edge,16);}
    });
    part('Faceted cockpit and canopy',()=>{
      loft([[44,51,34,100,8],[86,47,33,99,7],[124,35,35,55,5],[136,29,38,50,4]],C.white);
      // Panes follow the actual sloping shell; narrow frames keep the glass area large.
      const rowTop=[[-39,99.6,86],[39,99.6,86]],rowBottom=[[-29.5,56.2,123.5],[29.5,56.2,123.5]];
      for(let col=0;col<3;col++){
        const u0=col/3+.018,u1=(col+1)/3-.018;
        const a=mix(rowBottom[0],rowBottom[1],u0),d=mix(rowTop[0],rowTop[1],u0),bb=mix(rowBottom[0],rowBottom[1],u1),c=mix(rowTop[0],rowTop[1],u1);
        plate([a,bb,c,d],C.glass,1.15);
        const t0=mix(d,a,.12),t1=mix(c,bb,.12),t2=mix(c,bb,.2),t3=mix(d,a,.2);for(const v of[t0,t1,t2,t3]){v[1]+=.18;v[2]+=.14;}b.quad(t0,t1,t2,t3,'#37454a',.08);
      }
      for(let col=0;col<3;col++){
        const x0=-38+col*25.5,x1=x0+22.5;
        plate([[x0,100.5,51],[x1,100.5,51],[x1,99.7,83],[x0,99.7,83]],'#26353b',.9);
      }
      for(const sign of[-1,1]){
        const sidePoint=(z,y,offset=.6)=>[sign*((z<=86?51-(z-44)*4/42:47-(z-86)*12/38)+offset),y,z];
        const side=[[sidePoint(51,60),sidePoint(82,58),sidePoint(82,89),sidePoint(51,91)],[sidePoint(89,55),sidePoint(119,42),sidePoint(119,52),sidePoint(89,86)]];
        for(const q of side)plate(q,C.glass,1.1);
        // Broad lower cheek armour and orange survey markings.
        const q=[sidePoint(60,37),sidePoint(118,37),sidePoint(118,41),sidePoint(60,55)];plate(q,C.ivory,.6);
        b.quad(sidePoint(66,40.8,.9),sidePoint(113,38.7,.9),sidePoint(113,41.7,.9),sidePoint(66,44,.9),C.orange);
        b.quad([sign*45.7,57,49],[sign*45.7,75,49],[sign*45.7,75,45],[sign*45.7,57,45],C.dark);
        for(const y of[40,49])b.sphere(sign*43.8,y,88,.85,.85,.85,C.edge,6,4);
      }
      b.roundedBox(0,45,134,63,17,11,3,C.dark);
      for(const sign of[-1,1]){
        b.roundedBox(sign*23,49.5,141,15,5,2,1,C.edge);b.box(sign*23,49.5,142.2,11.7,2.3,.8,'#fff1d2',1);
        b.roundedBox(sign*27,40.5,135,8,4,5,1,C.metal);b.box(sign*27,40.7,138,5,1.6,.6,C.light,.9);
        b.tube([sign*16,33,132],[sign*16,33,142],3.8,3.8,C.edge,12);b.sphere(sign*16,33,143,2.2,2.2,.8,C.glass,10,6);
      }
      b.roundedBox(0,40.7,141,22,7,3,1,C.rubber);
      for(const x of[-7,0,7])b.box(x,40.8,143,2.4,4,.5,C.metal);
    });
    part('Side cargo and service equipment',()=>{
      for(const sign of[-1,1]){
        b.roundedBox(sign*70,49,-38,36,41,58,4,C.white);
        b.roundedBox(sign*70,50,-72,31,32,15,3,C.ivory);
        b.roundedBox(sign*68,43,27,25,25,65,3,C.ivory);
        for(const z of[-61,-16,3,40]){b.box(sign*69,56,z,25,2.2,2.5,C.orange);b.box(sign*81.6,44,z,2.2,24,2.5,C.orange);}
        for(const z of[-56,-24,9,45]){
          b.roundedBox(sign*88.3,50,z>0?z-24:z,2.4,15,9,1,C.dark);
          b.box(sign*89.6,50,z>0?z-24:z,.6,9,3,C.metal);
        }
        b.roundedBox(sign*66,30,18,24,10,71,2,C.dark);
        b.tube([sign*75,34,4],[sign*75,34,50],8,8,C.metal,16);
        annulus(sign*75,34,51,8.3,6.1,C.edge);b.tube([sign*75,34,48],[sign*75,34,52],5.5,5.5,C.dark,16);
        b.tube([sign*52,62,-29],[sign*71,62,-18],2.2,2.2,C.metal,10);
        b.tube([sign*59,32,0],[sign*68,32,12],2,2,C.edge,10);
      }
    });
    part('Twin armoured engines',()=>{
      for(const sign of[-1,1]){
        const x=sign*63,y=93;
        b.roundedBox(sign*51,76,-63,26,17,61,3,C.dark);
        barrel(x,y,-122,-39,29,29,C.metal);
        // Individual outer armour sectors leave dark panel seams around the nacelle.
        for(let band=0;band<3;band++)for(let i=0;i<12;i++){
          const a=i/12*TAU+.026,c=(i+1)/12*TAU-.026,z0=-116+band*23,z1=z0+21,r=29.7;
          const pt=(t,z)=>[x+Math.cos(t)*r,y+Math.sin(t)*r,z];b.quad(pt(a,z0),pt(c,z0),pt(c,z1),pt(a,z1),i%3?C.ivory:C.white);
          const t=(a+c)/2;b.sphere(x+Math.cos(t)*30,y+Math.sin(t)*30,z0+3,.8,.8,.8,C.dark,6,4);
        }
        barrel(x,y,-49,-45,30.5,30.5,C.orange);barrel(x,y,-44,-35,30.6,30.6,C.dark);annulus(x,y,-34.8,30.7,26,C.edge);
        barrel(x,y,-55,-34.5,23,26,C.dark);annulus(x,y,-34.4,27,25,C.metal);
        b.tube([x,y,-57],[x,y,-55],23,23,C.rubber,28);
        for(let j=-2;j<=2;j++){const yy=y+j*5,w=12-Math.abs(j)*1.8;b.box(x,yy,-53.6,w,2.5,.9,C.light,.95);b.box(x+14,yy,-51.7,2.1,2.9,.8,C.orange,.65);}
        // Raised intake ribs and a dark, open rear bell.
        for(let i=0;i<12;i++){const a=i/12*TAU;b.tube([x+Math.cos(a)*25.5,y+Math.sin(a)*25.5,-34],[x+Math.cos(a)*22,y+Math.sin(a)*22,-54],.7,.7,C.metal,6);}
        barrel(x,y,-121,-130,29,25.5,C.dark);annulus(x,y,-130.3,25.8,20.8,C.edge);barrel(x,y,-130,-112,21,17,C.metal);
        b.tube([x,y,-114],[x,y,-115],16.5,16.5,C.rubber,24);annulus(x,y,-126,16.5,14.6,C.orange,.45);
        for(let j=-2;j<=2;j++)b.box(x,y+j*4.7,-124,11-Math.abs(j),1.8,.5,C.light,.95);
        barrel(x,y,-108,-104,30.4,30.4,C.orange);
        // Tall swept fins with thickness, orange paint and corner rivets.
        const xa=sign*62,xb=sign*67,v=[[xa,117,-109],[xa,152,-105],[xa,158,-84],[xa,120,-48],[xb,117,-109],[xb,152,-105],[xb,158,-84],[xb,120,-48]];
        for(const f of[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])b.quad(...f.map(i=>v[i]),C.metal);
        b.quad([sign*67.3,149,-100],[sign*67.3,151,-91],[sign*67.3,124,-67],[sign*67.3,121,-78],C.orange);
        for(const z of[-101,-90])b.sphere(sign*68,150,z,.85,.85,.85,C.edge,6,4);
      }
    });
    part('Roof hatch and communications',()=>{
      b.cone(-16,99,-16,18,18,3,C.dark,32);b.ring(-16,102.2,-16,15,2,C.orange,.1);b.cone(-16,102.4,-16,13,13,2,C.edge,24);
      for(const x of[-27,-5])b.box(x,105,-16,3,2,8,C.dark);
      for(const sign of[-1,1]){
        b.tube([sign*33,99,-48],[sign*33,99,38],1.5,1.5,C.metal,8);
        for(const z of[-40,-8,30])b.box(sign*33,99.7,z,4,2,3,C.dark);
        b.roundedBox(sign*27,99,38,11,3,13,1,C.dark);
      }
      b.roundedBox(0,100,-61,30,4,20,1,C.dark);for(let i=0;i<8;i++)b.box(-12+i*3.5,103,-61,1.2,1.2,17,C.edge);
      const x=13,z=14;
      b.roundedBox(x,102,z,22,8,25,2,C.dark);b.cone(x,106,z,7,6,32,C.metal,16);b.cone(x,138,z,4,3,34,C.dark,12);b.cone(x,172,z,1.4,.6,33,C.edge,10);
      for(const yy of[113,125,138,155,171])b.cone(x,yy,z,yy<145?7.5:4.8,yy<145?7.5:4.8,2.5,C.dark,12);
      b.tube([x-8,106,z+2],[x-8,184,z+2],1.2,.55,C.edge,8);b.tube([x+6,108,z-5],[x+6,162,z-5],2.5,2,C.metal,10);
      b.box(x-6.5,125,z+7,3.3,10,2,C.orange);b.box(x,146,z+4,2,6,1,C.light,.5);
      b.tube([x-9,112,z-4],[x-9,139,z-4],1,1,C.rubber,6);
      // A concave tilted parabolic dish, not a flat cone.
      const c=[-24,122,16],n=unit([-.25,.5,.82]),u=unit(cross([0,1,0],n)),v=cross(n,u),radius=18,depth=5.8;
      b.tube([-24,100,13],[-24,119,13],2.8,2.3,C.metal,12);b.sphere(-24,119,13,4,4,4,C.dark,12,7);
      const point=(r,a)=>c.map((p,k)=>p+u[k]*Math.cos(a)*r+v[k]*Math.sin(a)*r+n[k]*depth*(r*r/(radius*radius)-1));
      for(let j=0;j<5;j++)for(let i=0;i<32;i++){
        const a=i/32*TAU,aa=(i+1)/32*TAU,r0=radius*j/5,r1=radius*(j+1)/5;
        if(j)b.tri(point(r0,a),point(r1,aa),point(r0,aa),C.edge);b.tri(point(r0,a),point(r1,a),point(r1,aa),C.edge);
        if(j===4)b.tube(point(r1,a),point(r1,aa),.65,.65,C.dark,6);
      }
      const feed=c.map((p,k)=>p+n[k]*10);
      for(const a of[0,TAU/3,TAU*2/3])b.tube(point(radius*.9,a),feed,.6,.6,C.dark,6);b.sphere(...feed,1.8,1.8,1.8,C.dark,10,6);
    });
    part(space?'Retracted landing hinges':'Articulated landing gear',()=>{
      for(const sign of[-1,1])for(const z of[-67,90]){
        const x=sign*(z>0?35:63),knee=[x+sign*12,20,z+5],foot=[x+sign*19,5,z+14];
        b.tube([x-4,32,z],[x+4,32,z],5.8,5.8,C.dark,12);
        if(space){b.roundedBox(x,29,z,18,5,23,2,C.metal);continue;}
        b.tube([x,34,z],knee,4.5,4,C.dark,12);b.sphere(...knee,5,5,5,C.metal,12,7);b.tube(knee,foot,3.6,3.6,C.metal,12);
        b.tube([x+sign*6,33,z-5],[foot[0],10,foot[2]-6],2.5,2.5,C.edge,10);b.tube([x+sign*6,33,z-5],[knee[0],19,knee[2]-3],3.5,3.5,C.dark,10);
        b.roundedBox(foot[0],3.5,foot[2],27,6,31,2,C.dark);b.roundedBox(foot[0],7,foot[2],20,2,23,1,C.edge);
        for(let i=-2;i<=2;i++)b.box(foot[0]+i*4.4,8.2,foot[2],1.5,1.4,23,C.metal);
        b.box(knee[0]+sign*3.8,19,knee[2],1.5,4,4,C.orange);
      }
    });
    part('Fasteners and weathered armour',()=>{
      // Small deterministic paint chips are geometry; no network textures are needed.
      let seed=712;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      for(const sign of[-1,1])for(let i=0;i<42;i++){
        const z=-43+random()*67,y=50+random()*36,x=sign*55.9,w=.5+random()*1.4,h=.4+random()*1.7;
        b.quad([x,y,z],[x,y+h,z+.2],[x,y+h*.8,z+w],[x,y,z+w*.6],i%3?C.rust:C.edge);
      }
      for(let i=0;i<45;i++){const x=(random()-.5)*70,z=-60+random()*100;b.box(x,100.2,z,.4+random()*2,.15,.4+random()*3,i%4?C.edge:C.rust);}
      for(const sign of[-1,1])for(const z of[-53,-24,7,33]){b.sphere(sign*40,100.7,z,.85,.6,.85,C.dark,6,4);b.box(sign*48,93,z,3,1,2,C.orange);}
    });
    if(space&&moving)for(const sign of[-1,1]){
      const reach=42+Math.sin(time*40)*6;b.tube([sign*63,93,-131],[sign*63,93,-131-reach],10,0,'#ffb351',16,1);b.tube([sign*63,93,-131],[sign*63,93,-151],4,0,'#fff1d6',12,1);
    }
  }
  spaceshipModel.info={id:'PioneerEX7-Mesh-v4',name:'Terralink Pioneer EX-7',forwardAxis:'+Z',thrusters:[[-63,93,-131],[63,93,-131]],unitsPerMetre:28.57};
  function lifeModel(b,id,time,met){
    const s=SPECIES[id],bob=Math.sin(time*2.6)*2;
    if(['moth','sunwhorl','aurorayne','cinderwisp','veilfox'].includes(s.shape)){
      const y=46+bob;
      b.sphere(0,y,0,13,20,12,s.color,9,6,.4);
      if(s.shape==='moth')for(const sign of[-1,1]){
        const lift=Math.sin(time*4)*9;
        b.tube([sign*6,y,0],[sign*42,y+lift+14,-5],7,18,s.color,6,.25);
        b.sphere(sign*34,y+lift+12,-3,24,4,21,'#90d8c3',8,4,.5);
        b.sphere(sign*32,y+lift+14,7,9,2,8,'#e5fff1',7,4,.8);
        b.tube([sign*5,y+15,4],[sign*12,y+34,8],1.2,.5,s.dark,5);
      }
      if(s.shape==='sunwhorl'){
        b.ring(0,y-9,0,27,3,s.dark,.8);b.ring(0,y+17,0,33,2,s.color,1);
        for(let i=0;i<6;i++){const a=time*1.4+i/6*TAU;b.sphere(Math.cos(a)*33,y+8,Math.sin(a)*33,4,7,4,'#fff1b7',5,4,1);}
      }
      if(s.shape==='aurorayne'){
        b.sphere(0,24,-13,17,15,25,s.color,10,6,.2);
        for(const sign of[-1,1]){b.tube([sign*8,y+13,0],[sign*16,y+46,-6],2,1,'#a6f9ed',5,.7);b.tube([sign*13,y+31,-3],[sign*29,y+40,-6],2,.2,'#d2a9ff',5,.8);for(const z of[-26,0])b.tube([sign*10,26,z],[sign*12,2,z],3,2,s.dark,5);}
      }
      if(s.shape==='cinderwisp'){
        b.ring(0,y+27,0,22,3,'#ffb677',1);
        for(let i=0;i<5;i++){const a=time*2+i/5*TAU;b.tube([0,y-12,0],[Math.sin(a)*18,8+Math.cos(a)*5,Math.cos(a)*18],3,0,'#e77f68',5,.8);}
      }
      if(s.shape==='veilfox'){
        b.sphere(0,23,-10,17,16,29,s.color,9,5,.2);
        for(const sign of[-1,1]){b.cone(sign*10,y+11,-1,7,0,23,s.dark,5,.2);b.sphere(sign*10,5,0,5,6,9,s.dark,6,4);}
        for(let i=0;i<3;i++)b.tube([0,25,-29],[Math.sin(time*2+i)*24,43+i*10,-57-i*9],9,1,i%2?'#aa90e0':'#ddd3ff',7,.55);
      }
      for(const sign of[-1,1])b.sphere(sign*5,y+3,11,2,3,2,'#214753',6,4);
    }else if(s.shape==='crab'){
      b.sphere(0,22,0,26,16,20,s.color,10,5);for(const sign of[-1,1])for(let i=0;i<3;i++){b.tube([sign*16,19,i*12-12],[sign*35,7+Math.sin(time*4+i)*2,i*16-16],3,2,s.dark,5);}
      for(const sign of[-1,1]){b.tube([sign*9,29,12],[sign*10,40,14],3,3,s.color,6);b.sphere(sign*10,41,17,3,4,3,'#214650',6,4);b.sphere(sign*31,24,23,8,6,8,s.color,7,4);}
    }else{
      const floating=s.shape==='float',y=floating?41+bob*2:24+Math.abs(bob);
      b.sphere(0,y,0,22,25,20,s.color,s.shape==='prism'?5:20,12,floating?.12:0,s.shape!=='prism');
      if(s.shape==='sprout'){b.tube([0,y+20,0],[0,y+38,0],2,1,s.dark,5);b.sphere(-8,y+36,0,10,3,5,'#a0d58b',7,4);b.sphere(7,y+42,0,10,4,6,'#d1f195',7,4);}
      if(s.shape==='fluff')for(const side of[-1,1])b.sphere(side*13,y+27,0,6,19,7,s.color,8,5);
      if(s.shape==='flame'){b.cone(-7,y+18,-3,8,0,26+Math.sin(time*5)*4,'#ffc180',5,.5);b.cone(5,y+18,0,9,0,35,'#ffe0a4',5,.4);}
      if(s.shape==='prism'){b.cone(-12,y+15,-2,6,0,20,'#e8ceff',5,.5);b.cone(6,y+16,-5,9,0,28,'#e4c9ff',5,.5);}
      if(!floating){b.sphere(-12,5,4,7,5,8,s.dark,7,4);b.sphere(12,5,4,7,5,8,s.dark,7,4);}else for(let i=0;i<3;i++)b.tube([i*9-9,y-18,0],[i*9-9+Math.sin(time*3+i)*4,y-34,0],2,1,s.color,5,.3);
      for(const sign of[-1,1]){b.sphere(sign*8,y+4,18.5,2.5,4,2.5,'#244554',7,5);b.sphere(sign*8-.5,y+5.5,20.5,1,1.5,1,'#efffee',5,4,.3);}
      b.box(0,y-4,20,5,1.5,1,s.dark);
    }
    if(met)b.sphere(0,100,0,3,3,3,'#c7f5a3',7,4,1);
  }
  function buildingModel(b,type,t){
    if(type==='habitat'){
      b.roundedBox(0,4,0,115,8,103,3,'#739889');b.roundedBox(0,37,0,91,62,79,6,'#dce7d7');b.roundedBox(0,71,0,101,9,91,4,'#83aeb0');b.roundedBox(0,77,0,86,4,77,1.8,'#aec9bc');
      b.box(18,28,40,24,47,3,'#396972');b.box(27,25,42,3,3,2,'#d7efa9',.7);b.box(-23,44,40,25,18,3,'#73b5c4',.2);b.box(-46,42,0,2,21,41,'#5c97a4',.1);b.box(46,42,0,2,21,42,'#5895a0',.1);
      b.box(0,10,51,108,3,3,'#c3ef9d',.8);b.box(17,2,61,30,4,25,'#91aa96');b.box(17,6,55,28,4,13,'#bacfb1');b.tube([-31,73,-25],[-31,98,-25],2,1,'#b4d2c0',5);b.sphere(-31,98,-25,3,3,3,'#c6f6a4',7,4,.8);
    }else if(type==='solar'){
      for(const side of[-1,1]){b.box(side*33,19,0,6,38,6,'#a7c5b7');b.box(side*31,41,0,56,5,78,'#456985');for(let i=0;i<4;i++)for(let j=0;j<4;j++)b.box(side*31-21+i*14,44,-29+j*19,12,1,16,(i+j)%2?'#3b6383':'#37597c');}
      b.box(0,9,0,36,18,34,'#b9d2bc');b.box(0,17,19,17,5,2,'#bff188',.7);
    }else{
      b.cone(0,0,0,27,22,9,'#9cc1b0',10);b.cone(0,8,0,4,3,91,'#b0cabb',7);b.cone(0,80,0,16,9,9,'#85aeb4',8);b.sphere(0,104,0,9,8,9,'#ceffa0',10,7,.9);b.ring(0,91,0,14,2,'#d4fbbb',1);
    }
  }
  function terrainBatch(p){
    const b=new Batch(),random=rand(p.seed+900),step=50,limit=TERRAIN_LIMIT,grid=[];
    for(let z=-limit;z<=limit;z+=step){const row=[];for(let x=-limit;x<=limit;x+=step)row.push({p:[x,heightAt(x,z,p),z],n:terrainNormal(x,z,p),c:terrainColor(x,z,p)});grid.push(row);}
    for(let z=0;z<grid.length-1;z++)for(let x=0;x<grid[z].length-1;x++){const a=grid[z][x],bb=grid[z][x+1],c=grid[z+1][x+1],d=grid[z+1][x];b.tri(a.p,c.p,bb.p,a.c,0,[a.n,c.n,bb.n],[a.c,c.c,bb.c]);b.tri(a.p,d.p,c.p,a.c,0,[a.n,d.n,c.n],[a.c,d.c,c.c]);}
    // Soft overlapping silhouettes blend into the planet's atmospheric horizon.
    for(let i=0;i<28;i++){const a=i/28*TAU,r=(TERRAIN_LIMIT-100)+random()*100,h=120+random()*180,w=160+random()*190;b.sphere(Math.sin(a)*r,-65,Math.cos(a)*r,w,h,w*.85,tint(p.ground[2],.88+random()*.17),24,14);}
    for(let i=0;i<125;i++){const x=(random()-.5)*2650*SURFACE_MAP_SCALE,z=(random()-.5)*2650*SURFACE_MAP_SCALE;if(Math.hypot(x,z)<340)continue;treeModel(b,{x,z,s:.55+random()*.9,a:random()*TAU,kind:Math.floor(random()*3)},p);}
    for(let i=0;i<550;i++){const x=(random()-.5)*2850*SURFACE_MAP_SCALE,z=(random()-.5)*2850*SURFACE_MAP_SCALE;if(Math.hypot(x,z)<160)continue;const y=heightAt(x,z,p);b.cone(x,y,z,2.4,0,7+random()*9,tint(p.flora,.8),3);}
    const ground=heightAt(0,0,p);b.cone(0,ground,0,113,113,1.4,tint(p.ground[4],1.04),48);b.ring(0,ground+1.6,0,103,1.2,'#b9d7a1',.15);
    for(let i=0;i<8;i++){const a=i/8*TAU;b.box(Math.sin(a)*109,ground+2.5,Math.cos(a)*109,4,3,4,'#d7f6b5',.6);}
    shadow(b,0,ground,0,87,p);b.at(0,ground+2,0,1,Math.PI,()=>spaceshipModel(b,0,false,false));
    // A visible moon is geometry in the same scene, without downloaded textures.
    b.sphere(-980,690,-1470,285,285,285,tint(p.light,.74),40,24,.55);
    return b.array();
  }
  function spaceBatch(){
    const b=new Batch();
    for(const p of PLANETS){
      b.sphere(p.x,0,p.y,p.r,p.r,p.r,p.color,40,24,.06);
      const r=rand(p.seed);for(let j=0;j<12;j++){const theta=r()*TAU,phi=Math.acos(r()*2-1),v=[Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)],rr=p.r*(.08+r()*.12);b.sphere(p.x+v[0]*(p.r-rr*.08),v[1]*(p.r-rr*.08),p.y+v[2]*(p.r-rr*.08),rr,rr*.7,rr,p.id==='verdant'?p.dark:p.light,8,5,.06);}
      if(p.id==='prisma')b.ring(p.x,0,p.y,p.r*1.4,p.r*.2,'#9a83bb',.4);
    }
    const r=rand(7706);for(let i=0;i<200;i++){const x=(r()-.5)*5200,y=(r()-.5)*3600,z=(r()-.5)*5200;b.sphere(x,y,z,1.5,1.5,1.5,'#d6e7ec',5,3,1);}
    return b.array();
  }
  class Renderer{
    constructor(canvas,radar,game){
      this.canvas=canvas;this.radar=radar;this.rc=radar.getContext('2d');this.game=game;this.engine=new GLScene(canvas);this.width=1;this.height=1;this.mode=game.state.mode;this.planetId=null;this.camera={x:game.state.player.x,y:game.state.player.y};this.yaw=.24;this.pitch=.58;this.distance=420;this.firstPerson=false;this.mouse=null;this.particles=[];this.breakAnimations=[];this.objectKey='';this.shake=0;this.flash=0;this.transition=0;this.jumpHeight=0;this.jumpVelocity=0;this.speed=0;this.time=0;
      this.immersive=!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);this.intensity=.5;this.haptics=false;
      this.targetYaw=this.yaw;this.targetPitch=this.pitch;this.targetDistance=this.distance;this.resolution=1;this.frameMs=16.7;this.qualityTimer=0;this.radarTimer=0;
      try{const s=JSON.parse(localStorage.getItem('orbit-immersive-settings')||'null');if(s){this.immersive=typeof s.enabled==='boolean'?s.enabled:this.immersive;this.intensity=clamp(Number(s.intensity)||0,0,1);this.haptics=!!s.haptics;}}catch(e){}
      this.fx=document.createElement('canvas');this.fx.className='fx-canvas';this.fx.setAttribute('aria-hidden','true');canvas.after(this.fx);this.fc=this.fx.getContext('2d');
      this.stars=Array.from({length:85},(_,i)=>{const r=rand(i*61+51);return{a:r()*TAU,r:r(),speed:r()*.8+.3};});
      this.engine.upload('space',spaceBatch());this.resize();this.updateCamera(0);
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.game.paused=true;this.game.emit('message',{text:'3D 그래픽 연결이 끊겼어요. 새로고침하면 저장 기록에서 이어집니다.',error:true});});
    }
    settings(){return{enabled:this.immersive,intensity:this.intensity,haptics:this.haptics};}
    storeSettings(){try{localStorage.setItem('orbit-immersive-settings',JSON.stringify(this.settings()));}catch(e){}}
    setImmersive(v){this.immersive=!!v;if(!v){this.shake=0;this.flash=0;this.speed=0;this.stopHaptics();}this.storeSettings();}
    stopHaptics(){if(root.navigator?.vibrate)try{root.navigator.vibrate(0);}catch(e){}}
    pulse(pattern){if(this.immersive&&this.haptics&&root.navigator?.vibrate)try{root.navigator.vibrate(pattern);}catch(e){}}
    resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);this.dpr=Math.min(root.devicePixelRatio||1,1.5)*this.resolution;for(const c of[this.canvas,this.fx]){c.width=Math.round(this.width*this.dpr);c.height=Math.round(this.height*this.dpr);}this.zoom=1;}
    reset(){this.camera={...(this.game.state.mode==='surface'?this.game.state.player:this.game.state.ship)};this.planetId=null;this.objectKey='';this.particles=[];this.breakAnimations=[];this.jumpHeight=0;this.jumpVelocity=0;this.mouse=null;this.updateCamera(0);}
    input(keys){const x=(keys.right?1:0)-(keys.left?1:0),z=(keys.down?1:0)-(keys.up?1:0),co=Math.cos(this.yaw),si=Math.sin(this.yaw);return{...keys,dx:co*x+si*z,dy:-si*x+co*z};}
    orbit(dx,dy){this.targetYaw-=dx*.005;this.targetPitch=clamp(this.targetPitch+dy*.004,this.firstPerson?-.85:.16,this.firstPerson?.85:1.35);}
    zoomBy(delta){if(this.firstPerson)return;this.targetDistance=clamp(this.targetDistance+delta*.35,210,770);}
    toggleView(){this.firstPerson=!this.firstPerson;this.targetPitch=this.pitch=this.firstPerson?.08:.58;this.updateCamera(0);return this.firstPerson;}
    jump(){if(this.game.paused||this.game.state.mode!=='surface'||this.jumpHeight>0)return;this.jumpVelocity=170;this.jumpHeight=.1;}
    updateCamera(dt){
      const g=this.game,s=g.state,space=s.mode==='space',actor=space?s.ship:s.player;
      if(this.mode!==s.mode){this.mode=s.mode;this.camera={x:actor.x,y:actor.y};this.jumpHeight=0;this.objectKey='';}
      const aim=dt?1-Math.exp(-dt*18):1;this.yaw+=(this.targetYaw-this.yaw)*aim;this.pitch+=(this.targetPitch-this.pitch)*aim;this.distance+=(this.targetDistance-this.distance)*aim;
      const factor=dt?1-Math.exp(-dt*10):1;this.camera.x+=(actor.x-this.camera.x)*factor;this.camera.y+=(actor.y-this.camera.y)*factor;
      const effects=this.immersive?this.intensity:0,ground=space?(s.ship.altitude||0):heightAt(this.camera.x,this.camera.y,g.planet())+this.jumpHeight;
      const bob=g.moving&&!space?Math.sin(s.time*11)*1.3*effects:0;
      let shake=this.shake*effects;const sx=Math.sin(this.time*58)*shake,sy=Math.cos(this.time*72)*shake*.6;
      if(this.firstPerson){this.eye=[actor.x+sx,ground+58+bob+sy,actor.y];const cp=Math.cos(this.pitch);this.target=[this.eye[0]-Math.sin(this.yaw)*cp*100,this.eye[1]-Math.sin(this.pitch)*100,this.eye[2]-Math.cos(this.yaw)*cp*100];}
      else{const distance=space?this.distance*.86:this.distance;this.target=[this.camera.x,ground+38,this.camera.y];this.eye=[this.camera.x+Math.sin(this.yaw)*distance*Math.cos(this.pitch)+sx,ground+38+Math.sin(this.pitch)*distance+bob+sy,this.camera.y+Math.cos(this.yaw)*distance*Math.cos(this.pitch)];}
      this.fov=(61+this.speed*10*effects+(g.travel?Math.sin(g.travel.age/2.4*Math.PI)*19*effects:0))*Math.PI/180;
      const forward=norm(sub(this.target,this.eye));this.forward=forward;this.right=norm(cross(forward,[0,1,0]));this.up=cross(this.right,forward);
      this.vp=multiply(perspective(this.fov,this.width/this.height,.8,6500),lookAt(this.eye,this.target));
    }
    project(x,z,height){
      const y=height===undefined?(this.game.state.mode==='surface'?heightAt(x,z,this.game.planet())+60:0):height,m=this.vp,p=[x,y,z,1];let v=[0,0,0,0];for(let i=0;i<4;i++)for(let j=0;j<4;j++)v[i]+=m[j*4+i]*p[j];if(v[3]<=.5)return{x:-9999,y:-9999,visible:false};return{x:(v[0]/v[3]*.5+.5)*this.width,y:(1-(v[1]/v[3]*.5+.5))*this.height,visible:v[2]/v[3]<1,depth:v[3]};
    }
    unproject(x,y){
      const u=(x/this.width*2-1)*Math.tan(this.fov/2)*this.width/this.height,v=(1-y/this.height*2)*Math.tan(this.fov/2),direction=norm(this.forward.map((n,i)=>n+this.right[i]*u+this.up[i]*v));
      const space=this.game.state.mode==='space',plane=space?(this.game.state.ship.altitude||0):0;
      if(direction[1]>=-.015){const a=space?this.game.state.ship:this.game.state.player;return{x:a.x+direction[0]*260,y:a.y+direction[2]*260};}
      let t=(plane-this.eye[1])/direction[1];if(!space)for(let i=0;i<5;i++){const xx=this.eye[0]+direction[0]*t,zz=this.eye[2]+direction[2]*t;t=(heightAt(xx,zz,this.game.planet())-this.eye[1])/direction[1];}
      t=clamp(t,0,2000);return{x:this.eye[0]+direction[0]*t,y:this.eye[2]+direction[2]*t};
    }
    effect(e){
      const kind=e.kind,force={mine:1.4,break:4.8,collect:1,build:3.5,scan:.6,warp:3,launch:6,land:9,impact:3}[kind]||0;this.shake=Math.max(this.shake,force);this.flash=Math.max(this.flash,kind==='scan'?.1:kind==='warp'?.2:kind==='land'?.16:kind==='break'?.1:.045);
      if(kind==='launch'||kind==='land'){this.transition=1.4;this.pulse(kind==='land'?[60,40,110]:[25,30,45,40,80]);}else if(kind==='warp')this.pulse([30,40,55,60,90]);else if(kind==='mine')this.pulse(20);else if(kind==='break')this.pulse([22,30,18,42]);else if(kind==='build')this.pulse([30,40,60]);
      if(kind==='mine'&&!e.broken)this.startBreakAnimation(e,false);
      if(kind==='break')this.startBreakAnimation(e,true);
      if(['mine','break','collect','build','land','friend','relic','rest'].includes(kind)){
        const origin=kind==='land'?this.game.state.player:e,count=kind==='land'?32:kind==='break'?24:kind==='build'?30:12;
        for(let i=0;i<count&&this.particles.length<180;i++)this.particles.push({x:origin.x,y:heightAt(origin.x,origin.y,this.game.planet())+18,z:origin.y,vx:(Math.random()-.5)*115,vy:45+Math.random()*100,vz:(Math.random()-.5)*115,life:.55+Math.random()*.9,color:e.color||this.game.planet().accent,size:2+Math.random()*3});
      }
    }
    startBreakAnimation(e,destroyed){
      const seed=Math.abs(Math.sin((e.x||0)*.137+(e.y||0)*.193+(this.time+1)*.71))*1000;
      this.breakAnimations.push({x:e.x,z:e.y,color:e.color,nodeType:e.nodeType,rotation:seed%TAU,seed,age:0,duration:destroyed?.82:.38,destroyed});
      if(this.breakAnimations.length>24)this.breakAnimations.shift();
    }
    rebuildObjects(){const g=this.game,w=g.world(),p=g.planet(),key=p.id+'|'+w.nodes.map(n=>n.hp).join('')+'|'+JSON.stringify(w.buildings)+'|'+g.state.relics.join(',');if(key===this.objectKey)return;this.objectKey=key;const b=new Batch();for(const n of w.nodes)if(n.hp>0)resourceModel(b,n,p);for(const h of w.buildings){const y=heightAt(h.x,h.y,p);shadow(b,h.x,y,h.y,BUILDINGS[h.type].radius,p);b.at(h.x,y,h.y,1,0,()=>buildingModel(b,h.type,g.state.time));if(h.type==='habitat')b.box(h.x-23,y+44,h.y+42,24,17,2,h.lit===false?'#243a46':'#f8d3a0',h.lit===false?0:.9);if(h.level===2)b.ring(h.x,y+1.5,h.y,BUILDINGS[h.type].radius+6,2,'#9ae7ed',1);}for(const r of w.relics){const y=heightAt(r.x,r.y,p);b.cone(r.x,y,r.y,31,26,10,p.dark,8);b.cone(r.x,y+10,r.y,16,9,45,g.state.relics.includes(r.id)?p.dark:p.light,5,.25);}this.engine.upload('objects',b.array());}
    drawActors(){
      const g=this.game,s=g.state,p=g.planet(),surface=s.mode==='surface';
      const cached=(key,create,model)=>{if(!this.engine.buffers[key]){const b=new Batch();create(b);this.engine.upload(key,b.array());}this.engine.draw(key,model);};
      if(surface){
        for(const c of g.world().creatures){
          if(dist(c,s.player)>1250)continue;
          const angle=dist(c,s.player)<190?Math.atan2(s.player.x-c.x,s.player.y-c.y):Math.atan2(c.homeX-c.x,c.homeY-c.y);
          const bob=Math.sin(s.time*2.6+c.phase)*(s.companion===c.id?3:1.8);
          cached('life-'+c.species,b=>lifeModel(b,c.species,0,false),modelMatrix(c.x,heightAt(c.x,c.y,p)+bob,c.y,1,angle));
        }
        if(!this.firstPerson){
          // A small repeating pose cache keeps mesh allocation out of the frame loop.
          const phase=g.moving?Math.floor((s.time*12%(TAU))/TAU*24):-1;
          cached('astronaut-'+phase,b=>astronautModel(b,phase<0?0:phase/24*TAU/12,g.moving),modelMatrix(s.player.x,heightAt(s.player.x,s.player.y,p)+this.jumpHeight,s.player.y,1,Math.PI/2-s.player.angle));
        }
      }else if(!this.firstPerson)cached('ship-model',b=>spaceshipModel(b,0,true,false),modelMatrix(s.ship.x,s.ship.altitude||0,s.ship.y,.7,Math.PI/2-s.ship.angle));
    }
    dynamicBatch(dt){
      const b=new Batch(),g=this.game,s=g.state,p=g.planet(),space=s.mode==='space',t=s.time;
      if(!space){
        const w=g.world(),player=s.player,h=heightAt(player.x,player.y,p);shadow(b,player.x,h,player.y,18,p);
        for(const c of w.creatures){if(dist(c,player)>1250)continue;const y=heightAt(c.x,c.y,p);shadow(b,c.x,y,c.y,20,p);if(s.met.includes(c.species))b.sphere(c.x,y+105+Math.sin(t*3)*3,c.y,3,3,3,s.companion===c.id?'#ffbdca':'#c7f5a3',6,4,1);if(s.companion===c.id)b.ring(c.x,y+1,c.y,26,1.5,'#ffd2db',1);}
        for(const r of w.relics)if(!s.relics.includes(r.id)){const y=heightAt(r.x,r.y,p)+72+Math.sin(t*2)*6;b.at(r.x,y,r.y,1,t*.6,()=>{b.cone(0,0,0,10,0,19,p.accent,4,1);b.cone(0,-19,0,0,10,19,p.accent,4,1);});b.ring(r.x,y-28,r.y,25,1,p.light,1);}
        if(g.waypoint){const w=g.waypoint,y=heightAt(w.x,w.y,p);b.tube([w.x,y+70,w.y],[w.x,y+350,w.y],1.2,1,p.accent,5,1);b.ring(w.x,y+2,w.y,42,2,p.accent,1);}
        for(const fx of this.breakAnimations)blockBreakModel(b,fx,p,t);
        const nearest=g.nearest();if(nearest&&nearest.kind!=='ship'){const n=nearest.entity;b.ring(n.x,heightAt(n.x,n.y,p)+1.3,n.y,nearest.kind==='building'?72:35,1.7,p.accent,.8);}
        if(g.beam)b.tube([player.x+Math.cos(player.angle)*15,h+31+this.jumpHeight,player.y+Math.sin(player.angle)*15],[g.beam.x,heightAt(g.beam.x,g.beam.y,p)+24,g.beam.y],1.4,.8,'#e5ffc2',5,1);
        if(g.scanRing){const radius=g.scanRing.age*330;for(let i=0;i<96;i++){const a=i/96*TAU,bb=(i+1)/96*TAU;const x=g.scanRing.x+Math.sin(a)*radius,z=g.scanRing.y+Math.cos(a)*radius,xx=g.scanRing.x+Math.sin(bb)*radius,zz=g.scanRing.y+Math.cos(bb)*radius;b.tube([x,heightAt(x,z,p)+5,z],[xx,heightAt(xx,zz,p)+5,zz],1,1,'#b7f1d1',4,1);}}
        if(g.selectedBuild){const target=this.mouse||{x:player.x+Math.cos(player.angle)*105,y:player.y+Math.sin(player.angle)*105},check=g.canPlace(g.selectedBuild,target.x,target.y),y=heightAt(target.x,target.y,p);b.ring(target.x,y+1,target.y,BUILDINGS[g.selectedBuild].radius+8,3,check.ok?'#c3f379':'#ff9a80',1);b.at(target.x,y,target.y,1,0,()=>buildingModel(b,g.selectedBuild,t));}
        if(g.moveTarget)b.ring(g.moveTarget.x,heightAt(g.moveTarget.x,g.moveTarget.y,p)+1,g.moveTarget.y,10,2,'#e0edcf',.8);
        for(const h of w.buildings)if(h.type==='beacon'){const y=heightAt(h.x,h.y,p);b.ring(h.x,y+80,h.y,18+(t*25)%40,1,'#b6f59a',1);}
      }else{
        const actor=s.ship;if(this.firstPerson){b.at(actor.x,actor.altitude||0,actor.y,.7,this.yaw+Math.PI,()=>{b.box(0,4,25,38,8,55,'#8eb3b5');b.box(-24,10,11,6,15,30,'#456777');b.box(24,10,11,6,15,30,'#456777');});}
        else if(g.moving||g.travel)b.at(actor.x,actor.altitude||0,actor.y,.7,Math.PI/2-actor.angle,()=>{for(const [x,y,z] of spaceshipModel.info.thrusters){b.tube([x,y,z],[x,y,z-38-(g.boosting?36:0)-Math.sin(t*30)*5],9,0,'#ffb351',12,1);b.tube([x,y,z],[x,y,z-20],4,0,'#fff1d6',10,1);}});
      }
      for(let i=this.particles.length-1;i>=0;i--){const v=this.particles[i];if(!g.paused){v.life-=dt;v.x+=v.vx*dt;v.y+=v.vy*dt;v.z+=v.vz*dt;v.vy-=170*dt;}if(v.life<=0){this.particles.splice(i,1);continue;}b.box(v.x,v.y,v.z,v.size,v.size,v.size,v.color,.5);}
      return b.array();
    }
    draw(dt){
      if(this.lost)return;const g=this.game,s=g.state,p=g.planet(),space=s.mode==='space';
      if(!g.paused&&dt>0){this.frameMs+=(dt*1000-this.frameMs)*.04;this.qualityTimer+=dt;if(this.qualityTimer>3){this.qualityTimer=0;const next=this.frameMs>29?Math.max(.7,this.resolution-.1):this.frameMs<19?Math.min(1,this.resolution+.05):this.resolution;if(next!==this.resolution){this.resolution=next;this.resize();}}}
      if(!g.paused){this.time+=dt;this.shake=Math.max(0,this.shake-dt*7);this.flash=Math.max(0,this.flash-dt*.45);this.transition=Math.max(0,this.transition-dt);this.speed+=((g.boosting?1:0)-this.speed)*Math.min(1,dt*3);this.speed=clamp(this.speed,0,1);for(let i=this.breakAnimations.length-1;i>=0;i--){this.breakAnimations[i].age+=dt;if(this.breakAnimations[i].age>=this.breakAnimations[i].duration)this.breakAnimations.splice(i,1);}
        if(this.jumpHeight>0){this.jumpVelocity-=370*dt;this.jumpHeight+=this.jumpVelocity*dt;if(this.jumpHeight<=0){this.jumpHeight=0;this.jumpVelocity=0;this.shake=Math.max(this.shake,1.7);this.pulse(15);}}
      }
      this.updateCamera(dt);
      if(!space){if(this.planetId!==p.id){this.planetId=p.id;this.engine.upload('terrain',terrainBatch(p));this.objectKey='';}this.rebuildObjects();}
      this.engine.begin(this.canvas.width,this.canvas.height,this.vp,this.eye,space,p,s.time,this.yaw);
      if(space)this.engine.draw('space');else{this.engine.draw('terrain');this.engine.draw('objects');}
      this.drawActors();this.engine.upload('dynamic',this.dynamicBatch(dt),true);this.engine.draw('dynamic');this.engine.end();this.drawFX();this.radarTimer+=dt;if(this.radarTimer>.1){this.radarTimer=0;this.drawRadar();}
    }
    drawFX(){
      const c=this.fc,w=this.width,h=this.height,g=this.game,s=g.state,p=g.planet(),amount=this.immersive?this.intensity:0;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
      const vignette=c.createRadialGradient(w/2,h/2,h*.3,w/2,h/2,Math.max(w,h)*.75);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#05111b70');c.fillStyle=vignette;c.fillRect(0,0,w,h);
      if(this.firstPerson){c.strokeStyle='#e2f8e488';c.lineWidth=1;c.beginPath();c.moveTo(w/2-6,h/2);c.lineTo(w/2+6,h/2);c.moveTo(w/2,h/2-6);c.lineTo(w/2,h/2+6);c.stroke();}
      if(s.mode==='space')for(const planet of PLANETS){const pt=this.project(planet.x,planet.y,planet.r+25);if(pt.visible&&pt.x>0&&pt.x<w&&pt.y>35&&pt.y<h-100){c.textAlign='center';c.font='600 13px system-ui';c.fillStyle='#e0ede7';c.shadowColor='#081425';c.shadowBlur=7;c.fillText(planet.name,pt.x,pt.y);c.shadowBlur=0;}}
      if(!amount)return;
      const warp=g.travel?Math.sin(Math.min(1,g.travel.age/2.4)*Math.PI):0,speed=Math.max(this.speed*.45,warp);
      if(speed>.03){c.save();c.translate(w/2,h*.51);c.strokeStyle='rgba(188,232,249,'+speed*amount*.52+')';c.lineWidth=1.5;for(const st of this.stars){const r=((st.r+this.time*st.speed*.7)%1)*Math.max(w,h)*.7,a=st.a;c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.lineTo(Math.cos(a)*(r+15+speed*95),Math.sin(a)*(r+15+speed*95));c.stroke();}c.restore();}
      if(s.mode==='surface'&&p.id==='nix'){c.fillStyle='rgba(225,242,255,'+amount*.65+')';for(const st of this.stars.slice(0,40)){const x=((st.r*w+Math.sin(this.time*.3+st.a)*40)%w+w)%w,y=(st.r*h+this.time*st.speed*45)%h;c.beginPath();c.arc(x,y,1.3,0,TAU);c.fill();}}
      if(s.mode==='surface'&&p.id==='ember'){c.fillStyle='rgba(255,173,111,'+amount*.5+')';for(const st of this.stars.slice(0,24)){const x=st.r*w,y=h-((st.r*h+this.time*st.speed*34)%h);c.fillRect(x,y,2,2);}}
      if(this.flash>0){c.fillStyle='rgba(156,222,235,'+Math.min(.17,this.flash*amount)+')';c.fillRect(0,0,w,h);}
      if(g.travel){c.fillStyle='#e7f9f2';c.textAlign='center';c.font='600 19px system-ui';c.fillText('W A R P   D R I V E',w/2,h*.34);c.font='13px system-ui';c.fillStyle='#bedadd';c.fillText('항로를 따라 별 사이로',w/2,h*.34+27);}
    }
    drawRadar(){
      const c=this.rc,g=this.game,s=g.state,space=s.mode==='space',pos=space?s.ship:s.player,scale=space?.042:.09;c.clearRect(0,0,160,126);c.save();c.beginPath();c.arc(80,64,57,0,TAU);c.clip();c.fillStyle='#152f35';c.fillRect(0,0,160,126);c.strokeStyle='#a6c6c024';c.lineWidth=1;
      for(let i=1;i<4;i++){c.beginPath();c.arc(80,64,i*19,0,TAU);c.stroke();}c.beginPath();c.moveTo(23,64);c.lineTo(137,64);c.moveTo(80,7);c.lineTo(80,121);c.stroke();
      const dot=(x,z,color,r)=>{const dx=x-pos.x,dz=z-pos.y,xx=80+(dx*Math.cos(this.yaw)-dz*Math.sin(this.yaw))*scale,yy=64+(dx*Math.sin(this.yaw)+dz*Math.cos(this.yaw))*scale;c.fillStyle=color;c.beginPath();c.arc(xx,yy,r,0,TAU);c.fill();};
      if(space){for(const p of PLANETS)dot(p.x,p.y,p.color,6);}else{for(const n of g.world().nodes)if(n.hp>0)dot(n.x,n.y,n.type==='crystal'?'#adc8ff':n.type==='biomass'?'#c3ec92':'#c6d7da',1.8);for(const b of g.world().buildings)dot(b.x,b.y,'#fff0b1',3);for(const cr of g.world().creatures)dot(cr.x,cr.y,'#ddb8f2',2.4);dot(0,0,'#f5f6ec',4);}
      c.fillStyle='#d9f4ac';c.beginPath();c.moveTo(80,58);c.lineTo(84,69);c.lineTo(80,67);c.lineTo(76,69);c.fill();c.restore();c.strokeStyle='#a5bfb83d';c.beginPath();c.arc(80,64,57,0,TAU);c.stroke();
    }
  }
  root.Orbit3D={Batch,GLScene,Renderer,shaders,heightAt,terrainNormal,terrainColor,terrainBatch,spaceBatch,perspective,lookAt,multiply,transform,resourceModel,blockBreakModel,buildingModel,spaceshipModel,lifeModel,astronautModel};
  root.OrbitRenderer={Renderer,...root.OrbitPortraits};
})(typeof globalThis!=='undefined'?globalThis:this);
