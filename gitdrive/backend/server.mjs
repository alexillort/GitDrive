import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {dispatch} from './engine.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const token=randomBytes(32).toString('hex');let queue=Promise.resolve();
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!=='127.0.0.1:4317') {res.writeHead(403).end();return;}
  if(req.url==='/api'&&req.method==='POST') {
   if(req.headers.origin!=='http://127.0.0.1:4317'||req.headers['x-gitdrive-token']!==token) {res.writeHead(403).end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>1000000)throw Error('Solicitud demasiado grande.');}
   const {action,args}=JSON.parse(body);const job=queue.then(()=>dispatch(action,args));queue=job.catch(()=>{});const data=await job;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data}));return;
  }
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  const url=new URL(req.url,'http://127.0.0.1:4317');const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  let data=await fs.readFile(target);if(target.endsWith('index.html'))data=Buffer.from(data.toString().replace('</head>',`<meta name="gitdrive-token" content="${token}"></head>`));
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}
});server.listen(4317,'127.0.0.1',()=>console.log('GitDrive listo: http://127.0.0.1:4317'));
