import { q } from '@/lib/hris/db';
import { auth, json, errMsg } from '@/lib/hris/auth';
export const dynamic='force-dynamic';
// Data satu hotel (dokumen miliknya sendiri). Login hotel hanya bisa membaca/menulis hotelnya; admin memilih hotel lewat header X-Hotel.
export async function GET(req:Request){
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const r=await q<{data:any;version:number;name:string}>(`select data, version, name from hr_hotel where id=$1`,[a.hotelId]);return json({data:r[0]?.data||{},version:r[0]?.version||0,hotel:r[0]?.name})}
  catch(e:any){return json({error:errMsg(e)},500)}}
// Ditolak (409) bila sudah diubah dari perangkat lain sejak dimuat. Dokumen dipaksa hanya berisi hotel ini, jadi tidak bisa menyisipkan data hotel lain.
export async function PUT(req:Request){
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const b=await req.json();if(!b||typeof b.data!=='object')return json({error:'Data tidak valid'},400);
    const row=(await q<{name:string}>(`select name from hr_hotel where id=$1`,[a.hotelId]))[0];if(!row)return json({error:'Hotel tidak ditemukan'},404);
    const {att:_a,...data}=b.data as any,g=data.geo?.[row.name];
    data.hotels=[row.name];data.geo=g?{[row.name]:g}:{};data.emps=(data.emps||[]).map((e:any)=>({...e,hotel:row.name}));
    const r=await q<{version:number}>(`update hr_hotel set data=$1::jsonb, version=version+1, qr=$2 where id=$3 and version=$4 returning version`,[JSON.stringify(data),g?.qr||null,a.hotelId,Number(b.version)||0]);
    if(!r.length)return json({error:'Data sudah diubah dari perangkat lain. Dimuat ulang.'},409);
    return json({version:r[0].version})}catch(e:any){return json({error:errMsg(e)},500)}}
