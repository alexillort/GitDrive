import fs from 'node:fs/promises';
await fs.mkdir('runtime',{recursive:true});
await fs.copyFile(process.execPath,'runtime/node.exe');
console.log('Node.js runtime incluido para Windows.');
