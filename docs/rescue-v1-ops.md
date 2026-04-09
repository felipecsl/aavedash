# Rescue v1 Ops (Atomic Debt Repay)

## Scope

v1 currently supports:

- Ethereum mainnet Aave v3 via `AaveAtomicRepayV1`
- Ethereum mainnet Morpho Blue via `MorphoAtomicRepayV1`
- owner-funded, executor-triggered contract execution

## Build And Test

Prerequisite: Install [Foundry](https://github.com/foundry-rs/foundry).

From repo root:

```bash
cd packages/rescue-contract
forge build
forge test
```

## Deploy Aave

Set env vars for the Aave deploy script:

```bash
export RESCUE_OWNER=0x...                # Contract owner (monitored wallet address)
export RESCUE_EXECUTOR=0x...             # Hot wallet allowed to submit rescue txs
export AAVE_POOL=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
export AAVE_ADDRESSES_PROVIDER=0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e
export DEBT_TOKEN_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  # e.g. USDC
export RPC_URL=https://rpc.mevblocker.io  # or https://eth.llamarpc.com
```

Dry-run (simulation only, no broadcast). `--sender` must match `INITIAL_OWNER` (or `RESCUE_OWNER`
when `INITIAL_OWNER` is unset) so the
`setSupportedAsset` call succeeds in simulation:

```bash
forge script script/DeployAaveAtomicRepayV1.s.sol:DeployAaveAtomicRepayV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --sender ${INITIAL_OWNER:-$RESCUE_OWNER}
```

Broadcast (live deploy):

```bash
forge script script/DeployAaveAtomicRepayV1.s.sol:DeployAaveAtomicRepayV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

If `RESCUE_OWNER` is a hardware wallet, set a temporary deployer as `INITIAL_OWNER`. The script
will deploy from the hot wallet, set `RESCUE_EXECUTOR`, enable the supported asset, and then
transfer ownership to `RESCUE_OWNER` in the same run:

```bash
export INITIAL_OWNER=0xYourHotWallet
export RESCUE_OWNER=0xYourHardwareWallet
export RESCUE_EXECUTOR=0xYourHotWallet

forge script script/DeployAaveAtomicRepayV1.s.sol:DeployAaveAtomicRepayV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Save the deployed contract address from the output.

## Post-Deploy Aave

1. Save deployed `AaveAtomicRepayV1` address.

2. Set `watchdog.rescueContract` in `PUT /api/config`:

   ```bash
   curl -X PUT https://<your-host>/api/config \
     -H 'Content-Type: application/json' \
     -d '{"watchdog": {"rescueContract": "<deployed-address>"}}'
   ```

3. Approve the debt token (e.g. USDC) from monitored wallet to rescue contract (unlimited allowance):

   ```bash
   cast send <debt-token-address> \
     "approve(address,uint256)" \
     <deployed-address> \
     $(cast max-uint) \
     --rpc-url $RPC_URL \
     # sign this with the monitored wallet in your wallet UI / hardware wallet
   ```

   To use a capped allowance instead (e.g. 1000 USDC), replace `$(cast max-uint)` with `1000000000` (6 decimals).

4. Keep watchdog in dry-run first.
5. Switch to live mode after validation.

## Runtime Preconditions

- Monitored wallet is set as `RESCUE_OWNER`.
- Executor wallet is set as `RESCUE_EXECUTOR` (or defaults to `INITIAL_OWNER`).
- Wallet holds the debt token (e.g. USDC/USDT) and has allowance to the Aave rescue contract.
- Rescue contract has the debt token enabled as supported asset.

## Deploy Morpho

Set env vars for the Morpho deploy script:

```bash
export RESCUE_OWNER=0x...                # Contract owner (monitored wallet address)
export RESCUE_EXECUTOR=0x...             # Hot wallet allowed to submit rescue txs
export MORPHO_BLUE=0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
export MORPHO_LOAN_TOKEN=0x...
export MORPHO_COLLATERAL_TOKEN=0x...
export MORPHO_ORACLE=0x...
export MORPHO_IRM=0x...
export MORPHO_LLTV=<wad-value>           # e.g. 860000000000000000 for 86%
export RPC_URL=https://rpc.mevblocker.io # or https://eth.llamarpc.com
```

To avoid typos, generate these directly from a Morpho market URL or market unique key:

```bash
yarn morpho:market-env \
  app.morpho.org/ethereum/market/0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64/cbbtc-usdc
```

Example output for Ethereum `cbBTC/USDC`:

```bash
export MORPHO_BLUE=0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
export MORPHO_LOAN_TOKEN=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
export MORPHO_COLLATERAL_TOKEN=0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf
export MORPHO_ORACLE=0xA6D6950c9F177F1De7f7757FB33539e3Ec60182a
export MORPHO_IRM=0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC
export MORPHO_LLTV=860000000000000000
```

The `MORPHO_*` market params must match the monitored market exactly. A mismatch in
loan token, collateral token, oracle, IRM, or LLTV will make the rescue contract reject the call.

Dry-run (simulation only, no broadcast). `--sender` must match `INITIAL_OWNER` (or `RESCUE_OWNER`
when `INITIAL_OWNER` is unset) so the
`setSupportedMarket` call succeeds in simulation:

```bash
forge script script/DeployMorphoAtomicRepayV1.s.sol:DeployMorphoAtomicRepayV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --sender ${INITIAL_OWNER:-$RESCUE_OWNER}
```

Broadcast (live deploy):

```bash
forge script script/DeployMorphoAtomicRepayV1.s.sol:DeployMorphoAtomicRepayV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

If `RESCUE_OWNER` is a hardware wallet, set a temporary deployer as `INITIAL_OWNER`. The script
will deploy from the hot wallet, set `RESCUE_EXECUTOR`, call `setSupportedMarket(...)`, and then
transfer ownership to `RESCUE_OWNER` in the same run:

```bash
export INITIAL_OWNER=0xYourHotWallet
export RESCUE_OWNER=0xYourHardwareWallet
export RESCUE_EXECUTOR=0xYourHotWallet

forge script script/DeployMorphoAtomicRepayV1.s.sol:DeployMorphoAtomicRepayV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Save the deployed contract address from the output.

## Post-Deploy Morpho

1. Save deployed `MorphoAtomicRepayV1` address.

2. Set `watchdog.morphoRescueContract` in `PUT /api/config`:

```bash
  curl -X PUT https://<your-host>/api/config \
    -H 'Content-Type: application/json' \
    -d '{"watchdog": {"morphoRescueContract": "<deployed-address>"}}'
```

3. Approve the loan token (e.g. USDC `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`) from the monitored wallet to the rescue contract:

   ```bash
   cast send <borrowed-token-address> \
     "approve(address,uint256)" \
     <deployed-address> \
     $(cast max-uint) \
     --rpc-url $RPC_URL \
     # sign this with the monitored wallet in your wallet UI / hardware wallet
   ```

   For a capped allowance, replace `$(cast max-uint)` with the intended amount in token base units.
   The approval must be signed by the monitored wallet / rescue contract owner, not by the deployer,
   because the rescue contract pulls the loan token from `params.user` via `transferFrom(...)`.

   You can also do this from the etherscan UI at https://etherscan.io/address/<borrowed-token-address>#writeProxyContract

   If you want to use Etherscan’s Write Contract UI instead:
   1. Open the USDC contract on Etherscan.
   2. Go to Contract -> Write as Proxy.
   3. Connect your wallet through MetaMask/Rabby with the Trezor account selected.
   4. Use approve(address spender, uint256 amount).
   5. Enter:
      - spender: <deployed-address>
      - amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935 for unlimited, or e.g. 1000000000 for 1000 USDC
   6. Submit and confirm on the Trezor.

4. Verify the supported market params match the monitored loan exactly:
   - `loanToken`
   - `collateralToken`
   - `oracle`
   - `irm`
   - `lltv`

5. Verify the contract source on Etherscan:

   ```bash
   forge verify-contract --chain mainnet \
     --watch \
     --guess-constructor-args \
     --rpc-url $RPC_URL \
     --etherscan-api-key $ETHERSCAN_API_KEY \
     <deployed-address> \
     src/MorphoAtomicRepayV1.sol:MorphoAtomicRepayV1
   ```

   If the contract was deployed with a temporary `INITIAL_OWNER`, `--guess-constructor-args`
   should resolve the constructor from the creation bytecode correctly.

   The current implementation does not auto-discover or auto-register new Morpho markets on-chain. If the monitored
   wallet moves to a different market, deploy or reconfigure a rescue contract with that exact market tuple before
   enabling live mode.

6. Keep watchdog in dry-run first.
7. Switch to live mode after validation.

## Runtime Preconditions (Morpho)

- Monitored wallet is set as `RESCUE_OWNER`.
- Executor wallet is set as `RESCUE_EXECUTOR` (or defaults to `INITIAL_OWNER`).
- Wallet holds the loan token (e.g. USDC) and has allowance to the Morpho rescue contract.
- Rescue contract has the exact Morpho market enabled via `setSupportedMarket`.

## Common Incident Checks

- `Invalid or missing rescueContract in watchdog config`
- `No available USDC (balance/allowance/maxRepay all exhausted)`
- `Insufficient USDC to achieve minimum resulting HF`
- `Invalid or missing morphoRescueContract in watchdog config`
- `No available <debt-symbol> (balance/allowance/maxRepay all exhausted)`
- `Insufficient <debt-symbol> to achieve minimum resulting HF`
- `MarketNotSupported`
- `Gas price ... exceeds max ...`
- `NotExecutor`

```

```
