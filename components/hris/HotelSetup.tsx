'use client';
import { useState } from 'react';
import HotelQr from './HotelQr';
import { useDB, newToken } from '@/lib/hris/store';
import { Geo } from '@/lib/hris/payroll';
import { TZS, detectTz, okTz } from '@/lib/hris/geo';
// Daftar hotel awal: nama + lokasi + radius. Begitu disimpan, kode QR absen hotel otomatis dibuat dan posternya siap dicetak untuk pos security.
export default function HotelSetup(){
  const {db,update}=useDB();const S=db.settings;
  const [f,setF]=useState({name:'',lat:'',lng:'',radius:String(S.radius),shift:S.shift,tz:detectTz()||okTz(S.tz)}),[qr,setQr]=useState(''),[msg,setMsg]=useState('');
  const here=()=>{setMsg('Mengambil lokasi…');navigator.geolocation.getCurrentPosition(p=>{setF(x=>({...x,lat:p.coords.latitude.toFixed(6),lng:p.coords.longitude.toFixed(6)}));setMsg(`Lokasi terisi (akurasi ±${Math.round(p.coords.accuracy)} m). Sebaiknya ambil saat berdiri di lobi hotel.`)},()=>setMsg('Lokasi tidak bisa diakses. Izinkan lokasi di browser atau isi koordinat manual.'),{enableHighAccuracy:true,timeout:15000})};
  const name=f.name.trim(),lat=Number(f.lat),lng=Number(f.lng),exists=db.hotels.includes(name),ok=name&&!exists&&f.lat&&f.lng&&isFinite(lat)&&isFinite(lng)&&(lat||lng);
  const add=()=>{if(!ok)return;update(d=>({...d,hotels:[...d.hotels,name],geo:{...d.geo,[name]:{lat,lng,radius:Number(f.radius)||d.settings.radius,shift:f.shift||d.settings.shift,tz:f.tz,qr:newToken()}}}),`Daftarkan hotel ${name}`);setQr(name);setF({...f,name:'',lat:'',lng:''});setMsg('')};
  const g=db.geo[qr];
  return <section className="card panel" style={{marginTop:12}}><h2>Daftar Hotel Awal</h2>
    <p className="muted">Daftarkan hotel beserta titik lokasinya. QR absen dibuat otomatis — cetak dan tempel di pos security. Karyawan scan QR itu untuk absen.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:'0 12px'}}>
      <div className="field"><label>Nama hotel</label><input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></div>
      <div className="field"><label>Latitude</label><input inputMode="decimal" value={f.lat} onChange={e=>setF({...f,lat:e.target.value})}/></div>
      <div className="field"><label>Longitude</label><input inputMode="decimal" value={f.lng} onChange={e=>setF({...f,lng:e.target.value})}/></div>
      <div className="field"><label>Radius (m)</label><input type="number" value={f.radius} onChange={e=>setF({...f,radius:e.target.value})}/></div>
      <div className="field"><label>Zona waktu hotel</label><select value={f.tz} onChange={e=>setF({...f,tz:e.target.value})}>{TZS.map(t=><option key={t[0]} value={t[0]}>{t[2]}</option>)}</select></div>
      <div className="field"><label>Jam masuk</label><input type="time" value={f.shift} onChange={e=>setF({...f,shift:e.target.value})}/></div></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="button secondary" onClick={here}>Pakai lokasi saya</button><button className="button" disabled={!ok} onClick={add}>Daftarkan hotel & buat QR</button></div>
    {msg&&<p className="muted" role="status">{msg}</p>}{exists&&<p className="badge bad">Hotel dengan nama ini sudah terdaftar.</p>}
    {db.hotels.length>0&&<div className="table-wrap" style={{marginTop:10}}><table><thead><tr><th>Hotel</th><th>Lokasi</th><th>Radius</th><th></th></tr></thead><tbody>{db.hotels.map(h=>{const x=db.geo[h];return <tr key={h}><td>{h}</td><td>{x&&(x.lat||x.lng)?`${x.lat}, ${x.lng}`:<span className="badge wait">belum diatur</span>}</td><td>{x?.radius??'—'} m</td>
      <td><button className="button secondary" onClick={()=>{if(!x?.qr)update(d=>({...d,geo:{...d.geo,[h]:{lat:0,lng:0,radius:d.settings.radius,shift:d.settings.shift,...(d.geo[h] as Partial<Geo>|undefined),qr:newToken()}}}),`Buat kode QR ${h}`);setQr(h)}}>QR / Poster</button></td></tr>})}</tbody></table></div>}
    {g?.qr&&<HotelQr hotel={qr} token={g.qr} onRegen={()=>update(d=>({...d,geo:{...d.geo,[qr]:{...d.geo[qr],qr:newToken()}}}),`Ganti kode QR ${qr}`)} onClose={()=>setQr('')}/>}</section>}
