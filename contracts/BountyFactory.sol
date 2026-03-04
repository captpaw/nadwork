// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./BountyRegistry.sol";
import "./NadWorkEscrow.sol";
import "./ReputationRegistry.sol";
import "./IdentityRegistry.sol";

contract BountyFactory {
    error FactoryNotOwner();
    error FactoryPaused();
    error FactoryReentrant();
    error FactoryZeroAddress();
    error FactoryEmptyIpfsHash();
    error FactoryInvalidTitle();
    error FactoryInvalidRewardType();
    error FactoryZeroReward();
    error FactoryWinnerCountOutOfRange();
    error FactoryWeightsLengthMismatch();
    error FactoryDeadlineTooSoon();
    error FactoryDeadlineTooFar();
    error FactoryWeightsMustSumTo100();
    error FactoryWrongNativeAmount();
    error FactoryWrongStakeAmount();
    error FactoryZeroTokenAddress();
    error FactoryBountyNotActive();
    error FactoryDeadlinePassed();
    error FactoryCreatorCannotSubmit();
    error FactoryAlreadySubmitted();
    error FactoryUsernameRequired();
    error FactoryNotApprovedToSubmit();
    error FactoryInsufficientSubmissionStake();
    error FactoryExcessStakeRefundFailed();
    error FactoryNotCreator();
    error FactoryNotActive();
    error FactoryInvalidWinnerCount();
    error FactoryLengthMismatch();
    error FactoryWrongBounty();
    error FactorySubmissionNotPending();
    error FactoryDuplicateWinnerAddress();
    error FactoryRankOutOfRange();
    error FactoryDuplicateRank();
    error FactoryNotPending();
    error FactoryNotYourSubmission();
    error FactoryNotRejected();
    error FactoryAlreadyDisputed();
    error FactoryNotRejectedYet();
    error FactoryGracePeriodActiveDisputeInstead();
    error FactoryInsufficientComp();
    error FactoryExcessRefundFailed();
    error FactoryDeadlineNotReached();
    error FactoryNoSubmissions();
    error FactoryNoPendingSubmissions();
    error FactoryNotExpiredYet();
    error FactoryHasSubmissionsUseTriggerTimeout();
    error FactoryReviewWindowActive();
    error FactoryNoTimeoutPayoutPending();
    error FactoryTimeoutPayoutFailed();
    error FactoryNoCancelCompPending();
    error FactoryCancelCompTransferFailed();
    error FactoryNoStakeRefundPending();
    error FactoryStakeRefundTransferFailed();
    error FactoryInsufficientDisputeDeposit();
    error FactoryBountyAlreadySettled();
    error FactoryDisputeWindowExpired();
    error FactoryNotDisputed();
    error FactoryNoRefundPending();
    error FactoryRefundTransferFailed();
    error FactoryOpenBountyNoApplicationNeeded();
    error FactoryCreatorCannotApply();
    error FactoryAlreadyApplied();
    error FactoryEmptyProposal();
    error FactoryBuilderHasNotApplied();
    error FactoryAlreadyApproved();
    error FactoryNotCreatorOrOwner();
    error FactoryInsufficientFeaturedFee();
    error FactoryFeeExcessRefundFailed();
    error FactoryNothingToSweep();
    error FactorySweepFailed();

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

    // ── V4 Fair System: Skin in the Game constants (MON-only, realistic) ────────
    // Creator stake: 3% of reward, min 0.01 MON, max 50 MON
    uint256 public constant CREATOR_STAKE_BPS     = 300;
    uint256 public constant MIN_CREATOR_STAKE     = 0.01  ether;
    uint256 public constant MAX_CREATOR_STAKE      = 50    ether;
    // Builder submission stake: 2% of reward, min 0.005 MON, max 5 MON
    uint256 public constant SUBMISSION_STAKE_BPS  = 200;
    uint256 public constant MIN_SUBMISSION_STAKE  = 0.005 ether;
    uint256 public constant MAX_SUBMISSION_STAKE  = 5     ether;

    // ── V3 Fair System: Time-gated review constants ───────────────────────────
    uint256 public constant MIN_REVIEW_WINDOW     = 24 hours;
    uint256 public constant MAX_REVIEW_WINDOW     = 7 days;
    uint256 public constant GRACE_PERIOD_REJECT   = 2 hours;     // free spam rejection window

    // ── Dispute pull-payment ──────────────────────────────────────────────────
    mapping(address => uint256) public pendingDisputeRefunds;
    // Tracks total ETH reserved for pending dispute refunds so sweep() never touches it
    uint256 private _totalPendingRefunds;

    // ── FIX H-01: Cancel compensation pull-payment ───────────────────────────
    // Replaces the push-payment loop in cancelBounty that was vulnerable to DoS
    // by a malicious smart contract hunter that reverts on receive().
    mapping(address => uint256) public pendingCancelComps;
    uint256 private _totalPendingCancelComps;

    // ── FIX H-02: Timeout payout pull-payment ────────────────────────────────
    // Replaces the push-payment loop in claimTimeout that was vulnerable to DoS.
    mapping(address => uint256) public pendingTimeoutPayouts;
    uint256 private _totalPendingTimeoutPayouts;

    // ── FIX XC-02+T-01: Submission stake refund pull-payment ─────────────────
    // triggerTimeout and cancelBounty previously called escrow.refundSubmissionStake()
    // in a loop (push-payment), which is a DoS vector if any hunter is a smart contract
    // that reverts on receive(). Changed to pull-payment: escrow sends funds to factory
    // (via refundSubmissionStakeToFactory), factory queues for each hunter to claim.
    mapping(address => uint256) public pendingStakeRefunds;
    uint256 private _totalPendingStakeRefunds;

    // ── Events ────────────────────────────────────────────────────────────────
    event BountyCreated(uint256 indexed bountyId, address indexed creator, uint256 reward);
    event WorkSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed builder);
    event WinnersApproved(uint256 indexed bountyId, address[] winners);
    event SubmissionRejected(uint256 indexed bountyId, uint256 indexed submissionId, bool inGracePeriod);
    event BountyCancelled(uint256 indexed bountyId);
    event BountyExpired(uint256 indexed bountyId);
    event TimeoutTriggered(uint256 indexed bountyId, address triggeredBy);
    event DisputeRaised(uint256 indexed bountyId, uint256 indexed submissionId, address indexed builder);
    event DisputeResolved(uint256 indexed bountyId, bool inFavorOfBuilders);
    event BountyFeatured(uint256 indexed bountyId);
    // FIX L-03: distinguish owner-comped featuring from paid featuring for transparency
    event BountyFeaturedByOwner(uint256 indexed bountyId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event IdentitySet(address indexed identity);
    event DisputeRefundPending(address indexed builder, uint256 amount);
    // V4: Application system events
    event ApplicationSubmitted(uint256 indexed bountyId, uint256 indexed appId, address indexed builder);
    event ApplicationApproved(uint256 indexed bountyId, uint256 indexed appId, address indexed builder);
    event ApplicationRejected(uint256 indexed bountyId, uint256 indexed appId, address indexed builder);
    // V3
    event SubmissionStakeRequired(uint256 indexed bountyId, address indexed builder, uint256 amount);
    event CreatorStakeSlashedOnCancel(uint256 indexed bountyId, uint256 amount);
    // FIX-9: emitted when bounty transitions to REVIEWING state after deadline
    event BountyEnteredReview(uint256 indexed bountyId, uint256 pendingCount);
    // FIX H-01: pull-payment for cancel compensation
    event CancelCompPending(uint256 indexed bountyId, address indexed builder, uint256 amount);
    // FIX H-02: pull-payment for timeout payout
    event TimeoutPayoutPending(uint256 indexed bountyId, address indexed builder, uint256 amount);
    // FIX XC-02+T-01: pull-payment for submission stake refunds
    event StakeRefundPending(uint256 indexed bountyId, address indexed builder, uint256 amount);

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner()     { if (msg.sender != owner) revert FactoryNotOwner(); _; }
    modifier whenNotPaused() { if (_paused) revert FactoryPaused(); _; }
    modifier nonReentrant()  { if (_locked != 0) revert FactoryReentrant(); _locked = 1; _; _locked = 0; }

    constructor(address _registry, address _escrow, address _reputation, address _identity) {
        if (_registry == address(0) || _escrow == address(0) || _reputation == address(0)) revert FactoryZeroAddress();
        owner = msg.sender;
        registry   = BountyRegistry(_registry);
        escrow     = NadWorkEscrow(payable(_escrow));
        reputation = ReputationRegistry(_reputation);
        if (_identity != address(0)) {
            identity = IdentityRegistry(_identity);
        }
    }

    function setIdentity(address _identity) external onlyOwner {
        if (_identity == address(0)) revert FactoryZeroAddress();
        identity = IdentityRegistry(_identity);
        emit IdentitySet(_identity);
    }

    function pause()   external onlyOwner { _paused = true;  }
    function unpause() external onlyOwner { _paused = false; }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert FactoryZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    // V4: calculate creator stake — capped at MAX_CREATOR_STAKE
    function _calcCreatorStake(uint256 totalReward) internal pure returns (uint256) {
        uint256 pct = (totalReward * CREATOR_STAKE_BPS) / 10_000;
        if (pct < MIN_CREATOR_STAKE) pct = MIN_CREATOR_STAKE;
        if (pct > MAX_CREATOR_STAKE) pct = MAX_CREATOR_STAKE;
        return pct;
    }

    // V4: calculate submission stake
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

    // V4: single-tier — require username (any builder with a username can participate)
    function _hasUsername(address builder) internal view returns (bool) {
        if (address(identity) == address(0)) return true; // permissive mode: no identity contract
        string memory uname = identity.getUsername(builder);
        return bytes(uname).length > 0;
    }

    // ── CREATE BOUNTY ─────────────────────────────────────────────────────────
    // V4: added requiresApplication parameter (last, append-only to preserve old ABIs)
    function createBounty(
        string  calldata ipfsHash,
        string  calldata title,
        string  calldata category,
        uint8   rewardType,
        address rewardToken,
        uint256 totalReward,
        uint8   winnerCount,
        uint8[] calldata prizeWeights,
        uint256 deadline,
        bool    requiresApplication
    ) external payable whenNotPaused nonReentrant returns (uint256 bountyId) {
        if (bytes(ipfsHash).length == 0) revert FactoryEmptyIpfsHash();
        if (bytes(title).length == 0 || bytes(title).length > 100) revert FactoryInvalidTitle();
        if (rewardType > 1) revert FactoryInvalidRewardType();
        if (totalReward == 0) revert FactoryZeroReward();
        if (winnerCount < 1 || winnerCount > MAX_WINNERS) revert FactoryWinnerCountOutOfRange();
        if (prizeWeights.length != winnerCount) revert FactoryWeightsLengthMismatch();
        if (deadline <= block.timestamp + MIN_DURATION) revert FactoryDeadlineTooSoon();
        if (deadline >= block.timestamp + MAX_DURATION) revert FactoryDeadlineTooFar();

        uint256 weightSum = 0;
        for (uint256 i = 0; i < prizeWeights.length; i++) weightSum += prizeWeights[i];
        if (weightSum != 100) revert FactoryWeightsMustSumTo100();

        uint256 creatorStake   = _calcCreatorStake(totalReward);
        uint256 reviewDeadline = _calcReviewDeadline(deadline, block.timestamp);

        BountyRegistry.RewardType rType = BountyRegistry.RewardType(rewardType);

        bountyId = registry.registerBounty(
            msg.sender, ipfsHash, title, category, rType,
            rType == BountyRegistry.RewardType.NATIVE ? address(0) : rewardToken,
            totalReward, winnerCount, prizeWeights, deadline,
            reviewDeadline, creatorStake, requiresApplication
        );

        if (rType == BountyRegistry.RewardType.NATIVE) {
            uint256 required = totalReward + creatorStake;
            if (msg.value != required) revert FactoryWrongNativeAmount();
            escrow.depositNative{value: msg.value}(bountyId, msg.sender, deadline, creatorStake);
        } else {
            // ERC20: creator stake is MON, sent as msg.value
            if (msg.value != creatorStake) revert FactoryWrongStakeAmount();
            if (rewardToken == address(0)) revert FactoryZeroTokenAddress();
            escrow.depositERC20{value: msg.value}(bountyId, msg.sender, rewardToken, totalReward, deadline);
        }

        reputation.recordBountyPosted(msg.sender, totalReward);
        emit BountyCreated(bountyId, msg.sender, totalReward);
    }

    // ── SUBMIT WORK ───────────────────────────────────────────────────────────
    function submitWork(uint256 bountyId, string calldata ipfsHash)
        external payable whenNotPaused nonReentrant returns (uint256 submissionId)
    {
        if (bytes(ipfsHash).length == 0) revert FactoryEmptyIpfsHash();
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (b.status != BountyRegistry.BountyStatus.ACTIVE) revert FactoryBountyNotActive();
        if (block.timestamp >= b.deadline) revert FactoryDeadlinePassed();
        if (msg.sender == b.creator) revert FactoryCreatorCannotSubmit();
        if (registry.hasSubmitted(bountyId, msg.sender)) revert FactoryAlreadySubmitted();

        // V4: single-tier — username required for all submissions
        if (!_hasUsername(msg.sender)) revert FactoryUsernameRequired();

        // V4: curated project — must be an approved applicant
        if (b.requiresApplication) {
            if (!registry.isApprovedApplicant(bountyId, msg.sender)) revert FactoryNotApprovedToSubmit();
        }

        // V4: calculate and collect submission stake (no tier multiplier)
        uint256 stakeAmount = _calcSubmissionStake(b.totalReward);
        if (msg.value < stakeAmount) revert FactoryInsufficientSubmissionStake();

        // Refund excess stake above required
        if (msg.value > stakeAmount) {
            (bool ok,) = msg.sender.call{value: msg.value - stakeAmount, gas: 100_000}("");
            if (!ok) revert FactoryExcessStakeRefundFailed();
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
        if (msg.sender != b.creator) revert FactoryNotCreator();
        if (b.status != BountyRegistry.BountyStatus.ACTIVE && b.status != BountyRegistry.BountyStatus.REVIEWING) revert FactoryBountyNotActive();
        if (submissionIds.length < 1 || submissionIds.length > b.winnerCount) revert FactoryInvalidWinnerCount();
        if (submissionIds.length != ranks.length) revert FactoryLengthMismatch();

        address[] memory winners = new address[](submissionIds.length);
        for (uint256 i = 0; i < submissionIds.length; i++) {
            BountyRegistry.Submission memory s = registry.getSubmission(submissionIds[i]);
            if (s.bountyId != bountyId) revert FactoryWrongBounty();
            if (s.status != BountyRegistry.SubStatus.PENDING) revert FactorySubmissionNotPending();
            for (uint256 j = 0; j < i; j++) {
                if (winners[j] == s.builder) revert FactoryDuplicateWinnerAddress();
            }
            winners[i] = s.builder;
        }

        // FIX H-03: validate ranks array — must be unique values 1..submissionIds.length
        // Ranks determine which prizeWeight slot a winner receives; rank 1 = highest prize.
        {
            uint256 len = submissionIds.length;
            bool[] memory seen = new bool[](len + 1); // index 1..len
            for (uint256 i = 0; i < len; i++) {
                uint8 r = ranks[i];
                if (r < 1 || r > len) revert FactoryRankOutOfRange();
                if (seen[r]) revert FactoryDuplicateRank();
                seen[r] = true;
            }
        }

        // Build effective weights: winner with rank r gets prizeWeights[r-1].
        // If fewer winners than winnerCount, redistribute equally (ranks ignored for weights).
        uint8[] memory effectiveWeights = new uint8[](submissionIds.length);
        if (submissionIds.length == b.winnerCount) {
            // Assign weights by rank: rank 1 → prizeWeights[0], rank 2 → prizeWeights[1], etc.
            for (uint256 i = 0; i < submissionIds.length; i++) {
                effectiveWeights[i] = b.prizeWeights[ranks[i] - 1];
            }
        } else {
            // Partial winners — equal split, ranks are still recorded for display
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

        // V3: return creator stake on successful completion
        escrow.refundCreatorStake(bountyId, b.creator);

        // Record reputation
        uint256 total       = b.totalReward;
        uint256 fee         = (total * 300) / 10_000;
        uint256 builderPool = total - fee;
        for (uint256 i = 0; i < winners.length; i++) {
            uint256 actualPrize = (builderPool * effectiveWeights[i]) / 100;
            reputation.recordWin(winners[i], actualPrize, b.creator);
        }
        reputation.recordBountyCompleted(b.creator, b.totalReward);
        emit WinnersApproved(bountyId, winners);
    }

    // ── REJECT SUBMISSION ─────────────────────────────────────────────────────
    // FIX-2: nonReentrant guards against re-entry during MON refund to hunter
    // FIX C01-01: added whenNotPaused — without it, a paused contract would silently allow
    // poster to reject during pause (griefing: hunter submission expires during pause window)
    function rejectSubmission(uint256 bountyId, uint256 submissionId) external whenNotPaused nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (msg.sender != b.creator) revert FactoryNotCreator();
        if (b.status != BountyRegistry.BountyStatus.ACTIVE && b.status != BountyRegistry.BountyStatus.REVIEWING) revert FactoryNotActive();

        BountyRegistry.Submission memory s = registry.getSubmission(submissionId);
        if (s.bountyId != bountyId) revert FactoryWrongBounty();
        if (s.status != BountyRegistry.SubStatus.PENDING) revert FactoryNotPending();

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
            escrow.refundSubmissionStake(bountyId, s.builder);
        }
        // If inGrace: stake stays in submissionStakes — builder can dispute within GRACE_PERIOD_REJECT

        emit SubmissionRejected(bountyId, submissionId, inGrace);
    }

    // ── WITHDRAW REJECTED STAKE (grace period elapsed, hunter chose not to dispute) ─
    function withdrawRejectedStake(uint256 bountyId, uint256 submissionId) external nonReentrant {
        BountyRegistry.Submission memory s = registry.getSubmission(submissionId);
        if (s.bountyId != bountyId) revert FactoryWrongBounty();
        if (s.builder != msg.sender) revert FactoryNotYourSubmission();
        if (s.status != BountyRegistry.SubStatus.REJECTED) revert FactoryNotRejected();
        if (s.disputed) revert FactoryAlreadyDisputed();
        // FIX C-01: Use rejectedAt for consistency — grace period is GRACE_PERIOD_REJECT
        // after the poster actually called rejectSubmission(), not after submission time.
        if (s.rejectedAt == 0) revert FactoryNotRejectedYet();
        if (block.timestamp < s.rejectedAt + GRACE_PERIOD_REJECT) revert FactoryGracePeriodActiveDisputeInstead();
        escrow.refundSubmissionStake(bountyId, msg.sender);
    }

    // ── CANCEL BOUNTY ─────────────────────────────────────────────────────────
    // FIX CB-01: added whenNotPaused — cancel changes state and refunds funds
    function cancelBounty(uint256 bountyId) external payable whenNotPaused nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (msg.sender != b.creator) revert FactoryNotCreator();
        if (b.status != BountyRegistry.BountyStatus.ACTIVE && b.status != BountyRegistry.BountyStatus.REVIEWING) revert FactoryNotActive();

        if (b.submissionCount == 0) {
            // Simple cancel — full refund, creator stake returned
            registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.CANCELLED);
            escrow.refund(bountyId);
            escrow.refundCreatorStake(bountyId, b.creator);
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
                escrow.refundCreatorStake(bountyId, b.creator);
            } else {
                // Cancel with valid submissions — penalty applies
                uint256 compPerBuilder = (b.totalReward * CANCEL_COMP_BPS) / 10_000;
                uint256 totalComp     = compPerBuilder * validSubCount;
                if (totalComp > b.totalReward) totalComp = b.totalReward;
                if (msg.value < totalComp) revert FactoryInsufficientComp();

                // FIX H-01: Use pull-payment pattern instead of push-payment loop.
                // A push-payment loop is vulnerable to DoS: a malicious hunter smart
                // contract that reverts on receive() would block the entire cancel.
                // Instead, queue each compensation so hunters claim individually.
                // FIX L-01: Distribute dust (from integer division) to the last valid builder
                // so no wei is silently locked in the contract.
                uint256 eachMON = totalComp / validSubCount;
                uint256 dust    = totalComp - (eachMON * validSubCount);
                uint256 validIdx = 0;
                for (uint256 i = 0; i < subs.length; i++) {
                    bool isValid = subs[i].status == BountyRegistry.SubStatus.PENDING ||
                                  (subs[i].status == BountyRegistry.SubStatus.REJECTED && subs[i].gracePeriodExpired);
                    if (isValid) {
                        validIdx++;
                        uint256 amount = (validIdx == validSubCount) ? eachMON + dust : eachMON;
                        pendingCancelComps[subs[i].builder] += amount;
                        _totalPendingCancelComps            += amount;
                        emit CancelCompPending(bountyId, subs[i].builder, amount);
                    }
                }

                // FIX XC-02+T-01: Use pull-payment for submission stake refunds.
                for (uint256 i = 0; i < subs.length; i++) {
                    if (subs[i].status == BountyRegistry.SubStatus.PENDING) {
                        uint256 stakeAmt = escrow.refundSubmissionStakeToFactory(bountyId, subs[i].builder);
                        if (stakeAmt > 0) {
                            pendingStakeRefunds[subs[i].builder] += stakeAmt;
                            _totalPendingStakeRefunds             += stakeAmt;
                            emit StakeRefundPending(bountyId, subs[i].builder, stakeAmt);
                        }
                    }
                }

                // V3: slash creator stake 50% to builders, 50% to treasury
                address[] memory pendingBuilders = _getPendingBuilders(subs);
                escrow.slashCreatorStake(bountyId, pendingBuilders, 5_000); // 50% to builders
                emit CreatorStakeSlashedOnCancel(bountyId, b.creatorStake);

                // V3: record cancel in reputation
                reputation.recordCancelWithSubmissions(b.creator);

                registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.CANCELLED);
                escrow.refund(bountyId);

                // Refund excess MON to creator (amount above totalComp)
                if (msg.value > totalComp) {
                    (bool ok2,) = msg.sender.call{value: msg.value - totalComp, gas: 100_000}("");
                    if (!ok2) revert FactoryExcessRefundFailed();
                }
            }
        }
        emit BountyCancelled(bountyId);
    }

    // Helper: extract pending builder addresses from submission array
    function _getPendingBuilders(BountyRegistry.Submission[] memory subs)
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
                result[idx++] = subs[i].builder;
            }
        }
        return result;
    }

    // ── TRANSITION TO REVIEWING (FIX-9: completes the state machine) ────────────
    // Can be called by anyone once deadline has passed and pending submissions exist.
    // Signals on-chain that the creator's review window has begun.
    // FIX M-05: added whenNotPaused so this is blocked during emergency pause (consistent with all other state-changing functions)
    // FIX NR-01: added nonReentrant — registry.updateBountyStatus is an external call
    function transitionToReviewing(uint256 bountyId) external whenNotPaused nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (b.status != BountyRegistry.BountyStatus.ACTIVE) revert FactoryNotActive();
        if (block.timestamp < b.deadline) revert FactoryDeadlineNotReached();
        if (b.submissionCount == 0) revert FactoryNoSubmissions();

        // Count pending submissions
        BountyRegistry.Submission[] memory subs = registry.getBountySubmissions(bountyId);
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < subs.length; i++) {
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) pendingCount++;
        }
        if (pendingCount == 0) revert FactoryNoPendingSubmissions();

        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.REVIEWING);
        emit BountyEnteredReview(bountyId, pendingCount);
    }

    // ── EXPIRE BOUNTY (no submissions) ───────────────────────────────────────
    // FIX M-03: added whenNotPaused for consistency — expire changes state and refunds
    // FIX NR-02: added nonReentrant — escrow.refund and escrow.refundPosterStake transfer ETH
    function expireBounty(uint256 bountyId) external whenNotPaused nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (b.status != BountyRegistry.BountyStatus.ACTIVE) revert FactoryNotActive();
        if (block.timestamp < b.deadline) revert FactoryNotExpiredYet();
        if (b.submissionCount != 0) revert FactoryHasSubmissionsUseTriggerTimeout();
        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.EXPIRED);
        escrow.refund(bountyId);
        escrow.refundCreatorStake(bountyId, b.creator);
        emit BountyExpired(bountyId);
    }

    // ── TRIGGER TIMEOUT (creator ghosted after review deadline) ───────────────
    // FIX M-04: added whenNotPaused — timeout changes state and transfers ETH
    function triggerTimeout(uint256 bountyId) external whenNotPaused nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (b.status != BountyRegistry.BountyStatus.ACTIVE && b.status != BountyRegistry.BountyStatus.REVIEWING) revert FactoryNotActive();
        // V3: use reviewDeadline instead of deadline + GRACE_PERIOD
        if (block.timestamp <= b.reviewDeadline) revert FactoryReviewWindowActive();
        if (b.submissionCount == 0) revert FactoryNoSubmissions();

        BountyRegistry.Submission[] memory subs = registry.getBountySubmissions(bountyId);
        uint256 pendingCount = 0;
        for (uint256 i = 0; i < subs.length; i++)
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) pendingCount++;
        if (pendingCount == 0) revert FactoryNoPendingSubmissions();

        address[] memory pendingBuilders = new address[](pendingCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < subs.length; i++)
            if (subs[i].status == BountyRegistry.SubStatus.PENDING) {
                pendingBuilders[idx] = subs[i].builder; idx++;
            }

        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.EXPIRED);

        // FIX H-02: Use pull-payment pattern for timeout payouts.
        // claimTimeoutPullable() pays fee to treasury and sends the entire builder pool
        // to this factory contract (for native bounties). We queue each builder's share.
        (uint256 payoutPerBuilder, uint256 builderPool) = escrow.claimTimeoutPullable(bountyId, pendingBuilders);
        if (builderPool > 0) {
            // Native bounty: queue pull-payments; distribute dust to last builder
            uint256 allocated = payoutPerBuilder * pendingBuilders.length;
            uint256 dust = builderPool - allocated;
            for (uint256 i = 0; i < pendingBuilders.length; i++) {
                uint256 amount = (i == pendingBuilders.length - 1) ? payoutPerBuilder + dust : payoutPerBuilder;
                pendingTimeoutPayouts[pendingBuilders[i]] += amount;
                _totalPendingTimeoutPayouts                += amount;
                emit TimeoutPayoutPending(bountyId, pendingBuilders[i], amount);
            }
        }
        // If builderPool == 0, it was an ERC20 bounty handled directly in escrow (push-payment).

        // FIX XC-02+T-01: Use pull-payment for submission stake refunds.
        // The old push-payment loop (refundSubmissionStake in a loop) is a DoS vector:
        // a malicious builder smart contract that reverts on receive() would block the
        // entire triggerTimeout for all other builders.
        for (uint256 i = 0; i < pendingBuilders.length; i++) {
            uint256 stakeAmt = escrow.refundSubmissionStakeToFactory(bountyId, pendingBuilders[i]);
            if (stakeAmt > 0) {
                pendingStakeRefunds[pendingBuilders[i]] += stakeAmt;
                _totalPendingStakeRefunds                += stakeAmt;
                emit StakeRefundPending(bountyId, pendingBuilders[i], stakeAmt);
            }
        }

        // V3: slash creator stake 100% to treasury (creator ghosted)
        address[] memory empty = new address[](0);
        escrow.slashCreatorStake(bountyId, empty, 0);

        // FIX L-02: Record creator reputation for ghosting (was missing before)
        reputation.recordCancelWithSubmissions(b.creator);

        emit TimeoutTriggered(bountyId, msg.sender);
    }

    // FIX H-02: Hunter claims their queued timeout payout
    function claimTimeoutPayout() external nonReentrant {
        uint256 amount = pendingTimeoutPayouts[msg.sender];
        if (amount == 0) revert FactoryNoTimeoutPayoutPending();
        pendingTimeoutPayouts[msg.sender] = 0;
        _totalPendingTimeoutPayouts -= amount;
        (bool ok,) = msg.sender.call{value: amount, gas: 100_000}("");
        if (!ok) revert FactoryTimeoutPayoutFailed();
    }

    // FIX H-01: Hunter claims their queued cancel compensation
    function claimCancelComp() external nonReentrant {
        uint256 amount = pendingCancelComps[msg.sender];
        if (amount == 0) revert FactoryNoCancelCompPending();
        pendingCancelComps[msg.sender] = 0;
        _totalPendingCancelComps -= amount;
        (bool ok,) = msg.sender.call{value: amount, gas: 100_000}("");
        if (!ok) revert FactoryCancelCompTransferFailed();
    }

    // FIX XC-02+T-01: Hunter claims their queued submission stake refund
    function claimStakeRefund() external nonReentrant {
        uint256 amount = pendingStakeRefunds[msg.sender];
        if (amount == 0) revert FactoryNoStakeRefundPending();
        pendingStakeRefunds[msg.sender] = 0;
        _totalPendingStakeRefunds -= amount;
        (bool ok,) = msg.sender.call{value: amount, gas: 100_000}("");
        if (!ok) revert FactoryStakeRefundTransferFailed();
    }

    // ── DISPUTE MECHANISM ─────────────────────────────────────────────────────
    function raiseDispute(uint256 bountyId, uint256 submissionId) external payable whenNotPaused nonReentrant {
        if (msg.value < DISPUTE_DEPOSIT) revert FactoryInsufficientDisputeDeposit();
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        BountyRegistry.Submission memory s = registry.getSubmission(submissionId);

        if (s.bountyId != bountyId) revert FactoryWrongBounty();
        if (s.builder != msg.sender) revert FactoryNotYourSubmission();
        if (s.status != BountyRegistry.SubStatus.REJECTED) revert FactoryNotRejected();
        if (s.disputed) revert FactoryAlreadyDisputed();
        // FIX C3: dispute only valid while bounty is still in a live state, not after COMPLETED
        if (b.status != BountyRegistry.BountyStatus.ACTIVE && b.status != BountyRegistry.BountyStatus.REVIEWING) revert FactoryBountyAlreadySettled();
        // FIX C-01: Dispute window now measured from rejectedAt (when poster actually rejected),
        // not from submittedAt. Previously, a poster could wait 1h59m then reject, leaving the
        // hunter only 1 minute to dispute. Now hunter always gets a full GRACE_PERIOD_REJECT window.
        if (s.rejectedAt == 0) revert FactoryNotRejectedYet();
        if (block.timestamp >= s.rejectedAt + GRACE_PERIOD_REJECT) revert FactoryDisputeWindowExpired();

        registry.markDisputed(submissionId);
        registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.DISPUTED);

        // FIX C1: Move submission stake from submissionStakes → heldDisputeStakes.
        // Stake was kept in submissionStakes (not refunded) because rejection was inGrace.
        // It stays held until resolveDispute: won → released back, denied → slashed to treasury.
        escrow.moveStakeToHeld(bountyId, msg.sender);

        // Refund any excess dispute deposit above DISPUTE_DEPOSIT
        if (msg.value > DISPUTE_DEPOSIT) {
            (bool ok,) = msg.sender.call{value: msg.value - DISPUTE_DEPOSIT, gas: 100_000}("");
            if (!ok) revert FactoryExcessRefundFailed();
        }

        emit DisputeRaised(bountyId, submissionId, msg.sender);
    }

    // Admin resolves dispute — deposit refund queued for builder to claim
    function resolveDispute(uint256 bountyId, bool inFavorOfBuilders, address disputingBuilder) external onlyOwner nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (b.status != BountyRegistry.BountyStatus.DISPUTED) revert FactoryNotDisputed();

        if (inFavorOfBuilders) {
            BountyRegistry.Submission[] memory subs = registry.getBountySubmissions(bountyId);
            // FIX C-02: Only include submissions that are actively disputed (disputed == true).
            // The old filter (status != APPROVED) incorrectly included all non-approved
            // submissions — REJECTED-but-not-disputed, PENDING, etc. — causing non-disputing
            // builders to receive reward from a dispute they had no part in.
            uint256 eligibleCount = 0;
            for (uint256 i = 0; i < subs.length; i++)
                if (subs[i].disputed) eligibleCount++;

            address[] memory eligible = new address[](eligibleCount);
            uint256 idx = 0;
            for (uint256 i = 0; i < subs.length; i++)
                if (subs[i].disputed)
                    eligible[idx++] = subs[i].builder;

            registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.CANCELLED);

            if (!escrow.isSettled(bountyId)) {
                escrow.releaseToAll(bountyId, eligible);
            }

            // V3: slash creator stake 100% to disputing builder on fraud cancel
            if (disputingBuilder != address(0)) {
                address[] memory buildArr = new address[](1);
                buildArr[0] = disputingBuilder;
                escrow.slashCreatorStake(bountyId, buildArr, 10_000); // 100% to builder
                reputation.recordFraudCancel(b.creator);
                reputation.recordDisputeLost(b.creator, false);
            }

            // FIX C1: Release the held submission stake back to disputing builder (dispute won)
            if (disputingBuilder != address(0)) {
                escrow.releaseDisputeStake(bountyId, disputingBuilder);
            }

            // Queue dispute deposit refund (FIX-1: also track total so sweep() cannot touch it)
            if (disputingBuilder != address(0)) {
                pendingDisputeRefunds[disputingBuilder] += DISPUTE_DEPOSIT;
                _totalPendingRefunds += DISPUTE_DEPOSIT;
                emit DisputeRefundPending(disputingBuilder, DISPUTE_DEPOSIT);
            }
        } else {
            // Dispute denied — slash the held dispute stake (was moved to heldDisputeStakes on raiseDispute)
            if (disputingBuilder != address(0)) {
                escrow.slashHeldDisputeStake(bountyId, disputingBuilder);
                reputation.recordDisputeLost(disputingBuilder, true);
                // FIX BUG-RR-5: record fraud submission so fraudCount is incremented.
                // Previously recordFraudSubmission was never called, making fraudCount
                // always 0 and the fraud penalty in getBuilderScore() dead code.
                // A denied dispute means the builder raised a bad-faith / fraudulent dispute.
                reputation.recordFraudSubmission(disputingBuilder);
            }

            if (!escrow.isSettled(bountyId)) {
                // FIX M-02: if we're past the reviewDeadline, restore to REVIEWING so
                // triggerTimeout can be called immediately. Restoring to ACTIVE would allow
                // an instant triggerTimeout attack (triggerTimeout checks ACTIVE || REVIEWING).
                // Restoring to ACTIVE past the deadline gives the creator an undeserved
                // second chance and creates a race condition where anyone can immediately timeout.
                if (block.timestamp > b.reviewDeadline) {
                    registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.REVIEWING);
                } else {
                    registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.ACTIVE);
                }
            } else {
                registry.updateBountyStatus(bountyId, BountyRegistry.BountyStatus.COMPLETED);
            }
        }
        emit DisputeResolved(bountyId, inFavorOfBuilders);
    }

    // Hunter claims their queued dispute deposit refund
    function claimDisputeRefund() external nonReentrant {
        uint256 amount = pendingDisputeRefunds[msg.sender];
        if (amount == 0) revert FactoryNoRefundPending();
        pendingDisputeRefunds[msg.sender] = 0;
        // FIX-1: decrement reservation before transfer (CEI pattern)
        _totalPendingRefunds -= amount;
        (bool ok,) = msg.sender.call{value: amount, gas: 100_000}("");
        if (!ok) revert FactoryRefundTransferFailed();
    }

    // ── V4: APPLICATION SYSTEM ────────────────────────────────────────────────

    /// @notice Hunter submits a short proposal for a curated bounty.
    /// @param proposalIpfsHash IPFS CID of the JSON proposal blob.
    function applyToBounty(uint256 bountyId, string calldata proposalIpfsHash)
        external whenNotPaused nonReentrant
    {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (b.status != BountyRegistry.BountyStatus.ACTIVE) revert FactoryNotActive();
        if (block.timestamp >= b.deadline) revert FactoryDeadlinePassed();
        if (!b.requiresApplication) revert FactoryOpenBountyNoApplicationNeeded();
        if (msg.sender == b.creator) revert FactoryCreatorCannotApply();
        if (registry.hasApplied(bountyId, msg.sender)) revert FactoryAlreadyApplied();
        if (registry.hasSubmitted(bountyId, msg.sender)) revert FactoryAlreadySubmitted();
        if (bytes(proposalIpfsHash).length == 0) revert FactoryEmptyProposal();
        if (!_hasUsername(msg.sender)) revert FactoryUsernameRequired();

        uint256 appId = registry.addApplication(bountyId, msg.sender, proposalIpfsHash);
        emit ApplicationSubmitted(bountyId, appId, msg.sender);
    }

    /// @notice Creator approves an applicant, granting them permission to submit work.
    function approveApplication(uint256 bountyId, address builder)
        external whenNotPaused nonReentrant
    {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (msg.sender != b.creator) revert FactoryNotCreator();
        if (b.status != BountyRegistry.BountyStatus.ACTIVE) revert FactoryNotActive();
        if (!registry.hasApplied(bountyId, builder)) revert FactoryBuilderHasNotApplied();
        if (registry.isApprovedApplicant(bountyId, builder)) revert FactoryAlreadyApproved();

        registry.setApplicationApproved(bountyId, builder, true);

        // Retrieve appId for event
        BountyRegistry.Application[] memory apps = registry.getBountyApplications(bountyId);
        uint256 appId;
        for (uint256 i = 0; i < apps.length; i++) {
            if (apps[i].builder == builder) { appId = apps[i].id; break; }
        }
        emit ApplicationApproved(bountyId, appId, builder);
    }

    /// @notice Creator rejects an applicant.
    function rejectApplication(uint256 bountyId, address builder)
        external whenNotPaused nonReentrant
    {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (msg.sender != b.creator) revert FactoryNotCreator();
        if (!registry.hasApplied(bountyId, builder)) revert FactoryBuilderHasNotApplied();

        registry.setApplicationApproved(bountyId, builder, false);

        BountyRegistry.Application[] memory apps = registry.getBountyApplications(bountyId);
        uint256 appId;
        for (uint256 i = 0; i < apps.length; i++) {
            if (apps[i].builder == builder) { appId = apps[i].id; break; }
        }
        emit ApplicationRejected(bountyId, appId, builder);
    }

    // ── V4 VIEW: application helpers ─────────────────────────────────────────
    function getBountyApplications(uint256 bountyId)
        external view returns (BountyRegistry.Application[] memory)
    {
        return registry.getBountyApplications(bountyId);
    }

    function getBuilderApplications(address builder)
        external view returns (BountyRegistry.Application[] memory)
    {
        return registry.getBuilderApplications(builder);
    }

    // ── FEATURED BOUNTY ───────────────────────────────────────────────────────
    function setFeatured(uint256 bountyId, bool featured) external payable nonReentrant {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        if (msg.sender != b.creator && msg.sender != owner) revert FactoryNotCreatorOrOwner();
        if (msg.sender != owner) {
            if (msg.value < FEATURED_FEE) revert FactoryInsufficientFeaturedFee();
            NadWorkEscrow(payable(address(escrow))).sweepFees{value: FEATURED_FEE}();
            if (msg.value > FEATURED_FEE) {
                (bool ok,) = msg.sender.call{value: msg.value - FEATURED_FEE, gas: 100_000}("");
                if (!ok) revert FactoryFeeExcessRefundFailed();
            }
        }
        registry.setFeatured(bountyId, featured);
        if (featured) {
            // FIX L-03: emit distinct event so on-chain observers can differentiate
            // owner-comped featuring (no fee paid) from paid featuring.
            if (msg.sender == owner) {
                emit BountyFeaturedByOwner(bountyId);
            } else {
                emit BountyFeatured(bountyId);
            }
        }
    }

    // ── VIEW: get submission stake required for a bounty ─────────────────────
    // V4: no tier multiplier — flat stake for all hunters
    function getSubmissionStake(uint256 bountyId) external view returns (uint256) {
        BountyRegistry.Bounty memory b = registry.getBounty(bountyId);
        return _calcSubmissionStake(b.totalReward);
    }

    // ── VIEW: get creator stake required for a reward amount ──────────────────
    function getCreatorStake(uint256 totalReward) external pure returns (uint256) {
        return _calcCreatorStake(totalReward);
    }

    // ── ADMIN: sweep accumulated fees (denied dispute deposits, etc.) ───────────
    // Protects all four pull-payment pools: dispute refunds, cancel comps, timeout payouts,
    // and submission stake refunds (FIX XC-02+T-01).
    function sweep() external onlyOwner nonReentrant {
        uint256 reserved  = _totalPendingRefunds
                          + _totalPendingCancelComps
                          + _totalPendingTimeoutPayouts
                          + _totalPendingStakeRefunds;
        uint256 bal       = address(this).balance;
        if (bal <= reserved) revert FactoryNothingToSweep();
        uint256 sweepable = bal - reserved;
        (bool ok,) = owner.call{value: sweepable}("");
        if (!ok) revert FactorySweepFailed();
    }

    receive() external payable {}
}
