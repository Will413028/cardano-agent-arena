import fs from 'node:fs';
import { Lucid, Koios, Data, Constr, CML, fromHex, validatorToAddress } from '@lucid-evolution/lucid';
const base = new URL('.', import.meta.url);
const originalFetch=globalThis.fetch;
function plutus(value) {
 if('constructor' in value && 'fields' in value) return new Constr(value.constructor,value.fields.map(plutus));
 if('int' in value) return BigInt(value.int);
 if('bytes' in value) return value.bytes;
 if('list' in value) return value.list.map(plutus);
 if('map' in value) return new Map(value.map.map(({k,v})=>[plutus(k),plutus(v)]));
 throw new Error('Unsupported Plutus JSON');
}
function normalize(value) {
 if(Array.isArray(value)) return value.map(normalize);
 if(value && typeof value==='object') {
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='asset_list' && typeof v==='string' ? JSON.parse(v) : k==='inline_datum' && v?.bytes===null ? (v?.value===null ? null : {...v,bytes:Data.to(plutus(v.value))}) : normalize(v)]));
 }
 return value;
}
globalThis.fetch=async(...args)=>{
 const response=await originalFetch(...args);
 if(String(args[0]?.url ?? args[0]).startsWith('https://preprod.koios.rest') && response.headers.get('content-type')?.includes('json')) {
  return new Response(JSON.stringify(normalize(await response.json())),{status:response.status,statusText:response.statusText,headers:response.headers});
 }
 return response;
};
const provider = new Koios('https://preprod.koios.rest/api/v1');
const lucid = await Lucid(provider, 'Preprod');
const key = JSON.parse(fs.readFileSync(new URL('../alt/hydra/demo/devnet/preprod.skey',base),'utf8'));
const privateKey = CML.PrivateKey.from_normal_bytes(fromHex(key.cborHex.slice(4)));
lucid.selectWallet.fromPrivateKey(privateKey.to_bech32());
const address = await lucid.wallet().address();
const measured=JSON.parse(fs.readFileSync(new URL('preprod-precise.json',base),'utf8'));
if(!measured.records.some(x=>x.label==='close')) throw new Error('precise run not closed');
const close=measured.records.find(x=>x.label==='close');
if((await provider.getTransactionStatus(close.hash)).status!=='confirmed') throw new Error('close not confirmed');
const faucet='addr_test1vzpwq95z3xyum8vqndgdd9mdnmafh3djcxnc6jemlgdmswcve6tkw';
const utxos=await lucid.wallet().getUtxos();
if(!utxos.length) {console.log('wallet already empty');process.exit(0);}
const tx=await lucid.newTx().collectFrom(utxos).complete({changeAddress:faucet});
const signed=await tx.sign.withWallet().complete();
const cml=CML.Transaction.from_cbor_hex(signed.toCBOR());
const outputs=cml.body().outputs();
if(outputs.len()!==1 || outputs.get(0).address().to_bech32()!==faucet) throw new Error('Unexpected return destination');
const amount=outputs.get(0).amount().coin();
const hash=await signed.submit();
console.log(JSON.stringify({hash,lovelace:amount.toString(),fee:cml.body().fee().toString(),status:'submitted'}));
for(;;) {if((await provider.getTransactionStatus(hash)).status==='confirmed')break;await new Promise(r=>setTimeout(r,4000));}
fs.writeFileSync(new URL('faucet-return.json',base),JSON.stringify({hash,faucet,lovelace:amount.toString(),fee:cml.body().fee().toString(),confirmed:true},null,2));
console.log('faucet return confirmed');
