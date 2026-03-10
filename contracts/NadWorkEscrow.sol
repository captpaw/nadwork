// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract NadWorkEscrow {
    error EscrowNotFactory();
    error EscrowNotOwner();
    error EscrowReentrant();
    error EscrowPaused();
    error EscrowZeroAddress();
    error EscrowUnauthorized();
    error EscrowNoTreasury();
    error EscrowZeroRewardValue();
    error EscrowAlreadyDeposited();
    error EscrowZeroAmount();
    error EscrowZeroToken();
    error EscrowTransferFromFailed();
    error EscrowZeroActualAmount();
    error EscrowNoWinners();
    error EscrowLengthMismatch();
    error EscrowNotFound();
    error EscrowAlreadySettled();
    error EscrowWeightsMustSum100();
    error EscrowNoBuilders();
    error EscrowERC20FeeFailed();
    error EscrowERC20PayoutFailed();
    error EscrowZeroStake();
    error EscrowStakeAlreadyExists();
    error EscrowNoStakeToRefund();
    error EscrowStakeAlreadyHeld();
    error EscrowInvalidBps();
    error EscrowZeroRecipient();
    error EscrowMONTransferFailed();
    error EscrowERC20TransferFailed();

    uint256 public constant FEE_BPS      = 300;
    uint256 public constant BPS_DENOM    = 10_000;
    uint256 public constant GRACE_PERIOD = 7 days;

    address public owner;
    address public factory;
    address public treasury;
    bool    private _paused;
    uint256 private _locked;

    struct EscrowRecord {
        address depositor;
        address rewardToken;
        uint256 amount;
        uint256 deadline;
        bool    released;
        bool    refunded;
    }

    mapping(uint256 => EscrowRecord) private _records;

    // V3 Fair System: submission stakes — bountyId => builder => stake amount
    mapping(uint256 => mapping(address => uint256)) public submissionStakes;
    // V3 Fair System: creator stakes — bountyId => stake amount (stored separately from reward)
    mapping(uint256 => uint256) public creatorStakes;
    // V3 Fair System: held dispute stakes — bountyId => builder => stake amount
    // Stake moves here when builder raises a dispute so it can be slashed if dispute is denied
    mapping(uint256 => mapping(address => uint256)) public heldDisputeStakes;

    event Deposited(uint256 indexed bountyId, address depositor, address token, uint256 amount);
    event Released(uint256 indexed bountyId, address[] winners, uint256[] amounts, uint256 fee);
    event ReleasedToAll(uint256 indexed bountyId, address[] builders, uint256 eachAmount, uint256 fee);
    event TimeoutClaimed(uint256 indexed bountyId, address[] builders, uint256 eachAmount);
    event Refunded(uint256 indexed bountyId, address depositor, uint256 amount);
    event FeeSwept(address indexed to, uint256 amount);
    event TreasurySet(address indexed treasury);
    event FactorySet(address indexed factory);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    // V3 events
    event SubmissionStakeDeposited(uint256 indexed bountyId, address indexed builder, uint256 amount);
    event SubmissionStakeRefunded(uint256 indexed bountyId, address indexed builder, uint256 amount);
    event SubmissionStakeSlashed(uint256 indexed bountyId, address indexed builder, uint256 amount);
    event DisputeStakeHeld(uint256 indexed bountyId, address indexed builder, uint256 amount);
    event DisputeStakeReleased(uint256 indexed bountyId, address indexed builder, uint256 amount);
    event CreatorStakeDeposited(uint256 indexed bountyId, address indexed creator, uint256 amount);
    event CreatorStakeRefunded(uint256 indexed bountyId, address indexed creator, uint256 amount);
    event CreatorStakeSlashed(uint256 indexed bountyId, uint256 toBuilders, uint256 toTreasury);

    // FIX H-SC-4: Removed `|| msg.sender == owner` — owner cannot bypass factory logic
    modifier onlyFactory()   { if (msg.sender != factory) revert EscrowNotFactory(); _; }
    modifier onlyOwner()     { if (msg.sender != owner)   revert EscrowNotOwner();   _; }
    modifier nonReentrant()  { if (_locked != 0) revert EscrowReentrant(); _locked = 1; _; _locked = 0; }
    modifier whenNotPaused() { if (_paused) revert EscrowPaused(); _; }

    constructor(address _treasury) {
        if (_treasury == address(0)) revert EscrowZeroAddress();
        owner = msg.sender;
        treasury = _treasury;
    }

    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert EscrowZeroAddress();
        factory = _factory;
        emit FactorySet(_factory);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert EscrowZeroAddress();
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    function pause()   external onlyOwner { _paused = true;  }
    function unpause() external onlyOwner { _paused = false; }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert EscrowZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Accept ETH from factory only (featured fees, dispute deposits etc.)
    receive() external payable {
        if (msg.sender != factory) revert EscrowUnauthorized();
    }

    // FIX M-SC-1: sweepFees uses pull-pattern accumulation via payable receive;
    // forward to treasury. If treasury reverts, the call itself reverts but
    // the factory can still retry with a new treasury address.
    function sweepFees() external payable onlyFactory {
        if (msg.value > 0) {
            if (treasury == address(0)) revert EscrowNoTreasury();
            _safeTransferMON(treasury, msg.value);
            emit FeeSwept(treasury, msg.value);
        }
    }

    // V3: msg.value = totalReward + posterStake; posterStake stored separately
    function depositNative(uint256 bountyId, address depositor, uint256 deadline, uint256 stakeAmount)
        external payable onlyFactory whenNotPaused nonReentrant
    {
        if (msg.value <= stakeAmount) revert EscrowZeroRewardValue();
        if (_records[bountyId].amount != 0) revert EscrowAlreadyDeposited();
        uint256 rewardAmount = msg.value - stakeAmount;
        _records[bountyId] = EscrowRecord({
            depositor: depositor, rewardToken: address(0),
            amount: rewardAmount, deadline: deadline,
            released: false, refunded: false
        });
        if (stakeAmount > 0) {
            creatorStakes[bountyId] = stakeAmount;
            emit CreatorStakeDeposited(bountyId, depositor, stakeAmount);
        }
        emit Deposited(bountyId, depositor, address(0), rewardAmount);
    }

    // FIX C-SC-3: Measure actual received amount to handle fee-on-transfer tokens
    // V3: msg.value = posterStake (MON), ERC20 reward is transferred separately
    function depositERC20(uint256 bountyId, address depositor, address token, uint256 amount, uint256 deadline)
        external payable onlyFactory whenNotPaused nonReentrant
    {
        if (amount == 0) revert EscrowZeroAmount();
        if (token == address(0)) revert EscrowZeroToken();
        if (_records[bountyId].amount != 0) revert EscrowAlreadyDeposited();

        uint256 balBefore = _balanceOf(token, address(this));
        bool ok = _transferFrom(token, depositor, address(this), amount);
        if (!ok) revert EscrowTransferFromFailed();
        uint256 actualAmount = _balanceOf(token, address(this)) - balBefore;
        if (actualAmount == 0) revert EscrowZeroActualAmount();

        _records[bountyId] = EscrowRecord({
            depositor: depositor, rewardToken: token,
            amount: actualAmount, deadline: deadline,
            released: false, refunded: false
        });
        if (msg.value > 0) {
            creatorStakes[bountyId] = msg.value;
            emit CreatorStakeDeposited(bountyId, depositor, msg.value);
        }
        emit Deposited(bountyId, depositor, token, actualAmount);
    }

    // FIX H-SC-2: Send remainder dust to last winner to prevent permanent lock
    function release(uint256 bountyId, address[] calldata winners, uint8[] calldata weights)
        external onlyFactory nonReentrant
    {
        if (winners.length == 0) revert EscrowNoWinners();
        if (winners.length != weights.length) revert EscrowLengthMismatch();
        EscrowRecord storage r = _records[bountyId];
        if (r.amount == 0) revert EscrowNotFound();
        if (r.released || r.refunded) revert EscrowAlreadySettled();

        uint256 weightSum = 0;
        for (uint256 i = 0; i < weights.length; i++) weightSum += weights[i];
        if (weightSum != 100) revert EscrowWeightsMustSum100();

        r.released = true;
        uint256 total      = r.amount;
        uint256 fee        = (total * FEE_BPS) / BPS_DENOM;
        uint256 builderPool = total - fee;
        uint256[] memory amounts = new uint256[](winners.length);
        uint256 distributed = 0;
        for (uint256 i = 0; i < winners.length; i++) {
            amounts[i] = (builderPool * weights[i]) / 100;
            distributed += amounts[i];
        }
        // Give any integer-division dust to the last winner
        uint256 dust = builderPool - distributed;
        if (dust > 0) amounts[winners.length - 1] += dust;

        _transfer(r.rewardToken, treasury, fee);
        for (uint256 i = 0; i < winners.length; i++)
            if (amounts[i] > 0) _transfer(r.rewardToken, winners[i], amounts[i]);

        emit Released(bountyId, winners, amounts, fee);
    }

    // Dispute resolution — release equally to all eligible builders
    function releaseToAll(uint256 bountyId, address[] calldata builders)
        external onlyFactory nonReentrant
    {
        if (builders.length == 0) revert EscrowNoBuilders();
        EscrowRecord storage r = _records[bountyId];
        if (r.amount == 0) revert EscrowNotFound();
        if (r.released || r.refunded) revert EscrowAlreadySettled();

        r.released = true;
        uint256 total      = r.amount;
        uint256 fee        = (total * FEE_BPS) / BPS_DENOM;
        uint256 builderPool = total - fee;
        uint256 eachAmount = builderPool / builders.length;
        uint256 dust = builderPool - (eachAmount * builders.length);

        _transfer(r.rewardToken, treasury, fee);
        for (uint256 i = 0; i < builders.length; i++) {
            uint256 payout = (i == builders.length - 1) ? eachAmount + dust : eachAmount;
            if (payout > 0) _transfer(r.rewardToken, builders[i], payout);
        }

        emit ReleasedToAll(bountyId, builders, eachAmount, fee);
    }

    // Timeout: split equally among pending builders (factory controls timing checks)
    // Legacy push-payment version — kept for direct use if all builders are EOAs
    function claimTimeout(uint256 bountyId, address[] calldata builders)
        external onlyFactory nonReentrant
    {
        if (builders.length == 0) revert EscrowNoBuilders();
        EscrowRecord storage r = _records[bountyId];
        if (r.amount == 0) revert EscrowNotFound();
        if (r.released || r.refunded) revert EscrowAlreadySettled();

        r.released = true;
        uint256 total      = r.amount;
        uint256 fee        = (total * FEE_BPS) / BPS_DENOM;
        uint256 builderPool = total - fee;
        uint256 eachAmount = builderPool / builders.length;
        uint256 dust = builderPool - (eachAmount * builders.length);

        _transfer(r.rewardToken, treasury, fee);
        for (uint256 i = 0; i < builders.length; i++) {
            uint256 payout = (i == builders.length - 1) ? eachAmount + dust : eachAmount;
            if (payout > 0) _transfer(r.rewardToken, builders[i], payout);
        }

        emit TimeoutClaimed(bountyId, builders, eachAmount);
    }

    // FIX H-02: Pull-payment variant.
    // Marks escrow as released, pays fee to treasury, then transfers the entire builder
    // pool to the factory (msg.sender = factory) so the factory can queue pending payouts.
    // The factory is responsible for distributing to individual builders via pendingTimeoutPayouts.
    // Only works for NATIVE bounties — ERC20 timeout still uses push (builders are less likely
    // to be malicious smart contracts for ERC20, and ERC20 transfer failures are non-reverting).
    function claimTimeoutPullable(uint256 bountyId, address[] calldata builders)
        external onlyFactory nonReentrant
        returns (uint256 perBuilderAmount, uint256 builderPool)
    {
        if (builders.length == 0) revert EscrowNoBuilders();
        EscrowRecord storage r = _records[bountyId];
        if (r.amount == 0) revert EscrowNotFound();
        if (r.released || r.refunded) revert EscrowAlreadySettled();

        r.released = true;
        uint256 total = r.amount;
        uint256 fee   = (total * FEE_BPS) / BPS_DENOM;
        builderPool   = total - fee;

        if (r.rewardToken == address(0)) {
            // Native: pay fee, then send entire builder pool to factory for pull-payment
            _safeTransferMON(treasury, fee);
            _safeTransferMON(factory, builderPool);
        } else {
            // ERC20: fall back to push-payment (safe for ERC20 since transfer failures aren't reentrancy DoS)
            bool ok = _transferERC20(r.rewardToken, treasury, fee);
            if (!ok) revert EscrowERC20FeeFailed();
            uint256 each = builderPool / builders.length;
            uint256 dust = builderPool - each * builders.length;
            for (uint256 i = 0; i < builders.length; i++) {
                uint256 payout = (i == builders.length - 1) ? each + dust : each;
                if (payout > 0) {
                    bool tokOk = _transferERC20(r.rewardToken, builders[i], payout);
                    if (!tokOk) revert EscrowERC20PayoutFailed();
                }
            }
            builderPool = 0; // signal to factory that ERC20 was handled directly
        }

        perBuilderAmount = builderPool > 0 ? builderPool / builders.length : 0;
        emit TimeoutClaimed(bountyId, builders, perBuilderAmount);
    }

    // Full refund to depositor (cancel with no submissions, expire with no submissions)
    // Also returns creator stake if any (caller must handle separately via refundCreatorStake)
    function refund(uint256 bountyId) external onlyFactory nonReentrant {
        EscrowRecord storage r = _records[bountyId];
        if (r.amount == 0) revert EscrowNotFound();
        if (r.released || r.refunded) revert EscrowAlreadySettled();
        r.refunded = true;
        _transfer(r.rewardToken, r.depositor, r.amount);
        emit Refunded(bountyId, r.depositor, r.amount);
    }

    // ── V3: SUBMISSION STAKE MANAGEMENT ──────────────────────────────────────

    // Called by factory when builder submits work (msg.value = stake)
    function depositSubmissionStake(uint256 bountyId, address builder)
        external payable onlyFactory nonReentrant
    {
        if (msg.value == 0) revert EscrowZeroStake();
        if (submissionStakes[bountyId][builder] != 0) revert EscrowStakeAlreadyExists();
        submissionStakes[bountyId][builder] = msg.value;
        emit SubmissionStakeDeposited(bountyId, builder, msg.value);
    }

    // Return submission stake to builder (approve, cancel, or legitimate reject)
    function refundSubmissionStake(uint256 bountyId, address builder)
        external onlyFactory nonReentrant
    {
        uint256 amount = submissionStakes[bountyId][builder];
        if (amount == 0) revert EscrowNoStakeToRefund();
        submissionStakes[bountyId][builder] = 0;
        _safeTransferMON(builder, amount);
        emit SubmissionStakeRefunded(bountyId, builder, amount);
    }

    // FIX XC-02+T-01: Pull-payment variant — transfer stake to factory instead of pushing to builder.
    // Factory queues the refund in pendingStakeRefunds so builder can claim individually.
    // Used in triggerTimeout/cancelBounty loops to prevent DoS by malicious builder contracts.
    // Returns the stake amount so factory can queue it.
    function refundSubmissionStakeToFactory(uint256 bountyId, address builder)
        external onlyFactory nonReentrant
        returns (uint256 amount)
    {
        amount = submissionStakes[bountyId][builder];
        if (amount == 0) return 0; // no-op if stake already returned
        submissionStakes[bountyId][builder] = 0;
        _safeTransferMON(factory, amount);
        emit SubmissionStakeRefunded(bountyId, builder, amount);
    }

    // Slash submission stake to treasury (proven fraud/spam)
    // No-op if stake already refunded (e.g. during rejectSubmission before dispute)
    function slashSubmissionStake(uint256 bountyId, address builder)
        external onlyFactory nonReentrant
    {
        uint256 amount = submissionStakes[bountyId][builder];
        if (amount == 0) return; // stake already returned or never existed
        submissionStakes[bountyId][builder] = 0;
        if (treasury == address(0)) revert EscrowNoTreasury();
        _safeTransferMON(treasury, amount);
        emit SubmissionStakeSlashed(bountyId, builder, amount);
    }

    // Move submission stake from submissionStakes → heldDisputeStakes (no ETH transfer).
    // Called by Factory when builder raises a dispute (stake was kept, not refunded after inGrace reject).
    // No-op if submissionStakes is already 0 (e.g. stake was never collected for this builder).
    function moveStakeToHeld(uint256 bountyId, address builder)
        external onlyFactory nonReentrant
    {
        uint256 amount = submissionStakes[bountyId][builder];
        if (amount == 0) return; // stake was already refunded or did not exist
        if (heldDisputeStakes[bountyId][builder] != 0) revert EscrowStakeAlreadyHeld();
        submissionStakes[bountyId][builder] = 0;
        heldDisputeStakes[bountyId][builder] = amount;
        emit DisputeStakeHeld(bountyId, builder, amount);
    }

    // Release held dispute stake back to builder (dispute won by builder)
    function releaseDisputeStake(uint256 bountyId, address builder)
        external onlyFactory nonReentrant
    {
        uint256 amount = heldDisputeStakes[bountyId][builder];
        if (amount == 0) return;
        heldDisputeStakes[bountyId][builder] = 0;
        _safeTransferMON(builder, amount);
        emit DisputeStakeReleased(bountyId, builder, amount);
    }

    // Slash held dispute stake to treasury (dispute denied — builder raised bad-faith dispute)
    // FIX NE-6: emit DisputeStakeSlashed (dedicated event) instead of SubmissionStakeSlashed
    // so on-chain indexers can differentiate dispute stake slashes from submission stake slashes
    event DisputeStakeSlashed(uint256 indexed bountyId, address indexed builder, uint256 amount);

    function slashHeldDisputeStake(uint256 bountyId, address builder)
        external onlyFactory nonReentrant
    {
        uint256 amount = heldDisputeStakes[bountyId][builder];
        if (amount == 0) return;
        heldDisputeStakes[bountyId][builder] = 0;
        if (treasury == address(0)) revert EscrowNoTreasury();
        _safeTransferMON(treasury, amount);
        emit DisputeStakeSlashed(bountyId, builder, amount);
    }

    // ── V3: CREATOR STAKE MANAGEMENT ──────────────────────────────────────────

    // Return creator stake fully (bounty completed, cancel before submissions, or dispute won by creator)
    function refundCreatorStake(uint256 bountyId, address creator)
        external onlyFactory nonReentrant
    {
        uint256 amount = creatorStakes[bountyId];
        if (amount == 0) return; // no-op if no stake (e.g. ERC20 bounty without stake)
        creatorStakes[bountyId] = 0;
        _safeTransferMON(creator, amount);
        emit CreatorStakeRefunded(bountyId, creator, amount);
    }

    // Slash creator stake: split between builders and treasury
    // builderAddresses: recipients for the builders' share (may be empty)
    // builderShareBps: how many BPS of the stake go to builders (0-10000)
    function slashCreatorStake(uint256 bountyId, address[] calldata builderAddresses, uint256 builderShareBps)
        external onlyFactory nonReentrant
    {
        uint256 total = creatorStakes[bountyId];
        if (total == 0) return;
        creatorStakes[bountyId] = 0;
        if (builderShareBps > 10_000) revert EscrowInvalidBps();

        uint256 toBuilders  = (total * builderShareBps) / 10_000;
        uint256 toTreasury = total - toBuilders;

        if (toBuilders > 0 && builderAddresses.length > 0) {
            uint256 each = toBuilders / builderAddresses.length;
            uint256 dust = toBuilders - each * builderAddresses.length;
            for (uint256 i = 0; i < builderAddresses.length; i++) {
                uint256 payout = (i == builderAddresses.length - 1) ? each + dust : each;
                if (payout > 0) _safeTransferMON(builderAddresses[i], payout);
            }
        } else if (toBuilders > 0) {
            // No builder addresses — send everything to treasury
            toTreasury += toBuilders;
        }

        if (toTreasury > 0) {
            if (treasury == address(0)) revert EscrowNoTreasury();
            _safeTransferMON(treasury, toTreasury);
        }
        emit CreatorStakeSlashed(bountyId, toBuilders, toTreasury);
    }

    function getRecord(uint256 bountyId) external view returns (EscrowRecord memory) {
        return _records[bountyId];
    }

    function isSettled(uint256 bountyId) external view returns (bool) {
        return _records[bountyId].released || _records[bountyId].refunded;
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            _safeTransferMON(to, amount);
        } else {
            bool ok = _transferERC20(token, to, amount);
            if (!ok) revert EscrowERC20TransferFailed();
        }
    }

    // FIX L-SC-1: Increased gas from 30_000 to 100_000 to support multisig wallets
    function _safeTransferMON(address to, uint256 amount) internal {
        if (to == address(0)) revert EscrowZeroRecipient();
        (bool ok,) = to.call{value: amount, gas: 100_000}("");
        if (!ok) revert EscrowMONTransferFailed();
    }

    function _balanceOf(address token, address account) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(0x70a08231, account));
        return (ok && data.length >= 32) ? abi.decode(data, (uint256)) : 0;
    }

    function _transferFrom(address token, address from, address to, uint256 amount) internal returns (bool) {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _transferERC20(address token, address to, uint256 amount) internal returns (bool) {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }
}
