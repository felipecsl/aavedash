// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script} from "forge-std/Script.sol";
import {AaveAtomicRepayV1} from "../src/AaveAtomicRepayV1.sol";

contract DeployAaveAtomicRepayV1 is Script {
    function run() external {
        address owner = vm.envAddress("RESCUE_OWNER");
        address initialOwner = vm.envOr("INITIAL_OWNER", owner);
        address executor = vm.envOr("RESCUE_EXECUTOR", initialOwner);
        address pool = vm.envAddress("AAVE_POOL");
        address addressesProvider = vm.envAddress("AAVE_ADDRESSES_PROVIDER");
        address debtToken = vm.envAddress("DEBT_TOKEN_ADDRESS");

        vm.startBroadcast();

        AaveAtomicRepayV1 rescue =
            new AaveAtomicRepayV1(initialOwner, executor, pool, addressesProvider);
        rescue.setSupportedAsset(debtToken, true);
        if (initialOwner != owner) {
            rescue.setOwner(owner);
        }

        vm.stopBroadcast();
    }
}
