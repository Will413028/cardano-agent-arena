import json, subprocess, time, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent
DEV = ROOT.parent / "alt/hydra/demo/devnet"
CONTAINER = "arena-spike-cardano-node-1"
def cli(*args):
    p = subprocess.run(["docker", "exec", CONTAINER, "cardano-cli", *(map(str,args) if args[0]=="debug" else ["conway", *map(str,args)])], capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout.strip()
def write(name, obj):
    (DEV/name).write_text(json.dumps(obj))
    return "/devnet/"+name
def utxos(address): return json.loads(cli("query","utxo","--testnet-magic",42,"--address",address,"--out-file","/dev/stdout"))
def wait(txid):
    start=time.monotonic()
    for _ in range(60):
        v=json.loads(cli("query","utxo","--testnet-magic",42,"--tx-in",txid+"#0","--out-file","/dev/stdout"))
        if v: return time.monotonic()-start
        time.sleep(.2)
    raise RuntimeError("confirmation timeout")
def datum(cells,turn): return {"constructor":0,"fields":[{"list":[{"int":x} for x in cells]},{"int":turn}]}
def finish(name):
    cli("transaction","sign","--testnet-magic",42,"--tx-body-file","/devnet/"+name+".body","--signing-key-file","/devnet/credentials/faucet.sk","--out-file","/devnet/"+name+".signed")
    raw=cli("transaction","txid","--tx-file","/devnet/"+name+".signed")
    txid=json.loads(raw)["txhash"] if raw.startswith("{") else raw
    start=time.monotonic()
    cli("transaction","submit","--testnet-magic",42,"--tx-file","/devnet/"+name+".signed")
    wait(txid)
    return txid,time.monotonic()-start
blue=json.loads((ROOT/"l1-validator/plutus.json").read_text())
script=write("arena.plutus",{"type":"PlutusScriptV3","description":"disposable grid spike","cborHex":next(x["compiledCode"] for x in blue["validators"] if x["title"]=="placeholder.arena.spend")})
address=cli("address","build","--testnet-magic",42,"--payment-script-file",script)
faucet=cli("address","build","--testnet-magic",42,"--payment-verification-key-file","/devnet/credentials/faucet.vk")
available=utxos(faucet)
funding=max(available,key=lambda k:available[k]["value"]["lovelace"])
d=write("board.json",datum([],0))
cli("transaction","build","--testnet-magic",42,"--tx-in",funding,"--tx-out",address+"+3000000","--tx-out-inline-datum-file",d,"--tx-out",faucet+"+10000000","--change-address",faucet,"--out-file","/devnet/setup.body")
setup,_=finish("setup")
state=setup+"#0"; collateral=setup+"#1"
rows=[]
occupied=[]
for step,cell in enumerate([0,0] if os.getenv("ARENA_DUPLICATE") else [0,1]):
    funds=utxos(faucet)
    funding=max((k for k in funds if k!=collateral),key=lambda k:funds[k]["value"]["lovelace"])
    d=write("next.json",datum([cell, *occupied],(step+1)%2))
    redeemer=write("move.json",{"int":cell})
    name="move-"+str(step)
    output=cli("transaction","build","--testnet-magic",42,"--tx-in",funding,"--tx-in",state,"--tx-in-script-file",script,"--tx-in-inline-datum-present","--tx-in-redeemer-file",redeemer,"--tx-in-collateral",collateral,"--tx-out",address+"+3000000","--tx-out-inline-datum-file",d,"--change-address",faucet,"--out-file","/devnet/"+name+".body")
    txid,elapsed=finish(name)
    view=json.loads(cli("debug","transaction","view","--tx-file","/devnet/"+name+".signed","--output-json"))
    envelope=json.loads((DEV/(name+".signed")).read_text())
    rows.append({"cell":cell,"txid":txid,"bytes":len(bytes.fromhex(envelope["cborHex"])),"submit_to_observed_seconds":elapsed,"build":output,"view":view})
    state=txid+"#0"
    occupied.insert(0,cell)
(ROOT/"measurements.json").write_text(json.dumps(rows,indent=2))
(ROOT/"final-state.json").write_text(json.dumps({"state":state,"collateral":collateral,"address":address,"faucet":faucet,"occupied":occupied}))
print(json.dumps([{k:v for k,v in row.items() if k!="view"} for row in rows],indent=2))
