import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const skipped=new Set(['.git','node_modules','.npm-cache','target','.gitdrive-sync-backups']);
async function exists(p){return fs.lstat(p).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});}
async function inventory(root,safe){
 const files={};let count=0;
 async function walk(rel=''){
  const dir=await safe(root,rel,true);
  for(const item of await fs.readdir(dir,{withFileTypes:true})){
   if(skipped.has(item.name.toLowerCase()))continue;
   if(item.isSymbolicLink())throw Error('La sincronización no admite enlaces simbólicos: '+item.name);
   const name=[rel,item.name].filter(Boolean).join('/'),p=await safe(root,name);
   if(item.isDirectory()){if(await exists(path.join(p,'.git')))throw Error('No se sincronizan repositorios anidados: '+name);await walk(name);}
   else if(item.isFile()){const stat=await fs.lstat(p);if(stat.nlink>1)throw Error('No se sincronizan enlaces duros: '+name);if(stat.size>50*1024*1024)throw Error('Archivo mayor de 50 MB: '+name);if(++count>10000)throw Error('Máximo 10 000 archivos por carpeta.');files[name]=hash(await fs.readFile(p));}
  }
 }await walk();return files;
}
async function writeJson(file,value){const tmp=file+'.'+randomUUID();await fs.writeFile(tmp,JSON.stringify(value,null,2),{flag:'wx'});await fs.rename(tmp,file);}
export async function syncDispatch(action,a,root,{git,safe}){
 const gitDir=(await git(root,['rev-parse','--absolute-git-dir'])).trim();const configFile=path.join(gitDir,'gitdrive-sync.json');
 let config=await fs.readFile(configFile,'utf8').then(JSON.parse,e=>{if(e.code==='ENOENT')return null;throw e;});
 const branch=(await git(root,['symbolic-ref','--short','HEAD']).catch(()=> '')).trim();
 if(action==='syncConnect'){
  const external=await fs.realpath(a.external);if(!(await fs.stat(external)).isDirectory())throw Error('Selecciona una carpeta.');
  const overlap=(x,y)=>{const r=path.relative(x,y);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
  if(overlap(root,external)||overlap(external,root))throw Error('Las carpetas deben ser independientes: ninguna puede contener a la otra.');
  if(await exists(path.join(external,'.git')))throw Error('La carpeta externa no debe ser otro repositorio Git.');
  if(!branch)throw Error('Selecciona una rama local antes de conectar.');
  await inventory(external,safe);config={external,branch,base:{},connected:new Date().toISOString()};await writeJson(configFile,config);return config;
 }
 if(action==='syncDisconnect'){await fs.unlink(configFile).catch(e=>{if(e.code!=='ENOENT')throw e;});return true;}
 if(action==='syncInfo')return config;
 if(!config)throw Error('Conecta una carpeta externa primero.');
 if(branch!==config.branch)throw Error('Esta carpeta está vinculada a la rama '+config.branch+'. Vuelve a esa rama para sincronizar.');
 const external=await fs.realpath(config.external);if(external!==config.external)throw Error('La carpeta externa cambió de ubicación. Vuelve a conectarla.');
 const left=await inventory(root,safe),right=await inventory(external,safe);
 const names=[...new Set([...Object.keys(left),...Object.keys(right)])].sort();
 // Honor the repository ignore rules for both sides, including prospective imports.
 const ignored=new Set();
 if(names.length){const output=await git(root,['check-ignore','--no-index','-z','--stdin'],{input:names.join('\0')+'\0',allowExit1:true});output.split('\0').filter(Boolean).forEach(n=>ignored.add(n));}
 const rows=names.filter(n=>!ignored.has(n)).map(name=>{
  const l=left[name]||null,r=right[name]||null,b=config.base[name]||null;let kind='same';
  if(l!==r){if(!b)kind=!l?'toRepo':!r?'toExternal':'conflict';else if(!l||!r)kind='conflict';else if(l===b)kind='toRepo';else if(r===b)kind='toExternal';else kind='conflict';}
  return {path:name,kind,left:l,right:r};
 });
 const fingerprint=hash(Buffer.from(JSON.stringify({rows,branch,external,base:config.base})));
 if(action==='syncPreview')return {external,branch,rows:rows.filter(r=>r.kind!=='same'),fingerprint};
 if(action!=='syncApply')throw Error('Operación de sincronización desconocida.');
 if(a.fingerprint!==fingerprint)throw Error('Los archivos cambiaron desde la vista previa. Analiza otra vez antes de sincronizar.');
 const operations=rows.filter(r=>r.kind!=='same').map(r=>{
  const choice=r.kind==='conflict'?a.resolutions?.[r.path]:r.kind;
  if(!['toRepo','toExternal','skip'].includes(choice))throw Error('Resuelve cada conflicto antes de sincronizar.');
  if(choice==='toRepo'&&!r.right||choice==='toExternal'&&!r.left)throw Error('No se propagan eliminaciones. Elige la copia que todavía existe.');return {...r,choice};
 });
 const backupDir=path.join(gitDir,'gitdrive-sync-backups',randomUUID());await fs.mkdir(backupDir,{recursive:true});const backups=[];
 for(const r of operations){
  if(r.choice==='skip')continue;
  const sourceRoot=r.choice==='toRepo'?external:root,targetRoot=r.choice==='toRepo'?root:external;
  const source=await safe(sourceRoot,r.path),target=await safe(targetRoot,r.path);const data=await fs.readFile(source);
  const expectedSource=r.choice==='toRepo'?r.right:r.left,expectedTarget=r.choice==='toRepo'?r.left:r.right;
  if(hash(data)!==expectedSource)throw Error('Un archivo cambió durante la sincronización. Analiza otra vez.');
  const before=await fs.readFile(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if((before?hash(before):null)!==expectedTarget)throw Error('El destino cambió durante la sincronización. Analiza otra vez.');
  if(before){const backup=String(backups.length)+'.bak';await fs.writeFile(path.join(backupDir,backup),before,{flag:'wx'});backups.push({path:r.path,destination:targetRoot,file:backup});await writeJson(path.join(backupDir,'manifest.json'),backups);}
  await fs.mkdir(path.dirname(target),{recursive:true});await safe(targetRoot,r.path);
  const tmp=target+'.gitdrive-'+randomUUID();try{await fs.writeFile(tmp,data,{flag:'wx'});await fs.rename(tmp,target);}finally{await fs.unlink(tmp).catch(()=>{});}
  config.base[r.path]=hash(data);
  // Persist after each file so interruptions remain recoverable.
  await writeJson(configFile,config);
 }
 for(const r of rows)if(r.kind==='same'&&r.left)config.base[r.path]=r.left;
 await writeJson(configFile,config);
 return {copied:operations.filter(r=>r.choice!=='skip').length,backupDir:backups.length?backupDir:null};
}
