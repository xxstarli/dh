import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const received=[];
const server=http.createServer((request,response)=>{
  received.push({path:request.url,headers:request.headers});
  if(request.url==='/large'){response.writeHead(200,{'Content-Length':2097153});response.end('x');}
  else if(request.url==='/stream'){response.writeHead(200);response.end(Buffer.alloc(2097153));}
  else if(request.url==='/slow')setTimeout(()=>response.end('late'),1000);
  else if(request.url==='/redirect'){response.writeHead(302,{Location:'http://127.0.0.1/private'});response.end();}
  else response.end('OK');
});
await new Promise(resolve=>server.listen(3133,'127.0.0.1',resolve));
async function probe(path){
 const child=spawn(process.env.PHP_BIN||'php',['tests/php/transport.php',path],{windowsHide:true});let output='';let errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);const code=await new Promise(resolve=>child.on('exit',resolve));assert.equal(code,0,errors);return JSON.parse(output);
}
try{
 const ok=await probe('/ok');assert.equal(ok.body,'OK');assert.equal(ok.status,200);
 for(const path of ['/large','/stream','/slow']){const result=await probe(path);assert.equal(result.ok,false,path);assert.ok(result.seconds<3);}
 const redirect=await probe('/redirect');assert.equal(redirect.status,302);assert.equal(received.length,5);
 for(const request of received){assert.equal(request.headers.host,'transport.invalid:3133');assert.equal(request.headers.cookie,undefined);assert.equal(request.headers.authorization,undefined);assert.equal(request.headers['x-csrf-token'],undefined);}
 console.log('PASS: actual cURL DNS pinning, no credential forwarding, declared/streaming 2MB limits, timeout and no automatic redirects.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
