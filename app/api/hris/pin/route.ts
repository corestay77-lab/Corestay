import { q } from '@/lib/hris/db';
import { auth, json, errMsg, hashSecret } from '@/lib/hris/auth';
export const dynamic='force-dynamic';
export async function GET(req:Request){ // karyawan hotel ini yang sudah punya PIN (PIN-nya sendiri tidak pernah dikirim)
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const r=await q<{emp_id:string}>(`select emp_id from hr_pin where hotel_id=$1`,[a.hotelId]);return json({set:r.map(x=>x.emp_id)})}catch(e:any){return json({error:errMsg(e)},500)}}
export async function POST(req:Request){
  const a=await auth(req,{hotel:true});if('res' in a)return a.res;
  try{const b=await req.json();if(!b.empId||!/^\d{4,8}$/.test(String(b.pin||'')))return json({error:'PIN harus 4–8 digit angka'},400);
    const own=await q(`select 1 from hr_hotel where id=$1 and data->'emps' @> $2::jsonb`,[a.hotelId,JSON.stringify([{id:b.empId}])]);
    if(!own.length)return json({error:'Karyawan bukan dari hotel ini'},403);
    await q(`insert into hr_pin(emp_id,pin_hash,hotel_id) values($1,$2,$3) on conflict (emp_id) do update set pin_hash=excluded.pin_hash, fails=0, locked_until=null, hotel_id=excluded.hotel_id`,[b.empId,hashSecret(String(b.pin)),a.hotelId]);
    return json({ok:true})}catch(e:any){return json({error:errMsg(e)},500)}}
