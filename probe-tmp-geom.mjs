import { readFileSync } from "node:fs";
import { Matrix4, Vector3, Quaternion } from "three";
function readGlb(path){const buf=readFileSync(path);let offset=12,json=null,bin=null;
while(offset<buf.length){const length=buf.readUInt32LE(offset);const type=buf.readUInt32LE(offset+4);const start=offset+8;
if(type===0x4e4f534a){json=JSON.parse(buf.subarray(start,start+length).toString("utf8"));}else if(type===0x004e4942){bin=buf.subarray(start,start+length);}
offset=start+length+((4-(length%4))%4);}return {bin,json};}
function positions(json,bin,ai){const a=json.accessors[ai];const v=json.bufferViews[a.bufferView];const base=(v.byteOffset??0)+(a.byteOffset??0);const stride=v.byteStride??12;const out=[];
for(let i=0;i<a.count;i+=1){const at=base+i*stride;out.push([bin.readFloatLE(at),bin.readFloatLE(at+4),bin.readFloatLE(at+8)]);}return out;}
function worldMatrices(json){const parent=new Map();json.nodes.forEach((n,i)=>{for(const c of n.children??[])parent.set(c,i);});
return json.nodes.map((_,i)=>{const chain=[];let cur=i;while(cur!==undefined){chain.unshift(cur);cur=parent.get(cur);}const m=new Matrix4();
for(const link of chain){const n=json.nodes[link];if(n.matrix){m.multiply(new Matrix4().fromArray(n.matrix));continue;}
m.multiply(new Matrix4().compose(new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1])));}
return m;});}
for (const f of process.argv.slice(2)) {
  const {bin,json}=readGlb(f);
  const mats=worldMatrices(json);
  const pts=[];
  json.nodes.forEach((node,index)=>{
    if(node.mesh===undefined)return;
    for(const p of json.meshes[node.mesh].primitives){
      if(p.attributes.POSITION===undefined)continue;
      for(const raw of positions(json,bin,p.attributes.POSITION)) pts.push(new Vector3(...raw).applyMatrix4(mats[index]));
    }
  });
  let miny=Infinity,maxy=-Infinity,minx=Infinity,maxx=-Infinity,minz=Infinity,maxz=-Infinity;
  for(const q of pts){miny=Math.min(miny,q.y);maxy=Math.max(maxy,q.y);minx=Math.min(minx,q.x);maxx=Math.max(maxx,q.x);minz=Math.min(minz,q.z);maxz=Math.max(maxz,q.z);}
  const h=maxy-miny;
  console.log(`\n=== ${f}  verts=${pts.length}`);
  console.log(`  raw  h=${h.toFixed(4)}  x ${minx.toFixed(3)}..${maxx.toFixed(3)}  z ${minz.toFixed(3)}..${maxz.toFixed(3)}`);
  // normalized so height == 1: what half-extents does it then have?
  console.log(`  per unit of height:  halfX=${(Math.max(Math.abs(minx),Math.abs(maxx))/h).toFixed(4)}  halfZ=${(Math.max(Math.abs(minz),Math.abs(maxz))/h).toFixed(4)}  widthX=${((maxx-minx)/h).toFixed(4)} widthZ=${((maxz-minz)/h).toFixed(4)}`);
  // radius from the mesh's own x/z centre
  const cx=(minx+maxx)/2, cz=(minz+maxz)/2;
  const r=Math.max(maxx-cx, maxz-cz);
  console.log(`  centred radius per unit height = ${(r/h).toFixed(4)}   (centre x ${cx.toFixed(3)} z ${cz.toFixed(3)})`);
}
