'use client';
import { useEffect, useState } from 'react';
import Shell from '@/components/hris/Shell';
import Form from '@/components/hris/Form';
import { useDB, uid, assignCode, api, attDelEmp } from '@/lib/hris/store';
export default function Employees(){
  const {db,update,locked}=useDB();const [q,setQ]=useState('');
  const [hasPin,setHasPin]=useState<string[]>([]),[pins,setPins]=useState<Record<string,string>>({}),[err,setErr]=useState('');
  const loadPins=()=>api('/api/hris/pin').then(r=>setHasPin(r.set)).catch(()=>{});useEffect(()=>{loadPins()},[]);
  const savePin=async(id:string)=>{setErr('');try{await api('/api/hris/pin',{method:'POST',body:JSON.stringify({empId:id,pin:pins[id]})});setPins({...pins,[id]:''});loadPins()}catch(e:any){setErr(e.message)}};
  const rows=db.emps.filter(e=>(e.name+e.dept+e.hotel+e.position).toLowerCase().includes(q.toLowerCase()));
  return <Shell title="Employee Master" sub="Database karyawan. Perubahan langsung muncul di Kompensasi, Absensi, Payroll, dan Labor Cost.">
    <section className="card panel"><h2>Tambah karyawan</h2>{err&&<p role="alert" className="badge bad">{err}</p>}<p className="muted">ID karyawan (mis. EMP-0001) + PIN dipakai karyawan untuk absen lewat QR di pos security. Atur PIN di tabel di bawah.</p>{!db.hotels.length&&<p className="muted">Tambahkan hotel dulu di Organisasi & Hotel.</p>}
      <Form disabled={locked||!db.hotels.length} fields={[{k:'name',label:'Nama',req:true},{k:'hotel',label:'Hotel',type:'select',opts:db.hotels.map(h=>[h,h])},{k:'dept',label:'Departemen',type:'select',opts:db.depts.map(h=>[h,h])},{k:'position',label:'Jabatan'},{k:'joinDate',label:'Tanggal masuk',type:'date'}]}
        onAdd={v=>update(d0=>{const[code,d]=assignCode(d0,v.dept||d0.depts[0]);return {...d,emps:[...d.emps,{id:uid(),code,name:v.name.trim(),hotel:v.hotel||d.hotels[0],dept:v.dept||d.depts[0],position:v.position||'',joinDate:v.joinDate||'',status:'Aktif',basic:0,allowance:0,deduction:0,thrFactor:0}]}},`Tambah karyawan: ${v.name}`)}/></section>
    <section className="card panel" style={{marginTop:12}}><div className="toolbar"><h2>Daftar karyawan ({rows.length})</h2><div className="search"><input placeholder="Cari nama, hotel, dept…" value={q} onChange={e=>setQ(e.target.value)} aria-label="Cari karyawan di tabel"/></div></div>
      <div className="table-wrap"><table><thead><tr><th>ID</th><th>Nama</th><th>Hotel</th><th>Dept</th><th>Jabatan</th><th>Masuk</th><th>Status</th><th>PIN absen</th><th></th></tr></thead><tbody>
      {rows.map(e=><tr key={e.id}><td>{e.code||'—'}</td><td>{e.name}</td><td>{e.hotel}</td><td>{e.dept}</td><td>{e.position}</td><td>{e.joinDate}</td><td><span className="badge">{e.status}</span></td>
        <td style={{whiteSpace:'nowrap'}}><span className={`badge ${hasPin.includes(e.id)?'ok':'wait'}`}>{hasPin.includes(e.id)?'Sudah':'Belum'}</span> <input type="password" inputMode="numeric" placeholder="4–8 digit" style={{width:90}} aria-label={`PIN ${e.name}`} value={pins[e.id]||''} onChange={x=>setPins({...pins,[e.id]:x.target.value})}/> <button className="button secondary" disabled={!/^\d{4,8}$/.test(pins[e.id]||'')} onClick={()=>savePin(e.id)}>Simpan</button></td>
        <td style={{whiteSpace:'nowrap'}}><button className="button secondary" disabled={locked} onClick={()=>update(d=>({...d,emps:d.emps.map(x=>x.id===e.id?{...x,status:x.status==='Aktif'?'Nonaktif':'Aktif'}:x)}),`Ubah status ${e.name}`)}>{e.status==='Aktif'?'Nonaktifkan':'Aktifkan'}</button> <button className="button secondary" disabled={locked} onClick={()=>{attDelEmp(e.id);update(d=>({...d,emps:d.emps.filter(x=>x.id!==e.id),sched:d.sched.filter(x=>x.empId!==e.id),corr:d.corr.filter(a=>a.empId!==e.id)}),`Hapus karyawan: ${e.name}`)}}>Hapus</button></td></tr>)}
      {!rows.length&&<tr><td colSpan={9} className="muted">Belum ada karyawan.</td></tr>}</tbody></table></div></section></Shell>}
