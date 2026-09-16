import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const root=new URL('../',import.meta.url);

export async function exportSpaceship(){
  require('../game/core.js');require('../game/renderer-3d.js');
  const {Batch,spaceshipModel}=globalThis.Orbit3D,batch=new Batch(),parts=[];
  batch.part=(name,create)=>{const first=batch.data.length;create();parts.push({name,data:batch.data.slice(first)});};
  spaceshipModel(batch,0,false,false);
  const gltf={asset:{version:'2.0',generator:'justgame reference mesh exporter'},scene:0,scenes:[{name:spaceshipModel.info.name,nodes:[]}],nodes:[],meshes:[],materials:[
    {name:'Painted alloy and glazing',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:.25,roughnessFactor:.55},doubleSided:true},
    {name:'Amber service lights',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:.05,roughnessFactor:.3},emissiveFactor:[1,.52,.16],doubleSided:true},
    {name:'Dark cockpit glass',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:.35,roughnessFactor:.14},doubleSided:true}
  ],buffers:[],bufferViews:[],accessors:[],extras:{referenceModel:spaceshipModel.info.id,forwardAxis:'+Z',units:'metres',description:'Hand-modelled from the supplied single-view reference. Hidden sides use inferred symmetric geometry. The game uses the same mesh generator with retractable landing gear.'}};
  const chunks=[];let byteLength=0,totalVertices=0,totalTriangles=0;
  const append=(buffer,target)=>{const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}const index=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:buffer.length,target});chunks.push(buffer);byteLength+=buffer.length;return index;};
  const accessor=(buffer,componentType,type,count,target,extra={})=>{const index=gltf.accessors.length;gltf.accessors.push({bufferView:append(buffer,target),componentType,type,count,...extra});return index;};
  const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
  for(const part of parts){
    const primitives=[];
    for(let material=0;material<3;material++){
      const positions=[],normals=[],colors=[],indices=[],seen=new Map(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<part.data.length;i+=30){
        const glass=part.name==='Faceted cockpit and canopy'&&part.data[i+6]<.24&&part.data[i+8]>part.data[i+6]*1.1;
        if((part.data[i+9]>.5?1:glass?2:0)!==material)continue;
        for(let j=0;j<3;j++){
          const v=part.data.slice(i+j*10,i+j*10+10);if(!v.every(Number.isFinite))throw Error('Non-finite ship geometry');
          const key=v.slice(0,9).map(n=>n.toFixed(5)).join(','),existing=seen.get(key);
          if(existing!==undefined){indices.push(existing);continue;}
          const index=positions.length/3;seen.set(key,index);indices.push(index);
          for(let k=0;k<3;k++){const p=Math.fround(v[k]*.035);positions.push(p);min[k]=Math.min(min[k],p);max[k]=Math.max(max[k],p);normals.push(v[3+k]);colors.push(Math.round(linear(Math.max(0,Math.min(1,v[6+k])))*255));}colors.push(255);
        }
      }
      if(!indices.length)continue;
      const p=new Float32Array(positions),n=new Float32Array(normals),c=new Uint8Array(colors),indexType=positions.length/3<65536?5123:5125,ix=indexType===5123?new Uint16Array(indices):new Uint32Array(indices);
      const count=positions.length/3;
      primitives.push({attributes:{POSITION:accessor(Buffer.from(p.buffer),5126,'VEC3',count,34962,{min,max}),NORMAL:accessor(Buffer.from(n.buffer),5126,'VEC3',count,34962),COLOR_0:accessor(Buffer.from(c.buffer),5121,'VEC4',count,34962,{normalized:true})},indices:accessor(Buffer.from(ix.buffer),indexType,'SCALAR',indices.length,34963),material,mode:4});
      totalVertices+=count;totalTriangles+=indices.length/3;
    }
    if(primitives.length){const mesh=gltf.meshes.push({name:part.name,primitives})-1,node=gltf.nodes.push({name:part.name,mesh})-1;gltf.scenes[0].nodes.push(node);}
  }
  gltf.buffers.push({byteLength});
  const jsonRaw=Buffer.from(JSON.stringify(gltf)),json=Buffer.concat([jsonRaw,Buffer.alloc((4-jsonRaw.length%4)%4,32)]),binRaw=Buffer.concat(chunks),bin=Buffer.concat([binRaw,Buffer.alloc((4-binRaw.length%4)%4)]);
  const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);jsonHeader.writeUInt32LE(json.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  const glb=Buffer.concat([header,jsonHeader,json,binHeader,bin]);
  await mkdir(new URL('assets/',root),{recursive:true});
  await writeFile(new URL('assets/pioneer-ex7.glb',root),glb);
  await writeFile(new URL('assets/pioneer-ex7.glb.txt',root),glb.toString('base64')+'\n');
  return {model:spaceshipModel.info.id,parts:gltf.nodes.length,vertices:totalVertices,triangles:totalTriangles,glbBytes:glb.length};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await exportSpaceship());
