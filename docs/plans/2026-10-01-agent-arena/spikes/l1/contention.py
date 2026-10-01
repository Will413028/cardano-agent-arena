from common import *
from concurrent.futures import ThreadPoolExecutor
s=json.loads((ROOT/"final-state.json").read_text())
funds=utxos(s["faucet"])
funding=sorted((k for k in funds if k!=s["collateral"] and funds[k]["value"]["lovelace"]>4000000),key=lambda k:funds[k]["value"]["lovelace"],reverse=True)[:2]
def build(i,state,cells):
    name="contender-"+str(i)
    d=write(name+".json",datum([i+2,*cells],(len(cells)+1)%2))
    red=write(name+"-redeemer.json",{"int":i+2})
    cli("transaction","build","--testnet-magic",42,"--tx-in",funding[i],"--tx-in",state,"--tx-in-script-file","/devnet/arena.plutus","--tx-in-inline-datum-present","--tx-in-redeemer-file",red,"--tx-in-collateral",s["collateral"],"--tx-out",s["address"]+"+3000000","--tx-out-inline-datum-file",d,"--change-address",s["faucet"],"--out-file","/devnet/"+name+".body")
    cli("transaction","sign","--testnet-magic",42,"--tx-body-file","/devnet/"+name+".body","--signing-key-file","/devnet/credentials/faucet.sk","--out-file","/devnet/"+name+".signed")
    raw=cli("transaction","txid","--tx-file","/devnet/"+name+".signed")
    return json.loads(raw)["txhash"] if raw.startswith("{") else raw
ids=[build(i,s["state"],s["occupied"]) for i in range(2)]
start=time.monotonic()
def send(i):
    try:
        result=cli("transaction","submit","--testnet-magic",42,"--tx-file","/devnet/contender-"+str(i)+".signed")
        return {"actor":i,"accepted":True,"response":result}
    except RuntimeError as e: return {"actor":i,"accepted":False,"error":str(e)}
with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(send,range(2)))
winner=next(x["actor"] for x in results if x["accepted"])
wait(ids[winner])
loser=1-winner
retryid=build(loser,ids[winner]+"#0",[winner+2,*s["occupied"]])
retry=send(loser)
wait(retryid)
report={"shared_state":s["state"],"distinct_funding":funding,"attempts":results,"retry":retry,"retry_count":1,"total_seconds":time.monotonic()-start}
(ROOT/"contention.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
