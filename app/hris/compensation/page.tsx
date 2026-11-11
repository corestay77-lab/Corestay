'use client';
import Shell from '@/components/hris/Shell';
import { useDB } from '@/lib/hris/store';
import { Emp } from '@/lib/hris/payroll';
export default function Comp(){
  const {db,update,locked}=useDB();
  const F:[keyof Emp,string][]=[['basic','Gaji pokok / bln'],['medical','Medical / bln'],['meal','Makan / bln'],['ptkp','PTKP / tahun'],['insurance','Asuransi perusahaan / bln'],['otherCost','Biaya lain / bln']];
  return <Shell title="Compensation Master" sub="Gaji per karyawan (gaji pokok, medical, makan, PTKP, asuransi, biaya lain) plus nominal komponen tambahan per karyawan. Komponen tambahan dibuat di Pengaturan → Pengaturan Payroll (isi 0 untuk meniadakan).">
    <section className="card panel"><div className="table-wrap"><table><thead><tr><th>Karyawan</th>{F.map(f=><th key={f[0]}>{f[1]}</th>)}</tr></thead><tbody>
      {db.emps.map(e=><tr key={e.id}><td>{e.name}<div className="muted">{e.code||'—'} · {e.dept}</div></td>{F.map(([k,l])=><td key={k}><input type="number" min={0} disabled={locked} defaultValue={(e[k] as number)||''} key={e.id+k+e[k]} style={{width:130}} aria-label={`${l} ${e.name}`}
        onBlur={ev=>{const n=Number(ev.target.value)||0;if(n!==((e[k] as number)||0))update(d=>({...d,emps:d.emps.map(x=>x.id===e.id?{...x,[k]:n}:x)}),`Kompensasi ${e.name}: ${l} → ${n}`)}}/></td>)}{db.settings.comps.map(c=>{const cur=e.comps?.[c.id]??c.amount;return <td key={c.id}><input type="number" min={0} disabled={locked} defaultValue={cur} key={e.id+c.id+cur} style={{width:130}} aria-label={`${c.name} ${e.name}`} onBlur={ev=>{const n=Number(ev.target.value)||0;if(n!==cur)update(d=>({...d,emps:d.emps.map(x=>{if(x.id!==e.id)return x;const cm={...(x.comps||{})};if(n===c.amount)delete cm[c.id];else cm[c.id]=n;return {...x,comps:cm}})}),`Kompensasi ${e.name}: ${c.name} → ${n}`)}}/></td>})}</tr>)}
      {!db.emps.length&&<tr><td className="muted">Belum ada karyawan di Employee Master.</td></tr>}</tbody></table></div></section></Shell>}
