// Inicialização opcional via terminal. A senha aleatória é mostrada uma única vez.
// Não grava senha em arquivo e não altera instalações que já possuem usuários.
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './server.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const token=randomBytes(32).toString('hex'), password=randomBytes(18).toString('base64url');
const email=process.argv[2]||'admin@voltux.local', origin='http://127.0.0.1:3197';
const {server,db}=createApp({origin,setupToken:token,production:false});
if(db.prepare('SELECT id FROM users LIMIT 1').get()){db.close();throw new Error('Instalação já possui usuários. Nenhum acesso foi alterado.');}
await new Promise(r=>server.listen(3197,'127.0.0.1',r));
try{
  const response=await fetch(origin+'/api/setup',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Administrador Voltux',email,password,token})});
  const result=await response.json();if(!response.ok)throw new Error(result.error);
  try{await writeFile(path.join(root,'.env'),'HOST=127.0.0.1\nPORT=3100\nAPP_ORIGIN=http://127.0.0.1:3100\nNODE_ENV=development\nDB_PATH=./data/voltux.sqlite\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
  console.log(JSON.stringify({url:'http://127.0.0.1:3100',email,password,note:'Use Minha senha para definir uma senha pessoal.'}));
}finally{await new Promise(r=>server.close(r));db.close();}
