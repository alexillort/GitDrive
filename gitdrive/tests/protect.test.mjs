import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'gitdrive-protect-'));
process.env.GITDRIVE_HOME=path.join(temp,'home');process.env.GIT_CONFIG_GLOBAL=path.join(temp,'gitconfig');
await fs.writeFile(process.env.GIT_CONFIG_GLOBAL,'[user]\n\tname = GitDrive Test\n\temail = test@example.invalid\n[core]\n\tautocrlf = false\n');
const {dispatch}=await import('../backend/engine.mjs');
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true});
let fill=1;const big=(file,mb)=>fs.writeFile(file,Buffer.alloc(mb*1024*1024,fill++));
test('gitignore rules and Git LFS like gitnube.sh',async t=>{
 t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 // A 1 MB limit keeps the fixtures small; the default is 100 MB.
 await dispatch('settingsSet',{remindHours:4,lfsLimitMB:1});
 const root=path.join(temp,'App');await fs.mkdir(root);await fs.writeFile(path.join(root,'main.js'),'console.log(1)');
 const call=(action,args={})=>dispatch(action,{root,...args});
 await t.test('default rules are the script list plus node_modules',async()=>{const s=await dispatch('settings');assert.deepEqual(s.ignoreRules,['[Ll]ibrary/','[Tt]emp/','[Oo]bj/','[Bb]uild/','[Bb]uilds/','[Ll]ogs/','[Mm]emoryCaptures/','[Uu]serSettings/','Crashes/','_TRASH_*/','.vs/','.vscode/','node_modules/']);assert.equal(s.lfsLimitMB,1);await assert.rejects(dispatch('settingsSet',{remindHours:4,lfsLimitMB:0}),/LFS/);});
 await t.test('init writes .gitignore and keeps ignored folders out of the first commit',async()=>{await fs.mkdir(path.join(root,'node_modules','x'),{recursive:true});await fs.writeFile(path.join(root,'node_modules','x','index.js'),'dep');await fs.mkdir(path.join(root,'Build'));await fs.writeFile(path.join(root,'Build','out.bin'),'b');await call('init');const ignore=await fs.readFile(path.join(root,'.gitignore'),'utf8');assert.match(ignore,/^node_modules\/$/m);assert.match(ignore,/^\[Bb\]uild\/$/m);const files=git(root,'ls-files').split('\n').filter(Boolean);assert.deepEqual(files.sort(),['.gitignore','main.js']);});
 await t.test('rules are appended once, preserving existing lines',async()=>{await fs.writeFile(path.join(root,'.gitignore'),'*.log\r\nnode_modules/\r\n');await call('backup');const ignore=await fs.readFile(path.join(root,'.gitignore'),'utf8');assert.ok(ignore.startsWith('*.log\r\nnode_modules/\r\n'));assert.equal(ignore.match(/node_modules\//g).length,1);assert.match(ignore,/\.vscode\/\r\n$/);});
 await t.test('backup moves files over the limit to LFS by extension',async()=>{await big(path.join(root,'video.mp4'),2);await fs.writeFile(path.join(root,'small.mp4'),'tiny');const result=await call('backup');assert.deepEqual(result.lfs,['video.mp4']);assert.match(await fs.readFile(path.join(root,'.gitattributes'),'utf8'),/^\*\.mp4 filter=lfs diff=lfs merge=lfs -text/m);assert.ok(+git(root,'cat-file','-s','HEAD:video.mp4')<300);assert.match(git(root,'lfs','ls-files'),/video\.mp4/);assert.equal((await fs.stat(path.join(root,'video.mp4'))).size,2*1024*1024);});
 await t.test('pending commits with dependencies or huge files are fixed before pushing',async()=>{
  const remote=path.join(temp,'remote.git');await fs.mkdir(remote);git(remote,'init','--bare','--initial-branch=main');await call('remote',{url:remote});assert.equal((await call('backup')).pushed,true);
  // Reproduce the reported case: node_modules and a big binary committed outside GitDrive.
  await fs.mkdir(path.join(root,'node_modules','electron'),{recursive:true});await big(path.join(root,'node_modules','electron','electron.exe'),2);await big(path.join(root,'tool.dat'),2);await fs.writeFile(path.join(root,'renderer.js'),'ui');
  git(root,'add','-f','node_modules','tool.dat','renderer.js');git(root,'commit','-m','Respaldo automático A');
  await fs.writeFile(path.join(root,'preload.js'),'p');git(root,'add','preload.js');git(root,'commit','-m','Respaldo automático B');
  const blocked=await call('backup');assert.equal(blocked.pushed,false);assert.ok(blocked.needsFix.ignored>=1);assert.deepEqual(blocked.needsFix.big.map(b=>b.path),['tool.dat']);assert.equal(blocked.needsFix.commits,2);
  await assert.rejects(call('push'),/Respaldar y subir/);
  const fixed=await call('fixPending');assert.equal(fixed.replaced,2);assert.equal(fixed.removed,2);assert.deepEqual(fixed.lfs,['tool.dat']);
  assert.match(git(root,'log','-1','--format=%B'),/Respaldo corregido[\s\S]*Respaldo automático B \| Respaldo automático A/);
  const tree=git(root,'ls-tree','-r','--name-only','HEAD');assert.doesNotMatch(tree,/node_modules/);assert.match(tree,/renderer\.js/);assert.match(tree,/preload\.js/);
  assert.equal((await fs.stat(path.join(root,'node_modules','electron','electron.exe'))).size,2*1024*1024);
  assert.deepEqual((await call('pushReport')).big,[]);
  const pushed=await call('backup');assert.equal(pushed.pushed,true,pushed.pushError);assert.equal(git(remote,'log','-1','--format=%s').trim(),'Respaldo corregido'+git(root,'log','-1','--format=%s').trim().slice('Respaldo corregido'.length));
  assert.equal((await call('pushReport')).commits,0);
 });
});
