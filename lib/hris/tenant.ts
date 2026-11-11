// Multi-hotel dalam SATU database: setiap hotel punya dokumen data sendiri (baris di hr_hotel), tidak bercampur.
// Server saja.
import { randomBytes, randomUUID } from 'node:crypto';
import { EMPTY, normalize } from './payroll';
const token=()=>randomBytes(12).toString('hex');
export type HotelInit={lat?:number;lng?:number;radius?:number;shift?:string;tz?:string};
// Dokumen awal hotel baru: hanya berisi hotel itu, lengkap dengan kode QR absen.
export function newHotelDoc(name:string,o:HotelInit={}){
  const {att:_a,...base}=EMPTY as any,radius=o.radius||EMPTY.settings.radius,shift=o.shift||EMPTY.settings.shift,tz=o.tz||EMPTY.settings.tz;
  return {...base,hotels:[name],geo:{[name]:{lat:o.lat||0,lng:o.lng||0,radius,shift,tz,qr:token()}},settings:{...EMPTY.settings,company:name,radius,shift,tz}}}
// Memecah dokumen lama (satu dokumen untuk semua hotel) menjadi satu dokumen per hotel.
export function splitLegacy(raw:any):{name:string;doc:any}[]{
  const d=normalize(raw||{}),names=[...new Set([...(d.hotels||[]),...d.emps.map(e=>e.hotel).filter(Boolean)])] as string[];
  if(!names.length&&d.emps.length)names.push('Hotel Utama');
  return names.map(name=>{
    const emps=d.emps.filter(e=>(e.hotel||names[0])===name).map(e=>({...e,hotel:name})),ids=new Set(emps.map(e=>e.id));
    const pick=(m:Record<string,Record<string,any>>)=>Object.fromEntries(Object.entries(m||{}).map(([p,v])=>[p,Object.fromEntries(Object.entries(v||{}).filter(([id])=>ids.has(id)))]));
    const g:any=d.geo?.[name],{att:_a,...rest}=d as any;
    return {name,doc:{...rest,hotels:[name],emps,sched:d.sched.filter(s=>ids.has(s.empId)),corr:d.corr.filter(c=>ids.has(c.empId)),cuts:pick(d.cuts),snap:pick(d.snap),
      master:(d.master||[]).filter(m=>!m.hotel||m.hotel===name).map(m=>({...m,hotel:name})),audit:[],
      geo:{[name]:{lat:0,lng:0,radius:d.settings.radius,shift:d.settings.shift,tz:d.settings.tz,...(g||{}),qr:g?.qr||token()}}}}})}
type Q=(t:string,p?:any[])=>Promise<any[]>;
// Upgrade dari versi satu-dokumen: pecah data per hotel, beri hotel_id pada absensi & PIN, jadikan password lama sebagai login admin.
export async function migrateLegacy(q:Q){
  const has=(await q(`select to_regclass('public.hr_state') as t`))[0]?.t,hc=(await q(`select count(*)::int as c from hr_hotel`))[0].c;
  if(has&&!hc){const r=(await q(`select data from hr_state where id=1`))[0];
    for(const p of r?splitLegacy(r.data):[]){const id=randomUUID();
      await q(`insert into hr_hotel(id,name,data,version,qr) values($1,$2,$3::jsonb,1,$4) on conflict do nothing`,[id,p.name,JSON.stringify(p.doc),p.doc.geo[p.name].qr]);
      const ids=p.doc.emps.map((e:any)=>e.id);
      if(ids.length){await q(`update hr_att set hotel_id=$1 where emp_id = any($2::text[]) and hotel_id is null`,[id,ids]);await q(`update hr_pin set hotel_id=$1 where emp_id = any($2::text[]) and hotel_id is null`,[id,ids])}}}
  const uc=(await q(`select count(*)::int as c from hr_user`))[0].c;
  if(!uc){const a=(await q(`select pass_hash from hr_auth where id=1`))[0];if(a)await q(`insert into hr_user(id,username,pass_hash,role) values($1,'admin',$2,'admin') on conflict do nothing`,[randomUUID(),a.pass_hash])}}
