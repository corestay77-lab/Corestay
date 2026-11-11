'use client';
import Shell from '@/components/hris/Shell';
import { useDB } from '@/lib/hris/store';
import { calc, rp } from '@/lib/hris/payroll';
export default function LaborCost(){
  const {db,update}=useDB();
  const rows=db.depts.map(d=>{const l=db.emps.filter(e=>e.dept===d&&e.status==='Aktif');const actual=l.reduce((a,e)=>a+calc(e,db).laborCost,0);const b=db.budget[d]||0;return{d,n:l.length,actual,b,diff:b-actual}});
  const T=rows.reduce((a,r)=>({n:a.n+r.n,actual:a.actual+r.actual,b:a.b+r.b,diff:a.diff+r.diff}),{n:0,actual:0,b:0,diff:0});
  const csv=()=>{const t=['Departemen,Karyawan,Budget,Aktual,Selisih',...rows.map(r=>[`"${r.d}"`,r.n,r.b,Math.round(r.actual),Math.round(r.diff)].join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=`labor-cost-${db.period}.csv`;a.click()};
  return <Shell title="Labor Cost Control" sub="Biaya karyawan per departemen, total payroll bulanan, budget vs aktual, dan laporan.">
    <section className="kpis">{[['Total payroll '+db.period,rp(T.actual),T.n+' karyawan aktif'],['Total budget',rp(T.b),'Isi per departemen'],['Selisih budget − aktual',rp(T.diff),T.diff<0?'Melebihi budget':'Dalam budget']].map(([l,v,s])=><article className="card kpi" key={l}><div><div className="kpi-label">{l}</div><div className="kpi-value">{v}</div><div className="muted">{s}</div></div></article>)}</section>
    <section className="card panel" style={{marginTop:12}}><div className="toolbar"><h2>Budget vs aktual</h2><button className="button" onClick={csv}>Unduh CSV</button></div><div className="table-wrap"><table><thead><tr><th>Departemen</th><th>Karyawan</th><th>Budget (Rp)</th><th>Aktual</th><th>Selisih</th><th>%</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.d}><td>{r.d}</td><td>{r.n}</td><td><input type="number" min={0} style={{width:150}} aria-label={`Budget ${r.d}`} defaultValue={r.b||''} key={r.d+r.b} onBlur={e=>{const n=Number(e.target.value)||0;if(n!==r.b)update(d=>({...d,budget:{...d.budget,[r.d]:n}}),`Budget ${r.d} → ${n}`)}}/></td><td>{rp(r.actual)}</td><td style={{color:r.diff<0?'#d92d20':undefined}}>{rp(r.diff)}</td><td>{r.b?Math.round(r.actual/r.b*100)+'%':'—'}</td></tr>)}
      <tr><td><b>Total</b></td><td>{T.n}</td><td>{rp(T.b)}</td><td>{rp(T.actual)}</td><td>{rp(T.diff)}</td><td/></tr></tbody></table></div><p className="muted">Aktual = gaji kotor + BPJS perusahaan + koreksi.</p></section></Shell>}
