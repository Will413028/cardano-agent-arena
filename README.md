# Cardano Agent Arena

Let developers enter their own agents in strategy games, watch matches and replay independently verifiable game histories.

## Status

A devnet walking skeleton passes local and CI acceptance: two local script agents submit numbers, a validator enforces each transition and its outcome, an indexer reads the chain, and a separate verifier replays it through Ogmios. The result page displays the indexed match. This temporary number game is not the approved 5×5 game or a public deployment. User demand remains unvalidated. The approved MVP is recorded in [the plan](docs/plans/2026-10-01-agent-arena.md).

## Planned experience

1. Publish a two-player 5×5 connect-four game: alternate empty-cell moves, full-board draws and five-minute move timeouts.
2. Use validators to enforce legal actions and outcomes under fixed rules.
3. Provide agent integration, spectators, match replay and per-rules-version Elo standings.

## Scope

- Use Cardano to reduce dependence on a single operator and support independent verification.
- Payments, revenue splitting and bookings are outside the product scope.
- Token issuance, NFTs, betting and cryptocurrency prizes are not the product core.

## Verification boundaries

Recorded actions do not prove which model or code generated them. The MVP uses one preprod L1 transaction per move, player-held keys, permissionless challenges and no operator override key. Only the first three matches per unordered wallet pair, rules version and UTC day affect Elo; this does not prevent all rating abuse.

## Development

Requires Node.js 22.18+ (CI uses Node 22), npm, Python 3 and Docker.
The local test starts its own [Yaci DevKit](https://developers.cardano.org/docs/get-started/networks/development-networks/yaci-devkit) 0.12.0 container (node, Ogmios and Kupo)
with a unique name and dynamic ports, and removes only that container.

```sh
npm ci
make check
```

`make check` runs Aiken checks/build, blueprint type drift, TypeScript, unit tests,
real devnet transactions, independent replay, result-page behavior and verifier source mutation.
Transactions are built, evaluated, signed and submitted in-process with Blaze through Ogmios and Kupo.
Each illegal move is checked twice: transaction building refuses it, and the node rejects the same move
submitted without local evaluation as a phase-2 script failure.
Generated schemas come from `validators/plutus.json`; after contract changes run
`npm run build:validators && npm run generate` and review both generated files.

For manual local experiments (one manual session per checkout):

```sh
make devnet-up
npm run index -- <ogmios-ws> <creation-tx-id> <index.json>
npm run verifier -- replay <creation-tx-id> <ogmios-ws>
npm run web -- <index.json>
make devnet-down
```

`devnet-up` prints the Ogmios and Kupo endpoints. The result page listens at `http://127.0.0.1:3400`.
The automatic end-to-end test writes replayable transaction, acceptance and timing evidence to `.local/devnet/`.
Both the indexer and verifier open separate chain-sync sessions from origin; verifier never reads the index JSON.
This is one local chain source, not the two independent reading paths required by plan step 7.
An interrupted test removes its container; a killed one can leave it running, which
`docker rm -f -v $(docker ps -aq --filter label=arena.scope=devnet)` removes.

The skeleton has no timeout, public joining, terminal token burn/refund, official ranking or 5×5 rules.
Its terminal state remains locked on the disposable devnet. Full match lifecycle and hardening follow in the plan.
Player keys are generated in memory for each test run. Funding comes from Yaci DevKit's public default test
mnemonic, which must never hold funds on a public network.

## References

- https://screepspl.us/events/
- https://asteria.txpipe.io/
- https://aiken-lang.org/language-tour/validators
