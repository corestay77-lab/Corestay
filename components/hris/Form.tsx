'use client';
import { useState } from 'react';
export type F={k:string;label:string;type?:'text'|'number'|'date'|'time'|'select';opts?:[string,string][];req?:boolean};
export default function Form({fields,onAdd,disabled,btn='Tambah'}:{fields:F[];onAdd:(v:Record<string,string>)=>void;disabled?:boolean;btn?:string}){
  const [v,setV]=useState<Record<string,string>>({});
  const submit=(e:React.FormEvent)=>{e.preventDefault();if(disabled||fields.some(f=>f.req&&!(v[f.k]||'').trim()))return;onAdd(v);setV({})};
  return <form onSubmit={submit} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10}}>
    {fields.map(f=><div className="field" key={f.k}><label>{f.label}</label>
      {f.type==='select'?<select value={v[f.k]??f.opts?.[0]?.[0]??''} onChange={e=>setV({...v,[f.k]:e.target.value})}>{f.opts?.map(([a,b])=><option key={a} value={a}>{b}</option>)}</select>
      :<input type={f.type||'text'} value={v[f.k]||''} onChange={e=>setV({...v,[f.k]:e.target.value})}/>}</div>)}
    <div className="field" style={{alignSelf:'end'}}><button className="button" style={{width:'100%'}} disabled={disabled}>{btn}</button></div></form>}
