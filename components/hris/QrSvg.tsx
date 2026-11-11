import { qrMatrix } from '@/lib/hris/qr';
export default function QrSvg({text,size=240}:{text:string;size?:number}){
  const m=qrMatrix(text),n=m.length,q=4;let d='';
  m.forEach((row,r)=>row.forEach((on,c)=>{if(on)d+=`M${c+q} ${r+q}h1v1h-1z`}));
  return <svg viewBox={`0 0 ${n+2*q} ${n+2*q}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="Kode QR absen"><rect width="100%" height="100%" fill="#fff"/><path d={d} fill="#000"/></svg>}
