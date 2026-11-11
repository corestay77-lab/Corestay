// Penghubung HRIS ke kerangka CoreStay: login, peran, dan hak akses mengikuti sesi CoreStay (bukan tabel login HRIS lama).
// Owner = admin (semua hotel milik kliennya). GM dan staf = login satu hotel (hotel yang ditetapkan di Kelola tim).
// Semua data HRIS dibatasi ke tenant_id dari sesi; hotel dari header X-Hotel hanya diterima bila milik tenant itu.
import { NextResponse } from 'next/server';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { sql } from '@/lib/db';
import { currentUser, userModules } from '@/lib/data';
import { q, ensureSchema } from './db';
import { newHotelDoc } from './tenant';
export type Me={id:string;username:string;role:'admin'|'hotel';hotelId:string|null;tid:string};
export const hashSecret=(s:string)=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(s,salt,32).toString('hex')};
export const verifySecret=(s:string,h:string)=>{const[salt,hex]=h.split(':');if(!salt||!hex)return false;const a=scryptSync(s,salt,32),b=Buffer.from(hex,'hex');return a.length===b.length&&timingSafeEqual(a,b)};
export const json=(body:any,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const errMsg=(e:any)=>String(e?.message||e||'Terjadi kesalahan');
let ready:Promise<void>|null=null;
export const ensureReady=()=>ready||(ready=ensureSchema().catch(e=>{ready=null;throw e}));
// Hotel yang didaftarkan di CoreStay otomatis mendapat dokumen data HRIS-nya sendiri.
export async function syncHotels(tid:string){
  const rows=await q(`select h.id::text as id, h.name from hotels h where h.tenant_id=$1 and not exists(select 1 from hr_hotel r where r.id=h.id::text)`,[tid]);
  for(const r of rows){const doc=newHotelDoc(r.name);
    await q(`insert into hr_hotel(id,name,data,version,qr,tenant_id) values($1,$2,$3::jsonb,1,$4,$5) on conflict do nothing`,[r.id,r.name,JSON.stringify(doc),doc.geo[r.name].qr,tid])}}
export async function getMe():Promise<Me|null>{
  const s=await currentUser();if(!s)return null;
  if(!(await userModules(s.tid,s.uid,s.role)).includes('hris'))return null;
  await ensureReady();await syncHotels(s.tid);
  if(s.role==='owner')return {id:s.uid,username:s.name,role:'admin',hotelId:null,tid:s.tid};
  const [u]=await sql.query('select hotel_ids from users where id=$1 and tenant_id=$2',[s.uid,s.tid]);
  let h:string|null=(u?.hotel_ids||[])[0]||null;
  if(!h){const hs=await sql.query('select id from hotels where tenant_id=$1 limit 2',[s.tid]);if(hs.length===1)h=String(hs[0].id)}
  if(h&&!(await q(`select 1 from hr_hotel where id=$1 and tenant_id=$2`,[String(h),s.tid])).length)h=null;
  return {id:s.uid,username:s.name,role:'hotel',hotelId:h?String(h):null,tid:s.tid}}
// Pintu masuk semua route HRIS.
export async function auth(req:Request,o:{admin?:boolean;hotel?:boolean}={}):Promise<{me:Me;hotelId:string|null;tid:string}|{res:NextResponse}>{
  const me=await getMe();if(!me)return {res:json({error:'Belum login atau akun ini tidak punya akses ke HRIS'},401)};
  if(o.admin&&me.role!=='admin')return {res:json({error:'Hanya Owner yang boleh melakukan ini'},403)};
  let hotelId:string|null=me.role==='hotel'?me.hotelId:null;
  if(me.role==='admin'){const h=req.headers.get('x-hotel');if(h&&(await q(`select 1 from hr_hotel where id=$1 and tenant_id=$2`,[h,me.tid])).length)hotelId=h}
  if(o.hotel&&!hotelId)return {res:json({error:me.role==='admin'?'Pilih hotel terlebih dahulu (belum ada hotel terdaftar?)':'Akun Anda belum ditetapkan ke sebuah hotel. Hubungi Owner.'},400)};
  return {me,hotelId,tid:me.tid}}
