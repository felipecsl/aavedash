# Rescue v1 Ops (Atomic Top-Up)

## Scope

v1 currently supports:

- Ethereum mainnet Aave v3 via `AaveAtomicRescueV1`
- Ethereum mainnet Morpho Blue via `MorphoAtomicRescueV1`
- owner-only contract execution

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
export AAVE_POOL=0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2
export AAVE_ADDRESSES_PROVIDER=0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e
export AAVE_PROTOCOL_DATA_PROVIDER=0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD
export WBTC_ADDRESS=0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
export RPC_URL=https://rpc.mevblocker.io  # or https://eth.llamarpc.com
```

Dry-run (simulation only, no broadcast). `--sender` must match `RESCUE_OWNER` so the
`setSupportedAsset` call succeeds in simulation:

```bash
forge script script/DeployAaveAtomicRescueV1.s.sol:DeployAaveAtomicRescueV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --sender $RESCUE_OWNER
```

Expected output: 2 transactions (deploy + setSupportedAsset), ~1M gas, ~0.00026 ETH.

Broadcast (live deploy):

```bash
forge script script/DeployAaveAtomicRescueV1.s.sol:DeployAaveAtomicRescueV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --broadcast \
  --private-key $WATCHDOG_PRIVATE_KEY
```

Save the deployed contract address from the output.

## Post-Deploy Aave

1. Save deployed `AaveAtomicRescueV1` address.

2. Set `watchdog.rescueContract` in `PUT /api/config`:

   ```bash
   curl -X PUT https://<your-host>/api/config \
     -H 'Content-Type: application/json' \
     -d '{"watchdog": {"rescueContract": "<deployed-address>"}}'
   ```

3. Approve WBTC from monitored wallet to rescue contract (unlimited allowance):

   ```bash
   cast send 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 \
     "approve(address,uint256)" \
     <deployed-address> \
     $(cast max-uint) \
     --rpc-url $RPC_URL \
     --private-key $WATCHDOG_PRIVATE_KEY
   ```

   To use a capped allowance instead (e.g. 1 WBTC), replace `$(cast max-uint)` with `100000000` (8 decimals).

4. Verify WBTC is enabled as collateral on the user's Aave position. Query the
   ProtocolDataProvider — the last field (`bool usedAsCollateral`) must be `true`:

   ```bash
   # Get the ProtocolDataProvider address
   cast call 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e \
     "getPoolDataProvider()(address)" \
     --rpc-url $RPC_URL

   # Check WBTC user reserve data (last field = usedAsCollateral)
   cast call <data-provider-address> \
     "getUserReserveData(address,address)(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint40,bool)" \
     0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 \
     $RESCUE_OWNER \
     --rpc-url $RPC_URL
   ```

   If `usedAsCollateral` is `false`, enable it:

   ```bash
   cast send 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 \
     "setUserUseReserveAsCollateral(address,bool)" \
     0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 \
     true \
     --rpc-url $RPC_URL \
     --private-key $WATCHDOG_PRIVATE_KEY
   ```

5. Keep watchdog in dry-run first.
6. Switch to live mode after validation.

## Runtime Preconditions

- Monitored wallet signer key is set as `WATCHDOG_PRIVATE_KEY`.
- Signer address matches monitored wallet.
- Wallet holds WBTC and has allowance to the Aave rescue contract.
- Rescue contract has WBTC enabled as supported asset.
- WBTC must be enabled as collateral on the user's Aave position (see post-deploy step 4).

## Deploy Morpho

Set env vars for the Morpho deploy script:

```bash
export RESCUE_OWNER=0x...                # Contract owner (monitored wallet address)
export MORPHO_BLUE=0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
export MORPHO_LOAN_TOKEN=0x...
export MORPHO_COLLATERAL_TOKEN=0x...
export MORPHO_ORACLE=0x...
export MORPHO_IRM=0x...
export MORPHO_LLTV=<wad-value>           # e.g. 860000000000000000 for 86%
export RPC_URL=https://rpc.mevblocker.io # or https://eth.llamarpc.com
```

The `MORPHO_*` market params must match the monitored market exactly. A mismatch in
loan token, collateral token, oracle, IRM, or LLTV will make the rescue contract reject the call.

Dry-run (simulation only, no broadcast). `--sender` must match `RESCUE_OWNER` so the
`setSupportedMarket` call succeeds in simulation:

```bash
forge script script/DeployMorphoAtomicRescueV1.s.sol:DeployMorphoAtomicRescueV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --sender $RESCUE_OWNER
```

Broadcast (live deploy):

```bash
forge script script/DeployMorphoAtomicRescueV1.s.sol:DeployMorphoAtomicRescueV1 \
  --rpc-url $RPC_URL \
  --sig "run()" \
  --broadcast \
  --private-key $WATCHDOG_PRIVATE_KEY
```

Save the deployed contract address from the output.

## Post-Deploy Morpho

1. Save deployed `MorphoAtomicRescueV1` address.

2. Set `watchdog.morphoRescueContract` in `PUT /api/config`:

   ```bash
   curl -X PUT https://<your-host>/api/config \
     -H 'Content-Type: application/json' \
     -d '{"watchdog": {"morphoRescueContract": "<deployed-address>"}}'
   ```

3. Approve the monitored market's collateral token from the monitored wallet to the rescue contract:

   ```bash
   cast send <collateral-token-address> \
     "approve(address,uint256)" \
     <deployed-address> \
     $(cast max-uint) \
     --rpc-url $RPC_URL \
     --private-key $WATCHDOG_PRIVATE_KEY
   ```

   For a capped allowance, replace `$(cast max-uint)` with the intended collateral amount in token base units.

4. Verify the supported market params match the monitored loan exactly:

   - `loanToken`
   - `collateralToken`
   - `oracle`
   - `irm`
   - `lltv`

   The current implementation does not auto-discover or auto-register new Morpho markets on-chain. If the monitored
   wallet moves to a different market, deploy or reconfigure a rescue contract with that exact market tuple before
   enabling live mode.

5. Keep watchdog in dry-run first.
6. Switch to live mode after validation.

## Runtime Preconditions (Morpho)

- Monitored wallet signer key is set as `WATCHDOG_PRIVATE_KEY`.
- Signer address matches monitored wallet.
- Wallet holds the monitored market's collateral token and has allowance to the Morpho rescue contract.
- Rescue contract has the exact Morpho market enabled via `setSupportedMarket`.
- No separate Morpho `setAuthorization(...)` call is required for this supply-collateral rescue path.

## Common Incident Checks

- `Invalid or missing rescueContract in watchdog config`
- `No available WBTC (balance/allowance/maxTopUp all exhausted)`
- `Insufficient WBTC to achieve minimum resulting HF`
- `Invalid or missing morphoRescueContract in watchdog config`
- `No available <collateral-symbol> (balance/allowance/maxTopUp all exhausted)`
- `Insufficient <collateral-symbol> to achieve minimum resulting HF`
- `MarketNotSupported`
- `Gas price ... exceeds max ...`
- `Signer address mismatch`
