import fs from 'node:fs';
const socket=new WebSocket('ws://127.0.0.1:4401');
socket.addEventListener('open',()=>{console.log('connected');socket.send(JSON.stringify({tag:'Init'}));});
socket.addEventListener('message',event=>{const x=JSON.parse(event.data);console.log(JSON.stringify(x));});
socket.addEventListener('error',event=>console.error(event));
