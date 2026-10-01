from common import *
import urllib.request

def get(path): return json.loads(urllib.request.urlopen("http://127.0.0.1:4401/"+path).read())
def submit(name):
 cli("transaction","sign","--testnet-magic",42,"--tx-body-file","/devnet/"+name+".body","--signing-key-file","/devnet/credentials/alice-funds.sk","--out-file","/devnet/"+name+".signed")
 signed=json.loads((DEV/(name+".signed")).read_text())
 raw=cli("transaction","txid","--tx-file","/devnet/"+name+".signed");txid=json.loads(raw)["txhash"]
 start=time.monotonic()
 req=urllib.request.Request("http://127.0.0.1:4401/transaction",data=json.dumps(signed).encode(),headers={"Content-Type":"application/json"})
 try: result=json.loads(urllib.request.urlopen(req,timeout=30).read())
 except urllib.error.HTTPError as e: raise RuntimeError(e.read().decode())
 for _ in range(100):
  snapshot=get("snapshot/utxo")
  if txid+"#0" in snapshot: break
  time.sleep(.01)
 else: raise RuntimeError("snapshot confirmation timeout")
 return txid,time.monotonic()-start,result
actor=cli("address","build","--testnet-magic",42,"--payment-verification-key-file","/devnet/credentials/alice-funds.vk")
u=get("snapshot/utxo");funding=next(k for k,v in u.items() if v['address']==actor)
script="/devnet/arena.plutus"
address=cli("address","build","--testnet-magic",42,"--payment-script-file",script)
existing=[] if os.getenv("ARENA_REMEASURE") else [k for k,v in u.items() if v['address']==address]
if existing:
 state=existing[0];collateral=funding
 cells=[x['int'] for x in u[state]['inlineDatum']['fields'][0]['list']]
else:
 d=write("head-board.json",datum([],0))
 amount=u[funding]['value']['lovelace']-3000000
 cli("transaction","build-raw","--tx-in",funding,"--tx-out",address+"+3000000","--tx-out-inline-datum-file",d,"--tx-out",actor+"+"+str(amount),"--fee",0,"--out-file","/devnet/head-setup.body")
 setup,_,_=submit("head-setup")
 state=setup+"#0";collateral=setup+"#1";cells=[]
rows=[] if os.getenv("ARENA_REMEASURE") else (json.loads((ROOT/"hydra-measurements.json").read_text()) if (ROOT/"hydra-measurements.json").exists() else [])
for step in range(len(cells),20):
 d=write("head-next.json",datum([step,*cells],(step+1)%2));red=write("head-redeemer.json",{"int":step})
 cli("transaction","build-raw","--tx-in",state,"--tx-in-script-file",script,"--tx-in-inline-datum-present","--tx-in-redeemer-file",red,"--protocol-params-file","/devnet/hydra-parameters.json","--tx-in-execution-units","(500000000,5000000)","--tx-in-collateral",collateral,"--tx-out",address+"+3000000","--tx-out-inline-datum-file",d,"--fee",0,"--out-file","/devnet/head-move.body")
 txid,elapsed,result=submit("head-move")
 rows.append({"step":step,"txid":txid,"confirmed_snapshot_seconds":elapsed,"response":result})
 (ROOT/"hydra-measurements.json").write_text(json.dumps(rows,indent=2))
 print(json.dumps(rows[-1]),flush=True)
 state=txid+"#0";cells.insert(0,step)
