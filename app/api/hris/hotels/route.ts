import { randomBytes, randomUUID } from 'node:crypto';
import { q } from '@/lib/hris/db';
import { sql } from '@/lib/db';
import { auth, json, errMsg, syncHotels } from '@/lib/hris/auth';
import { newHotelDoc } from '@/lib/hris/tenant';
export const dynamic='force-dynamic';
// Daftar hotel milik klien: Owner melihat semua; login hotel hanya hotelnya sendiri.
export async function GET(req:Request){
  const a=await auth(req);if('res' in a)return a.res;
  try{await syncHotels(a.tid);
    const r=await q(`select id, name, ''::text as username from hr_hotel where tenant_id=$1 ${a.me.role==='admin'?'':'and id=$2'} order by name`,a.me.role==='admin'?[a.tid]:[a.tid,a.me.hotelId]);
    return json({hotels:r})}catch(e:any){return json({error:errMsg(e)},500)}}
// Daftarkan hotel baru (Owner): tercatat di CoreStay dan mendapat data HRIS sendiri. Login tim dibuat di Kelola tim.
export async function POST(req:Request){
  const a=await auth(req,{admin:true});if('res' in a)return a.res;
  try{const b=await req.json(),name=String(b.name||'').trim();
    if(!name)return json({error:'Nama hotel wajib diisi'},400);
    if((await q(`select 1 from hr_hotel where tenant_id=$1 and lower(name)=lower($2)`,[a.tid,name])).length)return json({error:'Nama hotel sudah terdaftar'},409);
    if((await sql.query('select 1 from hotels where lower(name)=lower($1) union all select 1 from tenants where id<>$2 and (lower(slug)=lower($1) or lower(name)=lower($1))',[name,a.tid])).length)return json({error:'Nama hotel sudah dipakai. Tambahkan kota atau ciri lain agar unik.'},409);
    const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0,id=randomUUID(),doc=newHotelDoc(name,{lat:num(b.lat),lng:num(b.lng),radius:num(b.radius)||undefined,shift:b.shift||undefined,tz:b.tz||undefined});
    await sql.query('insert into hotels(id,tenant_id,name) values($1,$2,$3)',[id,a.tid,name]);
    try{await q(`insert into hr_hotel(id,name,data,version,qr,tenant_id) values($1,$2,$3::jsonb,1,$4,$5)`,[id,name,JSON.stringify(doc),doc.geo[name].qr,a.tid])}
    catch(e){await sql.query('delete from hotels where id=$1',[id]);throw e}
    return json({id,name,qr:doc.geo[name].qr})}catch(e:any){return json({error:errMsg(e)},500)}}
// Buat ulang kode QR absen sebuah hotel (Owner).
export async function PATCH(req:Request){
  const a=await auth(req,{admin:true});if('res' in a)return a.res;
  try{const b=await req.json(),id=String(b.id||''),h=(await q(`select name from hr_hotel where id=$1 and tenant_id=$2`,[id,a.tid]))[0];
    if(!h)return json({error:'Hotel tidak ditemukan'},404);
    if(!b.regenQr)return json({error:'Tidak ada perubahan'},400);
    const tok=randomBytes(12).toString('hex');
    await q(`update hr_hotel set data=jsonb_set(data,ARRAY['geo',$2::text,'qr'],to_jsonb($3::text)), qr=$3::text, version=version+1 where id=$1 and tenant_id=$4`,[id,h.name,tok,a.tid]);
    return json({ok:true,qr:tok})}catch(e:any){return json({error:errMsg(e)},500)}}
