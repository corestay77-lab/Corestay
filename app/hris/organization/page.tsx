'use client';
import { useState } from 'react';
import Shell from '@/components/hris/Shell';
import Form from '@/components/hris/Form';
import HotelQr from '@/components/hris/HotelQr';
import { useDB, newToken } from '@/lib/hris/store';
import { Geo, tzOf } from '@/lib/hris/payroll';
import { TZS } from '@/lib/hris/geo';
export default function Org(){
  const {db,update}=useDB();
  const addDept=(v:Record<string,string>)=>{const n=v.n.trim();if(db.depts.includes(n))return;update(d=>({...d,depts:[...d.depts,n]}),`Tambah Departemen: ${n}`)};
  // Hotel baru langsung dibuatkan kode QR absennya; lokasi diatur di tabel bawah (atau di Pengaturan → Daftar Hotel Awal).
  const List=({title,items,key2,onAdd}:{title:string;items:string[];key2:'hotels'|'depts';onAdd:(v:Record<string,string>)=>void})=><section className="card panel"><h2>{title}</h2>
    <Form fields={[{k:'n',label:'Nama',req:true}]} onAdd={onAdd}/>
    <div className="table-wrap"><table><tbody>{items.map(i=>{const used=db.emps.some(e=>(key2==='hotels'?e.hotel:e.dept)===i);return <tr key={i}><td>{i}</td><td>{used?<span className="badge">dipakai karyawan</span>:<button className="button secondary" onClick={()=>update(d=>{const n={...d,[key2]:d[key2].filter(x=>x!==i)};if(key2==='hotels'){const g={...d.geo};delete g[i];n.geo=g}return n},`Hapus ${title}: ${i}`)}>Hapus</button>}</td></tr>})}
    {!items.length&&<tr><td className="muted">Belum ada data.</td></tr>}</tbody></table></div></section>;
  return <Shell title="Organisasi & Hotel" sub="Departemen, lokasi, QR absen, dan zona waktu hotel ini. Hotel baru didaftarkan admin pusat di Semua Hotel & Login."><div className="grid"><List title="Departemen" items={db.depts} key2="depts" onAdd={addDept}/></div><GeoSection/></Shell>}

function GeoSection(){
  const {db,update}=useDB();const [qrHotel,setQrHotel]=useState('');
  const set=(h:string,patch:Partial<Geo>,m:string)=>update(d=>({...d,geo:{...d.geo,[h]:{lat:0,lng:0,radius:d.settings.radius,shift:d.settings.shift,...(d.geo[h] as Partial<Geo>|undefined),...patch} as Geo}}),`Lokasi absensi ${h}: ${m}`);
  const here=(h:string)=>navigator.geolocation.getCurrentPosition(p=>set(h,{lat:+p.coords.latitude.toFixed(6),lng:+p.coords.longitude.toFixed(6)},'koordinat dari GPS'),()=>alert('Lokasi tidak bisa diakses. Izinkan akses lokasi di browser.'),{enableHighAccuracy:true,timeout:15000});
  const num=(h:string,k:'lat'|'lng'|'radius',v:number)=><input type="number" step="any" defaultValue={v||''} key={h+k+v} style={{width:k==='radius'?90:130}} aria-label={`${k} ${h}`} onBlur={e=>{const n=Number(e.target.value)||0;if(n!==v)set(h,{[k]:n},`${k} ${n}`)}}/>;
  const q=db.geo[qrHotel];
  return <><section className="card panel" style={{marginTop:12}}><h2>Lokasi, radius & QR absen per hotel</h2><p className="muted">Karyawan hanya bisa absen bila berada dalam radius titik hotel. Berdiri di lobi lalu klik &quot;Pakai lokasi saya&quot;. QR dicetak dan ditempel di pos security.</p>
    <div className="table-wrap"><table><thead><tr><th>Hotel</th><th>Latitude</th><th>Longitude</th><th>Radius (m)</th><th>Jam masuk</th><th>Zona waktu</th><th></th></tr></thead><tbody>
    {db.hotels.map(h=>{const g=db.geo[h]||{lat:0,lng:0,radius:db.settings.radius,shift:db.settings.shift};return <tr key={h}><td>{h}{!(g.lat||g.lng)&&<div className="badge wait">lokasi belum diatur</div>}</td><td>{num(h,'lat',g.lat)}</td><td>{num(h,'lng',g.lng)}</td><td>{num(h,'radius',g.radius)}</td>
      <td><input type="time" defaultValue={g.shift} key={h+g.shift} onBlur={e=>e.target.value!==g.shift&&set(h,{shift:e.target.value},'jam masuk '+e.target.value)}/></td>
      <td><select value={tzOf(db,h)} aria-label={`Zona waktu ${h}`} onChange={e=>set(h,{tz:e.target.value},'zona waktu '+e.target.value)}>{TZS.map(t=><option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></td>
      <td style={{whiteSpace:'nowrap'}}><button className="button secondary" onClick={()=>here(h)}>Pakai lokasi saya</button> <button className="button" onClick={()=>{if(!g.qr)set(h,{qr:newToken()},'buat kode QR');setQrHotel(h)}}>QR absen</button></td></tr>})}
    {!db.hotels.length&&<tr><td className="muted">Tambahkan hotel dulu.</td></tr>}</tbody></table></div></section>
    {q?.qr&&<HotelQr hotel={qrHotel} token={q.qr} onRegen={()=>set(qrHotel,{qr:newToken()},'ganti kode QR')} onClose={()=>setQrHotel('')}/>}</>}
