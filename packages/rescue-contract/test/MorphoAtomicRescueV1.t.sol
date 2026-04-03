// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test} from "forge-std/Test.sol";
import {MorphoAtomicRescueV1, IMorpho, IIrm} from "../src/MorphoAtomicRescueV1.sol";

contract MockToken {
    string public name = "Mock";
    string public symbol = "MOCK";
    uint8 public decimals = 8;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        require(balanceOf[from] >= amount, "balance");
        allowance[from][msg.sender] = allowed - amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockMorphoOracle {
    uint256 public price;

    constructor(uint256 price_) {
        price = price_;
    }

    function setPrice(uint256 price_) external {
        price = price_;
    }
}

contract MockMorphoIrm is IIrm {
    uint256 public borrowRateWad;

    function setBorrowRateWad(uint256 borrowRateWad_) external {
        borrowRateWad = borrowRateWad_;
    }

    function borrowRateView(IMorpho.MarketParams memory, IMorpho.Market memory)
        external
        view
        returns (uint256)
    {
        return borrowRateWad;
    }
}

contract MockMorpho {
    struct PositionData {
        uint256 supplyShares;
        uint128 borrowShares;
        uint128 collateral;
    }

    struct MarketData {
        uint128 totalSupplyAssets;
        uint128 totalSupplyShares;
        uint128 totalBorrowAssets;
        uint128 totalBorrowShares;
        uint128 lastUpdate;
        uint128 fee;
    }

    mapping(bytes32 => mapping(address => PositionData)) public positions;
    mapping(bytes32 => MarketData) public markets;
    // Track supply calls for test assertions
    uint256 public lastSupplyAmount;
    address public lastSupplyOnBehalf;

    function setPosition(bytes32 id, address user, PositionData memory data) external {
        positions[id][user] = data;
    }

    function setMarket(bytes32 id, MarketData memory data) external {
        markets[id] = data;
    }

    function position(bytes32 id, address user)
        external
        view
        returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)
    {
        PositionData memory p = positions[id][user];
        return (p.supplyShares, p.borrowShares, p.collateral);
    }

    function market(bytes32 id)
        external
        view
        returns (
            uint128 totalSupplyAssets,
            uint128 totalSupplyShares,
            uint128 totalBorrowAssets,
            uint128 totalBorrowShares,
            uint128 lastUpdate,
            uint128 fee
        )
    {
        MarketData memory m = markets[id];
        return (
            m.totalSupplyAssets,
            m.totalSupplyShares,
            m.totalBorrowAssets,
            m.totalBorrowShares,
            m.lastUpdate,
            m.fee
        );
    }

    function supplyCollateral(
        IMorpho.MarketParams calldata,
        uint256 assets,
        address onBehalf,
        bytes calldata
    ) external {
        lastSupplyAmount = assets;
        lastSupplyOnBehalf = onBehalf;

        // The test setUp pre-configures the post-rescue position state directly
        // since MockMorpho can't easily hash calldata params.
    }
}

contract MorphoAtomicRescueV1Test is Test {
    address internal owner = makeAddr("owner");
    address internal user = makeAddr("user");

    MockToken internal collateralToken;
    MockToken internal loanToken;
    MockMorpho internal mockMorpho;
    MockMorphoOracle internal mockOracle;
    MockMorphoIrm internal mockIrm;
    MorphoAtomicRescueV1 internal rescue;

    IMorpho.MarketParams internal marketParams;
    bytes32 internal marketId;

    function setUp() external {
        collateralToken = new MockToken();
        loanToken = new MockToken();
        mockMorpho = new MockMorpho();
        mockIrm = new MockMorphoIrm();
        // Oracle price: 1 collateral = 30000 loan tokens (e.g., WBTC/USDC), scaled to 1e36
        // For 8-decimal collateral and 6-decimal loan: price = 30000 * 1e36 * 1e6 / 1e8 = 30000e34
        // Actually, Morpho oracle price is: price of 1 unit of collateral (in loan token base units)
        // scaled by 1e36. So for WBTC ($30k) collateral and USDC ($1) loan:
        // price = 30000 * 10^6 / 10^8 * 10^36 = 30000 * 10^34 = 3e38
        mockOracle = new MockMorphoOracle(3e38);

        marketParams = IMorpho.MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: address(mockOracle),
            irm: address(mockIrm),
            lltv: 0.86e18 // 86% LLTV
        });

        marketId = keccak256(abi.encode(marketParams));

        rescue = new MorphoAtomicRescueV1(owner, address(mockMorpho));

        vm.prank(owner);
        rescue.setSupportedMarket(marketParams, true);

        // Give user collateral tokens and approve rescue contract
        collateralToken.mint(user, 100e8); // 100 WBTC
        vm.prank(user);
        collateralToken.approve(address(rescue), type(uint256).max);

        // Set up a position: 1 WBTC collateral, ~20k USDC borrow.
        mockMorpho.setPosition(
            marketId,
            user,
            MockMorpho.PositionData({
                supplyShares: 0,
                borrowShares: 20000e6, // 1:1 with assets for simplicity
                collateral: 1e8 // 1 WBTC (8 decimals)
            })
        );

        mockMorpho.setMarket(
            marketId,
            MockMorpho.MarketData({
                totalSupplyAssets: 1000000e6,
                totalSupplyShares: 1000000e6,
                totalBorrowAssets: 500000e6,
                totalBorrowShares: 500000e6, // 1:1 ratio
                lastUpdate: uint128(block.timestamp),
                fee: 0
            })
        );
    }

    function test_owner_only() external {
        MorphoAtomicRescueV1.RescueParams memory params = MorphoAtomicRescueV1.RescueParams({
            user: user,
            marketParams: marketParams,
            amount: 1e8,
            minResultingHF: 1.1e18,
            deadline: block.timestamp + 1
        });

        vm.prank(user);
        vm.expectRevert(MorphoAtomicRescueV1.NotOwner.selector);
        rescue.rescue(params);
    }

    function test_reverts_if_deadline_expired() external {
        MorphoAtomicRescueV1.RescueParams memory params = MorphoAtomicRescueV1.RescueParams({
            user: user,
            marketParams: marketParams,
            amount: 1e8,
            minResultingHF: 1.1e18,
            deadline: block.timestamp - 1
        });

        vm.prank(owner);
        vm.expectRevert(MorphoAtomicRescueV1.DeadlineExpired.selector);
        rescue.rescue(params);
    }

    function test_executes_rescue_when_result_hf_is_sufficient() external {
        uint256 expectedPostRescueHf = _expectedHF(1.5e8, 20_000e6, 500_000e6, 500_000e6, 0, 0.86e18, 3e38);
        // Update the position to reflect post-supply state.
        mockMorpho.setPosition(
            marketId,
            user,
            MockMorpho.PositionData({
                supplyShares: 0,
                borrowShares: 20000e6,
                collateral: 1.5e8 // 1.5 WBTC after rescue
            })
        );

        MorphoAtomicRescueV1.RescueParams memory params = MorphoAtomicRescueV1.RescueParams({
            user: user,
            marketParams: marketParams,
            amount: 0.5e8,
            minResultingHF: expectedPostRescueHf - 1,
            deadline: block.timestamp + 10
        });

        vm.prank(owner);
        rescue.rescue(params);

        // Verify token was transferred
        assertEq(mockMorpho.lastSupplyAmount(), 0.5e8);
        assertEq(mockMorpho.lastSupplyOnBehalf(), user);
    }

    function test_reverts_if_resulting_hf_too_low() external {
        uint256 expectedHf = _expectedHF(1e8, 20_000e6, 500_000e6, 500_000e6, 0, 0.86e18, 3e38);
        MorphoAtomicRescueV1.RescueParams memory params = MorphoAtomicRescueV1.RescueParams({
            user: user,
            marketParams: marketParams,
            amount: 0.1e8,
            minResultingHF: expectedHf + 1,
            deadline: block.timestamp + 10
        });

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                MorphoAtomicRescueV1.ResultingHFTooLow.selector, expectedHf, expectedHf + 1
            )
        );
        rescue.rescue(params);
    }

    function test_reverts_if_market_not_supported() external {
        IMorpho.MarketParams memory unsupportedMarket = IMorpho.MarketParams({
            loanToken: address(loanToken),
            collateralToken: address(collateralToken),
            oracle: address(mockOracle),
            irm: address(0x2), // different IRM
            lltv: 0.90e18
        });

        MorphoAtomicRescueV1.RescueParams memory params = MorphoAtomicRescueV1.RescueParams({
            user: user,
            marketParams: unsupportedMarket,
            amount: 1e8,
            minResultingHF: 1.1e18,
            deadline: block.timestamp + 10
        });

        vm.prank(owner);
        vm.expectRevert(MorphoAtomicRescueV1.MarketNotSupported.selector);
        rescue.rescue(params);
    }

    function test_preview_increases_with_amount() external view {
        uint256 hf0 = rescue.previewResultingHF(marketParams, user, 0);
        uint256 hf1 = rescue.previewResultingHF(marketParams, user, 1e8);
        assertGt(hf1, hf0);
    }

    function test_preview_returns_max_when_no_debt() external {
        // Create a position with no borrow
        mockMorpho.setPosition(
            marketId,
            user,
            MockMorpho.PositionData({
                supplyShares: 0,
                borrowShares: 0,
                collateral: 1e8
            })
        );

        uint256 hf = rescue.previewResultingHF(marketParams, user, 0);
        assertEq(hf, type(uint256).max);
    }

    function test_preview_math_correctness() external view {
        uint256 hf = rescue.previewResultingHF(marketParams, user, 0);
        uint256 expected = _expectedHF(1e8, 20_000e6, 500_000e6, 500_000e6, 0, 0.86e18, 3e38);
        assertEq(hf, expected);
    }

    function test_preview_with_additional_collateral() external view {
        uint256 hf = rescue.previewResultingHF(marketParams, user, 1e8);
        uint256 expected = _expectedHF(2e8, 20_000e6, 500_000e6, 500_000e6, 0, 0.86e18, 3e38);
        assertEq(hf, expected);
    }

    function test_preview_accrues_interest_before_health_check() external {
        uint256 borrowRatePerSecond = 1e14; // 0.01% per second
        vm.warp(2_000);
        mockIrm.setBorrowRateWad(borrowRatePerSecond);
        mockMorpho.setMarket(
            marketId,
            MockMorpho.MarketData({
                totalSupplyAssets: 1_000_000e6,
                totalSupplyShares: 1_000_000e6,
                totalBorrowAssets: 500_000e6,
                totalBorrowShares: 500_000e6,
                lastUpdate: uint128(block.timestamp - 1_000),
                fee: 0
            })
        );

        uint256 hf = rescue.previewResultingHF(marketParams, user, 0);
        uint256 expected =
            _expectedHF(1e8, 20_000e6, 500_000e6, 500_000e6, borrowRatePerSecond, 0.86e18, 3e38);
        uint256 stale = _expectedHF(1e8, 20_000e6, 500_000e6, 500_000e6, 0, 0.86e18, 3e38);

        assertEq(hf, expected);
        assertLt(hf, stale);
    }

    function test_preview_uses_virtual_share_math_for_borrow_conversion() external {
        mockMorpho.setPosition(
            marketId,
            user,
            MockMorpho.PositionData({
                supplyShares: 0,
                borrowShares: 1,
                collateral: 100
            })
        );
        mockMorpho.setMarket(
            marketId,
            MockMorpho.MarketData({
                totalSupplyAssets: 0,
                totalSupplyShares: 0,
                totalBorrowAssets: 10_000_000,
                totalBorrowShares: 1_000_000,
                lastUpdate: uint128(block.timestamp),
                fee: 0
            })
        );

        uint256 hf = rescue.previewResultingHF(marketParams, user, 0);
        uint256 expected = _expectedHF(100, 1, 10_000_000, 1_000_000, 0, 0.86e18, 3e38);
        uint256 naiveBorrowAssets = _mulDivUp(1, 10_000_000, 1_000_000);

        assertEq(hf, expected);
        assertEq(_toAssetsUp(1, 10_000_000, 1_000_000), 6);
        assertGt(naiveBorrowAssets, _toAssetsUp(1, 10_000_000, 1_000_000));
    }

    function _expectedHF(
        uint256 collateral,
        uint256 borrowShares,
        uint256 totalBorrowAssets,
        uint256 totalBorrowShares,
        uint256 borrowRatePerSecond,
        uint256 lltv,
        uint256 oraclePrice
    ) internal pure returns (uint256) {
        uint256 borrowed =
            _expectedBorrowAssets(borrowShares, totalBorrowAssets, totalBorrowShares, borrowRatePerSecond, 1_000);
        uint256 maxBorrow = _wMulDown(_mulDivDown(collateral, oraclePrice, 1e36), lltv);
        if (borrowed == 0) return type(uint256).max;
        return _wDivDown(maxBorrow, borrowed);
    }

    function _expectedBorrowAssets(
        uint256 borrowShares,
        uint256 totalBorrowAssets,
        uint256 totalBorrowShares,
        uint256 borrowRatePerSecond,
        uint256 elapsed
    ) internal pure returns (uint256) {
        uint256 accruedBorrowAssets = totalBorrowAssets;
        if (borrowRatePerSecond != 0 && elapsed != 0) {
            uint256 interest =
                _wMulDown(totalBorrowAssets, _wTaylorCompounded(borrowRatePerSecond, elapsed));
            accruedBorrowAssets += interest;
        }
        return _toAssetsUp(borrowShares, accruedBorrowAssets, totalBorrowShares);
    }

    function _toAssetsUp(uint256 shares, uint256 totalAssets, uint256 totalShares)
        internal
        pure
        returns (uint256)
    {
        return _mulDivUp(shares, totalAssets + 1, totalShares + 1e6);
    }

    function _wMulDown(uint256 x, uint256 y) internal pure returns (uint256) {
        return _mulDivDown(x, y, 1e18);
    }

    function _wDivDown(uint256 x, uint256 y) internal pure returns (uint256) {
        return _mulDivDown(x, 1e18, y);
    }

    function _mulDivDown(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        return (x * y) / d;
    }

    function _mulDivUp(uint256 x, uint256 y, uint256 d) internal pure returns (uint256) {
        return (x * y + (d - 1)) / d;
    }

    function _wTaylorCompounded(uint256 x, uint256 n) internal pure returns (uint256) {
        uint256 firstTerm = x * n;
        uint256 secondTerm = _mulDivDown(firstTerm, firstTerm, 2e18);
        uint256 thirdTerm = _mulDivDown(secondTerm, firstTerm, 3e18);
        return firstTerm + secondTerm + thirdTerm;
    }
}
