// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract NadWorkEscrow {
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

    // V3 Fair System: submission stakes — bountyId => hunter => stake amount
    mapping(uint256 => mapping(address => uint256)) public submissionStakes;
    // V3 Fair System: poster stakes — bountyId => stake amount (stored separately from reward)
    mapping(uint256 => uint256) public posterStakes;
    // V3 Fair System: held dispute stakes — bountyId => hunter => stake amount
    // Stake moves here when hunter raises a dispute so it can be slashed if dispute is denied
    mapping(uint256 => mapping(address => uint256)) public heldDisputeStakes;

    event Deposited(uint256 indexed bountyId, address depositor, address token, uint256 amount);
    event Released(uint256 indexed bountyId, address[] winners, uint256[] amounts, uint256 fee);
    event ReleasedToAll(uint256 indexed bountyId, address[] hunters, uint256 eachAmount, uint256 fee);
    event TimeoutClaimed(uint256 indexed bountyId, address[] hunters, uint256 eachAmount);
    event Refunded(uint256 indexed bountyId, address depositor, uint256 amount);
    event FeeSwept(address indexed to, uint256 amount);
    event TreasurySet(address indexed treasury);
    event FactorySet(address indexed factory);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    // V3 events
    event SubmissionStakeDeposited(uint256 indexed bountyId, address indexed hunter, uint256 amount);
    event SubmissionStakeRefunded(uint256 indexed bountyId, address indexed hunter, uint256 amount);
    event SubmissionStakeSlashed(uint256 indexed bountyId, address indexed hunter, uint256 amount);
    event DisputeStakeHeld(uint256 indexed bountyId, address indexed hunter, uint256 amount);
    event DisputeStakeReleased(uint256 indexed bountyId, address indexed hunter, uint256 amount);
    event PosterStakeDeposited(uint256 indexed bountyId, address indexed poster, uint256 amount);
    event PosterStakeRefunded(uint256 indexed bountyId, address indexed poster, uint256 amount);
    event PosterStakeSlashed(uint256 indexed bountyId, uint256 toHunters, uint256 toTreasury);

    // FIX H-SC-4: Removed `|| msg.sender == owner` — owner cannot bypass factory logic
    modifier onlyFactory()   { require(msg.sender == factory, "Escrow: not factory"); _; }
    modifier onlyOwner()     { require(msg.sender == owner,   "Escrow: not owner");   _; }
    modifier nonReentrant()  { require(_locked == 0, "Escrow: reentrant"); _locked = 1; _; _locked = 0; }
    modifier whenNotPaused() { require(!_paused, "Escrow: paused"); _; }

    constructor(address _treasury) {
        require(_treasury != address(0), "Escrow: zero treasury");
        owner = msg.sender;
        treasury = _treasury;
    }

    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Escrow: zero address");
        factory = _factory;
        emit FactorySet(_factory);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Escrow: zero address");
        treasury = _treasury;
        emit TreasurySet(_treasury);
    }

    function pause()   external onlyOwner { _paused = true;  }
    function unpause() external onlyOwner { _paused = false; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Escrow: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Accept ETH from factory only (featured fees, dispute deposits etc.)
    receive() external payable {
        require(msg.sender == factory, "Escrow: unauthorized");
    }

    // FIX M-SC-1: sweepFees uses pull-pattern accumulation via payable receive;
    // forward to treasury. If treasury reverts, the call itself reverts but
    // the factory can still retry with a new treasury address.
    function sweepFees() external payable onlyFactory {
        if (msg.value > 0) {
            require(treasury != address(0), "Escrow: no treasury");
            _safeTransferMON(treasury, msg.value);
            emit FeeSwept(treasury, msg.value);
        }
    }

    // V3: msg.value = totalReward + posterStake; posterStake stored separately
    function depositNative(uint256 bountyId, address depositor, uint256 deadline, uint256 stakeAmount)
        external payable onlyFactory whenNotPaused nonReentrant
    {
        require(msg.value > stakeAmount,               "Escrow: zero reward value");
        require(_records[bountyId].amount == 0,        "Escrow: already deposited");
        uint256 rewardAmount = msg.value - stakeAmount;
        _records[bountyId] = EscrowRecord({
            depositor: depositor, rewardToken: address(0),
            amount: rewardAmount, deadline: deadline,
            released: false, refunded: false
        });
        if (stakeAmount > 0) {
            posterStakes[bountyId] = stakeAmount;
            emit PosterStakeDeposited(bountyId, depositor, stakeAmount);
        }
        emit Deposited(bountyId, depositor, address(0), rewardAmount);
    }

    // FIX C-SC-3: Measure actual received amount to handle fee-on-transfer tokens
    // V3: msg.value = posterStake (MON), ERC20 reward is transferred separately
    function depositERC20(uint256 bountyId, address depositor, address token, uint256 amount, uint256 deadline)
        external payable onlyFactory whenNotPaused nonReentrant
    {
        require(amount > 0,                        "Escrow: zero amount");
        require(token != address(0),               "Escrow: zero token");
        require(_records[bountyId].amount == 0,    "Escrow: already deposited");

        uint256 balBefore = _balanceOf(token, address(this));
        bool ok = _transferFrom(token, depositor, address(this), amount);
        require(ok, "Escrow: ERC20 transferFrom failed");
        uint256 actualAmount = _balanceOf(token, address(this)) - balBefore;
        require(actualAmount > 0, "Escrow: zero actual amount received");

        _records[bountyId] = EscrowRecord({
            depositor: depositor, rewardToken: token,
            amount: actualAmount, deadline: deadline,
            released: false, refunded: false
        });
        if (msg.value > 0) {
            posterStakes[bountyId] = msg.value;
            emit PosterStakeDeposited(bountyId, depositor, msg.value);
        }
        emit Deposited(bountyId, depositor, token, actualAmount);
    }

    // FIX H-SC-2: Send remainder dust to last winner to prevent permanent lock
    function release(uint256 bountyId, address[] calldata winners, uint8[] calldata weights)
        external onlyFactory nonReentrant
    {
        require(winners.length > 0,                    "Escrow: no winners");
        require(winners.length == weights.length,      "Escrow: length mismatch");
        EscrowRecord storage r = _records[bountyId];
        require(r.amount > 0,                          "Escrow: not found");
        require(!r.released && !r.refunded,            "Escrow: already settled");

        uint256 weightSum = 0;
        for (uint256 i = 0; i < weights.length; i++) weightSum += weights[i];
        require(weightSum == 100, "Escrow: weights must sum to 100");

        r.released = true;
        uint256 total      = r.amount;
        uint256 fee        = (total * FEE_BPS) / BPS_DENOM;
        uint256 hunterPool = total - fee;
        uint256[] memory amounts = new uint256[](winners.length);
        uint256 distributed = 0;
        for (uint256 i = 0; i < winners.length; i++) {
            amounts[i] = (hunterPool * weights[i]) / 100;
            distributed += amounts[i];
        }
        // Give any integer-division dust to the last winner
        uint256 dust = hunterPool - distributed;
        if (dust > 0) amounts[winners.length - 1] += dust;

        _transfer(r.rewardToken, treasury, fee);
        for (uint256 i = 0; i < winners.length; i++)
            if (amounts[i] > 0) _transfer(r.rewardToken, winners[i], amounts[i]);

        emit Released(bountyId, winners, amounts, fee);
    }

    // Dispute resolution — release equally to all eligible hunters
    function releaseToAll(uint256 bountyId, address[] calldata hunters)
        external onlyFactory nonReentrant
    {
        require(hunters.length > 0, "Escrow: no hunters");
        EscrowRecord storage r = _records[bountyId];
        require(r.amount > 0,               "Escrow: not found");
        require(!r.released && !r.refunded, "Escrow: already settled");

        r.released = true;
        uint256 total      = r.amount;
        uint256 fee        = (total * FEE_BPS) / BPS_DENOM;
        uint256 hunterPool = total - fee;
        uint256 eachAmount = hunterPool / hunters.length;
        uint256 dust = hunterPool - (eachAmount * hunters.length);

        _transfer(r.rewardToken, treasury, fee);
        for (uint256 i = 0; i < hunters.length; i++) {
            uint256 payout = (i == hunters.length - 1) ? eachAmount + dust : eachAmount;
            if (payout > 0) _transfer(r.rewardToken, hunters[i], payout);
        }

        emit ReleasedToAll(bountyId, hunters, eachAmount, fee);
    }

    // Timeout: split equally among pending hunters (factory controls timing checks)
    // Legacy push-payment version — kept for direct use if all hunters are EOAs
    function claimTimeout(uint256 bountyId, address[] calldata hunters)
        external onlyFactory nonReentrant
    {
        require(hunters.length > 0, "Escrow: no hunters");
        EscrowRecord storage r = _records[bountyId];
        require(r.amount > 0,               "Escrow: not found");
        require(!r.released && !r.refunded, "Escrow: already settled");

        r.released = true;
        uint256 total      = r.amount;
        uint256 fee        = (total * FEE_BPS) / BPS_DENOM;
        uint256 hunterPool = total - fee;
        uint256 eachAmount = hunterPool / hunters.length;
        uint256 dust = hunterPool - (eachAmount * hunters.length);

        _transfer(r.rewardToken, treasury, fee);
        for (uint256 i = 0; i < hunters.length; i++) {
            uint256 payout = (i == hunters.length - 1) ? eachAmount + dust : eachAmount;
            if (payout > 0) _transfer(r.rewardToken, hunters[i], payout);
        }

        emit TimeoutClaimed(bountyId, hunters, eachAmount);
    }

    // FIX H-02: Pull-payment variant.
    // Marks escrow as released, pays fee to treasury, then transfers the entire hunter
    // pool to the factory (msg.sender = factory) so the factory can queue pending payouts.
    // The factory is responsible for distributing to individual hunters via pendingTimeoutPayouts.
    // Only works for NATIVE bounties — ERC20 timeout still uses push (hunters are less likely
    // to be malicious smart contracts for ERC20, and ERC20 transfer failures are non-reverting).
    function claimTimeoutPullable(uint256 bountyId, address[] calldata hunters)
        external onlyFactory nonReentrant
        returns (uint256 perHunterAmount, uint256 hunterPool)
    {
        require(hunters.length > 0, "Escrow: no hunters");
        EscrowRecord storage r = _records[bountyId];
        require(r.amount > 0,               "Escrow: not found");
        require(!r.released && !r.refunded, "Escrow: already settled");

        r.released = true;
        uint256 total = r.amount;
        uint256 fee   = (total * FEE_BPS) / BPS_DENOM;
        hunterPool    = total - fee;

        if (r.rewardToken == address(0)) {
            // Native: pay fee, then send entire hunter pool to factory for pull-payment
            _safeTransferMON(treasury, fee);
            _safeTransferMON(factory, hunterPool);
        } else {
            // ERC20: fall back to push-payment (safe for ERC20 since transfer failures aren't reentrancy DoS)
            bool ok = _transferERC20(r.rewardToken, treasury, fee);
            require(ok, "Escrow: ERC20 fee transfer failed");
            uint256 each = hunterPool / hunters.length;
            uint256 dust = hunterPool - each * hunters.length;
            for (uint256 i = 0; i < hunters.length; i++) {
                uint256 payout = (i == hunters.length - 1) ? each + dust : each;
                if (payout > 0) {
                    bool tokOk = _transferERC20(r.rewardToken, hunters[i], payout);
                    require(tokOk, "Escrow: ERC20 payout failed");
                }
            }
            hunterPool = 0; // signal to factory that ERC20 was handled directly
        }

        perHunterAmount = hunterPool > 0 ? hunterPool / hunters.length : 0;
        emit TimeoutClaimed(bountyId, hunters, perHunterAmount);
    }

    // Full refund to depositor (cancel with no submissions, expire with no submissions)
    // Also returns poster stake if any (caller must handle separately via refundPosterStake)
    function refund(uint256 bountyId) external onlyFactory nonReentrant {
        EscrowRecord storage r = _records[bountyId];
        require(r.amount > 0,               "Escrow: not found");
        require(!r.released && !r.refunded, "Escrow: already settled");
        r.refunded = true;
        _transfer(r.rewardToken, r.depositor, r.amount);
        emit Refunded(bountyId, r.depositor, r.amount);
    }

    // ── V3: SUBMISSION STAKE MANAGEMENT ──────────────────────────────────────

    // Called by factory when hunter submits work (msg.value = stake)
    function depositSubmissionStake(uint256 bountyId, address hunter)
        external payable onlyFactory nonReentrant
    {
        require(msg.value > 0, "Escrow: zero stake");
        require(submissionStakes[bountyId][hunter] == 0, "Escrow: stake already exists");
        submissionStakes[bountyId][hunter] = msg.value;
        emit SubmissionStakeDeposited(bountyId, hunter, msg.value);
    }

    // Return submission stake to hunter (approve, cancel, or legitimate reject)
    function refundSubmissionStake(uint256 bountyId, address hunter)
        external onlyFactory nonReentrant
    {
        uint256 amount = submissionStakes[bountyId][hunter];
        require(amount > 0, "Escrow: no stake to refund");
        submissionStakes[bountyId][hunter] = 0;
        _safeTransferMON(hunter, amount);
        emit SubmissionStakeRefunded(bountyId, hunter, amount);
    }

    // FIX XC-02+T-01: Pull-payment variant — transfer stake to factory instead of pushing to hunter.
    // Factory queues the refund in pendingStakeRefunds so hunter can claim individually.
    // Used in triggerTimeout/cancelBounty loops to prevent DoS by malicious hunter contracts.
    // Returns the stake amount so factory can queue it.
    function refundSubmissionStakeToFactory(uint256 bountyId, address hunter)
        external onlyFactory nonReentrant
        returns (uint256 amount)
    {
        amount = submissionStakes[bountyId][hunter];
        if (amount == 0) return 0; // no-op if stake already returned
        submissionStakes[bountyId][hunter] = 0;
        _safeTransferMON(factory, amount);
        emit SubmissionStakeRefunded(bountyId, hunter, amount);
    }

    // Slash submission stake to treasury (proven fraud/spam)
    // No-op if stake already refunded (e.g. during rejectSubmission before dispute)
    function slashSubmissionStake(uint256 bountyId, address hunter)
        external onlyFactory nonReentrant
    {
        uint256 amount = submissionStakes[bountyId][hunter];
        if (amount == 0) return; // stake already returned or never existed
        submissionStakes[bountyId][hunter] = 0;
        require(treasury != address(0), "Escrow: no treasury");
        _safeTransferMON(treasury, amount);
        emit SubmissionStakeSlashed(bountyId, hunter, amount);
    }

    // Move submission stake from submissionStakes → heldDisputeStakes (no ETH transfer).
    // Called by Factory when hunter raises a dispute (stake was kept, not refunded after inGrace reject).
    // No-op if submissionStakes is already 0 (e.g. stake was never collected for this hunter).
    function moveStakeToHeld(uint256 bountyId, address hunter)
        external onlyFactory nonReentrant
    {
        uint256 amount = submissionStakes[bountyId][hunter];
        if (amount == 0) return; // stake was already refunded or did not exist
        require(heldDisputeStakes[bountyId][hunter] == 0, "Escrow: stake already held");
        submissionStakes[bountyId][hunter] = 0;
        heldDisputeStakes[bountyId][hunter] = amount;
        emit DisputeStakeHeld(bountyId, hunter, amount);
    }

    // Release held dispute stake back to hunter (dispute won by hunter)
    function releaseDisputeStake(uint256 bountyId, address hunter)
        external onlyFactory nonReentrant
    {
        uint256 amount = heldDisputeStakes[bountyId][hunter];
        if (amount == 0) return;
        heldDisputeStakes[bountyId][hunter] = 0;
        _safeTransferMON(hunter, amount);
        emit DisputeStakeReleased(bountyId, hunter, amount);
    }

    // Slash held dispute stake to treasury (dispute denied — hunter raised bad-faith dispute)
    // FIX NE-6: emit DisputeStakeSlashed (dedicated event) instead of SubmissionStakeSlashed
    // so on-chain indexers can differentiate dispute stake slashes from submission stake slashes
    event DisputeStakeSlashed(uint256 indexed bountyId, address indexed hunter, uint256 amount);

    function slashHeldDisputeStake(uint256 bountyId, address hunter)
        external onlyFactory nonReentrant
    {
        uint256 amount = heldDisputeStakes[bountyId][hunter];
        if (amount == 0) return;
        heldDisputeStakes[bountyId][hunter] = 0;
        require(treasury != address(0), "Escrow: no treasury");
        _safeTransferMON(treasury, amount);
        emit DisputeStakeSlashed(bountyId, hunter, amount);
    }

    // ── V3: POSTER STAKE MANAGEMENT ──────────────────────────────────────────

    // Return poster stake fully (bounty completed, cancel before submissions, or dispute won by poster)
    function refundPosterStake(uint256 bountyId, address poster)
        external onlyFactory nonReentrant
    {
        uint256 amount = posterStakes[bountyId];
        if (amount == 0) return; // no-op if no stake (e.g. ERC20 bounty without stake)
        posterStakes[bountyId] = 0;
        _safeTransferMON(poster, amount);
        emit PosterStakeRefunded(bountyId, poster, amount);
    }

    // Slash poster stake: split between hunters and treasury
    // hunterAddresses: recipients for the hunters' share (may be empty)
    // hunterShareBps: how many BPS of the stake go to hunters (0-10000)
    function slashPosterStake(uint256 bountyId, address[] calldata hunterAddresses, uint256 hunterShareBps)
        external onlyFactory nonReentrant
    {
        uint256 total = posterStakes[bountyId];
        if (total == 0) return;
        posterStakes[bountyId] = 0;
        require(hunterShareBps <= 10_000, "Escrow: invalid bps");

        uint256 toHunters  = (total * hunterShareBps) / 10_000;
        uint256 toTreasury = total - toHunters;

        if (toHunters > 0 && hunterAddresses.length > 0) {
            uint256 each = toHunters / hunterAddresses.length;
            uint256 dust = toHunters - each * hunterAddresses.length;
            for (uint256 i = 0; i < hunterAddresses.length; i++) {
                uint256 payout = (i == hunterAddresses.length - 1) ? each + dust : each;
                if (payout > 0) _safeTransferMON(hunterAddresses[i], payout);
            }
        } else if (toHunters > 0) {
            // No hunter addresses — send everything to treasury
            toTreasury += toHunters;
        }

        if (toTreasury > 0) {
            require(treasury != address(0), "Escrow: no treasury");
            _safeTransferMON(treasury, toTreasury);
        }
        emit PosterStakeSlashed(bountyId, toHunters, toTreasury);
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
            require(ok, "Escrow: ERC20 transfer failed");
        }
    }

    // FIX L-SC-1: Increased gas from 30_000 to 100_000 to support multisig wallets
    function _safeTransferMON(address to, uint256 amount) internal {
        require(to != address(0), "Escrow: zero recipient");
        (bool ok,) = to.call{value: amount, gas: 100_000}("");
        require(ok, "Escrow: MON transfer failed");
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
