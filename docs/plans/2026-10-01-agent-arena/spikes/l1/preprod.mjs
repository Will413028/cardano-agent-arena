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
const blueprint=JSON.parse(fs.readFileSync(new URL('l1-validator/plutus.json',base),'utf8'));
const validator={type:'PlutusV3',script:blueprint.validators.find(v=>v.title==='latency.latency.spend').compiledCode};
const contract=validatorToAddress('Preprod',validator);
const datum=(cells,turn)=>Data.to(new Constr(0,[cells.map(BigInt),BigInt(turn)]));
const resultPath=new URL("preprod-precise.json",base);
const records=fs.existsSync(resultPath)?JSON.parse(fs.readFileSync(resultPath,"utf8")).records:[];
const save=()=>fs.writeFileSync(new URL('preprod-precise.json',base),JSON.stringify({address,contract,records},null,2));
async function submit(tx,label) {
 const signed=await tx.sign.withWallet().complete();
 const cbor=signed.toCBOR();
 const start=Date.now();
 const hash=await signed.submit();
 console.log(JSON.stringify({label,hash,status:'submitted'}));
 for(;;) {
  const status=await provider.getTransactionStatus(hash);
  if(status.status==="confirmed") break;
  await new Promise(resolve=>setTimeout(resolve,4000));
 }
 const observed=Date.now();
 const elapsed=(observed-start)/1000;
 records.push({label,hash,bytes:cbor.length/2,submitted_at_ms:start,observed_at_ms:observed,submit_to_indexer_observed_seconds:elapsed});
 save();console.log(JSON.stringify(records.at(-1)));
 return hash;
}
if(records.some(x=>x.label==='close')) {console.log('Measurement already complete');process.exit(0);}
let hash=records.at(-1)?.hash;
if(!hash) {
 const setup=await lucid.newTx().pay.ToContract(contract,{kind:'inline',value:datum([],0)},{lovelace:3000000n}).pay.ToAddress(address,{lovelace:10000000n}).complete();
 hash=await submit(setup,'setup');
}
const completed=records.filter(x=>x.label.startsWith('move-')).length;
let cells=Array.from({length:completed},(_,i)=>completed-1-i);
for(let step=completed;step<20;step++) {
 const inputs=(await lucid.utxosAt(contract)).filter(x=>x.txHash===hash && x.outputIndex===0);
 const tx=await lucid.newTx().collectFrom(inputs,Data.to(BigInt(step))).attach.SpendingValidator(validator).pay.ToContract(contract,{kind:'inline',value:datum([step,...cells],(step+1)%2)},{lovelace:3000000n}).complete();
 hash=await submit(tx,'move-'+step);cells.unshift(step);
}
const inputs=(await lucid.utxosAt(contract)).filter(x=>x.txHash===hash && x.outputIndex===0);
await submit(await lucid.newTx().collectFrom(inputs,Data.to(-1n)).attach.SpendingValidator(validator).complete(),'close');
