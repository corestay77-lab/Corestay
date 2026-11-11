// Satu-satunya route tanpa login HRD: dipakai karyawan lewat /absen. Semua validasi dilakukan di server.
import { q, dbConfigured } from '@/lib/hris/db';
import { tenantModules } from '@/lib/data';
import { verifySecret, json, errMsg } from '@/lib/hris/auth';
import { distM, nowIn, okTz, tzShort, addDays, absMin, toMin } from '@/lib/hris/geo';
import { validShifts, shiftForRow, shiftLabel, planClockIn, Resolved } from '@/lib/hris/shift';
export const dynamic='force-dynamic';
type Doc={emps:any[];geo:Record<string,any>;sched:any[];shifts:any[];settings:any;periods:Record<string,string>};
const fail=(error:string,status=200)=>json({ok:false,error},status);
// Hotel dari kode QR (setiap hotel punya QR sendiri) beserta dokumen datanya. Karyawan hanya dicari di hotel pemilik QR.
async function hotelOf(t:string):Promise<{id:string;name:string;d:Doc}|null>{
  if(!t)return null;const r=(await q(`select id, name, data, tenant_id from hr_hotel where qr=$1`,[t]))[0];if(!r)return null;if(!r.tenant_id||!(await tenantModules(r.tenant_id)).includes('hris'))return null;const x=r.data||{};
  return {id:r.id,name:r.name,d:{emps:x.emps||[],geo:x.geo||{},sched:x.sched||[],shifts:validShifts(x.shifts),settings:x.settings||{},periods:x.periods||{}}}}
// Kolom shift untuk catatan absensi (dibuat otomatis sekali bila database lama belum punya).
let cols=false;async function ensureCols(){if(cols)return;await q(`alter table hr_att add column if not exists shift text`);await q(`alter table hr_att add column if not exists shift_start text`);cols=true}
// Gerbang absen masuk: jadwal bulanan sebagai patokan (kecuali mode 'off'), plus keterangan manual HRD (sakit/izin/cuti/alpa) hari itu.
async function gate(d:Doc,empId:string,geo:any,n:{date:string;time:string}):Promise<{ok:boolean;reason:string;r?:Resolved;sch:{name:string;start:string;end:string;opens?:string;auto?:boolean}|null}>{
  const strict=d.settings.schedMode!=='off',early=d.settings.inEarly===undefined?60:Math.max(0,Number(d.settings.inEarly)||0);
  const pl=planClockIn(d.shifts,d.sched,empId,fb(d,geo),n,{strict,earlyMin:early});
  if(!pl.ok)return {ok:false,reason:pl.reason,sch:pl.info||null};
  if(strict){const mb=await q(`select status from hr_att where emp_id=$1 and work_date=$2 and src='manual' and status<>'Hadir' limit 1`,[empId,pl.r.workDate]);
    if(mb.length)return {ok:false,reason:`Hari ini Anda tercatat ${mb[0].status} oleh HRD, jadi tidak bisa absen masuk. Hubungi HRD bila ini keliru.`,sch:{name:pl.r.name,start:pl.r.start,end:pl.r.end,opens:pl.opens}}}
  return {ok:true,reason:'',r:pl.r,sch:{name:pl.r.name,start:pl.r.start,end:pl.r.end,opens:pl.opens,auto:pl.r.auto}}}
const fb=(d:Doc,geo:any)=>String(geo?.shift||d.settings.shift||'08:00');
export async function GET(req:Request){ // ?q=kode-QR → nama hotel (untuk ditampilkan setelah scan)
  if(!dbConfigured())return fail('Database belum dihubungkan.');
  try{const t=new URL(req.url).searchParams.get('q')||'';const h=await hotelOf(t);
    return h?json({ok:true,hotel:h.name}):fail('QR tidak dikenali atau sudah diganti. Scan QR terbaru di pos security.')}catch(e:any){return fail(errMsg(e),500)}}
// Cek ID + PIN. Salah 5 kali → terkunci 15 menit.
async function checkPin(d:Doc,code:string,pin:string){
  const e=d.emps.find((x:any)=>String(x.code||'').toUpperCase()===code.trim().toUpperCase()&&x.status==='Aktif');
  if(!e)return {err:'ID karyawan atau PIN salah'};
  const r=(await q(`select pin_hash, fails, locked_until > now() as locked from hr_pin where emp_id=$1`,[e.id]))[0];
  if(!r)return {err:'PIN belum diatur. Minta HRD mengatur PIN Anda.'};
  if(r.locked)return {err:'Akun terkunci 15 menit karena PIN salah berulang kali.'};
  if(!verifySecret(pin,r.pin_hash)){await q(`update hr_pin set fails=fails+1, locked_until=case when fails+1>=5 then now()+interval '15 minutes' else locked_until end where emp_id=$1`,[e.id]);
    return {err:'ID karyawan atau PIN salah'}}
  if(r.fails)await q(`update hr_pin set fails=0, locked_until=null where emp_id=$1`,[e.id]);
  return {e}}
// Posisi absensi saat ini: baris yang masih terbuka (belum pulang, < 16 jam) → pulang; sudah ada hari ini → selesai; selain itu → masuk.
async function position(empId:string,tz:string){
  const n=nowIn(tz),rows=await q(`select id, work_date, clock_in, clock_out, shift, shift_start from hr_att where emp_id=$1 and src='qr' and work_date>=$2 order by work_date desc, clock_in desc`,[empId,addDays(n.date,-1)]);
  const open=rows.find((r:any)=>r.clock_in&&!r.clock_out&&absMin(n.date,n.time)-absMin(r.work_date,r.clock_in)<=960);
  const today=rows.find((r:any)=>r.work_date===n.date);
  return {n,open,today,kind:(open?'out':today?'done':'in') as 'in'|'out'|'done'}}
// JPEG sungguhan dari kamera? Foto hanya diperiksa lalu dibuang — TIDAK disimpan di mana pun.
const selfieOk=(s:any)=>{if(typeof s!=='string'||!s.startsWith('data:image/jpeg;base64,')||s.length<2000||s.length>400000)return false;try{const b=Buffer.from(s.slice(23,60),'base64');return b[0]===0xff&&b[1]===0xd8}catch{return false}};
export async function POST(req:Request){
  if(!dbConfigured())return fail('Database belum dihubungkan.');
  try{const b=await req.json(),H=await hotelOf(String(b.q||''));
    if(!H)return fail('QR tidak dikenali atau sudah diganti. Scan QR terbaru di pos security.');
    const d=H.d,hotel=H.name;
    const c=await checkPin(d,String(b.code||''),String(b.pin||''));if(!c.e)return fail(c.err!);
    const e=c.e,geo=d.geo[hotel],maxAcc=Number(d.settings.maxAcc)||100;
    if(e.hotel!==hotel)return fail(`Anda terdaftar di ${e.hotel}. Scan QR hotel Anda sendiri.`);
    await ensureCols();
    const tz=okTz(geo?.tz||d.settings.tz),tzl=tzShort(tz),p=await position(e.id,tz);
    if(b.op==='status'){
      const row=p.open||p.today,g=p.kind==='in'?await gate(d,e.id,geo,p.n):null,sch=g?.sch||null;
      const lbl=row?.shift?`${row.shift} ${row.shift_start||''}`.trim():sch?.name?`${sch.name}${sch.auto?' (otomatis)':''} ${sch.start}–${sch.end}`:g&&!g.ok?'tidak ada jadwal':'—';
      return json({ok:true,name:e.name,code:e.code,hotel,shift:lbl,clock_in:row?.clock_in||null,clock_out:p.today?.clock_out||null,kind:p.kind,maxAcc,tz,tzLabel:tzl,soft:d.settings.geoMode==='soft',allowed:g?g.ok:true,reason:g?.reason||'',schedule:sch,strict:d.settings.schedMode!=='off'})}
    if(b.op!=='clock')return fail('Permintaan tidak dikenal');
    if(p.kind==='done')return fail('Absensi hari ini sudah selesai.');
    // — validasi lokasi & selfie —
    // Mode 'strict' (default): lokasi tidak valid → absen ditolak. Mode 'soft': absen tetap masuk, tetapi diberi tanda ⚠ untuk dicek HRD.
    const soft=d.settings.geoMode==='soft',hasGeo=!!geo&&!!(geo.lat||geo.lng);let warn='',dist:number|null=null,accR:number|null=null;
    if(!hasGeo&&!soft)return fail('Lokasi hotel belum diatur oleh HRD.');
    const lat=Number(b.lat),lng=Number(b.lng),acc=Number(b.acc),radius=Number(geo?.radius)||100;
    if(!isFinite(lat)||!isFinite(lng)||!isFinite(acc)){if(!soft)return fail('Lokasi tidak terbaca. Aktifkan GPS lalu coba lagi.');warn='Lokasi tidak terbaca'}
    else{accR=Math.round(acc);if(hasGeo)dist=Math.round(distM(lat,lng,geo.lat,geo.lng));
      if(acc>maxAcc){if(!soft)return fail(`Akurasi GPS ±${accR} m (maks ${maxAcc} m). Pindah ke area terbuka lalu ulangi lokasi.`);warn=`Akurasi GPS ±${accR} m`}
      else if(dist!==null&&dist>radius){if(!soft)return fail(`Anda ${dist} m dari ${hotel} (maks ${radius} m). Absen hanya bisa di area hotel.`);warn=`${dist} m dari hotel`}}
    if(!selfieOk(b.selfie))return fail('Selfie dari kamera diperlukan untuk absen.');
    if(d.periods[p.n.date.slice(0,7)]==='locked')return fail('Payroll periode ini sudah dikunci. Hubungi HRD.');
    if(p.kind==='in'){
      const g=await gate(d,e.id,geo,p.n);if(!g.ok)return fail(g.reason);const sh=g.r!,late=Math.max(0,absMin(p.n.date,p.n.time)-absMin(sh.workDate,sh.start)-(Number(d.settings.tol)||0));
      const ins=await q(`insert into hr_att(id,emp_id,work_date,status,clock_in,late_min,dist,acc,src,note,shift,shift_start,hotel_id) values($1,$2,$3,'Hadir',$4,$5,$6,$7,'qr',$8,$9,$10,$11) on conflict do nothing returning id`,[crypto.randomUUID(),e.id,sh.workDate,p.n.time,late,dist,accR,warn?'⚠ '+warn:null,shiftLabel(sh)||null,sh.start,H.id]);
      if(!ins.length)return fail('Absensi untuk hari/shift ini sudah tercatat.');
      return json({ok:true,kind:'in',tzLabel:tzl,time:p.n.time,lateMin:late,shift:`${shiftLabel(sh)} ${sh.start}`.trim(),warn})}
    // pulang: jam kerja & usulan lembur (kelipatan 30 menit setelah jam selesai shift, maks 4 jam) langsung masuk rekap
    const o=p.open!,sh=shiftForRow(d.shifts,o,fb(d,geo)),hours=+((absMin(p.n.date,p.n.time)-absMin(o.work_date,o.clock_in))/60).toFixed(2);
    let end=toMin(sh.end);if(end<=toMin(sh.start))end+=1440;
    const outM=absMin(p.n.date,p.n.time)-absMin(o.work_date,'00:00'),ot=Math.min(d.settings.otMax===undefined?4:Number(d.settings.otMax)||0,Math.floor(Math.max(0,outM-end)/30)/2);
    await q(`update hr_att set clock_out=$2, hours=$3, ot_hours=$4, note=case when $5::text is null then note else coalesce(note||' · ','')||$5::text end where id=$1`,[o.id,p.n.time,hours,ot,warn?'⚠ pulang: '+warn:null]);
    return json({ok:true,kind:'out',tzLabel:tzl,time:p.n.time,hours,ot,warn})}catch(e:any){return fail(errMsg(e),500)}}
