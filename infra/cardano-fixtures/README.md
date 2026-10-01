# Isolated devnet fixtures

These are **public, disposable test credentials**, genesis files and node configuration from
[Hydra](https://github.com/cardano-scaling/hydra/tree/0c395c2b795053db2f5881d949ab05fefcac9f95/hydra-cluster/config),
snapshot `0c395c2b795053db2f5881d949ab05fefcac9f95` (Apache-2.0).
They are copied unchanged from the upstream tracked files, with only Alice, Bob and faucet credentials retained.
The upstream license is included as `LICENSE`.

`scripts/devnet.ts` copies them to a unique ignored `.local/devnet/` directory and updates
the genesis timestamps for each test run. Runtime slots are one second and epochs are
1,000 slots instead of the upstream stress-test's 0.1-second slots and five-slot epochs.
This keeps epoch-transition churn separate from transaction correctness tests;
protocol fee, transaction-size and execution-unit limits are unchanged.
The isolated network has magic 42 and no peers.
No fixture key should ever receive funds on a public network.

Runtime node and Ogmios containers are unique to each run and removed after testing.
The test retains chain files and transaction evidence under `.local/`; none are used as
inputs to the independent verifier.
