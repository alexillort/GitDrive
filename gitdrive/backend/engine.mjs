import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {syncDispatch} from './sync.mjs';
import {DEFAULT_IGNORE,DEFAULT_LFS_MB,applyIgnore,trackLarge,pushReport,fixUnpushed,pushError,ignoreRules,ignoredMedia,disableRule} from './protect.mjs';
const exec = promisify(execFile);
async function git(root, args, options={}) {
  try { const job=exec('git', ['-C', root, ...args], {windowsHide:true, timeout:options.timeout||120000,maxBuffer:options.maxBuffer||8*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LITERAL_PATHSPECS:args.includes('check-ignore')||args.includes('stash')?'0':'1'}});job.child.stdin.end(options.input||'');return (await job).stdout; }
  catch(e) { if(options.allowExit1&&e.code===1)return e.stdout||'';throw new Error(e.stderr?.trim() || e.message); }
}
async function rootOf(input) {
 const root = await fs.realpath(input);
 const top = await fs.realpath((await git(root,['rev-parse','--show-toplevel'])).trim());
 if(root.toLowerCase() !== top.toLowerCase()) throw Error('Abre la carpeta raíz del repositorio.');
 return top;
}
async function safe(root, relative, allowRoot=false) {
 if(typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes(':') || relative.split(/[\\/]/).some(x=>x==='..'||x.toLowerCase()==='.git'||/[. ]$/.test(x)||/[<>"|?*\x00-\x1f]/.test(x)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x))) throw Error('Ruta no permitida.');
 const parts=relative.split(/[\\/]/).filter(Boolean);
 if(!parts.length && !allowRoot) throw Error('Selecciona un archivo o carpeta.');
 let current=root;
 for(let i=0;i<parts.length;i++) {
  current=path.join(current,parts[i]);
  try { const stat=await fs.lstat(current); if(stat.isSymbolicLink()) throw Error('Los enlaces simbólicos no se pueden gestionar.'); if(i<parts.length-1 && !stat.isDirectory()) throw Error('Ruta inválida.'); }
  catch(e) { if(e.code!=='ENOENT') throw e; }
 }
 return current;
}
async function changes(root) {
 const raw=await git(root,['status','--porcelain=v1','-z','--untracked-files=all']);
 const records=raw.split('\0'), result=[];
 for(let i=0;i<records.length;i++) {const r=records[i]; if(!r)continue; const status=r.slice(0,2), p=r.slice(3); const old=/R|C/.test(status)?records[++i]:undefined; result.push({path:p,status,old});}
 return result;
}
async function clean(root) {if((await changes(root)).length)throw Error('Guarda tus cambios en un commit, o apártalos, antes de descargar.');}
// Uncommitted work set aside with git stash. A fixed local author keeps it working before an identity exists; stashes are never pushed.
async function shelve(root,label,paths=[]){await git(root,['-c','user.name=GitDrive','-c','user.email=gitdrive@localhost','stash','push','--include-untracked','-m',`${label} · ${stamp()}`,...(paths.length?['--',...paths.map(p=>':(literal)'+p)]:[])]);}
async function shelves(root){
 const raw=await git(root,['stash','list','--format=%gd%x1f%gs%x1f%cI']).catch(()=> '');
 return raw.split('\n').filter(Boolean).map(l=>{const [ref,subject,date]=l.split('\x1f');const m=/^(?:WIP )?[Oo]n ([^:]+): (.*)$/.exec(subject);return {ref,branch:m?m[1]:'',message:m?m[2]:subject,date};});
}
function shelfRef(ref){if(typeof ref!=='string'||!/^stash@\{\d+\}$/.test(ref))throw Error('Identificador inválido.');return ref;}
function overwriteError(e){if(/would be overwritten|overwritten by checkout/i.test(e.message))throw Error('Algunos cambios chocan con archivos de la otra rama. Apártalos o crea un commit antes de cambiar.');throw e;}
async function switchBranch(root,a,create){
 await branchName(root,a.name);
 const dirty=(await changes(root)).length>0;
 if(dirty&&!['shelve','carry'].includes(a.mode))throw Error('Tienes cambios sin commit. Elige si apartarlos o llevarlos a la otra rama.');
 if(dirty&&a.mode==='shelve')await shelve(root,'Guardado aparte');
 try{await git(root,['switch',...(create?['-c']:[]),a.name]);}
 catch(e){if(dirty&&a.mode==='shelve')await git(root,['stash','pop']).catch(()=>{});overwriteError(e);}
 // Each branch gets back the work that was set aside in it, so spaces do not mix.
 let restored=null;
 if(!(await changes(root)).length){const s=(await shelves(root)).find(s=>s.branch===a.name&&s.message.startsWith('Guardado aparte'));if(s&&await git(root,['stash','pop',s.ref]).then(()=>true,()=>false))restored=s.message;}
 return {shelved:dirty&&a.mode==='shelve',restored};
}
async function worktrees(root){
 const raw=await git(root,['worktree','list','--porcelain']);
 return raw.split(/\r?\n\r?\n/).filter(b=>b.trim()).map(block=>{const o={};for(const line of block.split(/\r?\n/)){const i=line.indexOf(' ');o[i<0?line:line.slice(0,i)]=i<0?true:line.slice(i+1);}return {path:path.resolve(o.worktree),branch:typeof o.branch==='string'?o.branch.replace(/^refs\/heads\//,''):'',prunable:!!o.prunable};});
}
const inside=(x,y)=>{const r=path.relative(x,y);return r===''||(!r.startsWith('..')&&!path.isAbsolute(r));};
const pad=n=>String(n).padStart(2,'0');
export function stamp(d=new Date(),time=true){const day=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;return time?`${day} ${pad(d.getHours())}:${pad(d.getMinutes())}`:day;}
export const autoMessage=()=> 'Respaldo automático · '+stamp();
function identityError(e){if(/tell me who you are|user\.(name|email)|empty ident/i.test(e.message))throw Error('Configura tu nombre y correo de Git (git config --global user.name / user.email) para crear commits.');throw e;}
async function commitPaths(root,paths,message){await git(root,['add','--all','--',...paths]);await git(root,['commit','-m',message]).catch(identityError);}
async function hasConflicts(root){return (await changes(root)).some(c=>c.status.includes('U')||['AA','DD'].includes(c.status));}
// Recent repositories live outside any repository so browser and desktop modes share them.
const homeFile=name=>path.join(process.env.GITDRIVE_HOME||path.join(process.env.APPDATA||os.homedir(),'GitDrive'),name);
async function readJson(name,fallback){return fs.readFile(homeFile(name),'utf8').then(JSON.parse,e=>{if(e.code==='ENOENT')return fallback;throw e;});}
async function writeJson(name,value){const file=homeFile(name);await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID();await fs.writeFile(tmp,JSON.stringify(value,null,2),{flag:'wx'});await fs.rename(tmp,file);}
const readWorkspaces=()=>readJson('workspaces.json',[]),writeWorkspaces=list=>writeJson('workspaces.json',list);
const defaultSettings={remindHours:4,ignoreRules:DEFAULT_IGNORE,lfsLimitMB:DEFAULT_LFS_MB};
const loadSettings=async()=>({...defaultSettings,...await readJson('settings.json',{})});
// Network operations can move hundreds of MB; give them far more than the default two minutes.
const NETWORK={timeout:30*60*1000};
async function pushBranch(root){const name=(await git(root,['symbolic-ref','--short','HEAD'])).trim();await git(root,['push','--set-upstream','origin',name],NETWORK);}
const fixNeeded=r=>r.big.length>0||r.ignored>0;
// Oldest modification among pending changes; deleted files fall back to the last commit time.
async function pendingSince(root,changed){
 if(!changed.length)return null;
 const last=+(await git(root,['log','-1','--format=%ct']).catch(()=> '0')).trim()*1000||Date.now();
 const times=await Promise.all(changed.slice(0,500).map(c=>fs.lstat(path.join(root,c.path)).then(s=>Math.max(s.mtimeMs,last),()=>last)));
 return new Date(Math.min(...times)).toISOString();
}
async function globalConfig(key){return (await git(os.homedir(),['config','--global','--get',key],{allowExit1:true}).catch(()=> '')).trim();}
const sameRoot=(x,y)=>x.toLowerCase()===y.toLowerCase();
async function branchName(root,name) {if(!name || name.startsWith('-'))throw Error('Nombre de rama inválido.'); await git(root,['check-ref-format','--branch',name]);}
export async function dispatch(action, a={}) {
 if(action==='remoteCheck') {
  if(typeof a.url!=='string'||!a.url.trim()||a.url.startsWith('-')||a.url.startsWith('ext::'))throw Error('URL inválida.');
  await git(await fs.realpath(a.root||process.cwd()),['ls-remote','--symref','--',a.url,'HEAD']);return true;
 }
 if(action==='clone') {
  if(typeof a.url!=='string'||!a.url.trim()||a.url.startsWith('-')||a.url.startsWith('ext::'))throw Error('URL inválida.');
  const dest=await fs.realpath(a.root);if((await fs.readdir(dest)).length)throw Error('Elige una carpeta vacía para clonar.');
  await git(dest,['clone','--',a.url,'.'],NETWORK);return {root:dest};
 }
 if(action==='workspaces') {
  const list=await readWorkspaces();
  return Promise.all(list.map(async w=>{
   if(!(await fs.stat(path.join(w.root,'.git')).then(()=>true,()=>false)))return {...w,missing:true,pending:0,pendingSince:null};
   const changed=await changes(w.root).catch(()=>[]);
   return {...w,missing:false,pending:changed.length,pendingSince:await pendingSince(w.root,changed)};
  })).then(l=>l.sort((x,y)=>Number(!!y.pinned)-Number(!!x.pinned)||y.lastOpened.localeCompare(x.lastOpened)));
 }
 if(action==='identity')return {name:await globalConfig('user.name'),email:await globalConfig('user.email')};
 if(action==='identitySet') {
  const name=String(a.name||'').trim(),email=String(a.email||'').trim();
  if(!name||/[\r\n<>]/.test(name))throw Error('Escribe un nombre válido.');
  if(!/^[^\s@<>]+@[^\s@<>]+$/.test(email))throw Error('Escribe un correo válido.');
  await git(os.homedir(),['config','--global','user.name',name]);await git(os.homedir(),['config','--global','user.email',email]);return {name,email};
 }
 if(action==='settings')return loadSettings();
 if(action==='settingsSet') {
  const hours=Number(a.remindHours);if(!Number.isFinite(hours)||hours<0||hours>168)throw Error('Elige un intervalo entre 0 y 168 horas.');
  const settings={...await loadSettings(),remindHours:hours};
  if(a.ignoreRules!==undefined){if(!Array.isArray(a.ignoreRules)||a.ignoreRules.some(r=>typeof r!=='string'||/[\r\n]/.test(r)))throw Error('Reglas .gitignore inválidas.');settings.ignoreRules=a.ignoreRules.map(r=>r.trim()).filter(Boolean);}
  if(a.lfsLimitMB!==undefined){const mb=Number(a.lfsLimitMB);if(!Number.isFinite(mb)||mb<1||mb>2000)throw Error('El límite para Git LFS debe estar entre 1 y 2000 MB.');settings.lfsLimitMB=mb;}
  await writeJson('settings.json',settings);return settings;
 }
 if(action==='workspaceForget'||action==='workspacePin') {
  if(typeof a.path!=='string')throw Error('Ruta inválida.');
  const list=await readWorkspaces();
  await writeWorkspaces(action==='workspaceForget'?list.filter(w=>!sameRoot(w.root,a.path)):list.map(w=>sameRoot(w.root,a.path)?{...w,pinned:!!a.pinned}:w));return true;
 }
 if(action==='init') {
  const root=await fs.realpath(a.root);if(!(await fs.stat(root)).isDirectory())throw Error('Selecciona una carpeta.');
  const top=(await git(root,['rev-parse','--show-toplevel']).catch(()=> '')).trim();
  if(top)throw Error(sameRoot(path.resolve(top),root)?'Esta carpeta ya es un repositorio. Usa Abrir repositorio.':'Esta carpeta está dentro de otro repositorio: '+path.resolve(top));
  await git(root,['init','-b','main']);
  const name=(await git(root,['config','user.name']).catch(()=> '')).trim(),email=(await git(root,['config','user.email']).catch(()=> '')).trim();
  if(!name||!email)return {root,initialCommit:null,warning:'Repositorio creado sin commit inicial: configura tu nombre y correo de Git.'};
  // The first commit captures whatever the folder already contains, named after the folder and date.
  const message=`${path.basename(root)} · ${stamp(new Date(),false)}`;
  const prefs=await loadSettings();await applyIgnore(root,prefs.ignoreRules);const lfs=await trackLarge(git,root,prefs.lfsLimitMB);
  await git(root,['add','--all']);await git(root,['commit','--allow-empty','-m',message]);
  return {root,initialCommit:message,lfs:lfs.files};
 }
 const root=await rootOf(a.root);
 if(action.startsWith('sync'))return syncDispatch(action,a,root,{git,safe});
 if(action==='save') {
  const p=await safe(root,a.path);const stat=await fs.lstat(p);if(!stat.isFile()||stat.nlink>1)throw Error('No se puede editar este archivo o enlace.');
  const previous=await fs.readFile(p);if(previous.toString('utf8')!==a.original)throw Error('El archivo cambió fuera del editor. Ciérralo y vuelve a abrirlo para evitar sobrescribir cambios.');
  if(typeof a.content!=='string'||Buffer.byteLength(a.content)>512000)throw Error('El editor admite hasta 500 KB.');
  const tmp=p+'.gitdrive-'+randomUUID();try{await fs.writeFile(tmp,a.content,{flag:'wx',mode:stat.mode});await fs.rename(tmp,p);}finally{await fs.unlink(tmp).catch(()=>{});}return true;
 }
 if(action==='snapshot') {
  const branch=(await git(root,['symbolic-ref','--quiet','--short','HEAD']).catch(()=> 'HEAD separado')).trim();
  const branches=(await git(root,['for-each-ref','--format=%(refname:short)','refs/heads'])).trim().split('\n').filter(Boolean);
  const remote=(await git(root,['remote','get-url','origin']).catch(()=> '')).trim();
  const upstream=(await git(root,['rev-parse','--abbrev-ref','@{upstream}']).catch(()=> '')).trim();
  const counts=upstream?(await git(root,['rev-list','--left-right','--count','HEAD...@{upstream}'])).trim().split(/\s+/):['0','0'];
  const history=(await git(root,['log','-20','--format=%h%x1f%s%x1f%an%x1f%ar']).catch(()=> '')).trim().split('\n').filter(Boolean).map(x=>{const [hash,message,author,date]=x.split('\x1f');return {hash,message,author,date};});
  const changed=await changes(root);
  const spaces=(await worktrees(root)).filter(w=>w.branch&&!sameRoot(w.path,root)&&!w.prunable).map(w=>({branch:w.branch,path:w.path}));
  return {root,branch,branches,remote,upstream,ahead:+counts[0],behind:+counts[1],changes:changed,pendingSince:await pendingSince(root,changed),history,shelves:await shelves(root),spaces};
 }
 if(action==='list') {
  const dir=await safe(root,a.path||'',true); const entries=await fs.readdir(dir,{withFileTypes:true});
  const shown=entries.filter(e=>e.name.toLowerCase()!=='.git').sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name));
  const rel=e=>[a.path,e.name].filter(Boolean).join('/');
  // Shows which .gitignore rule keeps each entry out of Git (tracked files are never reported as ignored).
  const rules=await ignoreRules(git,root,shown.map(e=>rel(e)+(e.isDirectory()?'/':'')));
  return Promise.all(shown.map(async e=>{const stat=await fs.lstat(path.join(dir,e.name));const p=rel(e);return {name:e.name,path:p,directory:e.isDirectory(),link:e.isSymbolicLink(),size:stat.size,modified:stat.mtime.toISOString(),ignored:rules[p+(e.isDirectory()?'/':'')]||null};}));
 }
 if(action==='read') {const p=await safe(root,a.path);const stat=await fs.stat(p);if(stat.size>512000)throw Error('Vista previa limitada a 500 KB.');const data=await fs.readFile(p);if(data.includes(0))throw Error('Archivo binario: vista previa no disponible.');return data.toString('utf8');}
 if(action==='create') {const p=await safe(root,a.path);if(a.directory)await fs.mkdir(p);else await fs.writeFile(p,a.content||'',{flag:'wx'});return true;}
 if(action==='rename') {const from=await safe(root,a.path),to=await safe(root,a.to);if(await fs.lstat(to).then(()=>true,()=>false))throw Error('El destino ya existe.');await fs.rename(from,to);return true;}
 if(action==='trash') {
  const from=await safe(root,a.path); const gitDir=(await git(root,['rev-parse','--absolute-git-dir'])).trim(); const id=randomUUID(); const dir=path.join(gitDir,'gitdrive-trash',id);await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'metadata.json'),JSON.stringify({path:a.path}));await fs.rename(from,path.join(dir,'content'));return {id,path:a.path};
 }
 if(action==='restore') {
  if(!/^[a-f0-9-]{36}$/.test(a.id))throw Error('Identificador inválido.');const gitDir=(await git(root,['rev-parse','--absolute-git-dir'])).trim();const dir=path.join(gitDir,'gitdrive-trash',a.id);const meta=JSON.parse(await fs.readFile(path.join(dir,'metadata.json'),'utf8'));const target=await safe(root,meta.path);if(await fs.lstat(target).then(()=>true,()=>false))throw Error('El destino ya existe.');await fs.rename(path.join(dir,'content'),target);await fs.rm(dir,{recursive:true});return true;
 }
 if(action==='trashList') {const gitDir=(await git(root,['rev-parse','--absolute-git-dir'])).trim(); const dir=path.join(gitDir,'gitdrive-trash');return Promise.all((await fs.readdir(dir).catch(()=>[])).map(async id=>({id,...JSON.parse(await fs.readFile(path.join(dir,id,'metadata.json'),'utf8'))})));}
 if(action==='branchCreate')return switchBranch(root,a,true);
 if(action==='branchSwitch')return switchBranch(root,a,false);
 if(action==='discard') {
  // Undo selected changes, but keep them recoverable in the shelf list.
  const changed=await changes(root);if(changed.some(c=>c.status.includes('U')||['AA','DD'].includes(c.status)))throw Error('Resuelve los conflictos antes de deshacer cambios.');
  if(!Array.isArray(a.paths)||!a.paths.length)throw Error('Selecciona cambios.');
  const paths=[];for(const p of a.paths){await safe(root,p);const c=changed.find(c=>c.path===p);if(!c)throw Error('El estado cambió. Actualiza y vuelve a seleccionar.');paths.push(p);if(c.old)paths.push(c.old);}
  await shelve(root,'Descartado',paths);return true;
 }
 if(action==='shelve') {if(!(await changes(root)).length)throw Error('No hay cambios para apartar.');await shelve(root,'Guardado aparte');return true;}
 if(action==='shelfRestore') {await git(root,['stash','pop',shelfRef(a.ref)]).catch(e=>{if(/conflict/i.test(e.message))throw Error('Se recuperaron con conflictos: revisa los archivos marcados. La copia apartada se conserva.');overwriteError(e);});return true;}
 if(action==='shelfDrop') {await git(root,['stash','drop',shelfRef(a.ref)]);return true;}
 if(action==='spaceAdd') {
  // A branch checked out in its own folder (git worktree), opened as a separate workspace.
  await branchName(root,a.name);
  const all=await worktrees(root),main=all[0].path;
  if(all.some(w=>w.branch===a.name))throw Error('La rama '+a.name+' ya está abierta en otra carpeta.');
  const folder=a.folder?path.resolve(a.folder):path.join(path.dirname(main),`${path.basename(main)} (${a.name.replace(/[\\/:*?"<>|]/g,'-')})`);
  if(inside(main,folder)||inside(folder,main))throw Error('La carpeta de la rama debe estar fuera del repositorio.');
  if(await fs.readdir(folder).then(e=>e.length>0,()=>false))throw Error('La carpeta '+folder+' ya existe y no está vacía.');
  const exists=!!(await git(root,['rev-parse','--verify','--quiet','refs/heads/'+a.name],{allowExit1:true})).trim();
  if(!exists&&!a.create)throw Error('La rama '+a.name+' no existe.');
  if(exists&&a.create)throw Error('Ya existe una rama llamada '+a.name+'.');
  await git(root,exists?['worktree','add',folder,a.name]:['worktree','add','-b',a.name,folder]).catch(e=>{if(/already (checked out|used by worktree)/i.test(e.message))throw Error('La rama '+a.name+' ya está abierta en otra carpeta.');throw e;});
  return {root:await fs.realpath(folder)};
 }
 if(action==='spaceRemove') {
  const target=(await worktrees(root)).slice(1).find(w=>sameRoot(w.path,path.resolve(String(a.path||''))));
  if(!target)throw Error('Esa carpeta no es un espacio de este repositorio.');if(sameRoot(target.path,root))throw Error('Abre otro espacio antes de cerrar este.');
  await git(root,['worktree','remove',target.path]).catch(e=>{if(/modified or untracked|is dirty|contains modified/i.test(e.message))throw Error('Ese espacio tiene cambios sin commit. Ábrelo y guárdalos o apártalos antes de cerrarlo.');throw e;});
  return true;
 }
 if(action==='branchDelete') {await branchName(root,a.name);await git(root,['branch','-d',a.name]);return true;}
 if(action==='diff') {await safe(root,a.path);return await git(root,['diff','HEAD','--',a.path]).catch(()=>git(root,['diff','--',a.path]));}
 if(action==='workspaceTouch') {
  const gitDir=(await git(root,['rev-parse','--absolute-git-dir'])).trim();
  const external=(await fs.readFile(path.join(gitDir,'gitdrive-sync.json'),'utf8').then(JSON.parse,()=>null))?.external||'';
  const remote=(await git(root,['remote','get-url','origin']).catch(()=> '')).trim();
  const list=await readWorkspaces(),old=list.find(w=>sameRoot(w.root,root));
  const branch=(await git(root,['symbolic-ref','--quiet','--short','HEAD']).catch(()=> '')).trim();
  const entry={root,name:path.basename(root),branch,remote,external,lastOpened:new Date().toISOString(),pinned:!!old?.pinned};
  await writeWorkspaces([entry,...list.filter(w=>!sameRoot(w.root,root))].slice(0,50));return entry;
 }
 if(action==='commit') {
  const message=a.message?.trim()||autoMessage();
  const changed=await changes(root);if(changed.some(c=>c.status.includes('U')||['AA','DD'].includes(c.status)))throw Error('Resuelve los conflictos antes de crear un commit.');
  if(!Array.isArray(a.paths)||!a.paths.length)throw Error('Selecciona cambios.');
  if(changed.some(c=>c.status[0]!==' '&&c.status[0]!=='?'&&!a.paths.includes(c.path)))throw Error('Hay archivos preparados fuera de tu selección. Inclúyelos para conservar el índice.');
  const paths=[];for(const p of a.paths){await safe(root,p);const c=changed.find(c=>c.path===p);if(!c)throw Error('El estado cambió. Actualiza y vuelve a seleccionar.');paths.push(p);if(c.old){await safe(root,c.old);paths.push(c.old);}}
  const lfs=await trackLarge(git,root,(await loadSettings()).lfsLimitMB,paths);if(lfs.files.length)paths.push('.gitattributes');
  await commitPaths(root,paths,message);return {message,lfs:lfs.files};
 }
 if(action==='backup') {
  // One click: commit every change (auto message when empty) and push when a remote exists.
  if(await hasConflicts(root))throw Error('Resuelve los conflictos antes de crear un respaldo.');
  // Like gitnube.sh: apply the .gitignore rules and move files over the limit to Git LFS before committing.
  const prefs=await loadSettings();let message=null,ignoreAdded=[],lfs={files:[]};
  if((await changes(root)).length){ignoreAdded=await applyIgnore(root,prefs.ignoreRules);lfs=await trackLarge(git,root,prefs.lfsLimitMB);message=a.message?.trim()||autoMessage();await git(root,['add','--all']);await git(root,['commit','-m',message]).catch(identityError);}
  const result={message,ignoreAdded,lfs:lfs.files,pushed:false};
  const remote=(await git(root,['remote']).catch(()=> '')).split('\n').includes('origin');
  if(!remote)return result;
  // Never send oversized or now-ignored files; offer to rebuild the pending commits instead.
  const report=await pushReport(git,root,prefs.lfsLimitMB,prefs.ignoreRules);
  if(fixNeeded(report))return {...result,needsFix:report};
  try{await pushBranch(root);return {...result,pushed:true};}
  catch(e){return {...result,pushError:pushError(e,report)};}
 }
 if(action==='ignoredMedia')return ignoredMedia(git,root,(await loadSettings()).ignoreRules);
 if(action==='includeIgnored') {
  if(!Array.isArray(a.rules)||!a.rules.length)throw Error('Elige qué reglas desactivar.');
  const gitDir=(await git(root,['rev-parse','--absolute-git-dir'])).trim();
  for(const r of a.rules){if(typeof r?.source!=='string'||typeof r.pattern!=='string')throw Error('Regla inválida.');await disableRule(root,gitDir,r);}
  return true;
 }
 if(action==='pushReport'){const prefs=await loadSettings();return pushReport(git,root,prefs.lfsLimitMB,prefs.ignoreRules);}
 if(action==='fixPending') {
  if(await hasConflicts(root))throw Error('Resuelve los conflictos antes de corregir.');
  const prefs=await loadSettings();
  return fixUnpushed(git,root,prefs.ignoreRules,prefs.lfsLimitMB,'Respaldo corregido · '+stamp()).catch(identityError);
 }
 if(action==='remote') {if(typeof a.url!=='string'||!a.url.trim()||a.url.startsWith('-')||a.url.startsWith('ext::'))throw Error('URL inválida.');const existing=(await git(root,['remote'])).split('\n').includes('origin');await git(root,['remote',existing?'set-url':'add','origin',a.url]);return true;}
 if(action==='fetch') {await git(root,['fetch','origin'],NETWORK);return true;}
 if(action==='pull') {await clean(root);await git(root,['pull','--ff-only'],NETWORK);return true;}
 if(action==='push') {
  const prefs=await loadSettings(),report=await pushReport(git,root,prefs.lfsLimitMB,prefs.ignoreRules);
  if(fixNeeded(report))throw Error(`No se subió: los commits pendientes incluyen ${report.big.length?report.big.length+' archivo(s) de más de 100 MB':''}${report.big.length&&report.ignored?' y ':''}${report.ignored?report.ignored+' archivo(s) que .gitignore excluye':''}. Usa Respaldar y subir para corregirlo.`);
  await pushBranch(root).catch(e=>{throw Error(pushError(e,report));});return true;
 }
 throw Error('Operación desconocida.');
}
