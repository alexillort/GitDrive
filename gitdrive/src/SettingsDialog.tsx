import {useEffect,useState} from 'react';
import {UserRound,Bell,X,ShieldCheck} from 'lucide-react';
export type Identity={name:string,email:string};
export type Settings={remindHours:number,ignoreRules:string[],lfsLimitMB:number};
type Props={api:<T>(action:string,args:object)=>Promise<T>,busy:boolean,error:string,reason?:string,onClose:()=>void,onSaved:(identity:Identity,settings:Settings)=>Promise<void>};
const intervals=[[0,'Nunca'],[1,'1 hora'],[2,'2 horas'],[4,'4 horas'],[8,'8 horas'],[24,'1 día'],[72,'3 días']] as const;
export function SettingsDialog({api,busy,error,reason,onClose,onSaved}:Props){
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[hours,setHours]=useState(4),[rules,setRules]=useState(''),[limit,setLimit]=useState(100),[loaded,setLoaded]=useState(false);
 useEffect(()=>{void Promise.all([api<Identity>('identity',{}),api<Settings>('settings',{})]).then(([i,s])=>{setName(i.name);setEmail(i.email);setHours(s.remindHours);setRules(s.ignoreRules.join('\n'));setLimit(s.lfsLimitMB);setLoaded(true);});},[]);
 return <div className="overlay"><form className="modal settings-modal" onSubmit={e=>{e.preventDefault();void onSaved({name,email},{remindHours:hours,ignoreRules:rules.split(/\r?\n/).map(r=>r.trim()).filter(Boolean),lfsLimitMB:limit});}}><button type="button" className="close" aria-label="Cerrar ajustes" disabled={busy} onClick={onClose}><X size={20}/></button>
 <h2>Ajustes</h2>{reason&&<p className="settings-reason">{reason}</p>}
 <div className="settings-section"><UserRound size={18}/><div><strong>Tu identidad en Git</strong><small>Aparece como autor de cada commit. Se guarda en la configuración global de Git de este equipo.</small></div></div>
 <label htmlFor="git-name">Nombre</label><input id="git-name" autoFocus value={name} disabled={!loaded} onChange={e=>setName(e.target.value)} placeholder="username"/>
 <label htmlFor="git-email">Correo</label><input id="git-email" type="email" value={email} disabled={!loaded} onChange={e=>setEmail(e.target.value)} placeholder="email"/>
 <div className="settings-section"><Bell size={18}/><div><strong>Avisos de respaldo</strong><small>Te avisa cuando un repositorio lleva cambios sin respaldar más tiempo del indicado.</small></div></div>
 <label htmlFor="remind-hours">Avisar después de</label><select id="remind-hours" value={hours} disabled={!loaded} onChange={e=>setHours(+e.target.value)}>{intervals.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
 <div className="settings-section"><ShieldCheck size={18}/><div><strong>Protección al respaldar</strong><small>Antes de cada respaldo se añaden a .gitignore las reglas que falten, y los archivos que superen el límite pasan a Git LFS. Se comprueba también antes de subir.</small></div></div>
 <label htmlFor="ignore-rules">Reglas de .gitignore (una por línea)</label><textarea id="ignore-rules" className="rules-editor" spellCheck={false} value={rules} disabled={!loaded} onChange={e=>setRules(e.target.value)}/>
 <label htmlFor="lfs-limit">Usar Git LFS para archivos de más de (MB)</label><input id="lfs-limit" type="number" min={1} max={2000} value={limit} disabled={!loaded} onChange={e=>setLimit(+e.target.value)}/>
 {error&&<p className="modal-error" role="alert">{error}</p>}
 <div className="modal-buttons"><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary" disabled={busy||!loaded||!name.trim()||!email.trim()}>Guardar</button></div></form></div>;
}
