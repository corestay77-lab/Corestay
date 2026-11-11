// Sinkronisasi Master Payroll dari file yang diunduh di Hotel Budget.
// Dua format didukung: (1) Draft .json  (lengkap: per orang + PTKP)  (2) Excel .xlsx  (sheet "Payroll & Expenses": nilai per BARIS = total × jumlah staf, dibagi balik per orang; PTKP tidak ada di file ini).
import { DB, MasterRow, deptCode, normKey } from './payroll';
export type BudgetRow={dept:string;position:string;headcount:number;basic:number;medical:number;meal:number;ptkp:number;insurance:number;other:number};
export type Parsed={rows:BudgetRow[];hotelName:string;period:string;skipped:number;source:'draft'|'xlsx'};
// angka format Indonesia / internasional ("5.000.000", "5,000,000", "5000000")
export const num=(v:any):number=>{if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v??'').trim().replace(/[^0-9,.-]/g,'');if(!s)return 0;
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(s.includes(','))s=s.replace(',','.');else if((s.match(/\./g)||[]).length>1||/\.\d{3}$/.test(s))s=s.replace(/\./g,'');
  const x=Number(s);return Number.isFinite(x)?x:0};
const code=(d:any)=>deptCode(String(d||''))||String(d||'').trim().toUpperCase();
export function parseDraft(j:any):Parsed|null{
  const list=j?.form?.payrollEmployees;if(j?.format!=='corestay-hotel-budget-draft'||!Array.isArray(list))return null;
  const rows:BudgetRow[]=[];let skipped=0;
  for(const e of list){if(!(num(e.headcount)>0)||String(e.basicSalary??'').trim()===''){skipped++;continue}
    rows.push({dept:code(e.department),position:String(e.position||'').trim(),headcount:Math.round(num(e.headcount)),basic:num(e.basicSalary),medical:num(e.medical),meal:num(e.meal),ptkp:num(e.ptkpAnnual),insurance:num(e.insuranceMonthly),other:num(e.otherMonthly)})}
  return {rows,hotelName:String(j.form.hotelName||''),period:String(j.form.period||''),skipped,source:'draft'}}
export function parseSheet(data:any[][]):Parsed|null{
  const h=data.findIndex(r=>String(r?.[0]??'').trim()==='Department'&&String(r?.[2]??'').trim()==='Headcount');if(h<0)return null;
  const rows:BudgetRow[]=[];let skipped=0;
  for(let i=h+1;i<data.length;i++){const r=data[i]||[],first=String(r[0]??'').trim();if(!first||/^TOTAL/i.test(first))break;
    const hc=num(r[2]);if(!(hc>0)||String(r[3]??'').trim()==='—'||String(r[3]??'').trim()===''){skipped++;continue}
    const per=(v:any)=>Math.round(num(v)/hc);
    rows.push({dept:code(first),position:String(r[1]??'').replace(/^—$/,'').trim(),headcount:Math.round(hc),basic:per(r[3]),medical:per(r[4]),meal:per(r[5]),ptkp:0,insurance:per(r[9]),other:per(r[10])})}
  return {rows,hotelName:'',period:'',skipped,source:'xlsx'}}
// kunci pencocokan: hotel | kode departemen | jabatan | urutan kemunculan (bila ada dua baris yang sama)
const keyer=()=>{const seen:Record<string,number>={};return (hotel:string,dept:string,pos:string)=>{const k=normKey(hotel)+'|'+dept+'|'+normKey(pos);seen[k]=(seen[k]||0)+1;return k+'#'+seen[k]}};
export type PlanItem={row:BudgetRow;match?:MasterRow;changed:boolean};
export function planMaster(db:DB,hotel:string,p:Parsed){
  const ek=keyer(),existing=new Map<string,MasterRow>();for(const m of db.master)if(normKey(m.hotel)===normKey(hotel))existing.set(ek(m.hotel,m.dept,m.position),m);
  const fk=keyer(),items:PlanItem[]=[],used=new Set<MasterRow>();
  for(const row of p.rows){const m=existing.get(fk(hotel,row.dept,row.position));if(m)used.add(m);
    const changed=!!m&&(m.headcount!==row.headcount||m.basic!==row.basic||m.medical!==row.medical||m.meal!==row.meal||m.insurance!==row.insurance||m.other!==row.other||(row.ptkp>0&&m.ptkp!==row.ptkp));
    items.push({row,match:m,changed})}
  const missing=db.master.filter(m=>normKey(m.hotel)===normKey(hotel)&&!used.has(m));
  return {items,add:items.filter(i=>!i.match).length,upd:items.filter(i=>i.match&&i.changed).length,same:items.filter(i=>i.match&&!i.changed).length,missing:missing.length}}
// Terapkan: baris cocok diperbarui, baris baru ditambahkan, baris yang tidak ada di file DIBIARKAN (tidak dihapus). PTKP lama dipertahankan bila file tidak membawa PTKP.
export function applyMaster(db:DB,hotel:string,p:Parsed,newId:()=>string):MasterRow[]{
  const plan=planMaster(db,hotel,p),out=[...db.master],at=new Map(out.map((m,i)=>[m.id,i]));
  for(const it of plan.items){const r=it.row,base={headcount:r.headcount,basic:r.basic,medical:r.medical,meal:r.meal,insurance:r.insurance,other:r.other};
    if(it.match)out[at.get(it.match.id)!]={...it.match,...base,ptkp:r.ptkp>0?r.ptkp:it.match.ptkp,position:r.position||it.match.position};
    else out.push({id:newId(),hotel,dept:r.dept,position:r.position,ptkp:r.ptkp,...base})}
  return out}
