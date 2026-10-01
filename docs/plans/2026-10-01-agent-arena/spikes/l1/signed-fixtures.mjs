import fs from 'node:fs';
import {CML,fromHex,toHex,Data,Constr} from '@lucid-evolution/lucid';
const root=new URL('.',import.meta.url);
const keys=['alice','bob'].map(x=>CML.PrivateKey.from_normal_bytes(fromHex(JSON.parse(fs.readFileSync(new URL('../alt/hydra/demo/devnet/credentials/'+x+'.sk',root),'utf8')).cborHex.slice(4))));
const pubkeys=keys.map(k=>toHex(k.to_public().to_raw_bytes()));
const match='00'.repeat(32);
const moves=Array.from({length:256},(_,i)=>({cell:i,signature:toHex(keys[i%2].sign(fromHex(Data.to(new Constr(0,[match,BigInt(i),BigInt(i)])))).to_raw_bytes())}));
fs.writeFileSync(new URL('signed-fixtures.json',root),JSON.stringify({pubkeys,match,moves,illegal:{cell:0,signature:toHex(keys[1].sign(fromHex(Data.to(new Constr(0,[match,1n,0n])))).to_raw_bytes())}},null,2));
let s='use transcript_rules.{Config, Move, verify}\n';
for(const n of [1,2,4,8,16,25,32,64,96,128,160,192,208,224]) {
 const cfg=`Config { players: [${pubkeys.map(k=>'#"'+k+'"').join(',')}], match_id: #"${match}" }`;
 const ms=moves.slice(0,n).map(m=>`Move { cell: ${m.cell}, signature: #"${m.signature}" }`).join(',');
 s+=`test signed_${n}() { verify(${cfg},[${ms}],0,[]) }\n`;
}
const config=`Config { players: [${pubkeys.map(k=>'#"'+k+'"').join(',')}], match_id: #"${match}" }`;
const illegal={cell:0,signature:toHex(keys[1].sign(fromHex(Data.to(new Constr(0,[match,1n,0n])))).to_raw_bytes())};
const sequence=[moves[0],illegal].map(m=>`Move { cell: ${m.cell}, signature: #"${m.signature}" }`).join(',');
s+=`test correctly_signed_duplicate_rejected() { !verify(${config},[${sequence}],0,[]) }\n`;
const bad=`Move { cell: 0, signature: #"${'00'.repeat(64)}" }`;
s+=`test wrong_signature_rejected() { !verify(${config},[${bad}],0,[]) }\n`;
fs.writeFileSync(new URL('l1-validator/lib/signed_vectors.ak',root),s);
