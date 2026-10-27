import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'gitdrive-ignored-'));
process.env.GITDRIVE_HOME=path.join(temp,'home');process.env.GIT_CONFIG_GLOBAL=path.join(temp,'gitconfig');
await fs.writeFile(process.env.GIT_CONFIG_GLOBAL,'[user]\n\tname = GitDrive Test\n\temail = test@example.invalid\n[core]\n\tautocrlf = false\n');
const {dispatch}=await import('../backend/engine.mjs');
test('Ignored files are explained and media can be included',async t=>{
 t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const root=path.join(temp,'Proyecto');await fs.mkdir(root);
 const call=(action,args={})=>dispatch(action,{root,...args});
 // A cloned-style .gitignore that hides media, plus an exception and dependency folders.
 await fs.writeFile(path.join(root,'.gitignore'),'# Media\r\n*.mp4\r\n!intro.mp4\r\nuploads/\r\n');
 await call('init');
 for(const f of ['clip.mp4','intro.mp4','uploads/foto.png','uploads/notas.txt','node_modules/pkg/logo.png','Build/render.png','vacia/.keep'])await fs.mkdir(path.dirname(path.join(root,f)),{recursive:true}).then(()=>fs.writeFile(path.join(root,f),'x'));
 await fs.unlink(path.join(root,'vacia','.keep'));
 await t.test('the explorer names the rule behind each ignored entry',async()=>{const list=await call('list');const by=Object.fromEntries(list.map(e=>[e.name,e.ignored]));assert.deepEqual(by['clip.mp4'],{source:'.gitignore',line:2,pattern:'*.mp4'});assert.equal(by['intro.mp4'],null);assert.deepEqual(by['uploads'],{source:'.gitignore',line:4,pattern:'uploads/'});assert.equal(by['node_modules'].pattern,'node_modules/');assert.equal(by['vacia'],null);assert.equal(by['.gitignore'],null);assert.equal((await call('list',{path:'uploads'})).find(e=>e.name==='foto.png').ignored.pattern,'uploads/');});
 await t.test('media report groups by rule and skips protection and dependency rules',async()=>{const report=await call('ignoredMedia');assert.deepEqual(report.map(r=>[r.pattern,r.count,r.examples]),[['*.mp4',1,['clip.mp4']],['uploads/',1,['uploads/foto.png']]]);});
 await t.test('including a rule comments it out and the files appear as changes',async()=>{const [mp4]=await call('ignoredMedia');await call('includeIgnored',{rules:[mp4]});const text=await fs.readFile(path.join(root,'.gitignore'),'utf8');assert.match(text,/^# GitDrive: incluido para subir · \*\.mp4\r$/m);assert.match(text,/^uploads\/\r$/m);assert.ok((await call('snapshot')).changes.some(c=>c.path==='clip.mp4'));assert.deepEqual((await call('ignoredMedia')).map(r=>r.pattern),['uploads/']);await assert.rejects(call('includeIgnored',{rules:[mp4]}),/cambió/);await assert.rejects(call('includeIgnored',{rules:[{source:'../fuera/.gitignore',line:1,pattern:'*.png'}]}),/fuera del repositorio/);});
});
