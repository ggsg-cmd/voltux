import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), output=path.join(root,'.preview');
await mkdir(output,{recursive:true});
const origin='http://127.0.0.1:3199',token=randomBytes(32).toString('hex'),password=randomBytes(24).toString('base64url');
const {server,db}=createApp({dbPath:':memory:',origin,setupToken:token});
await new Promise(r=>server.listen(3199,'127.0.0.1',r));
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=19331',`--user-data-dir=${path.join(output,'browser')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket,send;const errors=[],report={viewports:[]},pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let targets;for(let n=0;n<50;n++){try{targets=await(await fetch('http://127.0.0.1:19331/json')).json();break;}catch{await pause(200);}}
  assert.ok(targets,'Chrome não iniciou');socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
  let counter=0;const pending=new Map();socket.onmessage=({data})=>{const m=JSON.parse(data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  send=(method,params={})=>new Promise((resolve,reject)=>{const id=++counter;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let n=0;n<100;n++){if(await evaluate(expression))return;await pause(70);}console.error(await evaluate('({text:document.body.innerText,invalid:[...document.querySelectorAll(":invalid")].map(x=>({label:x.parentElement.firstChild.textContent,message:x.validationMessage}))})'));throw new Error(`Timeout: ${expression}`);};
  const click=label=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  const fill=(label,value)=>evaluate(`(()=>{const scope=document.querySelector('dialog[open]')||document;const n=[...scope.querySelectorAll('label')].find(n=>n.firstChild.textContent===${JSON.stringify(label)}).querySelector('input,select,textarea');n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:origin});await waitFor('!!document.querySelector("form")');
  await fill('Seu nome','Admin de validação');await fill('Token de configuração',token);await fill('E-mail','browser@example.test');await fill('Senha',password);await click('Criar administrador');await waitFor('document.body.innerText.includes("Bom te ver")');await fill('E-mail','browser@example.test');await fill('Senha',password);await click('Entrar na Voltux');await waitFor('!!document.querySelector(".sidebar")');
  await evaluate('navigate("products")');await click('＋ Cadastrar produto');await fill('Nome','Processador de teste');await fill('Custo (R$)','600');await fill('Preço normal (R$)','750');await fill('Preço mínimo (R$)','700');await fill('Estoque','5');await click('Salvar produto');await waitFor('!document.querySelector("dialog").open && document.body.innerText.includes("Processador de teste")');
  await evaluate('navigate("new")');await fill('Nome do cliente','Cliente de validação');await fill('WhatsApp (55 + DDD + número)','5511999999999');await click('＋ Adicionar item');await fill('Desconto total (R$)','25');await click('Salvar orçamento');await waitFor('document.body.innerText.includes("Histórico de contatos")');assert.match(await evaluate('document.querySelector("main").innerText'),/725,00/);
  await click('Gerar proposta');await waitFor('!!document.querySelector(".proposal")');assert.doesNotMatch(await evaluate('document.querySelector(".proposal").innerText'),/custo|comissão|margem|mínimo/i);assert.equal(await evaluate('document.querySelector("dialog a").href.startsWith("https://wa.me/5511999999999")'),true);await click('Fechar');
  await click('Agendar follow-up');await fill('Data e hora (seu horário local)','2026-09-14T14:00');await fill('Observação','Conferir interesse');await fill('Próxima ação','Retomar conversa');await click('Agendar contato');await waitFor('!document.querySelector("dialog").open && document.body.innerText.includes("Conferir interesse")');
  for(const width of [320,375,768,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:width<640});for(const p of ['dashboard','products','new','budgets','followups','approvals','users','settings','audit']){await evaluate(`navigate(${JSON.stringify(p)})`);const size=await evaluate('({width:innerWidth,document:document.documentElement.scrollWidth})');assert.ok(size.document<=size.width,`${p} transborda em ${width}: ${JSON.stringify(size)}`);report.viewports.push({page:p,...size});if((width===375||width===1440)&&p==='dashboard'){const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,`dashboard-${width}.png`),Buffer.from(screenshot.data,'base64'));}}}
  await evaluate(`api('/users','POST',{name:'Vendedor teste',email:'seller-browser@example.test',password:${JSON.stringify(password)},active:1})`);
  await click('Sair');await waitFor('document.body.innerText.includes("Bom te ver por aqui.")');await fill('E-mail','seller-browser@example.test');await fill('Senha',password);await click('Entrar na Voltux');await waitFor('!!document.querySelector(".sidebar")');
  assert.equal(await evaluate('!!document.querySelector("[data-page=users]")'),false);assert.doesNotMatch(await evaluate('document.querySelector("main").innerText'),/lucro|comissão|margem/i);
  await evaluate('navigate("products")');assert.doesNotMatch(await evaluate('document.querySelector("main").innerText'),/custo|comissão|margem/i);
  await evaluate('navigate("budgets")');assert.equal(await evaluate('document.body.innerText.includes("Cliente de validação")'),false);
  assert.deepEqual(errors,[]);report.runtimeErrors=errors;report.flow='Configuração inicial, login, produto, orçamento, proposta, follow-up e isolamento visual do vendedor verificados no navegador.';await writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(send)try{await send('Browser.close');}catch{}socket?.close();browser.kill();await new Promise(r=>server.close(r));db.close();}
