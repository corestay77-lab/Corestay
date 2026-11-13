/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard,Building2,ContactRound,CalendarCheck,Wallet,ChartNoAxesCombined,Settings,Search,Bell,ChevronDown } from 'lucide-react';
import { useDB, api, refreshGate } from '@/lib/hris/store';
import Gate from './Gate';
import { APP_VERSION } from '@/lib/hris/version';
import { nowIn } from '@/lib/hris/geo';
// Sidebar diringkas: menu yang saling berkaitan digabung, halaman di dalamnya tampil sebagai tab.
export const groups=[
  {label:'Dashboard',icon:LayoutDashboard,tabs:[['Dashboard','/hris']]},
  {label:'Karyawan',icon:ContactRound,tabs:[['Employee Master','/hris/employees'],['Organisasi & Hotel','/hris/organization']]},
  {label:'Semua Hotel',icon:Building2,tabs:[['Semua Hotel & Login','/hris/hotels']],admin:true},
  {label:'Absensi',icon:CalendarCheck,tabs:[['Rekap Absensi','/hris/attendance']]},
  {label:'Payroll',icon:Wallet,tabs:[['Payroll Processing','/hris/payroll'],['Approval & Payroll Lock','/hris/approval'],['Payroll Correction','/hris/correction']]},
  {label:'Laporan & Audit',icon:ChartNoAxesCombined,tabs:[['Labor Cost Control','/hris/labor-cost'],['Audit Log','/hris/audit']]},
  {label:'Pengaturan',icon:Settings,tabs:[['Pengaturan & Hak Akses','/hris/settings'],['Integrasi · CoreStay Sync','/hris/sync']]},
] as const;
export const nav=groups.flatMap(g=>g.tabs.map(t=>[t[0],g.icon,t[1]] as const));
export default function Shell({title,sub,children}:{title:string;sub?:string;children:React.ReactNode}){
  const path=usePathname(),{db,update,status,locked,gate,saveErr,me,hotels,hotelId,switchHotel}=useDB();
  const [q,setQ]=useState(''),[open,setOpen]=useState(false),ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();ref.current?.focus()}};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[]);
  const ql=q.trim().toLowerCase(),grp=groups.find(g=>g.tabs.some(t=>t[1]===path))||groups[0];
  const hits=ql?[...nav.filter(n=>n[0].toLowerCase().includes(ql)).map(n=>({l:n[0],s:'Menu',h:n[2] as string})),...db.emps.filter(e=>e.name.toLowerCase().includes(ql)).slice(0,5).map(e=>({l:e.name,s:e.dept,h:'/hris/employees'}))].slice(0,8):[];
  const prof=db.settings.users.find(u=>u.id===db.settings.activeUser)||db.settings.users[0]||{name:'Pengguna',role:'-'};
  const vis=groups.filter(g=>!('admin' in g&&g.admin)||me?.role==='admin');
  const today=nowIn(db.settings.tz).date,pending=db.att.filter(a=>a.in&&!a.out&&a.date<today).length; // lupa absen pulang
  if(gate.state!=='ok')return <Gate g={gate}/>;
  return <><div className="mnav"><img src="/logo-icon.png" alt="CoreStay" width={30} height={30} style={{flex:"0 0 30px"}}/>{vis.map(g=><Link key={g.label} href={g.tabs[0][1]} className={g===grp?'active':''}>{g.label}</Link>)}</div>
  <div className="app"><aside className="sidebar"><Link href="/hris" className="brandlogo" aria-label="CoreStay Advisory · People"><img src="/logo.png" alt="CoreStay Advisory" width={170} height={150}/></Link><div className="appname">PEOPLE · HR · ATTENDANCE · PAYROLL</div>
    <Link href="/" className="backlink">‹ Beranda</Link><nav className="nav">{vis.map(g=>{const I=g.icon;return <Link key={g.label} href={g.tabs[0][1]} className={g===grp?'active':''}><I size={18}/>{g.label}</Link>})}</nav>
    <footer className="sfoot"><b>{db.settings.company}</b><div>CoreStay People · v{APP_VERSION}</div><div>© {new Date().getFullYear()} All rights reserved</div><div>Data tersimpan di database Vercel</div></footer></aside>
    <main className="main"><header className="topbar"><div className="search"><Search size={17} color="#6a7a9e"/><input ref={ref} value={q} onChange={e=>{setQ(e.target.value);setOpen(true)}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} placeholder="Cari karyawan atau menu…" aria-label="Cari"/><kbd>Ctrl K</kbd>
      {open&&hits.length>0&&<div className="results">{hits.map((h,i)=><Link key={i} href={h.h} onClick={()=>setQ('')}><span>{h.l}</span><span className="muted">{h.s}</span></Link>)}</div>}</div>
      <div className="top-right">{me?.role==='admin'?<div className="chip org"><Building2 size={18} color="#1d5bff"/><select aria-label="Hotel aktif" value={hotelId} onChange={e=>switchHotel(e.target.value)} style={{border:0,background:'transparent',fontWeight:700,maxWidth:200,color:'inherit'}}>{hotels.length?hotels.map(h=><option key={h.id} value={h.id}>{h.name}</option>):<option value="">Belum ada hotel</option>}</select></div>:<div className="chip org"><Building2 size={18} color="#1d5bff"/><div><b>{hotels[0]?.name||db.hotels[0]||'Hotel'}</b><small>Login hotel · {me?.username}</small></div></div>}
        <Link href="/hris/attendance" className="bell" aria-label="Notifikasi"><Bell size={19}/>{pending>0&&<em>{pending>99?'99+':pending}</em>}</Link>
        <button className="button secondary" onClick={async()=>{await fetch('/api/logout',{method:'POST'});location.href='/login'}}>Keluar</button><div className="chip prof"><span className="avatar">{prof.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span><div><b>{prof.name}</b><small>{prof.role}</small></div></div></div></header>
    <div className="toolbar"><div><h1>{title}</h1>{sub&&<p className="muted" style={{margin:'2px 0 0'}}>{sub}</p>}</div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}><input type="month" aria-label="Periode aktif" value={db.period} onChange={e=>update(d=>({...d,period:e.target.value}))} style={{border:'1px solid var(--line)',borderRadius:10,padding:'8px 10px',background:'#fff'}}/><span className={`badge ${locked?'lock':status==='approved'?'ok':status==='submitted'?'wait':''}`}>{locked?'🔒 ':''}{status}</span></div></div>
    {grp.tabs.length>1&&<nav className="subtabs" aria-label={grp.label}>{grp.tabs.map(t=><Link key={t[1]} href={t[1]} className={path===t[1]?'active':''}>{t[0]}</Link>)}</nav>}
    {me?.role==='admin'&&!hotelId&&path!=='/hris/hotels'&&<div role="alert" className="card panel" style={{marginBottom:12,borderLeft:'5px solid #ff9c2f'}}>Belum ada hotel. Daftarkan hotel pertama di <Link href="/hris/hotels">Semua Hotel & Login</Link>.</div>}
    {saveErr&&<div role="alert" className="card panel" style={{marginBottom:12,borderLeft:'5px solid #ff3b5c'}}>{saveErr}</div>}
    {locked&&<div className="card panel" style={{marginBottom:12}}>Periode ini terkunci: perubahan karyawan, kompensasi, dan absensi dinonaktifkan. Gunakan Payroll Correction.</div>}
    {children}</main></div></>}
