'use client';
import Shell from '@/components/hris/Shell';
import { useDB } from '@/lib/hris/store';
import { calc, compute, rp, PStatus, DB } from '@/lib/hris/payroll';
const snapFor=(d:DB,to:PStatus)=>{const s={...d.snap};if(to==='locked')s[d.period]=Object.fromEntries(d.emps.filter(e=>e.status==='Aktif').map(e=>[e.id,compute(e,d)]));else delete s[d.period];return s};
export default function Approval(){
  const {db,update,status}=useDB();
  const tot=db.emps.filter(e=>e.status==='Aktif').reduce((s,e)=>s+calc(e,db).net,0);
  const go=(to:PStatus,m:string,from:PStatus[])=><button className="button" disabled={!from.includes(status)} onClick={()=>update(d=>({...d,periods:{...d.periods,[d.period]:to},snap:snapFor(d,to)}),`${m} ${db.period}`)}>{m}</button>;
  return <Shell title="Approval & Payroll Lock" sub="draft → submitted → approved → locked. Saat dikunci, hasil perhitungan disimpan (snapshot) dan tidak berubah lagi.">
    <section className="card panel"><h2>Periode {db.period}</h2><p>Status: <span className="badge">{status}</span> · Total gaji bersih {rp(tot)}</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{go('approved','Setujui',['submitted'])}{go('locked','Kunci payroll',['approved'])}{go('draft','Tolak / kembali ke draft',['submitted','approved'])}{go('draft','Buka kunci',['locked'])}</div></section>
    <section className="card panel" style={{marginTop:12}}><h2>Semua periode</h2><div className="table-wrap"><table><tbody>{Object.entries(db.periods).map(([p,s])=><tr key={p}><td>{p}</td><td><span className="badge">{s}</span></td></tr>)}{!Object.keys(db.periods).length&&<tr><td className="muted">Belum ada periode yang diajukan.</td></tr>}</tbody></table></div></section></Shell>}
