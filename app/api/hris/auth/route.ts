import { getMe, json, errMsg } from '@/lib/hris/auth';
export const dynamic='force-dynamic';
// Status untuk klien HRIS: sesi dan hak akses berasal dari login CoreStay.
export async function GET(){
  try{const me=await getMe();
    return me?json({db:'ready',auth:'ok',me:{id:me.id,username:me.username,role:me.role,hotelId:me.hotelId}}):json({db:'ready',auth:'login'})}
  catch(e:any){return json({db:'error',auth:'setup',error:errMsg(e)})}}
export async function POST(){return json({error:'Login dan password dikelola di Kelola tim (menu Semua aplikasi).'},400)}
