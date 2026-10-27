import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
// .gitignore rules and Git LFS for large files, following gitnube.sh (manage_gitignore / track_large_files).
// node_modules/ is added to the script's list: dependencies are rebuilt with npm install and never belong in a backup.
export const DEFAULT_IGNORE=['[Ll]ibrary/','[Tt]emp/','[Oo]bj/','[Bb]uild/','[Bb]uilds/','[Ll]ogs/','[Mm]emoryCaptures/','[Uu]serSettings/','Crashes/','_TRASH_*/','.vs/','.vscode/','node_modules/'];
export const DEFAULT_LFS_MB=100;
const MB=1024*1024;
const split0=s=>s.split('\0').filter(Boolean);
// Appends the missing rules (whole-line literal comparison, like grep -qxF). Returns the added rules.
export async function applyIgnore(root,rules){
 const file=path.join(root,'.gitignore');
 const text=await fs.readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
 const present=new Set(text.split(/\r?\n/));
 const added=[...new Set(rules.map(r=>r.trim()).filter(r=>r&&!present.has(r)))];
 if(!added.length)return added;
 const eol=text.includes('\r\n')?'\r\n':'\n';
 await fs.writeFile(file,text+(text&&!text.endsWith('\n')?eol:'')+added.join(eol)+eol);
 return added;
}
export async function lfsAvailable(git,root){return git(root,['lfs','version']).then(()=>true,()=>false);}
async function lfsFilters(git,root,files){
 if(!files.length)return {};
 const out=split0(await git(root,['check-attr','-z','--stdin','filter'],{input:files.join('\0')+'\0',maxBuffer:64*MB}));
 const result={};for(let i=0;i+2<out.length;i+=3)result[out[i]]=out[i+2];return result;
}
// Same pattern rule as the script: *.ext when the file has an extension, otherwise its own path.
const patternFor=f=>{const base=f.split('/').pop();const dot=base.lastIndexOf('.');return dot>0?'*'+base.slice(dot):f;};
// Moves files over the limit (tracked or new, respecting .gitignore) to Git LFS before they are committed.
export async function trackLarge(git,root,limitMB,paths=null){
 const listed=split0(await git(root,['ls-files','-co','--exclude-standard','-z',...(paths?['--',...paths]:[])],{maxBuffer:64*MB}));
 const big=[];for(const f of new Set(listed)){const stat=await fs.lstat(path.join(root,f)).catch(()=>null);if(stat?.isFile()&&stat.size>limitMB*MB)big.push({path:f,size:stat.size});}
 if(!big.length)return {files:[],patterns:[]};
 const filters=await lfsFilters(git,root,big.map(b=>b.path));
 const pending=big.filter(b=>filters[b.path]!=='lfs');
 if(!pending.length)return {files:[],patterns:[]};
 if(!await lfsAvailable(git,root))throw Error(`Hay archivos de más de ${limitMB} MB (${pending.map(b=>b.path).slice(0,3).join(', ')}). GitHub los rechaza sin Git LFS: instala Git LFS o exclúyelos con .gitignore.`);
 await git(root,['lfs','install','--local']);
 const patterns=[...new Set(pending.map(b=>patternFor(b.path)))];
 await git(root,['lfs','track','--',...patterns]);
 await git(root,['add','--','.gitattributes']);
 // Files already in the index must be re-cleaned so they become LFS pointers.
 const tracked=new Set(split0(await git(root,['ls-files','-z','--',...pending.map(b=>b.path)])));
 if(tracked.size)await git(root,['add','--renormalize','--',...tracked]);
 return {files:pending.map(b=>b.path),patterns};
}
// Commits not yet on any remote branch, oldest last.
async function unpushed(git,root){return (await git(root,['rev-list','HEAD','--not','--remotes']).catch(()=> '')).split('\n').filter(Boolean);}
// Inspects what a push would send: total size, blobs over the limit (never LFS pointers) and files the ignore rules now exclude.
export async function pushReport(git,root,limitMB,rules=[]){
 const commits=await unpushed(git,root);
 if(!commits.length)return {commits:0,sizeMB:0,big:[],ignored:0};
 const objects=await git(root,['rev-list','--objects','HEAD','--not','--remotes'],{maxBuffer:256*MB});
 const rows=(await git(root,['cat-file','--batch-check=%(objecttype) %(objectsize) %(rest)'],{input:objects,maxBuffer:256*MB})).split('\n').filter(Boolean).map(l=>{const [type,size,...rest]=l.split(' ');return {type,size:+size,path:rest.join(' ')};});
 const blobs=rows.filter(r=>r.type==='blob'&&r.path);
 const names=[...new Set(blobs.map(b=>b.path))];
 // The configured rules count even before they are written to .gitignore; they go through a temporary excludes file.
 const excludes=path.join(os.tmpdir(),`gitdrive-rules-${randomUUID()}`);await fs.writeFile(excludes,rules.join('\n')+'\n');
 let ignored;try{ignored=new Set(names.length?split0(await git(root,['-c','core.excludesFile='+excludes.replace(/\\/g,'/'),'check-ignore','--no-index','-z','--stdin'],{input:names.join('\0')+'\0',allowExit1:true,maxBuffer:64*MB})):[]);}
 finally{await fs.unlink(excludes).catch(()=>{});}
 const big=blobs.filter(b=>b.size>limitMB*MB&&!ignored.has(b.path)).map(b=>({path:b.path,sizeMB:+(b.size/MB).toFixed(1)}));
 return {commits:commits.length,sizeMB:+(blobs.reduce((s,b)=>s+b.size,0)/MB).toFixed(1),big,ignored:ignored.size};
}
// Rebuilds the unpushed commits as one: drops files the ignore rules exclude and moves large files to LFS. The working folder is not touched.
export async function fixUnpushed(git,root,rules,limitMB,message){
 const commits=await unpushed(git,root);
 if(!commits.length)throw Error('No hay commits pendientes de subir.');
 const oldest=commits[commits.length-1];
 const base=(await git(root,['rev-parse','--verify','--quiet',oldest+'^'],{allowExit1:true})).trim();
 const originals=(await git(root,['log','--format=%s',base?`${base}..HEAD`:'HEAD'])).split('\n').filter(Boolean);
 await applyIgnore(root,rules);
 const added=split0(base?await git(root,['diff','--name-only','-z','--diff-filter=A',base,'HEAD'],{maxBuffer:64*MB}):await git(root,['ls-tree','-r','-z','--name-only','HEAD'],{maxBuffer:64*MB}));
 const ignored=added.length?split0(await git(root,['check-ignore','--no-index','-z','--stdin'],{input:added.join('\0')+'\0',allowExit1:true,maxBuffer:64*MB})):[];
 if(base)await git(root,['reset','--soft',base]);else await git(root,['update-ref','-d','HEAD']);
 if(ignored.length)await git(root,['rm','-r','--cached','-q','--ignore-unmatch','--pathspec-from-file=-','--pathspec-file-nul'],{input:ignored.join('\0')+'\0'});
 const lfs=await trackLarge(git,root,limitMB);
 await git(root,['add','--all']);
 await git(root,['commit','--allow-empty','-m',message+'\n\nReúne: '+originals.join(' | ')]);
 return {replaced:originals.length,removed:ignored.length,lfs:lfs.files};
}
// Plain-language versions of the usual push failures.
export function pushError(e,report){
 const m=e.message;const size=report?.sizeMB?` (${report.sizeMB} MB pendientes)`:'';
 if(/GH001|exceeds GitHub's file size limit|file size limit|this exceeds/i.test(m))return 'GitHub rechazó un archivo de más de 100 MB. Usa Corregir y subir para pasarlo a Git LFS.\n\n'+m;
 if(/\b408\b|RPC failed|remote end hung up|unexpected disconnect|timed out|early EOF/i.test(m))return `La subida se cortó: el servidor tardó demasiado en recibirla${size}. Suele pasar con subidas muy grandes o conexiones lentas. Revisa que no se estén subiendo carpetas como node_modules y vuelve a intentarlo.\n\n`+m;
 if(/Authentication failed|could not read Username|403|Permission denied/i.test(m))return 'No tienes acceso para subir a este repositorio. Revisa tu sesión de Git (Git Credential Manager o SSH).\n\n'+m;
 return m;
}
// Which ignore rule hides each path (null when not ignored). Negations ("!x") mean "not ignored". Directories need a trailing slash.
export async function ignoreRules(git,root,paths){
 const result={};if(!paths.length)return result;
 const out=(await git(root,['check-ignore','-v','-z','--stdin'],{input:paths.join('\0')+'\0',allowExit1:true,maxBuffer:64*MB})).split('\0');
 for(let i=0;i+3<out.length;i+=4){if(out[i+2].trim()&&!out[i+2].startsWith('!'))result[out[i+3]]={source:out[i],line:+out[i+1],pattern:out[i+2]};}
 return result;
}
export const MEDIA=/\.(png|jpe?g|gif|webp|bmp|tiff?|heic|psd|ai|svg|exr|hdr|tga|mp4|mov|avi|mkv|webm|m4v|wmv|wav|mp3|ogg|flac|m4a|aac|fbx|obj|blend|glb|gltf|stl|3ds|max|ma|mb|dae|usdz?|abc|ply|unitypackage)$/i;
// Folders that are meant to be ignored (dependencies, caches): media inside them is not reported.
const EXPECTED=['node_modules/','.venv/','venv/','env/','__pycache__/','.ipynb_checkpoints/','site-packages/'];
// Media files the repository ignores, grouped by the rule responsible, skipping GitDrive's own protection rules.
export async function ignoredMedia(git,root,protection){
 const files=split0(await git(root,['ls-files','-o','-i','--exclude-standard','-z'],{maxBuffer:256*MB})).filter(f=>MEDIA.test(f));
 const rules=await ignoreRules(git,root,files);const skip=new Set([...protection,...EXPECTED].map(r=>r.trim()));
 const groups={};
 for(const f of files){const r=rules[f];if(!r||skip.has(r.pattern))continue;const key=`${r.source}:${r.line}`;const g=groups[key]||(groups[key]={...r,count:0,bytes:0,examples:[]});g.count++;g.bytes+=(await fs.lstat(path.join(root,f)).catch(()=>({size:0}))).size;if(g.examples.length<3)g.examples.push(f);}
 return Object.values(groups).map(({bytes,...g})=>({...g,sizeMB:+(bytes/MB).toFixed(1)})).sort((a,b)=>b.count-a.count);
}
// Re-includes what a rule hides by commenting it out in its file (reversible, keeps the rest of the file untouched).
export async function disableRule(root,gitDir,rule){
 const file=path.resolve(root,rule.source);
 const allowed=path.basename(file)==='.gitignore'&&!path.relative(root,file).startsWith('..')||file.toLowerCase()===path.join(gitDir,'info','exclude').toLowerCase();
 if(!allowed)throw Error(`La regla «${rule.pattern}» está en ${rule.source}, fuera del repositorio. Edítala ahí o quítala de la configuración global de Git.`);
 const text=await fs.readFile(file,'utf8');const eol=text.includes('\r\n')?'\r\n':'\n';const lines=text.split(/\r?\n/);
 const i=rule.line-1;if(!Number.isInteger(i)||lines[i]===undefined||lines[i].trim()!==rule.pattern.trim())throw Error('El archivo .gitignore cambió. Actualiza y vuelve a intentarlo.');
 lines[i]=`# GitDrive: incluido para subir · ${lines[i]}`;await fs.writeFile(file,lines.join(eol));
}
