// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BountyRegistry {
    // FIRST_COME removed in V2 — all bounties are Open (poster reviews and selects winners)
    enum BountyType   { OPEN }
    enum BountyStatus { ACTIVE, REVIEWING, COMPLETED, EXPIRED, CANCELLED, DISPUTED }
    enum RewardType   { NATIVE, ERC20 }
    enum SubStatus    { PENDING, APPROVED, REJECTED }

    struct Bounty {
        uint256      id;
        address      poster;
        string       ipfsHash;
        string       title;
        string       category;
        BountyType   bountyType;
        BountyStatus status;
        RewardType   rewardType;
        address      rewardToken;
        uint256      totalReward;
        uint8        winnerCount;
        uint8[]      prizeWeights;
        uint256      deadline;
        uint256      createdAt;
        address[]    winners;
        bool         featured;
        uint256      submissionCount;
        // V3 Fair System: review window fields
        uint256      reviewDeadline;  // when review window ends (auto-timeout after this)
        uint256      posterStake;     // poster's stake amount locked alongside reward
    }

    struct Submission {
        uint256   id;
        uint256   bountyId;
        address   hunter;
        string    ipfsHash;
        SubStatus status;
        uint8     rank;
        uint256   submittedAt;
        bool      disputed;
        // V3 Fair System: grace period tracking
        bool      gracePeriodExpired; // true if poster rejected after the 2-hour grace window
        uint256   submissionStake;    // hunter's stake amount for this submission
        // FIX C-01: track when poster actually rejected, so dispute window is fair
        uint256   rejectedAt;         // timestamp of rejectSubmission() call; 0 if not yet rejected
    }

    address public owner;
    address public factory;
    uint256 private _bountyCount;
    uint256 private _submissionCount;

    mapping(uint256 => Bounty)     private _bounties;
    mapping(uint256 => Submission) private _submissions;
    mapping(uint256 => uint256[])  private _bountySubmissions;
    mapping(address => uint256[])  private _posterBounties;
    mapping(address => uint256[])  private _hunterSubmissions;
    mapping(uint256 => mapping(address => bool)) private _hasSubmitted;

    event BountyRegistered(uint256 indexed bountyId, address indexed poster, uint256 reward);
    event SubmissionAdded(uint256 indexed bountyId, uint256 indexed submissionId, address indexed hunter);
    event WinnersSet(uint256 indexed bountyId, address[] winners);
    event BountyStatusUpdated(uint256 indexed bountyId, BountyStatus status);
    event BountyFeatured(uint256 indexed bountyId, bool featured);
    event FactorySet(address indexed factory);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner()   { require(msg.sender == owner,   "Registry: not owner");   _; }
    modifier onlyFactory() { require(msg.sender == factory, "Registry: not factory"); _; }

    constructor() { owner = msg.sender; }

    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Registry: zero address");
        factory = _factory;
        emit FactorySet(_factory);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Registry: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setFeatured(uint256 bountyId, bool featured) external onlyFactory {
        Bounty storage b = _bounties[bountyId];
        require(b.id != 0, "Registry: not found");
        b.featured = featured;
        emit BountyFeatured(bountyId, featured);
    }

    function registerBounty(
        address poster, string calldata ipfsHash, string calldata title,
        string calldata category, RewardType rewardType,
        address rewardToken, uint256 totalReward, uint8 winnerCount,
        uint8[] calldata prizeWeights, uint256 deadline,
        uint256 reviewDeadline, uint256 posterStake
    ) external onlyFactory returns (uint256 bountyId) {
        bountyId = ++_bountyCount;
        Bounty storage b = _bounties[bountyId];
        b.id = bountyId; b.poster = poster; b.ipfsHash = ipfsHash;
        b.title = title; b.category = category; b.bountyType = BountyType.OPEN;
        b.status = BountyStatus.ACTIVE; b.rewardType = rewardType;
        b.rewardToken = rewardToken; b.totalReward = totalReward;
        b.winnerCount = winnerCount; b.prizeWeights = prizeWeights;
        b.deadline = deadline; b.createdAt = block.timestamp;
        b.reviewDeadline = reviewDeadline;
        b.posterStake = posterStake;
        _posterBounties[poster].push(bountyId);
        emit BountyRegistered(bountyId, poster, totalReward);
    }

    function addSubmission(uint256 bountyId, address hunter, string calldata ipfsHash, uint256 submissionStake)
        external onlyFactory returns (uint256 submissionId)
    {
        Bounty storage b = _bounties[bountyId];
        require(b.id != 0, "Registry: bounty not found");
        require(!_hasSubmitted[bountyId][hunter], "Registry: already submitted");
        submissionId = ++_submissionCount;
        Submission storage s = _submissions[submissionId];
        s.id = submissionId; s.bountyId = bountyId; s.hunter = hunter;
        s.ipfsHash = ipfsHash; s.status = SubStatus.PENDING;
        s.submittedAt = block.timestamp;
        s.submissionStake = submissionStake;
        _bountySubmissions[bountyId].push(submissionId);
        _hunterSubmissions[hunter].push(submissionId);
        _hasSubmitted[bountyId][hunter] = true;
        b.submissionCount++;
        emit SubmissionAdded(bountyId, submissionId, hunter);
    }

    function setWinners(uint256 bountyId, uint256[] calldata submissionIds, uint8[] calldata ranks)
        external onlyFactory
    {
        require(submissionIds.length == ranks.length, "Registry: length mismatch");
        Bounty storage b = _bounties[bountyId];
        require(b.id != 0, "Registry: bounty not found");
        address[] memory winners = new address[](submissionIds.length);
        for (uint256 i = 0; i < submissionIds.length; i++) {
            Submission storage s = _submissions[submissionIds[i]];
            require(s.bountyId == bountyId, "Registry: wrong bounty");
            require(s.status == SubStatus.PENDING, "Registry: already decided");
            s.status = SubStatus.APPROVED; s.rank = ranks[i];
            winners[i] = s.hunter;
        }
        b.winners = winners; b.status = BountyStatus.COMPLETED;
        emit WinnersSet(bountyId, winners);
        emit BountyStatusUpdated(bountyId, BountyStatus.COMPLETED);
    }

    function rejectSubmission(uint256 submissionId) external onlyFactory {
        Submission storage s = _submissions[submissionId];
        require(s.id != 0, "Registry: not found");
        require(s.status == SubStatus.PENDING, "Registry: not pending");
        s.status     = SubStatus.REJECTED;
        // FIX C-01: record rejection timestamp so dispute window is measured from here
        s.rejectedAt = block.timestamp;
    }

    function markGracePeriodExpired(uint256 submissionId) external onlyFactory {
        Submission storage s = _submissions[submissionId];
        require(s.id != 0, "Registry: not found");
        s.gracePeriodExpired = true;
    }

    function markDisputed(uint256 submissionId) external onlyFactory {
        Submission storage s = _submissions[submissionId];
        require(s.id != 0, "Registry: not found");
        require(s.status == SubStatus.REJECTED, "Registry: must be rejected to dispute");
        s.disputed = true;
    }

    function updateBountyStatus(uint256 bountyId, BountyStatus status) external onlyFactory {
        Bounty storage b = _bounties[bountyId];
        require(b.id != 0, "Registry: not found");
        b.status = status;
        emit BountyStatusUpdated(bountyId, status);
    }

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        require(_bounties[bountyId].id != 0, "Registry: not found");
        return _bounties[bountyId];
    }

    function getSubmission(uint256 submissionId) external view returns (Submission memory) {
        require(_submissions[submissionId].id != 0, "Registry: not found");
        return _submissions[submissionId];
    }

    function getBountySubmissions(uint256 bountyId) external view returns (Submission[] memory) {
        uint256[] storage ids = _bountySubmissions[bountyId];
        Submission[] memory result = new Submission[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) result[i] = _submissions[ids[i]];
        return result;
    }

    function getPosterBounties(address poster) external view returns (uint256[] memory) {
        return _posterBounties[poster];
    }

    function getHunterSubmissions(address hunter) external view returns (Submission[] memory) {
        uint256[] storage ids = _hunterSubmissions[hunter];
        Submission[] memory result = new Submission[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) result[i] = _submissions[ids[i]];
        return result;
    }

    function hasSubmitted(uint256 bountyId, address hunter) external view returns (bool) {
        return _hasSubmitted[bountyId][hunter];
    }

    function bountyCount()     external view returns (uint256) { return _bountyCount; }
    function submissionCount() external view returns (uint256) { return _submissionCount; }

    function getAllBounties(uint256 offset, uint256 limit)
        external view returns (Bounty[] memory result, uint256 total)
    {
        total = _bountyCount;
        if (offset >= total) return (new Bounty[](0), total);
        uint256 size = (total - offset) < limit ? (total - offset) : limit;
        result = new Bounty[](size);
        // FIX M-02: IDs are 1-based; compute index as (total - offset - i) which is always >= 1
        // when offset < total and i < size = (total - offset), so no underflow to ID 0.
        for (uint256 i = 0; i < size; i++) {
            uint256 id = total - offset - i; // guaranteed >= 1
            result[i] = _bounties[id];
        }
    }

    function getActiveBounties(uint256 offset, uint256 limit)
        external view returns (Bounty[] memory result, uint256 total)
    {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= _bountyCount; i++)
            if (_bounties[i].status == BountyStatus.ACTIVE) activeCount++;
        total = activeCount;
        if (offset >= activeCount) return (new Bounty[](0), total);
        uint256 size = (activeCount - offset) < limit ? (activeCount - offset) : limit;
        result = new Bounty[](size);
        uint256 seen = 0; uint256 filled = 0;
        for (uint256 i = _bountyCount; i >= 1 && filled < size; i--) {
            if (_bounties[i].status == BountyStatus.ACTIVE) {
                if (seen >= offset) { result[filled] = _bounties[i]; filled++; }
                seen++;
            }
        }
    }

    function getBountiesByCategory(string calldata category, uint256 offset, uint256 limit)
        external view returns (Bounty[] memory result, uint256 total)
    {
        bytes32 catHash = keccak256(bytes(category));
        uint256 catCount = 0;
        for (uint256 i = 1; i <= _bountyCount; i++)
            if (keccak256(bytes(_bounties[i].category)) == catHash) catCount++;
        total = catCount;
        if (offset >= catCount) return (new Bounty[](0), total);
        uint256 size = (catCount - offset) < limit ? (catCount - offset) : limit;
        result = new Bounty[](size);
        uint256 seen = 0; uint256 filled = 0;
        for (uint256 i = _bountyCount; i >= 1 && filled < size; i--) {
            if (keccak256(bytes(_bounties[i].category)) == catHash) {
                if (seen >= offset) { result[filled] = _bounties[i]; filled++; }
                seen++;
            }
        }
    }

    // Returns featured bounties first, then rest — for frontend sorting
    function getFeaturedBounties() external view returns (Bounty[] memory result) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _bountyCount; i++)
            if (_bounties[i].featured && _bounties[i].status == BountyStatus.ACTIVE) count++;
        result = new Bounty[](count);
        uint256 idx = 0;
        for (uint256 i = _bountyCount; i >= 1 && idx < count; i--)
            if (_bounties[i].featured && _bounties[i].status == BountyStatus.ACTIVE)
                result[idx++] = _bounties[i];
    }
}
