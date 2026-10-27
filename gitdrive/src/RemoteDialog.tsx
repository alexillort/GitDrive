import {useState} from 'react';
import {Github,Gitlab,Server,FolderOpen,Link,Download,X,CheckCircle2} from 'lucide-react';
type Provider='github'|'gitlab'|'other';
export function remoteProvider(url:string){return /github\.com[:/]/i.test(url)?'GitHub':/gitlab\.com[:/]/i.test(url)?'GitLab':'Servidor Git';}
export function RemoteDialog({mode,initial='',folder='',busy,error,pick,onClose,onSubmit,onTest}:{mode:'connect'|'clone',initial?:string,folder?:string,busy:boolean,error:string,pick:()=>Promise<string|null>,onClose:()=>void,onSubmit:(url:string,folder:string)=>Promise<void>,onTest:(url:string)=>Promise<boolean>}){
 const [provider,setProvider]=useState<Provider>(initial?/github\.com/i.test(initial)?'github':/gitlab\.com/i.test(initial)?'gitlab':'other':'github');
 const [value,setValue]=useState(initial),[destination,setDestination]=useState(folder),[transport,setTransport]=useState('https'),[tested,setTested]=useState(false);
 const raw=value.trim();const isUrl=/^(https?:\/\/|ssh:\/\/|git@|[A-Za-z]:[\\/]|\/)/i.test(raw);
 const host=provider==='github'?'github.com':'gitlab.com';const repo=raw.replace(/^\/+|\/+$/g,'').replace(/\.git$/,'');
 const url=isUrl||provider==='other'?raw:transport==='ssh'?`git@${host}:${repo}.git`:`https://${host}/${repo}.git`;
 const valid=!!raw&&(isUrl||provider==='other'||/^[\w.-]+(?:\/[\w.-]+)+$/.test(repo));
 return <div className="overlay"><form className="modal remote-modal" onSubmit={e=>{e.preventDefault();void onSubmit(url,destination);}}><button type="button" className="close" aria-label="Cerrar conexión" disabled={busy} onClick={onClose}><X size={20}/></button>
 <div className="remote-heading-icon">{mode==='clone'?<Download size={23}/>:<Link size={23}/>}</div><h2>{mode==='clone'?'Trae tu repositorio':'Vincula tu repositorio'}</h2><p>{mode==='clone'?'Clona tu proyecto y empieza a trabajar desde tu equipo.':'Conecta este proyecto para bajar y subir tus commits.'}</p>
 <div className="provider-options">{([['github','GitHub',Github],['gitlab','GitLab',Gitlab],['other','Otro servidor',Server]] as const).map(([id,name,Icon])=><button key={id} type="button" className={provider===id?'selected':''} onClick={()=>{setProvider(id);setValue('');setTested(false);}}><Icon size={21}/><span>{name}</span></button>)}</div>
 <label htmlFor="remote-repository">{provider==='other'?'URL HTTPS, SSH o ruta local':'Repositorio o URL completa'}</label><input id="remote-repository" autoFocus value={value} onChange={e=>{setValue(e.target.value);setTested(false);}} placeholder={provider==='other'?'https://git.miempresa.com/equipo/proyecto.git':'equipo/proyecto'}/>
 {provider!=='other'&&!isUrl&&<div className="transport-options"><button type="button" className={transport==='https'?'selected':''} onClick={()=>{setTransport('https');setTested(false);}}>HTTPS</button><button type="button" className={transport==='ssh'?'selected':''} onClick={()=>{setTransport('ssh');setTested(false);}}>SSH</button></div>}
 {valid&&<div className="remote-url">{url}</div>}
 {mode==='clone'&&<><label htmlFor="clone-folder">Carpeta local vacía</label><div className="path-input"><input id="clone-folder" value={destination} onChange={e=>setDestination(e.target.value)} placeholder="C:\\Proyectos\\Mi proyecto"/><button type="button" title="Elegir carpeta de destino" disabled={busy} onClick={async()=>{const selected=await pick();if(selected)setDestination(selected);}}><FolderOpen size={18}/></button></div></>}
 <div className="auth-note">Público o privado · Usa la sesión de Git de tu equipo. Si necesitas autenticarte, configura tu acceso HTTPS o tu clave SSH. No pegues contraseñas ni tokens en la URL.</div>
 {error&&<p className="modal-error" role="alert">{error}</p>}{tested&&<div className="connection-success"><CheckCircle2 size={16}/>Acceso al repositorio confirmado</div>}
 <div className="modal-buttons"><button type="button" disabled={busy||!valid} onClick={async()=>setTested(await onTest(url))}>Probar acceso</button><button className="primary" disabled={busy||!valid||(mode==='clone'&&!destination)}>{busy?'Procesando…':mode==='clone'?'Clonar y abrir':'Vincular repositorio'}</button></div></form></div>;
}
