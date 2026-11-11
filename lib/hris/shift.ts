// Menentukan shift saat karyawan absen masuk. Fungsi murni (tanpa database) supaya mudah diuji.
import { addDays, absMin, toMin } from './geo';
export const HM=/^\d{2}:\d{2}$/;
export type ShiftDef={name:string;start:string;end:string};
export type Sched={empId:string;date:string;shift:string};
export type Resolved={name:string;start:string;end:string;auto:boolean;workDate:string};
export const validShifts=(l:any):ShiftDef[]=>(Array.isArray(l)?l:[]).filter(x=>x&&HM.test(String(x.start))&&HM.test(String(x.end)));
const hm=(m:number)=>`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const dur=(s:ShiftDef)=>((toMin(s.end)-toMin(s.start)+1440)%1440)||1440;
// 1) Ada jadwal → pakai jadwal (shift malam kemarin yang masih berjalan ikut dipertimbangkan, dipilih yang jam mulainya paling dekat dengan sekarang).
// 2) Tanpa jadwal → shift otomatis: yang jam mulainya PALING DEKAT dengan jam absen (dari shift di Pengaturan → Shift Kerja).
// 3) Belum ada shift sama sekali → jam masuk default hotel, 8 jam.
export function resolveShift(shifts:ShiftDef[],sched:Sched[],empId:string,fallbackStart:string,now:{date:string;time:string}):Resolved{
  const nowA=absMin(now.date,now.time),y=addDays(now.date,-1);
  const sched1=(date:string)=>{const sc=sched.find(s=>s.empId===empId&&s.date===date);return sc?shifts.find(x=>x.name===sc.shift):undefined};
  const cands:{sh:ShiftDef;date:string}[]=[],sy=sched1(y),st=sched1(now.date);
  if(sy&&toMin(sy.end)<=toMin(sy.start)){const a=absMin(y,sy.start);if(nowA>=a&&nowA<=a+dur(sy))cands.push({sh:sy,date:y})}
  if(st)cands.push({sh:st,date:now.date});
  if(cands.length){const b=cands.reduce((m,c)=>Math.abs(nowA-absMin(c.date,c.sh.start))<Math.abs(nowA-absMin(m.date,m.sh.start))?c:m);return {...b.sh,auto:false,workDate:b.date}}
  if(shifts.length){let best:{diff:number;sh:ShiftDef;dd:string}|null=null;
    for(const dd of [y,now.date,addDays(now.date,1)])for(const sh of shifts){const diff=Math.abs(nowA-absMin(dd,sh.start));if(!best||diff<best.diff)best={diff,sh,dd}}
    return {...best!.sh,auto:true,workDate:best!.dd>now.date?now.date:best!.dd}}
  const start=HM.test(fallbackStart)?fallbackStart:'08:00';return {name:'',start,end:hm(toMin(start)+480),auto:true,workDate:now.date}}
// Jam mulai/selesai shift yang tersimpan di baris absensi (untuk menghitung lembur saat pulang).
export function shiftForRow(shifts:ShiftDef[],row:{shift?:string|null;shift_start?:string|null},fallbackStart:string){
  const nm=String(row.shift||'').replace(/ \(otomatis\)$/,''),sh=shifts.find(x=>x.name===nm);
  if(sh)return {start:HM.test(String(row.shift_start))?String(row.shift_start):sh.start,end:sh.end};
  const start=HM.test(String(row.shift_start))?String(row.shift_start):HM.test(fallbackStart)?fallbackStart:'08:00';return {start,end:hm(toMin(start)+480)}}
export const shiftLabel=(r:Resolved)=>r.name?`${r.name}${r.auto?' (otomatis)':''}`:'';

// ABSEN MASUK WAJIB SESUAI JADWAL (mode strict, bawaan): jadwal bulanan = patokan.
// Ditolak bila: tidak ada jadwal hari itu, jadwal Libur, shift belum dibuka (earlyMin menit sebelum mulai), atau shift sudah berakhir.
// Mode off: tanpa pemeriksaan, shift dipilih otomatis dari jam absen (resolveShift).
export type Plan={ok:true;r:Resolved;opens:string}|{ok:false;reason:string;info?:{name:string;start:string;end:string}};
const clock=(min:number)=>hm(((min%1440)+1440)%1440);
export function planClockIn(shifts:ShiftDef[],sched:Sched[],empId:string,fallbackStart:string,now:{date:string;time:string},opt:{strict:boolean;earlyMin:number}):Plan{
  if(!opt.strict){const r=resolveShift(shifts,sched,empId,fallbackStart,now);return {ok:true,r,opens:clock(toMin(r.start)-opt.earlyMin)}}
  const nowA=absMin(now.date,now.time),y=addDays(now.date,-1),raw=(date:string)=>sched.find(s=>s.empId===empId&&s.date===date);
  const byDate=(date:string)=>{const sc=raw(date);return sc?shifts.find(x=>x.name===sc.shift):undefined};
  const cands:{sh:ShiftDef;date:string}[]=[],sy=byDate(y),st=byDate(now.date);
  if(sy&&toMin(sy.end)<=toMin(sy.start)){const a=absMin(y,sy.start);if(nowA>=a&&nowA<=a+dur(sy))cands.push({sh:sy,date:y})}
  if(st)cands.push({sh:st,date:now.date});
  if(!cands.length){const te=raw(now.date);
    return {ok:false,reason:te?(te.shift==='Libur'?'Hari ini jadwal Anda Libur, jadi tidak bisa absen.':`Jadwal hari ini ("${te.shift}") tidak dikenali. Hubungi HRD.`):'Anda belum dijadwalkan hari ini, jadi belum bisa absen. Hubungi HRD/atasan untuk mengisi jadwal bulanan.'}}
  const b=cands.reduce((m,c)=>Math.abs(nowA-absMin(c.date,c.sh.start))<Math.abs(nowA-absMin(m.date,m.sh.start))?c:m);
  const startA=absMin(b.date,b.sh.start),endA=startA+dur(b.sh),info={name:b.sh.name,start:b.sh.start,end:b.sh.end},opens=clock(toMin(b.sh.start)-opt.earlyMin);
  if(nowA<startA-opt.earlyMin)return {ok:false,reason:`Jadwal Anda hari ini ${info.name} ${info.start}–${info.end}. Absen masuk baru dibuka pukul ${opens}.`,info};
  if(nowA>endA)return {ok:false,reason:`Shift ${info.name} ${info.start}–${info.end} sudah berakhir, jadi tidak bisa absen masuk. Hubungi HRD bila Anda memang bekerja.`,info};
  return {ok:true,r:{...b.sh,auto:false,workDate:b.date},opens}}
