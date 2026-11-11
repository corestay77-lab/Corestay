import { q, toAtt, periodLocked, AttRow } from '@/lib/hris/db';
import { auth, json, errMsg } from '@/lib/hris/auth';
export const dynamic='force-dynamic';
// karyawan harus milik hotel ini (mencegah menyisipkan absensi untuk karyawan hotel lain)
const own=async(hotelId:string,empId:string)=>(await q(`select 1 from hr_hotel where id=$1 and data->'emps' @> $2::jsonb`,[hotelId,JSON.stringify([{id:String(empId)}])])).length>0;
const ST=['Hadir','Sakit','Izin','Alpa','Cuti'],okDate=(s:any)=>/^\d{4}-\d{2}-\d{2}$/.test(String(s)),LOCK='Payroll periode ini sudah dikunci';
// Absensi satu hotel saja (kolom hotel_id). Daftar sejak bulan tertentu (?from=YYYY-MM).
export async function GET(req:Request){
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const from=new URL(req.url).searchParams.get('from')||'0000-00';
    const r=await q<AttRow>(`select * from hr_att where hotel_id=$2 and work_date>=$1 order by work_date desc, clock_in desc nulls last`,[from+'-01',a.hotelId]);
    return json({att:r.map(toAtt)})}catch(e:any){return json({error:errMsg(e)},500)}}
export async function POST(req:Request){ // input manual: sakit / izin / cuti / alpa / koreksi
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const b=await req.json();
    if(!b.empId||!okDate(b.date)||!ST.includes(b.status))return json({error:'Karyawan, tanggal, dan status wajib diisi'},400);
    if(!(await own(a.hotelId!,b.empId)))return json({error:'Karyawan bukan dari hotel ini'},403);
    if(await periodLocked(b.date,a.hotelId!))return json({error:LOCK},423);
    const id=crypto.randomUUID();
    await q(`insert into hr_att(id,emp_id,work_date,status,clock_in,clock_out,ot_hours,src,note,hotel_id) values($1,$2,$3,$4,$5,$6,$7,'manual',$8,$9)`,
      [id,b.empId,b.date,b.status,b.in||null,b.out||null,Math.max(0,Number(b.otHours)||0),b.note||null,a.hotelId]);
    return json({id})}catch(e:any){return json({error:errMsg(e)},500)}}
export async function PATCH(req:Request){
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const b=await req.json();const r=await q<AttRow>(`select * from hr_att where id=$1 and hotel_id=$2`,[b.id,a.hotelId]);if(!r[0])return json({error:'Data tidak ditemukan'},404);
    if(await periodLocked(r[0].work_date,a.hotelId!))return json({error:LOCK},423);
    const ot=b.otHours===undefined?r[0].ot_hours:Math.max(0,Number(b.otHours)||0),st=b.status===undefined?r[0].status:b.status;
    if(!ST.includes(st))return json({error:'Status tidak valid'},400);
    await q(`update hr_att set ot_hours=$2, status=$3 where id=$1`,[b.id,ot,st]);return json({ok:true})}catch(e:any){return json({error:errMsg(e)},500)}}
export async function DELETE(req:Request){ // ?id=… satu baris, atau ?emp=… semua absensi karyawan (saat karyawan dihapus)
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const u=new URL(req.url).searchParams,id=u.get('id'),emp=u.get('emp');
    if(id){const r=await q<AttRow>(`select work_date from hr_att where id=$1 and hotel_id=$2`,[id,a.hotelId]);if(r[0]&&await periodLocked(r[0].work_date,a.hotelId!))return json({error:LOCK},423);await q(`delete from hr_att where id=$1 and hotel_id=$2`,[id,a.hotelId])}
    else if(emp){await q(`delete from hr_att where emp_id=$1 and hotel_id=$2`,[emp,a.hotelId]);await q(`delete from hr_pin where emp_id=$1 and hotel_id=$2`,[emp,a.hotelId])}
    else return json({error:'id atau emp wajib'},400);
    return json({ok:true})}catch(e:any){return json({error:errMsg(e)},500)}}
// Isi banyak tanggal sekaligus untuk satu karyawan (Daftar Bulanan): hapus input manual lama di tanggal itu, lalu isi status baru (kosong = hanya menghapus).
export async function PUT(req:Request){
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const b=await req.json(),dates:string[]=Array.isArray(b.dates)?b.dates.filter(okDate):[];
    if(!b.empId||!dates.length||dates.length>62)return json({error:'Karyawan dan tanggal wajib diisi'},400);
    if(b.status&&!ST.includes(b.status))return json({error:'Status tidak valid'},400);
    if(!(await own(a.hotelId!,b.empId)))return json({error:'Karyawan bukan dari hotel ini'},403);
    for(const m of new Set(dates.map(x=>x.slice(0,7))))if(await periodLocked(m+'-01',a.hotelId!))return json({error:`Payroll periode ${m} sudah dikunci`},423);
    await q(`delete from hr_att where emp_id=$1 and hotel_id=$3 and work_date = any($2::text[]) and src='manual' and status<>'Hadir'`,[b.empId,dates,a.hotelId]);
    if(b.status)await q(`insert into hr_att(id,emp_id,work_date,status,ot_hours,src,hotel_id) select gen_random_uuid()::text,$1::text,d,$3::text,0,'manual',$4::text from unnest($2::text[]) as d`,[b.empId,dates,b.status,a.hotelId]);
    return json({ok:true})}catch(e:any){return json({error:errMsg(e)},500)}}
