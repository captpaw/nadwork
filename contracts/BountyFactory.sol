// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BountyRegistry.sol";
import "./NadWorkEscrow.sol";
import "./ReputationRegistry.sol";
import "./IdentityRegistry.sol";

contract BountyFactory {
    address public owner;
    BountyRegistry     public registry;
    NadWorkEscrow      public escrow;
    ReputationRegistry public reputation;
    IdentityRegistry   public identity;
    bool private _paused;
    uint256 private _locked;

    // ── Duration constants ────────────────────────────────────────────────────
    uint256 public constant MIN_DURATION       = 1 hours;
    uint256 public constant MAX_DURATION       = 180 days;

    // ── Fee constants (exposed for frontend) ─────────────────────────────────
    uint256 public constant DISPUTE_DEPOSIT    = 0.01 ether;
    uint256 public constant FEATURED_FEE       = 0.5 ether;
    uint256 public constant CANCEL_COMP_BPS    = 200;   // 2% per valid submission
    uint8   public constant MAX_WINNERS        = 3;

    // ── V3 Fair System: Skin in the Game constants ────────────────────────────
    uint256 public constant POSTER_STAKE_BPS      = 500;         // 5% of totalReward
    uint256 public constant MIN_POSTER_STAKE      = 0.005 ether; // absolute minimum
    uint256 public constant SUBMISSION_STAKE_BPS  = 100;         // 1% of totalReward
    uint256 public constant MIN_SUBMISSION_STAKE  = 0.001 ether;
    uint256 public constant MAX_SUBMISSION_STAKE  = 0.1 ether;   // cap per submission

    // ── V3 Fair System: Time-gated review constants ───────────────────────────
    uint256 public constant MIN_REVIEW_WINDOW     = 24 hours;
    uint256 public constant MAX_REVIEW_WINDOW     = 7 days;
    uint256 public constant GRACE_PERIOD_REJECT   = 2 hours;     // free spam rejection window

    // ── Dispute pull-payment ──────────────────────────────────────────────────
    mapping(address => uint256) public pendingDisputeRefunds;
    // Tracks total ETH reserved for pending dispute refunds so sweep() never touches it
    uint256 private _totalPendingRefunds;

    // ── Events ────────────────────────────────────────────────────────────────
    event BountyCreated(uint256 indexed bountyId, address indexed poster, uint256 reward);
    event WorkSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed hunter);
    event WinnersApproved(uint256 indexed bountyId, address[] winners);
    event SubmissionRejected(uint256 indexed bountyId, uint256 indexed submissionId, bool inGracePeriod);
    event BountyCancelled(uint256 indexed bountyId);
    event BountyExpired(uint256 indexed bountyId);
    event TimeoutTriggered(uint256 indexed bountyId, address triggeredBy);
    event DisputeRaised(uint256 indexed bountyId, uint256 indexed submissionId, address indexed hunter);
    event DisputeResolved(uint256 indexed bountyId, bool inFavorOfHunters);
    event BountyFeatured(uint256 indexed bountyId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event IdentitySet(address indexed identity);
    event DisputeRefundPending(address indexed hunter, uint256 amount);
    // V3
    event SubmissionStakeRequired(uint256 indexed bountyId, address indexed hunter, uint256 amount);
    event PosterStakeSlashedOnCancel(uint256 indexed bountyId, uint256 amount);
    // FIX-9: emitted when bounty transitions to REVIEWING state after deadline
    event BountyEnteredReview(uint256 indexed bountyId, uint256 pendingCount);

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner()     { require(msg.sender == owner, "Factory: not owner"); _; }
    modifier whenNotPaused() { require(!_paused, "Factory: paused"); _; }
    modifier nonReentrant()  { require(_locked == 0, "Factory: reentrant"); _locked = 1; _; _locked = 0; }

    constructor(address _registry, address _escrow, address _reputation, address _identity) {
        require(_registry != address(0) && _escrow != address(0) && _reputation != address(0), "Factory: zero address");
        owner = msg.sender;
        registry   = BountyRegistry(_registry);
        escrow     = NadWorkEscrow(payable(_escrow));
        reputation = ReputationRegistry(_reputation);
        if (_identity != address(0)) {
            identity = IdentityRegistry(_identity);
        }
    }

    function setIdentity(address _identity) external onlyOwner {
        require(_identity != address(0), "Factory: zero address");
        identity = IdentityRegistry(_identity);
        emit IdentitySet(_identity);
    }

    function pause()   external onlyOwner { _paused = true;  }
    function unpause() external onlyOwner { _paused = false; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Factory: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    // V3: calculate poster stake
    function _calcPosterStake(uint256 totalReward) internal pure returns (uint256) {
        uint256 pct = (totalReward * POSTER_STAKE_BPS) / 10_000;
        return pct < MIN_POSTER_STAKE ? MIN_POSTER_STAKE : pct;
    }

    // V3: calculate submission stake
    function _calcSubmissionStake(uint256 totalReward) internal pure returns (uint256) {
        uint256 pct = (totalReward * SUBMISSION_STAKE_BPS) / 10_000;
        if (pct < MIN_SUBMISSION_STAKE) pct = MIN_SUBMISSION_STAKE;
        if (pct > MAX_SUBMISSION_STAKE) pct = MAX_SUBMISSION_STAKE;
        return pct;
    }

    // V3: calculate review deadline from bounty deadline
    function _calcReviewDeadline(uint256 deadline, uint256 createdAt) internal pure returns (uint256) {
        uint256 duration = deadline - createdAt;
        uint256 window   = duration / 5; // 20% of bounty duration
        if (window < MIN_REVIEW_WINDOW) window = MIN_REVIEW_WINDOW;
        if (window > MAX_REVIEW_WINDOW) window = MAX_REVIEW_WINDOW;
        return deadline + window;
    }

    // V3: identity tier check
    function _getHunterTier(address hunter) internal view returns (uint8) {
        if (address(identity) == address(0)) return 2; // no identity contract = permissive mode
        string memory uname = identity.getUsername(hunter);
        if (bytes(uname).length == 0) return 0; // Anonymous
        ReputationRegistry.HunterStats memory s = reputation.getHunterStats(hunter);
        if (s.submissionCount == 0) return 1;   // Registered, no history
        if (s.winCount < 5) return 2;           // Active
        return 3;                               // Trusted
    }

    // V3: tier-adjusted submission stake multiplier (BPS of stake)
    function _tierStakeMultiplier(uint8 tier) internal pure returns (uint256) {
        if (tier <= 1) return 15_000; // 1.5× for new accounts (extra friction)
        if (tier >= 3) return 7_500;  // 0.75× for trusted (discount)
        return 10_000;                // 1.0× normal
    }

    // ── CREATE BOUNTY ─────────────────────────────────────────────────────────
    function createBounty(
        string  calldata ipfsHash,
        string  calldata title,
        string  calldata category,
        uint8   rewardType,
        address rewardToken,
        uint256 totalReward,
        uint8   winnerCount,
        uint8[] calldata prizeWeights,
        uint256 deadline
    ) external payable whenNotPaused nonReentrant returns (uint256 bountyId) {
        require(bytes(ipfsHash).length > 0,                      "Factory: empty ipfsHash");
        require(bytes(title).length > 0 && bytes(title).length <= 100, "Factory: invalid title");
        require(rewardType <= 1,                                 "Factory: invalid rewardType");
        require(totalReward > 0,                                 "Factory: zero reward");
        require(winnerCount >= 1 && winnerCount <= MAX_WINNERS,  "Factory: winnerCount 1-3");
        require(prizeWeights.length == winnerCount,              "Factory: weights length mismatch");
        require(deadline > block.timestamp + MIN_DURATION,       "Factory: deadline too soon");
        require(deadline < block.timestamp + MAX_DURATION,       "Factory: deadline too far");

        uint256 weightSum = 0;
        for (uint256 i = 0; i < prizeWeights.length; i++) weightSum += prizeWeights[i];
        require(weightSum == 100, "Factory: weights must sum to 100");

        uint256 posterStake   = _calcPosterStake(totalReward);
        uint256 reviewDeadline = _calcReviewDeadline(deadline, block.timestamp);

        BountyRegistry.RewardType rType = BountyRegistry.RewardType(rewardType);

        bountyId = registry.registerBounty(
            msg.sender, ipfsHash, title, category, rType,
            rType == BountyRegistry.RewardType.NATIVE ? address(0) : rewardToken,
            totalReward, winnerCount, prizeWeights, deadline,
            reviewDeadline, posterStake
        );

        if (rType == BountyRegistry.RewardType.NATIVE) {
            uint256 required = totalReward + posterStake;
            require(msg.value == required, "Factory: wrong MON amount (reward + stake)");
            escrow.depositNative{value: msg.value}(bountyId, msg.sender, deadline, posterStake);
        } else {
            // ERC20: poster stake is MON, sent as msg.value
            require(msg.value == posterStake, "Factory: wrong MON stake amount");
            require(rewardToken != address(0), "Factory: zero token address");
            escrow.depositERC20{value: msg.value}(bountyId, msg.sender, rewardToken, totalReward, deadline);
        }

        reputation.recordBountyPosted(msg.sender, totalReward);
        emit BountyCreated(bountyId, msg.sender, totalReward);
    }

    // ── SUBMIT WORK ───────────────────────────────────────────────────────────
    function submitWork(uint256 bountyId, string calldata ipfsHash)
        external payable whenNotPaused nonReentrant returns (uint256 submissionId)
    {
        require(bytes(ipfsHash).length > 0, "Factory: empty ipfsHash");
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(b.status == BountyRegistry.BountyStatus.ACTIVE, "Factory: bounty not active");
        require(block.timestamp < b.deadline,                   "Factory: deadline passed");
        require(msg.sender != b.poster,                         "Factory: poster cannot submit");
        require(!registry.hasSubmitted(bountyId, msg.sender),   "Factory: already submitted");

        // V3: identity tier check
        uint8 tier = _getHunterTier(msg.sender);
        require(tier >= 1, "Factory: identity required to submit");
        if (b.totalReward >= 1 ether) {
            require(tier >= 2, "Factory: active status required for bounties >= 1 MON");
        }

        // V3: calculate and collect submission stake
        uint256 baseStake   = _calcSubmissionStake(b.totalReward);
        uint256 multiplier  = _tierStakeMultiplier(tier);
        uint256 stakeAmount = (baseStake * multiplier) / 10_000;
        require(msg.value >= stakeAmount, "Factory: insufficient submission stake");

        // Refund excess stake above required
        if (msg.value > stakeAmount) {
            (bool ok,) = msg.sender.call{value: msg.value - stakeAmount, gas: 100_000}("");
            require(ok, "Factory: excess stake refund failed");
        }

        escrow.depositSubmissionStake{value: stakeAmount}(bountyId, msg.sender);
        submissionId = registry.addSubmission(bountyId, msg.sender, ipfsHash, stakeAmount);
        reputation.recordSubmission(msg.sender);

        emit WorkSubmitted(bountyId, submissionId, msg.sender);
        emit SubmissionStakeRequired(bountyId, msg.sender, stakeAmount);
    }

    // ── APPROVE WINNERS ───────────────────────────────────────────────────────
    function approveWinners(
        uint256   bountyId,
        uint256[] calldata submissionIds,
        uint8[]   calldata ranks
    ) external whenNotPaused nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(msg.sender == b.poster,                                            "Factory: not poster");
        require(b.status == BountyRegistry.BountyStatus.ACTIVE ||
                b.status == BountyRegistry.BountyStatus.REVIEWING,                "Factory: bounty not active");
        require(submissionIds.length >= 1 && submissionIds.length <= b.winnerCount, "Factory: invalid winner count");
        require(submissionIds.length == ranks.length,                              "Factory: length mismatch");

        address[] memory winners = new address[](submissionIds.length);
        for (uint256 i = 0; i < submissionIds.length; i++) {
            BountyRegistry.Submission memory s = registry.getSubmission(submissionIds[i]);
            require(s.bountyId == bountyId, "Factory: wrong bounty");
            require(s.status == BountyRegistry.SubStatus.PENDING, "Factory: submission not pending");
            for (uint256 j = 0; j < i; j++) {
                require(winners[j] != s.hunter, "Factory: duplicate winner address");
            }
            winners[i] = s.hunter;
        }

        uint8[] memory effectiveWeights = new uint8[](submissionIds.length);
        if (submissionIds.length == b.winnerCount) {
            for (uint256 i = 0; i < submissionIds.length; i++) {
                effectiveWeights[i] = b.prizeWeights[i];
            }
        } else {
            uint8 each      = uint8(100 / submissionIds.length);
            uint8 remainder = uint8(100 - each * uint8(submissionIds.length));
            for (uint256 i = 0; i < submissionIds.length; i++) {
                effectiveWeights[i] = each;
            }
            effectiveWeights[0] += remainder;
        }

        registry.setWinners(bountyId, submissionIds, ranks);
        escrow.release(bountyId, winners, effectiveWeights);

        // V3: refund submission stakes for all winning submissions
        for (uint256 i = 0; i < winners.length; i++) {
            escrow.refundSubmissionStake(bountyId, winners[i]);
        }

        // V3: return poster stake on successful completion
        escrow.refundPosterStake(bountyId, b.poster);

        // Record reputation
        uint256 total      = b.totalReward;
        uint256 fee        = (total * 300) / 10_000;
        uint256 hunterPool = total - fee;
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 actualPrize = (hunterPool * effectiveWeights[i]) / 100;
            reputation.recordWin(winners[i], actualPrize, b.poster);
        }
        reputation.recordBountyCompleted(b.poster, b.totalReward);
        emit WinnersApproved(bountyId, winners);
    }

    // ── REJECT SUBMISSION ─────────────────────────────────────────────────────
    // FIX-2: nonReentrant guards against re-entry during MON refund to hunter
    function rejectSubmission(uint256 bountyId, uint256 submissionId) external nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(msg.sender == b.poster,                                          "Factory: not poster");
        require(b.status == BountyRegistry.BountyStatus.ACTIVE ||
                b.status == BountyRegistry.BountyStatus.REVIEWING,              "Factory: not active");

        BountyRegistry.Submission memory s = registry.getSubmission(submissionId);
        require(s.bountyId == bountyId,                                          "Factory: wrong bounty");
        require(s.status == BountyRegistry.SubStatus.PENDING,                   "Factory: not pending");

        bool inGrace = (block.timestamp - s.submittedAt) < GRACE_PERIOD_REJECT;

        if (!inGrace) {
            // After grace period — mark gracePeriodExpired so cancel fee counts it
            registry.markGracePeriodExpired(submissionId);
        }

        registry.rejectSubmission(submissionId);

        // V3 FIX: During grace period hunter can dispute, so DO NOT refund stake yet.
        // The stake stays in submissionStakes until: (a) hunter disputes (moves to heldDisputeStakes),
        // (b) grace period expires without dispute (hunter calls withdrawRejectedStake), or
        // (c) bounty is cancelled/expired (escrow already handles those paths).
        // After grace period the rejection is final — refund immediately.
        if (!inGrace) {
            escrow.refundSubmissionStake(bountyId, s.hunter);
        }
        // If inGrace: stake stays in submissionStakes — hunter can dispute within GRACE_PERIOD_REJECT

        emit SubmissionRejected(bountyId, submissionId, inGrace);
    }

    // ── WITHDRAW REJECTED STAKE (grace period elapsed, hunter chose not to dispute) ─
    function withdrawRejectedStake(uint256 bountyId, uint256 submissionId) external nonReentrant {
        BountyRegistry.Submission memory s = registry.getSubmission(submissionId);
        require(s.bountyId == bountyId,                           "Factory: wrong bounty");
        require(s.hunter == msg.sender,                           "Factory: not your submission");
        require(s.status == BountyRegistry.SubStatus.REJECTED,   "Factory: not rejected");
        require(!s.disputed,                                      "Factory: already disputed");
        // Only callable once grace period has expired (stake wasn't auto-refunded because it was inGrace at reject time)
        require(block.timestamp >= s.submittedAt + GRACE_PERIOD_REJECT, "Factory: grace period active - dispute instead");
        escrow.refundSubmissionStake(bountyId, msg.sender);
    }

    // ── CANCEL BOUNTY ─────────────────────────────────────────────────────────
    function cancelBounty(uint256 bountyId) external payable nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(msg.sender == b.poster,                           "Factory: not poster");
        require(b.status == BountyRegistry.BountyStatus.ACTIVE ||
                b.status == BountyRegistry.BountyStatus.REVIEWING, "Factory: not active");

        if (b.submissionCount == 0) {
            // Simple cancel — full refund, poster stake returned
            registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.CANCELLED);
            escrow.refund(bountyId);
            escrow.refundPosterStake(bountyId, b.poster);
        } else {
            BountyRegistry.Submission[] memory subs = registry.getBountySubmissions(bountyId);

            // Count only valid submissions (not grace-period-rejected ones)
            uint256 validSubCount = 0;
            for (uint256 i = 0; i < subs.length; i++) {
                if (subs[i].status == BountyRegistry.SubStatus.PENDING ||
                   (subs[i].status == BountyRegistry.SubStatus.REJECTED && subs[i].gracePeriodExpired)) {
                    validSubCount++;
                }
            }

            if (validSubCount == 0) {
                // All submissions were grace-period rejects — treat as no submissions
                registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.CANCELLED);
                escrow.refund(bountyId);
                escrow.refundPosterStake(bountyId, b.poster);
            } else {
                // Cancel with valid submissions — penalty applies
                uint256 compPerHunter = (b.totalReward * CANCEL_COMP_BPS) / 10_000;
                uint256 totalComp     = compPerHunter * validSubCount;
                if (totalComp > b.totalReward) totalComp = b.totalReward;
                require(msg.value >= totalComp, "Factory: insufficient comp");

                uint256 eachMON = totalComp / validSubCount;

                // Pay hunters first using msg.value
                uint256 paid = 0;
                for (uint256 i = 0; i < subs.length; i++) {
                    bool isValid = subs[i].status == BountyRegistry.SubStatus.PENDING ||
                                  (subs[i].status == BountyRegistry.SubStatus.REJECTED && subs[i].gracePeriodExpired);
                    if (isValid && eachMON > 0) {
                        (bool ok,) = subs[i].hunter.call{value: eachMON, gas: 100_000}("");
                        require(ok, "Factory: comp transfer failed");
                        paid += eachMON;
                    }
                }

                // Refund submission stakes for pending submissions
                for (uint256 i = 0; i < subs.length; i++) {
                    if (subs[i].status == BountyRegistry.SubStatus.PENDING) {
                        escrow.refundSubmissionStake(bountyId, subs[i].hunter);
                    }
                }

                // V3: slash poster stake 50% to hunters, 50% to treasury
                address[] memory pendingHunters = _getPendingHunters(subs);
                escrow.slashPosterStake(bountyId, pendingHunters, 5_000); // 50% to hunters
                emit PosterStakeSlashedOnCancel(bountyId, b.posterStake);

                // V3: record cancel in reputation
                reputation.recordCancelWithSubmissions(b.poster);

                registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.CANCELLED);
                escrow.refund(bountyId);

                // Refund excess MON to poster
                if (msg.value > paid) {
                    (bool ok2,) = msg.sender.call{value: msg.value - paid, gas: 100_000}("");
                    require(ok2, "Factory: excess refund failed");
                }
            }
        }
        emit BountyCancelled(bountyId);
    }

    // Helper: extract pending hunter addresses from submission array
    function _getPendingHunters(BountyRegistry.Submission[] memory subs)
        internal pure returns (address[] memory)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < subs.length; i++) {
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) count++;
        }
        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < subs.length; i++) {
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) {
                result[idx++] = subs[i].hunter;
            }
        }
        return result;
    }

    // ── TRANSITION TO REVIEWING (FIX-9: completes the state machine) ────────────
    // Can be called by anyone once deadline has passed and pending submissions exist.
    // Signals on-chain that the poster's review window has begun.
    function transitionToReviewing(uint256 bountyId) external {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(b.status == BountyRegistry.BountyStatus.ACTIVE,  "Factory: not active");
        require(block.timestamp >= b.deadline,                   "Factory: deadline not reached");
        require(b.submissionCount > 0,                           "Factory: no submissions");

        // Count pending submissions
        BountyRegistry.Submission[] memory subs = registry.getBountySubmissions(bountyId);
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < subs.length; i++) {
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) pendingCount++;
        }
        require(pendingCount > 0, "Factory: no pending submissions");

        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.REVIEWING);
        emit BountyEnteredReview(bountyId, pendingCount);
    }

    // ── EXPIRE BOUNTY (no submissions) ───────────────────────────────────────
    function expireBounty(uint256 bountyId) external {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(b.status == BountyRegistry.BountyStatus.ACTIVE,  "Factory: not active");
        require(block.timestamp >= b.deadline,                   "Factory: not expired yet");
        require(b.submissionCount == 0,                          "Factory: has submissions, use triggerTimeout");
        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.EXPIRED);
        escrow.refund(bountyId);
        escrow.refundPosterStake(bountyId, b.poster);
        emit BountyExpired(bountyId);
    }

    // ── TRIGGER TIMEOUT (poster ghosted after review deadline) ───────────────
    function triggerTimeout(uint256 bountyId) external nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(b.status == BountyRegistry.BountyStatus.ACTIVE ||
                b.status == BountyRegistry.BountyStatus.REVIEWING,         "Factory: not active");
        // V3: use reviewDeadline instead of deadline + GRACE_PERIOD
        require(block.timestamp > b.reviewDeadline,                        "Factory: review window active");
        require(b.submissionCount > 0,                                     "Factory: no submissions");

        BountyRegistry.Submission[] memory subs = registry.getBountySubmissions(bountyId);
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < subs.length; i++)
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) pendingCount++;
        require(pendingCount > 0, "Factory: no pending submissions");

        address[] memory pendingHunters = new address[](pendingCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < subs.length; i++)
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) {
                pendingHunters[idx] = subs[i].hunter; idx++;
            }

        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.EXPIRED);
        escrow.claimTimeout(bountyId, pendingHunters);

        // V3: refund submission stakes to pending hunters
        for (uint256 i = 0; i < pendingHunters.length; i++) {
            escrow.refundSubmissionStake(bountyId, pendingHunters[i]);
        }

        // V3: slash poster stake 100% to treasury (poster ghosted)
        address[] memory empty = new address[](0);
        escrow.slashPosterStake(bountyId, empty, 0);

        emit TimeoutTriggered(bountyId, msg.sender);
    }

    // ── DISPUTE MECHANISM ─────────────────────────────────────────────────────
    function raiseDispute(uint256 bountyId, uint256 submissionId) external payable whenNotPaused nonReentrant {
        require(msg.value >= DISPUTE_DEPOSIT, "Factory: insufficient dispute deposit");
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        BountyRegistry.Submission memory s = registry.getSubmission(submissionId);

        require(s.bountyId == bountyId,                                      "Factory: wrong bounty");
        require(s.hunter == msg.sender,                                      "Factory: not your submission");
        require(s.status == BountyRegistry.SubStatus.REJECTED,              "Factory: not rejected");
        require(!s.disputed,                                                 "Factory: already disputed");
        // FIX C3: dispute only valid while bounty is still in a live state, not after COMPLETED
        require(b.status == BountyRegistry.BountyStatus.ACTIVE ||
                b.status == BountyRegistry.BountyStatus.REVIEWING,          "Factory: bounty already settled");
        // Dispute must be raised within the grace period
        require(block.timestamp < s.submittedAt + GRACE_PERIOD_REJECT,      "Factory: dispute window expired");

        registry.markDisputed(submissionId);
        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.DISPUTED);

        // FIX C1: Move submission stake from submissionStakes → heldDisputeStakes.
        // Stake was kept in submissionStakes (not refunded) because rejection was inGrace.
        // It stays held until resolveDispute: won → released back, denied → slashed to treasury.
        escrow.moveStakeToHeld(bountyId, msg.sender);

        // Refund any excess dispute deposit above DISPUTE_DEPOSIT
        if (msg.value > DISPUTE_DEPOSIT) {
            (bool ok,) = msg.sender.call{value: msg.value - DISPUTE_DEPOSIT, gas: 100_000}("");
            require(ok, "Factory: excess refund failed");
        }

        emit DisputeRaised(bountyId, submissionId, msg.sender);
    }

    // Admin resolves dispute — deposit refund queued for hunter to claim
    function resolveDispute(uint256 bountyId, bool inFavorOfHunters, address disputingHunter) external onlyOwner nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(b.status == BountyRegistry.BountyStatus.DISPUTED, "Factory: not disputed");

        if (inFavorOfHunters) {
            BountyRegistry.Submission[] memory subs = registry.getBountySubmissions(bountyId);
            uint256 eligibleCount = 0;
            for (uint256 i = 0; i < subs.length; i++)
                if (subs[i].status != BountyRegistry.SubStatus.APPROVED) eligibleCount++;

            address[] memory eligible = new address[](eligibleCount);
            uint256 idx = 0;
            for (uint256 i = 0; i < subs.length; i++)
                if (subs[i].status != BountyRegistry.SubStatus.APPROVED)
                    eligible[idx++] = subs[i].hunter;

            registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.CANCELLED);

            if (!escrow.isSettled(bountyId)) {
                escrow.releaseToAll(bountyId, eligible);
            }

            // V3: slash poster stake 100% to disputing hunter on fraud cancel
            if (disputingHunter != address(0)) {
                address[] memory huntArr = new address[](1);
                huntArr[0] = disputingHunter;
                escrow.slashPosterStake(bountyId, huntArr, 10_000); // 100% to hunter
                reputation.recordFraudCancel(b.poster);
                reputation.recordDisputeLost(b.poster, false);
            }

            // FIX C1: Release the held submission stake back to disputing hunter (dispute won)
            if (disputingHunter != address(0)) {
                escrow.releaseDisputeStake(bountyId, disputingHunter);
            }

            // Queue dispute deposit refund (FIX-1: also track total so sweep() cannot touch it)
            if (disputingHunter != address(0)) {
                pendingDisputeRefunds[disputingHunter] += DISPUTE_DEPOSIT;
                _totalPendingRefunds += DISPUTE_DEPOSIT;
                emit DisputeRefundPending(disputingHunter, DISPUTE_DEPOSIT);
            }
        } else {
            // Dispute denied — slash the held dispute stake (was moved to heldDisputeStakes on raiseDispute)
            if (disputingHunter != address(0)) {
                escrow.slashHeldDisputeStake(bountyId, disputingHunter);
                reputation.recordDisputeLost(disputingHunter, true);
            }

            if (!escrow.isSettled(bountyId)) {
                registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.ACTIVE);
            } else {
                registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.COMPLETED);
            }
        }
        emit DisputeResolved(bountyId, inFavorOfHunters);
    }

    // Hunter claims their queued dispute deposit refund
    function claimDisputeRefund() external nonReentrant {
        uint256 amount = pendingDisputeRefunds[msg.sender];
        require(amount > 0, "Factory: no refund pending");
        pendingDisputeRefunds[msg.sender] = 0;
        // FIX-1: decrement reservation before transfer (CEI pattern)
        _totalPendingRefunds -= amount;
        (bool ok,) = msg.sender.call{value: amount, gas: 100_000}("");
        require(ok, "Factory: refund transfer failed");
    }

    // ── FEATURED BOUNTY ───────────────────────────────────────────────────────
    function setFeatured(uint256 bountyId, bool featured) external payable nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        require(msg.sender == b.poster || msg.sender == owner, "Factory: not poster or owner");
        if (msg.sender != owner) {
            require(msg.value >= FEATURED_FEE, "Factory: insufficient featured fee");
            NadWorkEscrow(payable(address(escrow))).sweepFees{value: FEATURED_FEE}();
            if (msg.value > FEATURED_FEE) {
                (bool ok,) = msg.sender.call{value: msg.value - FEATURED_FEE, gas: 100_000}("");
                require(ok, "Factory: fee excess refund failed");
            }
        }
        registry.setFeatured(bountyId, featured);
        if (featured) emit BountyFeatured(bountyId);
    }

    // ── VIEW: get submission stake required for a bounty ─────────────────────
    function getSubmissionStake(uint256 bountyId) external view returns (uint256) {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        uint8 tier = _getHunterTier(msg.sender);
        uint256 baseStake  = _calcSubmissionStake(b.totalReward);
        uint256 multiplier = _tierStakeMultiplier(tier);
        return (baseStake * multiplier) / 10_000;
    }

    // ── VIEW: get poster stake required for a reward amount ──────────────────
    function getPosterStake(uint256 totalReward) external pure returns (uint256) {
        return _calcPosterStake(totalReward);
    }

    // ── ADMIN: sweep accumulated fees (denied dispute deposits, etc.) ───────────
    // FIX-1: only sweeps balance NOT reserved for pending dispute refunds
    function sweep() external onlyOwner nonReentrant {
        uint256 reserved  = _totalPendingRefunds;
        uint256 bal       = address(this).balance;
        require(bal > reserved, "Factory: nothing to sweep");
        uint256 sweepable = bal - reserved;
        (bool ok,) = owner.call{value: sweepable}("");
        require(ok, "Factory: sweep failed");
    }

    receive() external payable {}
}
