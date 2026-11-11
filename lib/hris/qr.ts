// Pembuat kode QR minimal tanpa dependensi: mode byte, koreksi level M, versi 1-6 (hingga 106 karakter).
const CAP=[0,14,26,42,62,84,106];
const BLK:[number,number,number][]=[[0,0,0],[1,26,10],[1,44,16],[1,70,26],[2,100,18],[2,134,24],[4,172,16]]; // [blok, total codeword, ec per blok]
const ALIGN:number[][]=[[],[],[6,18],[6,22],[6,26],[6,30],[6,34]];
const EXP:number[]=new Array(512).fill(0),LOG:number[]=new Array(256).fill(0);
(()=>{let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d}for(let i=255;i<512;i++)EXP[i]=EXP[i-255]})();
const mul=(a:number,b:number)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
function rs(data:number[],n:number){let g=[1];for(let i=0;i<n;i++){const ng=new Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){ng[j]^=g[j];ng[j+1]^=mul(g[j],EXP[i])}g=ng}
  const r=new Array(n).fill(0);for(const d of data){const f=d^r[0];r.shift();r.push(0);for(let i=0;i<n;i++)r[i]^=mul(g[i+1],f)}return r}
const MASKS:((r:number,c:number)=>boolean)[]=[(r,c)=>(r+c)%2===0,(r)=>r%2===0,(_r,c)=>c%3===0,(r,c)=>(r+c)%3===0,(r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>r*c%2+r*c%3===0,(r,c)=>(r*c%2+r*c%3)%2===0,(r,c)=>((r+c)%2+r*c%3)%2===0];
function penalty(g:boolean[][]){const N=g.length;let p=0,dark=0;
  const lines:string[]=[];for(let i=0;i<N;i++){lines.push(g[i].map(b=>b?1:0).join(''));lines.push(g.map(row=>row[i]?1:0).join(''))}
  for(const s of lines){for(const m of s.matchAll(/0{5,}|1{5,}/g))p+=3+m[0].length-5;p+=40*((s.match(/(?=00001011101)/g)||[]).length+(s.match(/(?=10111010000)/g)||[]).length)}
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){if(g[r][c])dark++;if(r<N-1&&c<N-1&&g[r][c]===g[r][c+1]&&g[r][c]===g[r+1][c]&&g[r][c]===g[r+1][c+1])p+=3}
  return p+(Math.ceil(Math.abs(dark*20-N*N*10)/(N*N))-1)*10}
export function qrMatrix(text:string):boolean[][]{
  const bytes=Array.from(new TextEncoder().encode(text));const v=[1,2,3,4,5,6].find(k=>bytes.length<=CAP[k]);
  if(!v)throw new Error('Teks terlalu panjang untuk QR (maks 106 karakter)');
  const bits:number[]=[];const put=(val:number,len:number)=>{for(let i=len-1;i>=0;i--)bits.push((val>>i)&1)};
  put(4,4);put(bytes.length,8);bytes.forEach(b=>put(b,8));
  const [nb,total,ecn]=BLK[v],dataCw=total-nb*ecn;
  for(let i=0;i<4&&bits.length<dataCw*8;i++)bits.push(0);while(bits.length%8)bits.push(0);
  const cw:number[]=[];for(let i=0;i<bits.length;i+=8)cw.push(parseInt(bits.slice(i,i+8).join(''),2));
  for(let p=0xec;cw.length<dataCw;p^=0xec^0x11)cw.push(p);
  const per=dataCw/nb,D:number[][]=[],E:number[][]=[];for(let b=0;b<nb;b++){const d=cw.slice(b*per,(b+1)*per);D.push(d);E.push(rs(d,ecn))}
  const all:number[]=[];for(let i=0;i<per;i++)D.forEach(d=>all.push(d[i]));for(let i=0;i<ecn;i++)E.forEach(e=>all.push(e[i]));
  const N=17+4*v,m:boolean[][]=Array.from({length:N},()=>new Array(N).fill(false)),fn:boolean[][]=Array.from({length:N},()=>new Array(N).fill(false));
  const set=(r:number,c:number,val:boolean)=>{m[r][c]=val;fn[r][c]=true};
  for(const [r0,c0] of [[0,0],[0,N-7],[N-7,0]])for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){const rr=r0+r,cc=c0+c;if(rr<0||cc<0||rr>=N||cc>=N)continue;
    set(rr,cc,r>=0&&r<=6&&c>=0&&c<=6&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4)))}
  for(let i=8;i<N-8;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  for(const r of ALIGN[v])for(const c of ALIGN[v]){if(fn[r][c])continue;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++)set(r+dr,c+dc,Math.max(Math.abs(dr),Math.abs(dc))!==1)}
  for(let i=0;i<9;i++){if(!fn[8][i])set(8,i,false);if(!fn[i][8])set(i,8,false)}
  for(let i=0;i<8;i++)set(8,N-1-i,false);for(let i=0;i<7;i++)set(N-1-i,8,false);
  let bi=0;const bitAt=(i:number)=>i<all.length*8&&((all[i>>3]>>(7-(i&7)))&1)===1;
  for(let right=N-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<N;vert++)for(let j=0;j<2;j++){const x=right-j,y=((right+1)&2)===0?N-1-vert:vert;if(!fn[y][x])m[y][x]=bitAt(bi++)}}
  let best:boolean[][]=m,bp=Infinity;
  for(let mask=0;mask<8;mask++){const g=m.map(row=>row.slice());for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(!fn[r][c]&&MASKS[mask](r,c))g[r][c]=!g[r][c];
    const data=mask;let rem=data;for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>9)*0x537);const bits15=((data<<10)|rem)^0x5412,bt=(i:number)=>((bits15>>i)&1)!==0;
    for(let i=0;i<=5;i++)g[i][8]=bt(i);g[7][8]=bt(6);g[8][8]=bt(7);g[8][7]=bt(8);for(let i=9;i<15;i++)g[8][14-i]=bt(i);
    for(let i=0;i<8;i++)g[8][N-1-i]=bt(i);for(let i=8;i<15;i++)g[N-15+i][8]=bt(i);g[N-8][8]=true;
    const p=penalty(g);if(p<bp){bp=p;best=g}}
  return best}
