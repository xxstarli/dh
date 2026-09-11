import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
const root=path.resolve('storage/restart');fs.mkdirSync(root,{recursive:true});
const php=process.env.PHP_BIN||'php', config=path.join(root,'config.php');
const q=value=>"'"+value.replaceAll('\\','/').replaceAll("'","\\'")+"'";
fs.writeFileSync(config,`<?php return ['database'=>${q(root+'/test.db')},'icons'=>${q(root+'/icons')},'state'=>${q(root+'/state')},'origin'=>'http://localhost:3101'];`);
const env={...process.env,DH_CONFIG:config};
const hash=spawnSync(php,['-r',"echo password_hash('Navigation-test-only-2026',PASSWORD_BCRYPT);"],{encoding:'utf8'});
const init=spawnSync(php,['scripts/init.php'],{env,input:hash.stdout,encoding:'utf8'});assert.equal(init.status,0,init.stderr);
fs.rmSync(root+'/state/login-rate.json',{force:true});
let server;
async function start(){
 server=spawn(php,['-S','localhost:3101','-t','public','scripts/router.php'],{env,stdio:'ignore',windowsHide:true});
 for(let i=0;i<100;i++){try{if((await fetch('http://localhost:3101/api/navigation')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw Error('PHP failed to start');
}
async function stop(){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}
await start();
let first,icon;
try{
 const login=await fetch('http://localhost:3101/api/admin/login',{method:'POST',headers:{Origin:'http://localhost:3101','Content-Type':'application/json'},body:JSON.stringify({password:'Navigation-test-only-2026'})});
 assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i);assert.doesNotMatch(cookie,/;\s*Secure/i);
 const session=await login.json();
 const headers={Origin:'http://localhost:3101',Cookie:cookie.split(';')[0],'X-CSRF-Token':session.csrf_token};
 async function write(url,method,data){const response=await fetch('http://localhost:3101/api/admin/'+url,{method,headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(data)});assert.ok(response.ok,await response.clone().text());return response.json();}
 const category=await write('categories','POST',{name:'Restart persistence'});
 const images=JSON.parse(fs.readFileSync('tests/images.json','utf8'));const form=new FormData();form.append('file',new Blob([Buffer.from(images.webp,'base64')],{type:'image/webp'}),'legacy.webp');
 const uploaded=await fetch('http://localhost:3101/api/admin/uploads/site-icon',{method:'POST',headers,body:form});assert.equal(uploaded.status,201);icon=(await uploaded.json()).icon_url;
 await write('sites','POST',{category_id:category.id,name:'Persistence',url:'https://example.com',description:'',icon_type:'custom',icon_url:icon});
 first=await(await fetch('http://localhost:3101/api/navigation')).json();
}finally{await stop();}
await start();
try{
 assert.deepEqual(await(await fetch('http://localhost:3101/api/navigation')).json(),first);
 assert.equal((await fetch('http://localhost:3101'+icon)).status,200);
 for(const channel of ['chrome','msedge']){
  let names;
  for(let i=0;i<2;i++){
   const browser=await chromium.launch({channel});try{const page=await browser.newPage();await page.goto('http://localhost:3101');await expect(page.locator('a.site-card').first()).toBeVisible();const actual=await page.locator('a.site-card').allTextContents();if(names)assert.deepEqual(actual,names);names=actual;}finally{await browser.close();}
  }
 }
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/restart.json',JSON.stringify({passed:true,phpStarts:2,browserReopens:2,httpCookie:true,uploadedWebp:true,dataAndOrderUnchanged:true},null,2));
 console.log('PASS: PHP restart, Chrome/Edge close/reopen, data, order, icon and HTTP Cookie.');
}finally{await stop();}
