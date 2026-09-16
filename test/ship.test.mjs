import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {loadWorker} from '../scripts/load-worker.mjs';
const require=createRequire(import.meta.url);
require('../game/core.js');require('../game/renderer-3d.js');

test('Pioneer geometry keeps engine positions and retracts landing gear in flight',()=>{
  const {Batch,spaceshipModel}=globalThis.Orbit3D,landed=new Batch(),flying=new Batch();
  spaceshipModel(landed,0,false,false);spaceshipModel(flying,0,true,false);
  const limits=b=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<b.data.length;i+=10){for(const v of b.data.slice(i,i+10))assert.ok(Number.isFinite(v));for(let k=0;k<3;k++){min[k]=Math.min(min[k],b.data[i+k]);max[k]=Math.max(max[k],b.data[i+k]);}}return{min,max};};
  const ground=limits(landed),air=limits(flying);
  assert.ok(ground.min[1]>=0&&ground.min[1]<1);
  assert.ok(air.min[1]>15,'landing feet must be retracted in flight');
  assert.ok(landed.data.length>flying.data.length);
  assert.ok(ground.max[0]-ground.min[0]>180&&ground.max[2]-ground.min[2]>260,'preserve the reference proportions');
  for(const [x,y,z] of spaceshipModel.info.thrusters){assert.ok(Math.abs(x)===63&&y===93&&z<ground.min[2]);}
});

test('downloaded GLB has valid buffers, indices, normals and the current game model',async()=>{
  const worker=await loadWorker(),response=await worker.fetch(new Request('https://game.test/models/pioneer-ex7.glb'));
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'model/gltf-binary');
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.deepEqual(bytes,await readFile(new URL('../assets/pioneer-ex7.glb',import.meta.url)));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),binStart=28+jsonLength;
  assert.equal(bytes.readUInt32LE(16),0x4e4f534a);assert.equal(bytes.readUInt32LE(24+jsonLength),0x004e4942);
  assert.equal(json.extras.referenceModel,globalThis.Orbit3D.spaceshipModel.info.id);
  assert.equal(json.nodes.length,7);assert.equal(json.materials.length,3);
  assert.ok(json.buffers[0].byteLength<=bytes.length-binStart);
  const components={SCALAR:1,VEC3:3,VEC4:4},sizes={5121:1,5123:2,5125:4,5126:4};
  const values=index=>{const a=json.accessors[index],v=json.bufferViews[a.bufferView],size=sizes[a.componentType],count=a.count*components[a.type];assert.equal(v.byteOffset%4,0);assert.ok(v.byteOffset+v.byteLength<=json.buffers[0].byteLength);assert.ok(count*size<=v.byteLength);const start=binStart+v.byteOffset,read=a.componentType===5126?'readFloatLE':a.componentType===5123?'readUInt16LE':a.componentType===5125?'readUInt32LE':'readUInt8';return Array.from({length:count},(_,i)=>bytes[read](start+i*size));};
  let triangles=0;
  for(const mesh of json.meshes)for(const primitive of mesh.primitives){
    const position=json.accessors[primitive.attributes.POSITION],points=values(primitive.attributes.POSITION),normals=values(primitive.attributes.NORMAL),indices=values(primitive.indices);
    assert.equal(indices.length%3,0);triangles+=indices.length/3;assert.ok(indices.every(i=>i<position.count));assert.ok(points.every(Number.isFinite));
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<points.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],points[i+k]);max[k]=Math.max(max[k],points[i+k]);}
    assert.deepEqual(position.min,min);assert.deepEqual(position.max,max);
    for(let i=0;i<normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...normals.slice(i,i+3))-1)<1e-4,'normal must have unit length');
  }
  assert.ok(triangles>20000&&triangles<35000);
  const health=await(await worker.fetch(new Request('https://game.test/health'))).json();assert.equal(health.modelSystem,json.extras.referenceModel);assert.equal(health.spaceshipModel,'Terralink Pioneer EX-7');
});
