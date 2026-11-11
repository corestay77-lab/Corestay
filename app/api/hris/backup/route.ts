import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { q, tx } from '@/lib/hris/db';
import { auth, json, errMsg } from '@/lib/hris/auth';
import { splitLegacy } from '@/lib/hris/tenant';
export const dynamic='force-dynamic';
// Backup dan restore hanya untuk data klien sendiri (Owner). Data klien lain tidak pernah ikut terbaca atau tertimpa.
export async function GET(req:Request){
  const a=await auth(req,{admin:true});if('res' in a)return a.res;
  try{const h=await q(`select id, name, version, data from hr_hotel where tenant_id=$1 order by name`,[a.tid]),ids=h.map((x:any)=>x.id);
    const [at,p]=await Promise.all([q(`select * from hr_att where hotel_id = any($1::text[]) order by work_date`,[ids]),q(`select emp_id, pin_hash, hotel_id from hr_pin where hotel_id = any($1::text[])`,[ids])]);
    const body=JSON.stringify({app:'corestay-people',v:3,exported:new Date().toISOString(),hotels:h,att:at,pins:p},null,1);
    return new NextResponse(body,{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="corestay-people-backup-${new Date().toISOString().slice(0,10)}.json"`,'Cache-Control':'no-store'}})}
  catch(e:any){return json({error:errMsg(e)},500)}}
const COLS='id,emp_id,work_date,status,clock_in,clock_out,ot_hours,late_min,hours,dist,acc,src,note,shift,shift_start,hotel_id';
const attParams=(r:any,hid:string|null)=>[r.id||randomUUID(),r.emp_id,r.work_date,r.status||'Hadir',r.clock_in??null,r.clock_out??null,Number(r.ot_hours)||0,Number(r.late_min)||0,r.hours??null,r.dist??null,r.acc??null,r.src||'manual',r.note??null,r.shift??null,r.shift_start??null,hid];
// Restore: hotel dalam backup dicocokkan dengan hotel klien lewat nama. Hotel yang cocok ditimpa datanya; yang belum ada dibuat baru. Hotel lain tidak disentuh.
export async function POST(req:Request){
  const a=await auth(req,{admin:true});if('res' in a)return a.res;
  try{const j=await req.json();
    let hotels:{id:string;name:string;version:number;data:any}[]=[],att:any[]=[],pins:any[]=[];
    if(j?.app==='corestay-people'&&j.v>=3&&Array.isArray(j.hotels)){hotels=j.hotels;att=j.att||[];pins=j.pins||[]}
    else{let state:any,rows:any[]=[];
      if(j?.app==='corestay-people'&&j.state){state=j.state;rows=j.att||[];pins=j.pins||[]}
      else if(j&&Array.isArray(j.emps)){const {att:old=[],...rest}=j;state=rest;rows=old.filter((x:any)=>x.appr!=='rejected').map((x:any)=>({id:x.id,emp_id:x.empId,work_date:x.date,status:x.status,clock_in:x.in||null,clock_out:x.out||null,ot_hours:x.otHours||0,late_min:x.lateMin||0,hours:x.hours??null,dist:x.dist??null,acc:null,src:x.src==='selfie'?'qr':'manual',note:x.note||null}))}
      else return json({error:'File backup tidak dikenali'},400);
      const parts=splitLegacy(state),emp2h=new Map<string,string>();
      hotels=parts.map(p=>{const id=randomUUID();for(const e of p.doc.emps)emp2h.set(e.id,id);return {id,name:p.name,version:1,data:p.doc}});
      att=rows.filter((r:any)=>emp2h.has(r.emp_id)).map((r:any)=>({...r,hotel_id:emp2h.get(r.emp_id)}));pins=pins.filter((r:any)=>emp2h.has(r.emp_id)).map((r:any)=>({...r,hotel_id:emp2h.get(r.emp_id)}))}
    const exist=await q(`select id, name from hr_hotel where tenant_id=$1`,[a.tid]),byName=new Map(exist.map((r:any)=>[String(r.name).toLowerCase(),r.id as string]));
    const idMap=new Map<string,string>(),ops:{text:string;params?:any[]}[]=[];
    for(const h of hotels){const qr=h.data?.geo?.[h.name]?.qr||null;let id=byName.get(h.name.toLowerCase());
      if(id){ops.push({text:`delete from hr_att where hotel_id=$1`,params:[id]},{text:`delete from hr_pin where hotel_id=$1`,params:[id]},{text:`update hr_hotel set data=$1::jsonb, version=version+1, qr=$2 where id=$3 and tenant_id=$4`,params:[JSON.stringify(h.data),qr,id,a.tid]})}
      else{id=randomUUID();ops.push({text:`insert into hotels(id,tenant_id,name) values($1,$2,$3)`,params:[id,a.tid,h.name]},{text:`insert into hr_hotel(id,name,data,version,qr,tenant_id) values($1,$2,$3::jsonb,1,$4,$5)`,params:[id,h.name,JSON.stringify(h.data),qr,a.tid]})}
      idMap.set(h.id,id)}
    for(let i=0;i<att.length;i+=300){const ch=att.filter((r:any)=>idMap.has(r.hotel_id)).slice(i,i+300),ps:any[]=[];if(!ch.length)continue;
      const vals=ch.map((r:any,k:number)=>{ps.push(...attParams(r,idMap.get(r.hotel_id)||null));const o=k*16;return `(${Array.from({length:16},(_,c)=>'$'+(o+c+1)).join(',')})`}).join(',');
      ops.push({text:`insert into hr_att(${COLS}) values ${vals} on conflict do nothing`,params:ps})}
    for(const p of pins)if(idMap.has(p.hotel_id))ops.push({text:`insert into hr_pin(emp_id,pin_hash,hotel_id) values($1,$2,$3) on conflict do nothing`,params:[p.emp_id,p.pin_hash,idMap.get(p.hotel_id)]});
    await tx(ops);return json({ok:true,hotels:hotels.length,emps:hotels.reduce((t,h)=>t+(h.data?.emps||[]).length,0),att:att.length,note:''})}
  catch(e:any){return json({error:errMsg(e)},500)}}
