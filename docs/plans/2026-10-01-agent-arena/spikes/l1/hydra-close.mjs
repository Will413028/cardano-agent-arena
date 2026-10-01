import fs from 'node:fs';
const start=Date.now();const records=[];
const socket=new WebSocket('ws://127.0.0.1:4401');
const timer=setTimeout(()=>{console.error('close timeout');socket.close();process.exitCode=1},120000);
socket.addEventListener('open',()=>{socket.send(JSON.stringify({tag:'Close'}));console.log('Close sent with Bob stopped');});
socket.addEventListener('message',event=>{
 const x=JSON.parse(event.data);
 if(['HeadIsClosed','ReadyToFanout','HeadIsFinalized','CommandFailed','PostTxOnChainFailed'].includes(x.tag)) {
  records.push({seconds:(Date.now()-start)/1000,event:x});
  console.log(JSON.stringify(records.at(-1)));
  fs.writeFileSync(new URL('hydra-close.json',import.meta.url),JSON.stringify(records,null,2));
 }
 if(x.tag==='ReadyToFanout')socket.send(JSON.stringify({tag:'Fanout'}));
 if(x.tag==='HeadIsFinalized'){clearTimeout(timer);socket.close();}
});
