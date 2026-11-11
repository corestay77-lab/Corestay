'use client';
import { useSyncExternalStore } from 'react';
import { DB, Att, EMPTY, normalize, nextCode } from './payroll';
import { monthAdd } from './geo';
// Sumber data = database Vercel (Neon) lewat /api. Data HRD (karyawan, gaji, hotel, jadwal, dll.) satu dokumen;
// absensi ada di tabel sendiri dan ikut dimuat ke db.att supaya Rekap & Payroll membacanya dengan cara yang sama.
export type Gate={state:'loading'|'none'|'empty'|'upgrade'|'error'|'setup'|'login'|'ok';msg?:string};
export type Me={id:string;username:string;role:'admin'|'hotel';hotelId:string|null};
export type HotelRef={id:string;name:string;username?:string};
let doc:DB=EMPTY,att:Att[]=[],version=0,gate:Gate={state:'loading'},attFrom='',saveErr='',view:DB=EMPTY;
// multi-hotel: setiap hotel punya data sendiri. Login hotel terkunci ke hotelnya; admin pusat memilih hotel aktif.
let me:Me|null=null,hotels:HotelRef[]=[],hotelId='';
const subs=new Set<()=>void>();
const rebuild=()=>{view={...doc,att}};
const emit=()=>{rebuild();subs.forEach(s=>s())};
export async function api(path:string,init:RequestInit={}){
  const r=await fetch(path,{...init,headers:{'Content-Type':'application/json',...(hotelId?{'X-Hotel':hotelId}:{}),...(init.headers||{})},cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e:any=new Error(j.error||`HTTP ${r.status}`);e.status=r.status;throw e}return j}
export const read=():DB=>view;
let booted=false;
export async function refreshGate(){
  try{const s=await api('/api/hris/auth');
    if(s.db==='none')gate={state:'none'};else if(s.db==='empty')gate={state:'empty'};else if(s.db==='upgrade')gate={state:'upgrade'};else if(s.db==='error')gate={state:'error',msg:s.error};
    else if(s.auth==='setup')gate={state:'setup'};else if(s.auth==='login')gate={state:'login'};
    else{me=s.me;gate={state:'ok'};await loadHotels();
      hotelId=me!.role==='hotel'?(me!.hotelId||''):(()=>{try{const h=localStorage.getItem('cs-hotel');return hotels.some(x=>x.id===h)?h!:hotels[0]?.id||''}catch{return hotels[0]?.id||''}})();
      if(hotelId){await loadAll();return}doc=EMPTY;att=[];attFrom=''}
  }catch(e:any){gate={state:'error',msg:e.message}}
  emit()}
async function loadHotels(){try{hotels=(await api('/api/hris/hotels')).hotels}catch{hotels=[]}}
export async function reloadHotels(){await loadHotels();if(me?.role==='admin'&&hotelId&&!hotels.some(h=>h.id===hotelId))hotelId=hotels[0]?.id||'';emit()}
export async function switchHotel(id:string){hotelId=id;try{localStorage.setItem('cs-hotel',id)}catch{}doc=EMPTY;att=[];attFrom='';emit();if(id)await loadAll();else emit()}
export async function loadAll(){
  const s=await api('/api/hris/state');doc=normalize(s.data);version=s.version;
  if(!s.data?.period)doc={...doc,period:new Date().toISOString().slice(0,7)};
  attFrom='';await loadAtt(true)}
// absensi dimuat 6 bulan ke belakang dari periode aktif (untuk grafik tren); dimuat ulang bila periode digeser lebih jauh
export async function loadAtt(force=false){
  const from=monthAdd(doc.period,-6);if(!force&&attFrom&&from>=attFrom){emit();return}
  try{const r=await api('/api/hris/att?from='+from);att=r.att;attFrom=from}catch(e:any){if(e.status===401){gate={state:'login'}}}emit()}
let timer:any=null,saving=false,dirty=false;
async function flush(){
  if(!hotelId)return;
  if(saving){dirty=true;return}saving=true;dirty=false;
  try{const d:any={...doc};delete d.att;
    const cut=new Date(Date.now()-200*864e5).toISOString().slice(0,10);d.sched=d.sched.filter((s:any)=>s.date>=cut); // jadwal lama dipangkas agar data tetap ringan
    const r=await api('/api/hris/state',{method:'PUT',body:JSON.stringify({data:d,version})});version=r.version;saveErr=''}
  catch(e:any){if(e.status===409){saveErr=e.message;await loadAll()}else if(e.status===401){gate={state:'login'}}else saveErr='Gagal menyimpan: '+e.message}
  saving=false;emit();if(dirty)flush()}
const save=()=>{clearTimeout(timer);timer=setTimeout(flush,500)};
export function update(fn:(d:DB)=>DB,log?:string){
  let n=fn(view);const{att:_a,...rest}=n;n={...rest,att:[]} as DB;
  if(log){const u=n.settings.users.find(x=>x.id===n.settings.activeUser)?.name;n={...n,audit:[{t:new Date().toISOString(),m:log,u},...n.audit].slice(0,300)}}
  const periodChanged=n.period!==doc.period;doc=n;emit();save();if(periodChanged)loadAtt()}
// Absensi: perubahan lewat API lalu dimuat ulang. Log aktivitas ikut tersimpan di Audit Log.
const afterAtt=async(log:string)=>{await loadAtt(true);update(d=>d,log)};
export const attAdd=async(r:{empId:string;date:string;status:string;otHours?:number;note?:string},log:string)=>{await api('/api/hris/att',{method:'POST',body:JSON.stringify(r)});await afterAtt(log)};
export const attSet=async(id:string,patch:{otHours?:number;status?:string},log:string)=>{await api('/api/hris/att',{method:'PATCH',body:JSON.stringify({id,...patch})});await afterAtt(log)};
export const attDel=async(id:string,log:string)=>{await api('/api/hris/att?id='+id,{method:'DELETE'});await afterAtt(log)};
// Sel langsung berubah di layar sebelum server menjawab; bila gagal, data dimuat ulang dari server dan error dilempar.
const attLocal=(empId:string,dates:string[],status:string)=>{att=[...att.filter(a=>!(a.empId===empId&&dates.includes(a.date)&&a.src==='manual'&&a.status!=='Hadir')),...(status?dates.map(date=>({id:'tmp-'+uid(),empId,date,status:status as Att['status'],otHours:0,src:'manual' as const})):[])];emit()};
export const attCells=async(empId:string,dates:string[],status:string,log?:string)=>{attLocal(empId,dates,status);
  try{await api('/api/hris/att',{method:'PUT',body:JSON.stringify({empId,dates,status})})}catch(e){await loadAtt(true);throw e}
  if(log)await afterAtt(log);else await loadAtt(true)};
export const attDelEmp=async(empId:string)=>{await api('/api/hris/att?emp='+empId,{method:'DELETE'});await loadAtt(true)};
const sub=(f:()=>void)=>{subs.add(f);if(!booted){booted=true;refreshGate()}return()=>{subs.delete(f)}};
export function useDB(){
  const db=useSyncExternalStore(sub,()=>view,()=>EMPTY);
  const locked=db.periods[db.period]==='locked';
  return {db,update,locked,status:db.periods[db.period]||'draft',gate,saveErr,me,hotels,hotelId,switchHotel};
}
export const uid=()=>crypto.randomUUID();
export const newToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b=>b.toString(16).padStart(2,'0')).join('');
export function assignCode(d:DB,dept:string):[string,DB]{return[nextCode(d,dept),d]}
