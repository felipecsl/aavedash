# Rescue Contract (Foundry)

This package contains the v1 atomic rescue contracts for both Aave and Morpho Blue.

## Contents

- `src/AaveAtomicRescueV1.sol` - owner-only atomic rescue executor
- `src/MorphoAtomicRescueV1.sol` - owner-only Morpho Blue collateral top-up executor
- `script/DeployAaveAtomicRescueV1.s.sol` - deploy script
- `script/DeployMorphoAtomicRescueV1.s.sol` - Morpho deploy script
- `test/AaveAtomicRescueV1.t.sol` - unit tests with mocks
- `test/MorphoAtomicRescueV1.t.sol` - Morpho unit tests with mocks

## Commands

```bash
forge build --root packages/rescue-contract
forge test --root packages/rescue-contract
forge script script/DeployAaveAtomicRescueV1.s.sol --root packages/rescue-contract --rpc-url $RPC_URL --broadcast
forge script script/DeployMorphoAtomicRescueV1.s.sol --root packages/rescue-contract --rpc-url $RPC_URL --broadcast
```
