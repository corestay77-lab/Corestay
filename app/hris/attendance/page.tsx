'use client';
import { useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/hris/Shell';
import Form from '@/components/hris/Form';
import MonthlyRoster from '@/components/hris/MonthlyRoster';
import { useDB, uid, attAdd, attSet, attDel } from '@/lib/hris/store';
import { calc, recap, rp } from '@/lib/hris/payroll';
import { nowIn, fmtDur } from '@/lib/hris/geo';
const TABS=['Rekap','Harian','Daftar Bulanan'];
const STAT=['Sakit','Izin','Cuti','Alpa'],code=(n:string)=>n.slice(0,3);
export default function Attendance(){
  const {db,update,locked}=useDB();const [tab,setTab]=useState(TABS[0]),[dept,setDept]=useState(''),[hotel,setHotel]=useState(''),[dateSel,setDate]=useState(''),[err,setErr]=useState('');
  const date=dateSel||nowIn(db.settings.tz).date;
  // jam masuk yang dipakai menghitung telat: shift dari jadwal, kalau tidak ada = jam masuk default hotel
  const startOf=(empId:string,d:string)=>{const sc=db.sched.find(x=>x.empId===empId&&x.date===d),sh=db.shifts.find(x=>x.name===sc?.shift);if(sh)return `${sh.name} ${sh.start}`;const e=db.emps.find(x=>x.id===empId);return db.geo[e?.hotel||'']?.shift||db.settings.shift};
  const name=(id:string)=>db.emps.find(e=>e.id===id)?.name||'—';
  const act=db.emps.filter(e=>e.status==='Aktif'&&(!hotel||e.hotel===hotel));
  const R=act.map(e=>({e,r:recap(e.id,db),c:calc(e,db)}));
  const T=R.reduce((t,x)=>({hadir:t.hadir+x.r.hadir,telat:t.telat+x.r.telat,alpa:t.alpa+x.r.alpa,ot:t.ot+x.r.otHours,cut:t.cut+x.c.manualCut}),{hadir:0,telat:0,alpa:0,ot:0,cut:0});
  const run=async(f:()=>Promise<void>)=>{setErr('');try{await f()}catch(e:any){setErr(e.message)}};
  const csv=()=>{const rows=[['Kode','Nama','Hotel','Hadir','Telat (kali)','Telat (menit)','Telat (jam & menit)','Sakit','Izin','Cuti','Alpa','Lembur (jam)','Potongan manual (Payroll)'],...R.map(({e,r,c})=>[e.code||'',e.name,e.hotel,r.hadir,r.telat,r.lateMin,fmtDur(r.lateMin),r.sakit,r.izin,r.cuti,r.alpa,r.otHours,Math.round(c.manualCut)])];
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n')],{type:'text/csv'}));a.download=`rekap-absensi-${db.period}.csv`;a.click()};
  const sched=db.sched.filter(s=>s.date.startsWith(db.period)).sort((a,b)=>a.date.localeCompare(b.date));
  const day=db.att.filter(a=>a.date===date).sort((a,b)=>(a.in||'').localeCompare(b.in||''));
  const step=(l:string,href?:string)=>href?<Link href={href} className="badge">{l}</Link>:<span className="badge">{l}</span>;
  return <Shell title="Rekap Absensi" sub="Karyawan scan QR & absen → otomatis masuk rekap → HRD isi potongan manual di Payroll. Daftar bulanan per departemen ada di tab Daftar Bulanan.">
    <div className="card panel" style={{marginBottom:12,display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>{step('1. Karyawan absen (QR + PIN)')}→{step('2. Rekap otomatis (halaman ini)')}→{step('3. Payroll: HRD isi potongan manual','/hris/payroll')}</div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>{TABS.map(t=><button key={t} className={t===tab?'button':'button secondary'} onClick={()=>setTab(t)}>{t}</button>)}</div>
    {err&&<p role="alert" className="badge bad" style={{marginBottom:10,whiteSpace:'normal'}}>{err}</p>}
    {tab==='Rekap'&&<section className="card panel"><div className="toolbar"><h2>Rekap {db.period}</h2><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <select value={hotel} onChange={e=>setHotel(e.target.value)} aria-label="Filter hotel"><option value="">Semua hotel</option>{db.hotels.map(h=><option key={h}>{h}</option>)}</select>
      <button className="button secondary" onClick={csv} disabled={!R.length}>Unduh CSV</button><Link className="button" href="/hris/payroll">Lihat Payroll →</Link></div></div>
      <div className="table-wrap"><table><thead><tr><th>Karyawan</th><th>Hadir</th><th>Telat</th><th>Total telat</th><th>Sakit</th><th>Izin</th><th>Cuti</th><th>Alpa</th><th>Lembur (jam)</th><th>Potongan di Payroll (manual)</th></tr></thead><tbody>
      {R.map(({e,r,c})=>{const cut=c.manualCut;return <tr key={e.id}><td>{e.name}<div className="muted">{e.code||'—'} · {e.hotel}</div></td><td>{r.hadir}</td><td>{r.telat}×</td><td>{r.lateMin?fmtDur(r.lateMin):'—'}</td><td>{r.sakit}</td><td>{r.izin}</td><td>{r.cuti}</td>
        <td>{r.alpa}{r.noScan>0&&<span className="muted" title="Terjadwal tetapi belum ada scan. Belum dihitung alpa: tandai Alpa di Daftar Bulanan bila memang tidak hadir."> · {r.noScan} tanpa scan</span>}</td><td>{r.otHours}</td><td>{cut>0?<b style={{color:'#c0243f'}}>−{rp(cut)}</b>:<span className="muted">—</span>}{r.belumPulang>0&&<span className="badge wait" style={{marginLeft:6}}>{r.belumPulang} belum pulang</span>}</td></tr>})}
      {R.length?<tr><td><b>Total</b></td><td><b>{T.hadir}</b></td><td><b>{T.telat}×</b></td><td/><td/><td/><td/><td><b>{T.alpa}</b></td><td><b>{T.ot}</b></td><td><b>−{rp(T.cut)}</b></td></tr>:<tr><td colSpan={10} className="muted">Belum ada karyawan aktif.</td></tr>}</tbody></table></div>
      <p className="muted">Rekap ini hanya <b>informasi kehadiran</b> dan tidak memotong gaji otomatis. Potongan diisi manual oleh HRD di <Link href="/hris/payroll">Payroll</Link> (kolom Potongan absensi), dengan saran angka dari rekap. Lembur dihitung dari jam pulang setelah jam selesai shift. Alpa hanya dari input HRD (tidak otomatis). &quot;Tanpa scan&quot; = hari terjadwal yang sudah lewat tanpa scan: periksa, lalu tandai Alpa di Daftar Bulanan bila memang tidak hadir.</p></section>}
    {tab==='Harian'&&<><section className="card panel"><div className="toolbar"><h2>Absensi {date} <span className="muted" style={{fontSize:12}}>(jam sesuai zona waktu hotel)</span></h2><input type="date" value={date} onChange={e=>setDate(e.target.value)} aria-label="Tanggal"/></div>
      <div className="table-wrap"><table><thead><tr><th>Karyawan</th><th>Status</th><th>Jadwal masuk</th><th>Masuk</th><th>Pulang</th><th>Telat</th><th>Jam kerja</th><th>Jarak</th><th>Lembur (jam)</th><th></th></tr></thead><tbody>
      {day.map(a=><tr key={a.id}><td>{name(a.empId)}</td><td><span className="badge">{a.status}</span></td><td>{a.status==='Hadir'?(a.shiftStart?`${a.shift||''} ${a.shiftStart}`.trim():startOf(a.empId,a.date)):'—'}</td><td>{a.in||'—'}</td><td>{a.out||(a.in?<span className="badge wait">belum pulang</span>:'—')}</td><td>{a.lateMin?<span className="badge bad">{fmtDur(a.lateMin)}</span>:'—'}</td><td>{a.hours??'—'}</td><td>{a.dist!==undefined?a.dist+' m':'—'}{a.src==='qr'&&a.note&&<span className="badge wait" title={a.note} style={{marginLeft:4}}>⚠ lokasi</span>}</td>
        <td><input type="number" min={0} step={0.5} style={{width:70}} disabled={locked} defaultValue={a.otHours} key={a.id+a.otHours} onBlur={e=>{const n=Number(e.target.value)||0;if(n!==a.otHours)run(()=>attSet(a.id,{otHours:n},`Ubah lembur ${name(a.empId)} ${a.date} → ${n}`))}}/></td>
        <td><button className="button secondary" disabled={locked} onClick={()=>{if(confirm('Hapus absensi ini?'))run(()=>attDel(a.id,`Hapus absensi ${name(a.empId)} ${a.date}`))}}>Hapus</button></td></tr>)}
      {!day.length&&<tr><td colSpan={10} className="muted">Belum ada absensi pada tanggal ini.</td></tr>}</tbody></table></div></section>
      <section className="card panel" style={{marginTop:12}}><h2>Input manual (sakit / izin / cuti / alpa / koreksi)</h2><Form disabled={locked||!db.emps.length} fields={[{k:'emp',label:'Karyawan',type:'select',opts:db.emps.map(e=>[e.id,e.name])},{k:'date',label:'Tanggal',type:'date',req:true},{k:'st',label:'Status',type:'select',opts:['Sakit','Izin','Cuti','Alpa','Hadir'].map(s=>[s,s])},{k:'ot',label:'Jam lembur',type:'number'}]}
        onAdd={v=>{const emp=v.emp||db.emps[0].id,st=v.st||'Sakit';run(()=>attAdd({empId:emp,date:v.date,status:st,otHours:Number(v.ot)||0},`Absensi manual ${name(emp)} ${v.date}: ${st}`))}}/>
        <p className="muted">Input manual dipakai untuk sakit/izin/cuti/alpa atau koreksi. Alpa tidak otomatis: tandai sendiri (mudah lewat tab Daftar Bulanan).</p></section></>}
    {tab===TABS[2]&&<MonthlyRoster/>}
  </Shell>}
