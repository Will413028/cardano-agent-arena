from common import *
import urllib.request
faucet=cli("address","build","--testnet-magic",42,"--payment-verification-key-file","/devnet/credentials/faucet.vk")
f=utxos(faucet); funding=max(f,key=lambda k:f[k]["value"]["lovelace"])
actor=cli("address","build","--testnet-magic",42,"--payment-verification-key-file","/devnet/credentials/alice-funds.vk")
cli("transaction","build","--testnet-magic",42,"--tx-in",funding,"--tx-out",actor+"+100000000","--change-address",faucet,"--out-file","/devnet/hydra-funds.body")
txid,_=finish("hydra-funds")
f=utxos(actor)
request=urllib.request.Request("http://127.0.0.1:4401/commit",data=json.dumps(f).encode(),headers={"Content-Type":"application/json"})
response=json.loads(urllib.request.urlopen(request).read())
write("hydra-deposit.json",response)
cli("transaction","sign","--testnet-magic",42,"--tx-file","/devnet/hydra-deposit.json","--signing-key-file","/devnet/credentials/alice-funds.sk","--out-file","/devnet/hydra-deposit.signed")
print(cli("transaction","submit","--testnet-magic",42,"--tx-file","/devnet/hydra-deposit.signed"))
