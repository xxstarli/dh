import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version');
const archive='dist/navigation-v'+version+'.tar.gz';
const files=[];
function walk(directory) {
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const name=directory+'/'+entry.name;
  if(entry.isDirectory())walk(name);else files.push(name);
 }
}
walk('app');walk('public');walk('database');
files.push('config.example.php','scripts/init.php','scripts/router.php','deploy/nginx.example.conf','README.md','CHANGELOG.md');
if(files.some(file=>/\.(tsx?|env|db)$/.test(file)))throw Error('Unexpected release source');
fs.mkdirSync('dist',{recursive:true});
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest={version,commit,files:Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))};
fs.writeFileSync('dist/manifest.json',JSON.stringify(manifest,null,2)+'\n');
execFileSync('tar',['-czf',path.resolve(archive),...files,'-C','dist','manifest.json'],{stdio:'inherit',windowsHide:true});
const sha=createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
fs.writeFileSync('dist/SHA256SUMS',sha+'  '+path.basename(archive)+'\n');
console.log('Release: '+files.length+' source files, '+fs.statSync(archive).size+' bytes, SHA256 '+sha);
