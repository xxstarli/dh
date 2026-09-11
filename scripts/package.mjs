import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const files=[];
function walk(directory) {
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const name=directory+'/'+entry.name;
  if(entry.isDirectory())walk(name);else files.push(name);
 }
}
walk('app');walk('public');walk('database');
files.push('config.example.php','scripts/init.php','scripts/router.php','README.md','CHANGELOG.md');
if(files.some(file=>/\.(tsx?|env|db)$/.test(file)))throw Error('Unexpected release source');
fs.mkdirSync('dist',{recursive:true});
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest={version:'1.1.0',commit,files:Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
fs.writeFileSync('dist/manifest.json',JSON.stringify(manifest,null,2)+'\n');
execFileSync('tar',['-czf',path.resolve('dist/navigation-v1.1.0.tar.gz'),...files,'-C','dist','manifest.json'],{stdio:'inherit',windowsHide:true});
const sha=createHash('sha256').update(fs.readFileSync('dist/navigation-v1.1.0.tar.gz')).digest('hex');
fs.writeFileSync('dist/SHA256SUMS',sha+'  navigation-v1.1.0.tar.gz\n');
console.log('Release: '+files.length+' source files, '+fs.statSync('dist/navigation-v1.1.0.tar.gz').size+' bytes, SHA256 '+sha);
