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
