// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// V4: Application System (Path B) + requiresApplication flag on Bounty.
// registerBounty() has one new parameter at the end.
// All other existing function signatures are unchanged.
contract BountyRegistry {
    enum BountyType   { OPEN }
    enum BountyStatus { ACTIVE, REVIEWING, COMPLETED, EXPIRED, CANCELLED, DISPUTED }
    enum RewardType   { NATIVE, ERC20 }
    enum SubStatus    { PENDING, APPROVED, REJECTED }
    // V4: Application status
    enum AppStatus    { PENDING, APPROVED, REJECTED }

    struct Bounty {
        uint256      id;
        address      creator;
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
        uint256      reviewDeadline;
        uint256      creatorStake;
        // V4: curated project flag — appended at end to preserve ABI ordering
        bool         requiresApplication;
    }

    struct Submission {
        uint256   id;
        uint256   bountyId;
        address   builder;
        string    ipfsHash;
        SubStatus status;
        uint8     rank;
        uint256   submittedAt;
        bool      disputed;
        bool      gracePeriodExpired;
        uint256   submissionStake;
        uint256   rejectedAt;
    }

    // V4: Short proposal submitted before full work
    struct Application {
        uint256   id;
        uint256   bountyId;
        address   builder;
        string    proposalIpfsHash;
        AppStatus status;
        uint256   appliedAt;
    }

    address public owner;
    address public factory;
    uint256 private _bountyCount;
    uint256 private _submissionCount;

    mapping(uint256 => Bounty)     private _bounties;
    mapping(uint256 => Submission) private _submissions;
    mapping(uint256 => uint256[])  private _bountySubmissions;
    mapping(address => uint256[])  private _creatorBounties;
    mapping(address => uint256[])  private _builderSubmissions;
    mapping(uint256 => mapping(address => bool)) private _hasSubmitted;

    // V4: Application state
    uint256 private _applicationCount;
    mapping(uint256 => Application)                      private _applications;
    mapping(uint256 => uint256[])                        private _bountyApplications;
    mapping(address => uint256[])                        private _builderApplications;
    mapping(uint256 => mapping(address => bool))         private _hasApplied;
    mapping(uint256 => mapping(address => bool))         private _isApprovedApplicant;

    // ── Events ────────────────────────────────────────────────────────────────
    event BountyRegistered(uint256 indexed bountyId, address indexed creator, uint256 reward);
    event SubmissionAdded(uint256 indexed bountyId, uint256 indexed submissionId, address indexed builder);
    event WinnersSet(uint256 indexed bountyId, address[] winners);
    event BountyStatusUpdated(uint256 indexed bountyId, BountyStatus status);
    event BountyFeatured(uint256 indexed bountyId, bool featured);
    event FactorySet(address indexed factory);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    // V4
    event ApplicationAdded(uint256 indexed bountyId, uint256 indexed appId, address indexed builder);
    event ApplicationStatusUpdated(uint256 indexed appId, AppStatus status);

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

    // V4: added requiresApplication parameter (last, to not break older ABI readers)
    function registerBounty(
        address creator, string calldata ipfsHash, string calldata title,
        string calldata category, RewardType rewardType,
        address rewardToken, uint256 totalReward, uint8 winnerCount,
        uint8[] calldata prizeWeights, uint256 deadline,
        uint256 reviewDeadline, uint256 creatorStake,
        bool requiresApplication
    ) external onlyFactory returns (uint256 bountyId) {
        bountyId = ++_bountyCount;
        Bounty storage b = _bounties[bountyId];
        b.id = bountyId; b.creator = creator; b.ipfsHash = ipfsHash;
        b.title = title; b.category = category; b.bountyType = BountyType.OPEN;
        b.status = BountyStatus.ACTIVE; b.rewardType = rewardType;
        b.rewardToken = rewardToken; b.totalReward = totalReward;
        b.winnerCount = winnerCount; b.prizeWeights = prizeWeights;
        b.deadline = deadline; b.createdAt = block.timestamp;
        b.reviewDeadline = reviewDeadline;
        b.creatorStake = creatorStake;
        b.requiresApplication = requiresApplication;
        _creatorBounties[creator].push(bountyId);
        emit BountyRegistered(bountyId, creator, totalReward);
    }

    function addSubmission(uint256 bountyId, address builder, string calldata ipfsHash, uint256 submissionStake)
        external onlyFactory returns (uint256 submissionId)
    {
        Bounty storage b = _bounties[bountyId];
        require(b.id != 0, "Registry: bounty not found");
        require(!_hasSubmitted[bountyId][builder], "Registry: already submitted");
        submissionId = ++_submissionCount;
        Submission storage s = _submissions[submissionId];
        s.id = submissionId; s.bountyId = bountyId; s.builder = builder;
        s.ipfsHash = ipfsHash; s.status = SubStatus.PENDING;
        s.submittedAt = block.timestamp;
        s.submissionStake = submissionStake;
        _bountySubmissions[bountyId].push(submissionId);
        _builderSubmissions[builder].push(submissionId);
        _hasSubmitted[bountyId][builder] = true;
        b.submissionCount++;
        emit SubmissionAdded(bountyId, submissionId, builder);
    }

    // ── V4: Application management ────────────────────────────────────────────

    function addApplication(
        uint256 bountyId, address builder, string calldata proposalIpfsHash
    ) external onlyFactory returns (uint256 appId) {
        require(_bounties[bountyId].id != 0, "Registry: bounty not found");
        require(!_hasApplied[bountyId][builder],  "Registry: already applied");
        appId = ++_applicationCount;
        Application storage a = _applications[appId];
        a.id               = appId;
        a.bountyId         = bountyId;
        a.builder          = builder;
        a.proposalIpfsHash = proposalIpfsHash;
        a.status           = AppStatus.PENDING;
        a.appliedAt        = block.timestamp;
        _bountyApplications[bountyId].push(appId);
        _builderApplications[builder].push(appId);
        _hasApplied[bountyId][builder] = true;
        emit ApplicationAdded(bountyId, appId, builder);
    }

    /// @dev Linear scan is acceptable: typical curated bounty has < 50 applicants.
    function setApplicationApproved(
        uint256 bountyId, address builder, bool approved
    ) external onlyFactory {
        _isApprovedApplicant[bountyId][builder] = approved;
        AppStatus newStatus = approved ? AppStatus.APPROVED : AppStatus.REJECTED;
        uint256[] storage ids = _bountyApplications[bountyId];
        for (uint256 i = 0; i < ids.length; i++) {
            if (_applications[ids[i]].builder == builder) {
                _applications[ids[i]].status = newStatus;
                emit ApplicationStatusUpdated(ids[i], newStatus);
                break;
            }
        }
    }

    // ── Existing mutation functions ───────────────────────────────────────────

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
            winners[i] = s.builder;
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

    // ── View functions ────────────────────────────────────────────────────────

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

    function getCreatorBounties(address creator) external view returns (uint256[] memory) {
        return _creatorBounties[creator];
    }

    function getBuilderSubmissions(address builder) external view returns (Submission[] memory) {
        uint256[] storage ids = _builderSubmissions[builder];
        Submission[] memory result = new Submission[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) result[i] = _submissions[ids[i]];
        return result;
    }

    function hasSubmitted(uint256 bountyId, address builder) external view returns (bool) {
        return _hasSubmitted[bountyId][builder];
    }

    // V4: Application views
    function hasApplied(uint256 bountyId, address builder) external view returns (bool) {
        return _hasApplied[bountyId][builder];
    }

    function isApprovedApplicant(uint256 bountyId, address builder) external view returns (bool) {
        return _isApprovedApplicant[bountyId][builder];
    }

    function getBountyApplications(uint256 bountyId)
        external view returns (Application[] memory)
    {
        uint256[] storage ids = _bountyApplications[bountyId];
        Application[] memory result = new Application[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) result[i] = _applications[ids[i]];
        return result;
    }

    function getBuilderApplications(address builder)
        external view returns (Application[] memory)
    {
        uint256[] storage ids = _builderApplications[builder];
        Application[] memory result = new Application[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) result[i] = _applications[ids[i]];
        return result;
    }

    function getApplication(uint256 appId) external view returns (Application memory) {
        require(_applications[appId].id != 0, "Registry: application not found");
        return _applications[appId];
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
        for (uint256 i = 0; i < size; i++) {
            result[i] = _bounties[total - offset - i];
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
        for (uint256 i = _bountyCount; i > 0 && filled < size; i--) {
            uint256 id = i;
            if (_bounties[id].status == BountyStatus.ACTIVE) {
                if (seen >= offset) { result[filled] = _bounties[id]; filled++; }
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
        for (uint256 i = _bountyCount; i > 0 && filled < size; i--) {
            uint256 id = i;
            if (keccak256(bytes(_bounties[id].category)) == catHash) {
                if (seen >= offset) { result[filled] = _bounties[id]; filled++; }
                seen++;
            }
        }
    }

    function getFeaturedBounties() external view returns (Bounty[] memory result) {
        uint256 count = 0;
        for (uint256 i = 1; i <= _bountyCount; i++)
            if (_bounties[i].featured && _bounties[i].status == BountyStatus.ACTIVE) count++;
        result = new Bounty[](count);
        uint256 idx = 0;
        for (uint256 i = _bountyCount; i > 0 && idx < count; i--) {
            uint256 id = i;
            if (_bounties[id].featured && _bounties[id].status == BountyStatus.ACTIVE)
                result[idx++] = _bounties[id];
        }
    }
}
