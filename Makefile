ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
.PHONY: check devnet-up devnet-down
check:
	cd "$(ROOT)" && npm run check:validators
	cd "$(ROOT)" && npm run build:validators
	cd "$(ROOT)" && npm run check:generated
	cd "$(ROOT)" && npm run typecheck
	cd "$(ROOT)" && npm test
	cd "$(ROOT)" && npm run test:e2e
	python3 "$(ROOT)/docs/plans/2026-10-01-agent-arena/check_plan.py"
devnet-up:
	cd "$(ROOT)" && npm run devnet -- up
devnet-down:
	cd "$(ROOT)" && npm run devnet -- down
