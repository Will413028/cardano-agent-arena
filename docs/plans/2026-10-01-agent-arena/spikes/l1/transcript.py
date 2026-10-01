from common import *
fixture=json.loads((ROOT/"signed-fixtures.json").read_text())
blue=json.loads((ROOT/"l1-validator/plutus.json").read_text())
script=write("transcript.plutus",{"type":"PlutusScriptV3","description":"signed batch cost benchmark","cborHex":next(x['compiledCode'] for x in blue['validators'] if x['title']=='transcript.transcript.spend')})
address=cli("address","build","--testnet-magic",42,"--payment-script-file",script)
faucet=cli("address","build","--testnet-magic",42,"--payment-verification-key-file","/devnet/credentials/faucet.vk")
f=utxos(faucet);funding=max(f,key=lambda k:f[k]['value']['lovelace'])
d=write("transcript-config.json",{"constructor":0,"fields":[{"list":[{"bytes":x} for x in fixture['pubkeys']]},{"bytes":fixture['match']}]})
cli("transaction","build","--testnet-magic",42,"--tx-in",funding,"--tx-out",address+"+3000000","--tx-out-inline-datum-file",d,"--tx-out",faucet+"+10000000","--change-address",faucet,"--out-file","/devnet/transcript-setup.body")
setup,_=finish("transcript-setup");state=setup+"#0";collateral=setup+"#1"
f=utxos(faucet);funding=max(f,key=lambda k:f[k]['value']['lovelace'])
params=json.loads((DEV/'l1-parameters.json').read_text());rows=[]
def build(n,illegal=False):
 moves=fixture['moves'][:n]
 if illegal: moves=moves.copy();moves[1]=fixture['illegal']
 redeemer=write("sequence.json",{'list':[{'constructor':0,'fields':[{'int':m['cell']},{'bytes':m['signature']}]} for m in moves]})
 try:
  cli("transaction","build","--testnet-magic",42,"--tx-in",funding,"--tx-in",state,"--tx-in-script-file",script,"--tx-in-inline-datum-present","--tx-in-redeemer-file",redeemer,"--tx-in-collateral",collateral,"--tx-out",faucet+"+3000000","--change-address",faucet,"--out-file","/devnet/transcript.body")
  cli("transaction","sign","--testnet-magic",42,"--tx-body-file","/devnet/transcript.body","--signing-key-file","/devnet/credentials/faucet.sk","--out-file","/devnet/transcript.signed")
  size=len(bytes.fromhex(json.loads((DEV/'transcript.signed').read_text())['cborHex']))
  view=json.loads(cli("debug","transaction","view","--tx-file","/devnet/transcript.signed","--output-json"))
  units=view['redeemers'][0]['redeemer']['execution units']
  accepted=size<=params['maxTxSize'] and units['memory']<=params['maxTxExecutionUnits']['memory'] and units['steps']<=params['maxTxExecutionUnits']['steps']
  row={'n':n,'accepted':accepted,'bytes':size,'units':units,'fee':view['fee'],'illegal':illegal}
 except RuntimeError as e:
  row={'n':n,'accepted':False,'error':str(e),'illegal':illegal}
 rows.append(row);print(json.dumps({k:v for k,v in row.items() if k!='error'}),flush=True)
 (ROOT/'transcript-measurements.json').write_text(json.dumps({'limits':params['maxTxExecutionUnits'],'maxTxSize':params['maxTxSize'],'rows':rows},indent=2))
 return row['accepted']
for n in [1,2,4,8,16,25,32,64,96,128,160,192,208,224]: build(n)
lo,hi=1,256
while lo<hi:
 mid=(lo+hi+1)//2
 if build(mid):lo=mid
 else:hi=mid-1
assert not build(lo+1)
assert not build(2,True)
assert build(lo)
raw=cli("transaction","txid","--tx-file","/devnet/transcript.signed");txid=json.loads(raw)['txhash']
cli("transaction","submit","--testnet-magic",42,"--tx-file","/devnet/transcript.signed");wait(txid)
(ROOT/'transcript-result.json').write_text(json.dumps({'maximum_n':lo,'txid':txid,'confirmed':True},indent=2))
print('confirmed maximum',lo,txid,flush=True)
