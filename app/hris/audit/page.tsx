'use client';
import Shell from '@/components/hris/Shell';
import { useDB } from '@/lib/hris/store';
export default function Audit(){
  const {db}=useDB();
  return <Shell title="Audit Log" sub="Setiap perubahan di semua menu tercatat otomatis (300 terakhir)."><section className="card panel"><div className="table-wrap"><table><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th></tr></thead><tbody>
    {db.audit.map((a,i)=><tr key={i}><td style={{whiteSpace:'nowrap'}}>{new Date(a.t).toLocaleString('id-ID')}</td><td>{a.u||'—'}</td><td>{a.m}</td></tr>)}{!db.audit.length&&<tr><td colSpan={3} className="muted">Belum ada aktivitas.</td></tr>}</tbody></table></div></section></Shell>}
