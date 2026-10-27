import {useState} from 'react';
import {GitBranch,FolderOpen,FolderTree,Archive,ArrowRightLeft,X} from 'lucide-react';
export type BranchChoice={name:string,place:'here'|'folder',folder:string,mode:'shelve'|'carry'};
type Props={kind:'create'|'switch',target?:string,current:string,dirty:number,repoRoot:string,busy:boolean,error:string,pick:()=>Promise<string|null>,onClose:()=>void,onSubmit:(choice:BranchChoice)=>Promise<void>};
export function BranchDialog({kind,target='',current,dirty,repoRoot,busy,error,pick,onClose,onSubmit}:Props){
 const [name,setName]=useState(target),[place,setPlace]=useState<'here'|'folder'>(kind==='create'?'folder':'here'),[mode,setMode]=useState<'shelve'|'carry'>('shelve'),[folder,setFolder]=useState('');
 const parts=repoRoot.split(/[\\/]/),base=parts.pop()||'',parent=parts.join('\\');
 const suggested=name.trim()?`${parent}\\${base} (${name.trim().replace(/[\\/:*?"<>|]/g,'-')})`:'';
 return <div className="overlay"><form className="modal branch-modal" onSubmit={e=>{e.preventDefault();void onSubmit({name:name.trim(),place,folder,mode});}}><button type="button" className="close" aria-label="Cerrar" disabled={busy} onClick={onClose}><X size={20}/></button>
 <h2>{kind==='create'?'Nueva rama':`Cambiar a ${target}`}</h2>
 {kind==='create'&&<><label htmlFor="branch-name">Nombre de la rama</label><input id="branch-name" autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="borrador, version-2, cliente-x…"/></>}
 <label>¿Dónde quieres trabajar{kind==='switch'?` en ${target}`:''}?</label>
 <div className="choice-grid">
  <button type="button" className={place==='folder'?'selected':''} onClick={()=>setPlace('folder')}><FolderTree size={20}/><strong>En su propia carpeta</strong><small>Como un disco aparte: sus archivos nunca se mezclan con los de {current}. Puedes tener ambas abiertas.</small></button>
  <button type="button" className={place==='here'?'selected':''} onClick={()=>setPlace('here')}><GitBranch size={20}/><strong>En esta misma carpeta</strong><small>Los archivos de la carpeta cambian al contenido de la rama.</small></button>
 </div>
 {place==='folder'&&<><label htmlFor="branch-folder">Carpeta de la rama</label><div className="path-input"><input id="branch-folder" value={folder} onChange={e=>setFolder(e.target.value)} placeholder={suggested||'Se creará junto al repositorio'}/><button type="button" title="Elegir carpeta vacía" disabled={busy} onClick={async()=>{const p=await pick();if(p)setFolder(p);}}><FolderOpen size={18}/></button></div><p className="choice-note">Vacío = {suggested||'junto al repositorio'}. {dirty>0?`Tus ${dirty} cambios sin commit se quedan aquí, en ${current}.`:''}</p></>}
 {place==='here'&&dirty>0&&<><label>Tienes {dirty} cambios sin commit en {current}</label><div className="choice-grid">
  <button type="button" className={mode==='shelve'?'selected':''} onClick={()=>setMode('shelve')}><Archive size={20}/><strong>Apartarlos en {current}</strong><small>Se guardan aparte y vuelven solos cuando regreses a {current}.</small></button>
  <button type="button" className={mode==='carry'?'selected':''} onClick={()=>setMode('carry')}><ArrowRightLeft size={20}/><strong>Llevarlos a {kind==='create'?'la nueva rama':target}</strong><small>Siguen sin commit, ahora en la otra rama.</small></button>
 </div></>}
 {error&&<p className="modal-error" role="alert">{error}</p>}
 <div className="modal-buttons"><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary" disabled={busy||!name.trim()}>{place==='folder'?'Abrir en su carpeta':kind==='create'?'Crear rama':'Cambiar de rama'}</button></div></form></div>;
}
