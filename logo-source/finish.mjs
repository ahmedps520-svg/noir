/**
 * Finish a generated logo into NOIR brand assets.
 *  - crushes the model's grey studio ground (and its floor shadow) to #050505
 *    while leaving the gold subject untouched
 *  - emits the opaque 1024 icon, an alpha splash, and small-size proofs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { join } from "node:path";

const T=(()=>{const t=new Int32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c}return t})();
const crc=b=>{let c=-1;for(let i=0;i<b.length;i++)c=T[(c^b[i])&0xff]^(c>>>8);return (c^-1)>>>0};
const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const b=Buffer.concat([Buffer.from(t,"ascii"),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(b));return Buffer.concat([l,b,c])};
function dec(buf){let p=8,w=0,h=0,ct=2;const id=[];while(p<buf.length){const l=buf.readUInt32BE(p),t=buf.toString("ascii",p+4,p+8),d=buf.subarray(p+8,p+8+l);
if(t==="IHDR"){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9]}else if(t==="IDAT")id.push(d);else if(t==="IEND")break;p+=12+l}
const c=ct===6?4:3,raw=inflateSync(Buffer.concat(id)),st=w*c,o=Buffer.alloc(h*st);
for(let y=0;y<h;y++){const f=raw[y*(st+1)],ln=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),pv=y>0?o.subarray((y-1)*st,y*st):null,cu=o.subarray(y*st,(y+1)*st);
for(let i=0;i<st;i++){const a=i>=c?cu[i-c]:0,b=pv?pv[i]:0,cc=pv&&i>=c?pv[i-c]:0;let v=ln[i];
if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const q=a+b-cc,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-cc);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:cc}cu[i]=v&0xff}}
return {w,h,c,data:o}}
function enc(px,size,channels){const ih=Buffer.alloc(13);ih.writeUInt32BE(size,0);ih.writeUInt32BE(size,4);ih[8]=8;ih[9]=channels===4?6:2;
const st=size*channels,raw=Buffer.alloc((st+1)*size);for(let y=0;y<size;y++){raw[y*(st+1)]=0;px.copy(raw,y*(st+1)+1,y*st,(y+1)*st)}
return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),ch("IHDR",ih),ch("IDAT",deflateSync(raw,{level:9})),ch("IEND",Buffer.alloc(0))])}

const ss=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const BLACK=[5,5,5];

function subjectBox(src){
  // Threshold high enough to catch the solid gold but ignore the dimmer floor
  // reflection, so the crop drops the ground plane instead of centring on it.
  let x0=src.w,y0=src.h,x1=0,y1=0;
  for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++){
    const i=(y*src.w+x)*src.c;
    const lum=(0.2126*src.data[i]+0.7152*src.data[i+1]+0.0722*src.data[i+2])/255;
    if(lum>0.45){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  }
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  const half=Math.max(x1-x0,y1-y0)/2*1.14; // 14% breathing room
  return {cx,cy,half};
}

function build(src,size,{alpha=false,box=null}={}){
  const out=Buffer.alloc(size*size*(alpha?4:3));
  const sc=src.c;
  const left = box ? box.cx-box.half : 0;
  const top  = box ? box.cy-box.half : 0;
  const span = box ? box.half*2 : src.w;
  const scale = span/size;
  for(let y=0;y<size;y++){
    const y0=Math.max(0,Math.floor(top+y*scale)), y1=Math.max(y0+1,Math.min(src.h,Math.ceil(top+(y+1)*scale)));
    for(let x=0;x<size;x++){
      const x0=Math.max(0,Math.floor(left+x*scale)), x1=Math.max(x0+1,Math.min(src.w,Math.ceil(left+(x+1)*scale)));
      let r=0,g=0,b=0,n=0; if(y0>=src.h||x0>=src.w){const o=(y*size+x)*(alpha?4:3);out[o]=5;out[o+1]=5;out[o+2]=5;if(alpha)out[o+3]=0;continue}
      for(let sy=y0;sy<y1;sy++)for(let sx=x0;sx<x1;sx++){const i=(sy*src.w+sx)*sc;r+=src.data[i];g+=src.data[i+1];b+=src.data[i+2];n++}
      r/=n;g/=n;b/=n;
      // Crush the studio ground to brand black; the gold subject is far brighter
      // than the backdrop, so a luminance ramp separates them cleanly.
      const lum=(0.2126*r+0.7152*g+0.0722*b)/255;
      const keep=ss(0.17,0.42,lum);
      r=BLACK[0]+(r-BLACK[0])*keep; g=BLACK[1]+(g-BLACK[1])*keep; b=BLACK[2]+(b-BLACK[2])*keep;
      const o=(y*size+x)*(alpha?4:3);
      out[o]=Math.round(r);out[o+1]=Math.round(g);out[o+2]=Math.round(b);
      if(alpha){const l2=(0.2126*r+0.7152*g+0.0722*b)/255;out[o+3]=Math.round(ss(0.03,0.16,l2)*255)}
    }
  }
  return out;
}

const [input,outDir,base]=process.argv.slice(2);
const src=dec(readFileSync(input));
const box=subjectBox(src);
console.log(`  subject box: centre ${box.cx.toFixed(0)},${box.cy.toFixed(0)} half ${box.half.toFixed(0)} (source ${src.w})`);
writeFileSync(join(outDir,`${base}-icon.png`),enc(build(src,1024,{box}),1024,3));
writeFileSync(join(outDir,`${base}-splash.png`),enc(build(src,1024,{alpha:true,box}),1024,4));
writeFileSync(join(outDir,`${base}-p40.png`),enc(build(src,40,{box}),40,3));
writeFileSync(join(outDir,`${base}-p120.png`),enc(build(src,120,{box}),120,3));
console.log(`${base}: ${src.w}x${src.h} -> icon + splash + proofs (ground crushed to #050505)`);
