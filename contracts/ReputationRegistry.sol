// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IdentityRegistry.sol";

contract ReputationRegistry {
    address public owner;
    address public factory;
    IdentityRegistry public identity;

    struct BuilderStats {
        uint256 submissionCount;
        uint256 winCount;
        uint256 totalEarned;
        uint256 firstActivity;
        uint256 lastActivity;
        // V3 Fair System: fraud tracking
        uint256 fraudCount;    // times proven spam/plagiarism
        uint256 disputeLost;   // times dispute ruled against builder
    }

    struct CreatorStats {
        uint256 bountiesPosted;
        uint256 bountiesCompleted;
        uint256 totalPaid;
        uint256 firstActivity;
        uint256 lastActivity;
        // V3 Fair System: fraud tracking
        uint256 cancelCount;       // cancels after submissions existed
        uint256 disputeLost;       // times dispute ruled against creator
        uint256 fraudCancelCount;  // cancels confirmed fraudulent (dispute won by builder)
    }

    mapping(address => BuilderStats)  public builders;
    mapping(address => CreatorStats) public creators;

    event BuilderUpdated(address indexed builder, uint256 winCount, uint256 totalEarned);
    event CreatorUpdated(address indexed creator, uint256 completed, uint256 totalPaid);
    event FactorySet(address indexed factory);
    event IdentitySet(address indexed identity);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner()   { require(msg.sender == owner,   "Reputation: not owner");   _; }
    modifier onlyFactory() { require(msg.sender == factory, "Reputation: not factory"); _; }

    constructor() { owner = msg.sender; }

    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Reputation: zero address");
        factory = _factory;
        emit FactorySet(_factory);
    }

    /**
     * @notice Wire the IdentityRegistry so score lookups resolve through primary wallet.
     *         Optional — if not set, each wallet is treated as its own primary (backward compatible).
     */
    function setIdentity(address _identity) external onlyOwner {
        require(_identity != address(0), "Reputation: zero address");
        identity = IdentityRegistry(_identity);
        emit IdentitySet(_identity);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Reputation: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function recordSubmission(address builder) external onlyFactory {
        address primary = _resolvePrimary(builder);
        BuilderStats storage h = builders[primary];
        h.submissionCount++;
        if (h.firstActivity == 0) h.firstActivity = block.timestamp;
        h.lastActivity = block.timestamp;
    }

    function recordWin(address builder, uint256 amount, address /* creator */) external onlyFactory {
        address primary = _resolvePrimary(builder);
        BuilderStats storage h = builders[primary];
        h.winCount++;
        h.totalEarned += amount;
        if (h.firstActivity == 0) h.firstActivity = block.timestamp;
        h.lastActivity = block.timestamp;
        emit BuilderUpdated(primary, h.winCount, h.totalEarned);
    }

    function recordBountyPosted(address creator, uint256 /* totalReward */) external onlyFactory {
        address primary = _resolvePrimary(creator);
        CreatorStats storage p = creators[primary];
        p.bountiesPosted++;
        if (p.firstActivity == 0) p.firstActivity = block.timestamp;
        p.lastActivity = block.timestamp;
    }

    function recordBountyCompleted(address creator, uint256 amountPaid) external onlyFactory {
        address primary = _resolvePrimary(creator);
        CreatorStats storage p = creators[primary];
        p.bountiesCompleted++;
        p.totalPaid += amountPaid;
        p.lastActivity = block.timestamp;
        emit CreatorUpdated(primary, p.bountiesCompleted, p.totalPaid);
    }

    // V3: Record fraud / dispute outcomes

    function recordFraudSubmission(address builder) external onlyFactory {
        address primary = _resolvePrimary(builder);
        builders[primary].fraudCount++;
        builders[primary].lastActivity = block.timestamp;
    }

    function recordFraudCancel(address creator) external onlyFactory {
        address primary = _resolvePrimary(creator);
        creators[primary].fraudCancelCount++;
        creators[primary].lastActivity = block.timestamp;
    }

    function recordCancelWithSubmissions(address creator) external onlyFactory {
        address primary = _resolvePrimary(creator);
        creators[primary].cancelCount++;
        creators[primary].lastActivity = block.timestamp;
    }

    function recordDisputeLost(address addr, bool isBuilder) external onlyFactory {
        address primary = _resolvePrimary(addr);
        if (isBuilder) {
            builders[primary].disputeLost++;
            // FIX RR-1: update lastActivity so the score change is reflected in activity timeline
            builders[primary].lastActivity = block.timestamp;
        } else {
            creators[primary].disputeLost++;
            // FIX RR-1: same fix for creator side
            creators[primary].lastActivity = block.timestamp;
        }
    }

    /**
     * @dev Resolve an address to its primary wallet via IdentityRegistry.
     *      Falls back to the address itself if IdentityRegistry is not wired.
     */
    function _resolvePrimary(address addr) internal view returns (address) {
        if (address(identity) == address(0)) return addr;
        return identity.getPrimary(addr);
    }

    function getBuilderScore(address builder) external view returns (uint256) {
        address primary = _resolvePrimary(builder);
        BuilderStats memory h = builders[primary];
        uint256 positive = (h.winCount * 30) + (h.submissionCount * 5) + (h.totalEarned / 1e15);
        uint256 penalty  = (h.fraudCount * 50) + (h.disputeLost * 15);
        return positive > penalty ? positive - penalty : 0;
    }

    function getCreatorScore(address creator) external view returns (uint256) {
        address primary = _resolvePrimary(creator);
        CreatorStats memory p = creators[primary];
        if (p.bountiesPosted == 0) return 0;
        uint256 positive = ((p.bountiesCompleted * 100) / p.bountiesPosted) * 10 + p.bountiesPosted;
        uint256 penalty  = (p.fraudCancelCount * 100) + (p.cancelCount * 20) + (p.disputeLost * 30);
        return positive > penalty ? positive - penalty : 0;
    }

    // Returns true if the address has a suspicious fraud record
    function isSuspicious(address addr, bool isBuilder) external view returns (bool) {
        address primary = _resolvePrimary(addr);
        if (isBuilder) {
            BuilderStats memory h = builders[primary];
            return h.fraudCount > 0 || h.disputeLost >= 3;
        } else {
            CreatorStats memory p = creators[primary];
            return p.fraudCancelCount > 0 || p.cancelCount >= 3;
        }
    }

    function getBuilderStats(address builder) external view returns (BuilderStats memory) {
        return builders[_resolvePrimary(builder)];
    }

    function getCreatorStats(address creator) external view returns (CreatorStats memory) {
        return creators[_resolvePrimary(creator)];
    }

    function getWinRate(address builder) external view returns (uint256) {
        address primary = _resolvePrimary(builder);
        BuilderStats memory h = builders[primary];
        if (h.submissionCount == 0) return 0;
        return (h.winCount * 100) / h.submissionCount;
    }

    function getCompletionRate(address creator) external view returns (uint256) {
        address primary = _resolvePrimary(creator);
        CreatorStats memory p = creators[primary];
        if (p.bountiesPosted == 0) return 0;
        return (p.bountiesCompleted * 100) / p.bountiesPosted;
    }
}
