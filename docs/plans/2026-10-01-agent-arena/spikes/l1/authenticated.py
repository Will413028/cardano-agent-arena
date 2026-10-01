from common import *
blue=json.loads((ROOT/"l1-validator/plutus.json").read_text())
faucet=cli("address","build","--testnet-magic",42,"--payment-verification-key-file","/devnet/credentials/faucet.vk")
f=utxos(faucet); seed=max(f,key=lambda k:f[k]["value"]["lovelace"])
collateral=next(k for k in f if k!=seed and f[k]["value"]["lovelace"]>=10000000)
txhash,index=seed.split("#")
param="d8799f5820"+txhash+(f"{int(index):02x}" if int(index)<24 else "18"+f"{int(index):02x}")+"ff"
subprocess.run([str(ROOT/"node_modules/.bin/aiken"),"blueprint","apply","-i",str(ROOT/"l1-validator/plutus.json"),"-m","authenticated","-v","thread","-o",str(ROOT/"thread-applied.json"),param],check=True,capture_output=True)
applied=json.loads((ROOT/"thread-applied.json").read_text())
def script_file(name,title,source):
 return write(name,{"type":"PlutusScriptV3","description":"spike only","cborHex":next(v["compiledCode"] for v in source["validators"] if v["title"]==title)})
thread=script_file("thread.plutus","authenticated.thread.mint",applied)
script=script_file("authenticated.plutus","authenticated.authenticated.spend",blue)
policy=cli("transaction","policyid","--script-file",thread)
unit=policy+".6172656e61"
address=cli("address","build","--testnet-magic",42,"--payment-script-file",script)
actors=["alice","bob"]
addresses=[cli("address","build","--testnet-magic",42,"--payment-verification-key-file","/devnet/credentials/"+x+".vk") for x in actors]
keys=[cli("address","key-hash","--payment-verification-key-file","/devnet/credentials/"+x+".vk") for x in actors]
def board(cells,turn):
 return {"constructor":0,"fields":[{"list":[{"int":x} for x in cells]},{"int":turn},{"list":[{"bytes":x} for x in keys]},{"bytes":policy}]}
d=write("auth-board.json",board([],0));red=write("unit.json",{"constructor":0,"fields":[]})
cli("transaction","build","--testnet-magic",42,"--tx-in",seed,"--tx-in-collateral",collateral,"--mint","1 "+unit,"--mint-script-file",thread,"--mint-redeemer-file",red,"--tx-out",address+"+3000000+1 "+unit,"--tx-out-inline-datum-file",d,"--tx-out",addresses[0]+"+100000000","--tx-out",addresses[1]+"+100000000","--tx-out",addresses[0]+"+10000000","--tx-out",addresses[1]+"+10000000","--change-address",faucet,"--out-file","/devnet/auth-setup.body")
setup,_=finish("auth-setup")
state=setup+"#0";cells=[];rows=[]
for step in range(2):
 actor=step%2
 fund=utxos(addresses[actor]);funding=max(fund,key=lambda k:fund[k]["value"]["lovelace"])
 d=write("auth-next.json",board([step,*cells],1-actor));red=write("auth-move.json",{"int":step})
 args=["transaction","build","--testnet-magic",42,"--tx-in",funding,"--tx-in",state,"--tx-in-script-file",script,"--tx-in-inline-datum-present","--tx-in-redeemer-file",red,"--tx-in-collateral",setup+"#"+str(actor+3),"--required-signer-hash",keys[actor],"--tx-out",address+"+3000000+1 "+unit,"--tx-out-inline-datum-file",d,"--change-address",addresses[actor],"--out-file","/devnet/auth-move.body"]
 if step==1:
  wrong=args.copy();wrong[wrong.index("--required-signer-hash")+1]=keys[0]
  try: cli(*wrong);raise AssertionError("wrong player accepted")
  except RuntimeError as e: (ROOT/"wrong-player.log").write_text(str(e))
 cli(*args)
 cli("transaction","sign","--testnet-magic",42,"--tx-body-file","/devnet/auth-move.body","--signing-key-file","/devnet/credentials/"+actors[actor]+".sk","--out-file","/devnet/auth-move.signed")
 raw=cli("transaction","txid","--tx-file","/devnet/auth-move.signed");txid=json.loads(raw)["txhash"]
 start=time.monotonic();cli("transaction","submit","--testnet-magic",42,"--tx-file","/devnet/auth-move.signed");wait(txid)
 view=json.loads(cli("debug","transaction","view","--tx-file","/devnet/auth-move.signed","--output-json"))
 rows.append({"actor":actors[actor],"txid":txid,"bytes":len(bytes.fromhex(json.loads((DEV/"auth-move.signed").read_text())["cborHex"])),"seconds":time.monotonic()-start,"view":view})
 state=txid+"#0";cells.insert(0,step)
minimum=cli("transaction","calculate-min-required-utxo","--protocol-params-file","/devnet/l1-parameters.json","--tx-out",address+"+3000000+1 "+unit,"--tx-out-inline-datum-file",d)
(ROOT/"authenticated-measurements.json").write_text(json.dumps({"policy":policy,"minimum":minimum,"rows":rows},indent=2))
print(json.dumps({"minimum":minimum,"rows":[{k:v for k,v in x.items() if k!="view"} for x in rows]},indent=2))
