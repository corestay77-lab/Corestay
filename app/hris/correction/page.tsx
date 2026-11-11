'use client';
import Shell from '@/components/hris/Shell';
import Form from '@/components/hris/Form';
import { useDB, uid } from '@/lib/hris/store';
import { rp } from '@/lib/hris/payroll';
import { monthAdd } from '@/lib/hris/geo';
export default function Correction(){
  const {db,update}=useDB();const name=(id:string)=>db.emps.find(e=>e.id===id)?.name||'—';
  const rows=db.corr.filter(c=>c.period===db.period||c.entered===db.period);
  return <Shell title="Payroll Correction" sub="Periode terkunci tidak diubah: koreksi yang dibuat saat terkunci otomatis berlaku di periode berikutnya (negatif = pengurangan).">
    <section className="card panel"><Form disabled={!db.emps.length} fields={[{k:'emp',label:'Karyawan',type:'select',opts:db.emps.map(e=>[e.id,e.name])},{k:'from',label:'Periode asal',type:'text'},{k:'desc',label:'Keterangan',req:true},{k:'amt',label:'Nilai (Rp)',type:'number',req:true}]}
      onAdd={v=>{const emp=v.emp||db.emps[0].id;update(d=>({...d,corr:[...d.corr,{id:uid(),empId:emp,from:v.from||'',entered:d.period,period:d.periods[d.period]==='locked'?monthAdd(d.period,1):d.period,desc:v.desc,amount:Number(v.amt)||0}]}),`Koreksi ${name(emp)}: ${v.desc} ${v.amt}`)}}/></section>
    <section className="card panel" style={{marginTop:12}}><div className="table-wrap"><table><thead><tr><th>Karyawan</th><th>Asal</th><th>Berlaku di</th><th>Keterangan</th><th>Nilai</th><th></th></tr></thead><tbody>
      {rows.map(c=><tr key={c.id}><td>{name(c.empId)}</td><td>{c.from}</td><td>{c.period}</td><td>{c.desc}</td><td>{rp(c.amount)}</td><td><button className="button secondary" onClick={()=>update(d=>({...d,corr:d.corr.filter(x=>x.id!==c.id)}),`Hapus koreksi ${name(c.empId)}`)}>Hapus</button></td></tr>)}
      {!rows.length&&<tr><td colSpan={6} className="muted">Belum ada koreksi pada periode ini.</td></tr>}</tbody></table></div></section></Shell>}
