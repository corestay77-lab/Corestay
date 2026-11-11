import { nowIn, okTz, DEFAULT_TZ } from './geo';
export type Emp={id:string;code?:string;name:string;hotel:string;dept:string;position:string;joinDate:string;status:'Aktif'|'Nonaktif';basic:number;allowance:number;deduction:number;thrFactor:number;comps?:Record<string,number>;medical?:number;meal?:number;ptkp?:number;ptkpCode?:string;insurance?:number;otherCost?:number};
// Satu baris absensi. Karyawan yang scan QR tercatat otomatis (src 'qr'); sakit/izin/cuti/koreksi diinput HRD (src 'manual').
export type Att={id:string;empId:string;date:string;status:'Hadir'|'Sakit'|'Izin'|'Alpa'|'Cuti';otHours:number;src?:'manual'|'qr'|'selfie';in?:string;out?:string;dist?:number;late?:boolean;lateMin?:number;hours?:number;note?:string;shift?:string;shiftStart?:string};
export type Shift={name:string;start:string;end:string};
export type Sched={id:string;empId:string;date:string;shift:string};
export type Geo={lat:number;lng:number;radius:number;shift:string;qr?:string;tz?:string};
export type Corr={id:string;entered?:string;empId:string;from:string;period:string;desc:string;amount:number};
export type User={id:string;name:string;email:string;role:string;active:boolean};
// Satu baris Master Payroll = satu POSISI dengan jumlah staf (identik dengan menu Master Payroll di Hotel Budget). Angka per orang.
export type MasterRow={id:string;hotel:string;dept:string;position:string;headcount:number;basic:number;medical:number;meal:number;ptkp:number;insurance:number;other:number};
export type Comp={id:string;name:string;type:'Tunjangan'|'Potongan';amount:number;bpjs:boolean};
export type Settings={company:string;companyId:string;npwp:string;address:string;phone:string;email:string;empPrefix:string;empDigits:number;empNext:number;deptCodes:Record<string,string>;radius:number;shift:string;tol:number;maxAcc:number;lateCut:number;geoMode:'strict'|'soft';schedMode:'strict'|'off';inEarly:number;tz:string;jsCo:number;jsEmp:number;otDiv:number;otRate1:number;otRate2:number;otMax:number;alpaDiv:number;comps:Comp[];activeUser:string;users:User[]};
export type PStatus='draft'|'submitted'|'approved'|'locked';
export type DB={hotels:string[];depts:string[];emps:Emp[];att:Att[];corr:Corr[];geo:Record<string,Geo>;shifts:Shift[];sched:Sched[];closed:Record<string,boolean>;budget:Record<string,number>;periods:Record<string,PStatus>;period:string;audit:{t:string;m:string;u?:string}[];snap:Record<string,Record<string,any>>;settings:Settings;master:MasterRow[];cuts:Record<string,Record<string,number>>;lastSync:string|null};
export const EMPTY:DB={hotels:[],depts:['Front Office','Housekeeping','F&B','Engineering','Sales & Marketing','Finance','HR'],emps:[],att:[],corr:[],geo:{},shifts:[{name:'Pagi',start:'07:00',end:'15:00'},{name:'Siang',start:'15:00',end:'23:00'},{name:'Malam',start:'23:00',end:'07:00'}],sched:[],closed:{},budget:{},periods:{},period:new Date().toISOString().slice(0,7),audit:[],snap:{},settings:{company:'CoreStay Advisory',companyId:'CSA-001',npwp:'',address:'',phone:'',email:'',empPrefix:'EMP',empDigits:4,empNext:1,deptCodes:{},radius:100,shift:'08:00',tol:0,maxAcc:100,lateCut:0,geoMode:'strict',schedMode:'strict',inEarly:60,tz:DEFAULT_TZ,jsCo:4.89,jsEmp:2,otDiv:173,otRate1:1.5,otRate2:2,otMax:4,alpaDiv:26,comps:[],activeUser:'USR-001',users:[{id:'USR-001',name:'HR Manager',email:'',role:'Admin',active:true}]},master:[],cuts:{},lastSync:null};
// Gabungkan data (mis. dari backup versi lama) dengan nilai default agar field baru selalu ada.
export const normalize=(j:any):DB=>({...EMPTY,...j,settings:{...EMPTY.settings,...(j?.settings||{})}});
// PTKP per tahun (TK = tidak kawin, K = kawin; angka = tanggungan). Dipakai sebagai saran pengisian kolom PTKP / tahun.
export const PTKP:[string,number][]=[['TK/0',54e6],['TK/1',58.5e6],['TK/2',63e6],['TK/3',67.5e6],['K/0',58.5e6],['K/1',63e6],['K/2',67.5e6],['K/3',72e6]];
// PPh 21 tahunan: tarif progresif 5% / 15% / 25% / 30% / 35% (lapisan 60 jt, 250 jt, 500 jt, 5 M).
export const pph21=(pkp:number)=>{let rest=pkp,prev=0,t=0;for(const[l,r] of [[60e6,.05],[250e6,.15],[500e6,.25],[5e9,.3],[Infinity,.35]]){const w=Math.min(rest,l-prev);if(w<=0)break;t+=w*r;rest-=w;prev=l}return t};
// Zona waktu sebuah hotel: pengaturan hotel → default perusahaan.
export const tzOf=(db:DB,hotel?:string)=>okTz((hotel&&db.geo[hotel]?.tz)||db.settings.tz);
export const rp=(n:number)=>'Rp '+Math.round(n).toLocaleString('id-ID');
// REKAP absensi per karyawan per bulan. Satu-satunya sumber angka absensi untuk halaman Rekap dan Payroll.
// Alpa HANYA dari input manual HRD. Hari terjadwal yang sudah lewat tanpa scan dihitung terpisah (noScan) sebagai informasi, tidak otomatis menjadi alpa.
export function recap(empId:string,db:DB,p=db.period){
  const att=db.att.filter(a=>a.empId===empId&&a.date.startsWith(p)),has=new Set(att.map(a=>a.date)),today=nowIn(tzOf(db,db.emps.find(e=>e.id===empId)?.hotel)).date;
  const noScan=db.sched.filter(s=>s.empId===empId&&s.date.startsWith(p)&&s.shift!=='Libur'&&s.date<today&&!has.has(s.date)).length;
  const n=(s:Att['status'])=>att.filter(a=>a.status===s).length,sum=(f:(a:Att)=>number)=>att.reduce((t,a)=>t+f(a),0);
  return {hadir:n('Hadir'),telat:att.filter(a=>a.status==='Hadir'&&(a.lateMin||0)>0).length,lateMin:sum(a=>a.lateMin||0),sakit:n('Sakit'),izin:n('Izin'),cuti:n('Cuti'),alpa:n('Alpa'),noScan,otHours:sum(a=>a.otHours||0),hours:sum(a=>a.hours||0),belumPulang:att.filter(a=>a.in&&!a.out).length}}
// Departemen Master Payroll (kode sama dengan Hotel Budget) dan padanannya dengan nama departemen di HR.
export const MASTER_DEPTS:[string,string][]=[['FO','Front Office'],['HK','Housekeeping'],['FB','Food & Beverage'],['MOD','Minor Operated Department'],['AG','Executive / General Affair'],['FN','Finance / Accounting'],['HR','Human Resource'],['SEC','Security'],['ENG','Engineering'],['POMEC','POMEC & Utilities'],['SM','Sales & Marketing']];
const DEPT_ALIASES:Record<string,string[]>={FO:['FO','FRONT OFFICE'],HK:['HK','HOUSEKEEPING','HOUSE KEEPING'],FB:['FB','F&B','F & B','FOOD & BEVERAGE','FOOD AND BEVERAGE','FOOD & BEVERAGE DEPARTMENT'],MOD:['MOD','MINOR OPERATED DEPT','MINOR OPERATED DEPT.','MINOR OPERATED DEPARTMENT','MINOR OPERATING DEPT','MINOR OPERATING DEPARTMENT'],AG:['AG','A&G','ADMINISTRATION & GENERAL','EXECUTIVE / GENERAL AFFAIR'],FN:['FN','FINANCE','FINANCE / ACCOUNTING','FINANCE & ACCOUNTING','ACCOUNTING'],HR:['HR','HRD','HUMAN RESOURCE','HUMAN RESOURCES','HUMAN RESOURCES DEPARTMENT'],SEC:['SEC','SECURITY'],ENG:['ENG','ENGINEERING'],POMEC:['POMEC','POMEC & UTILITIES'],SM:['SM','S&M','SALES & MARKETING','SALES AND MARKETING']};
const nz=(t:string)=>String(t||'').trim().toUpperCase().replace(/\s+/g,' ');
export const deptCode=(t:string)=>{const x=nz(t);return Object.keys(DEPT_ALIASES).find(k=>DEPT_ALIASES[k].includes(x))||''};
// nama departemen HR untuk sebuah kode Master Payroll (memakai yang sudah ada; kalau belum ada, nama standar)
export const hrDept=(db:DB,code:string)=>db.depts.find(d=>deptCode(d)===code)||MASTER_DEPTS.find(x=>x[0]===code)?.[1]||code;
export const normKey=nz;
// ID karyawan = KODE DEPARTEMEN + urutan di departemen itu (FO-0001, FO-0002, HK-0001, ...).
// Kode: pengaturan manual (Pengaturan → Penomoran ID) → kode standar Master Payroll → singkatan nama departemen → awalan cadangan.
export const deptPrefix=(db:DB,dept:string)=>{const o=(db.settings.deptCodes?.[dept]||'').trim().toUpperCase();if(o)return o;const c=deptCode(dept);if(c)return c;
  const w=String(dept||'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').split(' ').filter(Boolean),g=w.length>1?w.map(x=>x[0]).join('').slice(0,5):(w[0]||'').slice(0,3);return g||db.settings.empPrefix||'EMP'};
export const pad=(db:DB,n:number)=>String(n).padStart(db.settings.empDigits||4,'0');
export const nextCode=(db:DB,dept:string)=>{const pre=deptPrefix(db,dept),re=new RegExp('^'+pre.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'-(\\d+)$','i');
  return `${pre}-${pad(db,db.emps.reduce((m,e)=>{const x=re.exec(e.code||'');return x?Math.max(m,Number(x[1])):m},0)+1)}`};

// MODEL BIAYA — rumus yang sama persis dengan Master Payroll di Hotel Budget (input per orang, hasil × jumlah staf):
//  THR provisi = gaji pokok ÷ 12 · Jamsostek perusahaan/staf = % gaji pokok · gross = gaji + medical + makan + THR provisi
//  biaya jabatan = 5% gross setahun (maks 6 jt) · PKP/tahun = (gross×12 − biaya jabatan − PTKP) dibulatkan ke bawah ribuan · PPh = tarif progresif
//  TOTAL BIAYA PERUSAHAAN = gross + Jamsostek perusahaan + asuransi + biaya lain. Kolom kosong = 0; PPh baru dihitung bila PTKP diisi.
export type PayIn={basic?:number;medical?:number;meal?:number;ptkp?:number;insurance?:number;other?:number};
export function costModel(x:PayIn,count:number,S:{jsCo:number;jsEmp:number}){
  const n=(v?:number)=>Math.max(0,Number(v)||0),c=Math.max(0,count);
  const basic=n(x.basic),medical=n(x.medical),meal=n(x.meal),insurance=n(x.insurance),other=n(x.other),ptkp=n(x.ptkp);
  const thr=basic/12,grossAnnual=(basic+medical+meal+thr)*12,jobAnnual=Math.min(grossAnnual*.05,6e6),hasPtkp=ptkp>0;
  const pkpY=hasPtkp?Math.max(0,Math.floor((grossAnnual-jobAnnual-ptkp)/1000)*1000):0,pphY=hasPtkp?pph21(pkpY):0;
  const T={basic:basic*c,medical:medical*c,meal:meal*c,thr:Math.round(thr*c),jsCo:Math.round(basic*n(S.jsCo)/100*c),jsEmp:Math.round(basic*n(S.jsEmp)/100*c)};
  const gross=T.basic+T.medical+T.meal+T.thr,ins=insurance*c,oth=other*c;
  return {count:c,hasPtkp,...T,gross,ptkp:ptkp*c,jabatan:jobAnnual/12*c,pkpM:pkpY/12*c,pkpY:pkpY*c,pphY:pphY*c,pphM:pphY/12*c,insurance:ins,other:oth,total:gross+T.jsCo+ins+oth};
}
// Gaji karyawan = nilai yang diisi di menu Payroll → Gaji karyawan (kolom kosong = 0).
export const payInOf=(e:Emp,_db?:DB):PayIn=>({basic:e.basic,medical:e.medical,meal:e.meal,ptkp:e.ptkp,insurance:e.insurance,other:e.otherCost});
export function compute(e:Emp,db:DB){
  const r=recap(e.id,db),p=db.period,S=db.settings,{otHours,lateMin,hours,alpa}=r;
  const cm=costModel(payInOf(e,db),1,S),{basic,medical,meal,thr:thrProv,jsCo,jsEmp,gross,ptkp,jabatan,pkpM,pkpY,pphY,pphM,insurance,other,total}=cm;
  // Penyesuaian bulan berjalan. Potongan absensi (alpa/telat) DIISI MANUAL oleh HRD per karyawan per bulan di Payroll;
  // angka dari Rekap hanya menjadi saran (dibatasi maks. gaji pokok).
  const h1=Math.min(otHours,1),h2=Math.max(otHours-1,0);
  const overtime=basic/(S.otDiv||173)*(S.otRate1*h1+S.otRate2*h2);
  const sugAlpa=basic/(S.alpaDiv||26)*alpa,sugLate=lateMin*(S.lateCut||0),suggest=Math.min(basic,sugAlpa+sugLate);
  const manualCut=Math.max(0,Number(db.cuts?.[p]?.[e.id])||0);
  const lines=(S.comps||[]).map(c=>({name:c.name,type:c.type,bpjs:c.bpjs,amt:Number(e.comps?.[c.id]??c.amount)||0})).filter(l=>l.amt>0);
  const extraAllow=lines.filter(l=>l.type==='Tunjangan').reduce((t,l)=>t+l.amt,0),extraDed=lines.filter(l=>l.type==='Potongan').reduce((t,l)=>t+l.amt,0);
  const corr=db.corr.filter(c=>c.empId===e.id&&c.period===p).reduce((s,c)=>s+c.amount,0);
  // Dibayar tunai bulan ini: THR provisi tidak dibayar bulanan (dicadangkan perusahaan).
  const cash=basic+medical+meal+overtime+extraAllow,cuts=manualCut+extraDed;
  return {basic,medical,meal,thrProv,jsCo,jsEmp,gross,ptkp,jabatan,pkpM,pkpY,pphY,pphM,insurance,other,total,
    otHours,alpa,lateMin,hours,overtime,sugAlpa,sugLate,suggest,manualCut,extraAllow,extraDed,lines,corr,cash,
    net:cash-jsEmp-pphM-cuts+corr,laborCost:total+overtime+extraAllow-cuts+corr};
}
export type Calc=ReturnType<typeof compute>;
// Periode terkunci memakai snapshot saat dikunci. Snapshot format lama (tanpa manualCut) tidak dipakai: dihitung ulang dengan model baru.
export const calc=(e:Emp,db:DB):Calc=>{const s=db.snap?.[db.period]?.[e.id] as Calc|undefined;return s&&'manualCut' in s?s:compute(e,db)};
