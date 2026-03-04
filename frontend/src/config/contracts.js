import addresses from './addresses.json';

export const ADDRESSES = {
  factory:    import.meta.env.VITE_BOUNTY_FACTORY_ADDRESS      || addresses.BountyFactory      || '',
  registry:   import.meta.env.VITE_BOUNTY_REGISTRY_ADDRESS     || addresses.BountyRegistry     || '',
  escrow:     import.meta.env.VITE_ESCROW_ADDRESS              || addresses.NadWorkEscrow      || '',
  reputation: import.meta.env.VITE_REPUTATION_REGISTRY_ADDRESS || addresses.ReputationRegistry || '',
  identity:   import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS   || addresses.IdentityRegistry   || '',
  usdc:       import.meta.env.VITE_USDC_ADDRESS                || '',
};

// V4: V3 + Application System (Path B) + 1-tier identity + revised MON-only stakes
export const FACTORY_ABI = [
  // createBounty — V4: added requiresApplication (last param, bool)
  'function createBounty(string,string,string,uint8,address,uint256,uint8,uint8[],uint256,bool) payable returns (uint256)',
  // submitWork — V4: msg.value = submissionStake (no tier multiplier)
  'function submitWork(uint256,string) payable returns (uint256)',
  'function approveWinners(uint256,uint256[],uint8[]) external',
  'function rejectSubmission(uint256,uint256) external',
  'function withdrawRejectedStake(uint256,uint256) external',
  'function cancelBounty(uint256) external payable',
  'function expireBounty(uint256) external',
  'function triggerTimeout(uint256) external',
  'function transitionToReviewing(uint256) external',
  'function raiseDispute(uint256,uint256) external payable',
  'function resolveDispute(uint256,bool,address) external',
  'function claimDisputeRefund() external',
  'function pendingDisputeRefunds(address) view returns (uint256)',
  'function setFeatured(uint256,bool) external payable',
  // V4: Application system
  'function applyToBounty(uint256,string) external',
  'function approveApplication(uint256,address) external',
  'function rejectApplication(uint256,address) external',
  'function getBountyApplications(uint256) view returns (tuple(uint256 id, uint256 bountyId, address builder, string proposalIpfsHash, uint8 status, uint256 appliedAt)[])',
  'function getBuilderApplications(address) view returns (tuple(uint256 id, uint256 bountyId, address builder, string proposalIpfsHash, uint8 status, uint256 appliedAt)[])',
  // V4 view helpers (no tier parameter)
  'function getSubmissionStake(uint256) view returns (uint256)',
  'function getCreatorStake(uint256) view returns (uint256)',
  // Constants — Solidity public constants emit view state-mutability (not pure)
  'function DISPUTE_DEPOSIT() view returns (uint256)',
  'function FEATURED_FEE() view returns (uint256)',
  'function CANCEL_COMP_BPS() view returns (uint256)',
  'function MAX_WINNERS() view returns (uint8)',
  'function CREATOR_STAKE_BPS() view returns (uint256)',
  'function MIN_CREATOR_STAKE() view returns (uint256)',
  'function MAX_CREATOR_STAKE() view returns (uint256)',
  'function SUBMISSION_STAKE_BPS() view returns (uint256)',
  'function MIN_SUBMISSION_STAKE() view returns (uint256)',
  'function MAX_SUBMISSION_STAKE() view returns (uint256)',
  'function MIN_REVIEW_WINDOW() view returns (uint256)',
  'function MAX_REVIEW_WINDOW() view returns (uint256)',
  'function GRACE_PERIOD_REJECT() view returns (uint256)',
  'function MIN_DURATION() view returns (uint256)',
  'function MAX_DURATION() view returns (uint256)',
  // Pull-payment claim functions
  'function claimCancelComp() external',
  'function claimTimeoutPayout() external',
  'function claimStakeRefund() external',
  'function pendingCancelComps(address) view returns (uint256)',
  'function pendingTimeoutPayouts(address) view returns (uint256)',
  'function pendingStakeRefunds(address) view returns (uint256)',
  // Events
  'event BountyCreated(uint256 indexed bountyId, address indexed creator, uint256 reward)',
  'event WorkSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed builder)',
  'event WinnersApproved(uint256 indexed bountyId, address[] winners)',
  'event DisputeRaised(uint256 indexed bountyId, uint256 indexed submissionId, address indexed builder)',
  'event DisputeResolved(uint256 indexed bountyId, bool inFavorOfBuilders)',
  'event BountyFeatured(uint256 indexed bountyId)',
  'event BountyFeaturedByOwner(uint256 indexed bountyId)',
  'event BountyCancelled(uint256 indexed bountyId)',
  'event SubmissionStakeRequired(uint256 indexed bountyId, address indexed builder, uint256 amount)',
  'event BountyEnteredReview(uint256 indexed bountyId, uint256 pendingCount)',
  'event SubmissionRejected(uint256 indexed bountyId, uint256 indexed submissionId, bool inGracePeriod)',
  'event BountyExpired(uint256 indexed bountyId)',
  'event TimeoutTriggered(uint256 indexed bountyId, address triggeredBy)',
  'event DisputeRefundPending(address indexed builder, uint256 amount)',
  'event CreatorStakeSlashedOnCancel(uint256 indexed bountyId, uint256 amount)',
  'event CancelCompPending(uint256 indexed bountyId, address indexed builder, uint256 amount)',
  'event TimeoutPayoutPending(uint256 indexed bountyId, address indexed builder, uint256 amount)',
  'event StakeRefundPending(uint256 indexed bountyId, address indexed builder, uint256 amount)',
  // V4: Application events
  'event ApplicationSubmitted(uint256 indexed bountyId, uint256 indexed appId, address indexed builder)',
  'event ApplicationApproved(uint256 indexed bountyId, uint256 indexed appId, address indexed builder)',
  'event ApplicationRejected(uint256 indexed bountyId, uint256 indexed appId, address indexed builder)',
];

// V4: added requiresApplication field (last, matches Solidity struct append order)
const BOUNTY_TUPLE = 'tuple(uint256 id, address creator, string ipfsHash, string title, string category, uint8 bountyType, uint8 status, uint8 rewardType, address rewardToken, uint256 totalReward, uint8 winnerCount, uint8[] prizeWeights, uint256 deadline, uint256 createdAt, address[] winners, bool featured, uint256 submissionCount, uint256 reviewDeadline, uint256 creatorStake, bool requiresApplication)';
const SUB_TUPLE    = 'tuple(uint256 id, uint256 bountyId, address builder, string ipfsHash, uint8 status, uint8 rank, uint256 submittedAt, bool disputed, bool gracePeriodExpired, uint256 submissionStake, uint256 rejectedAt)';
// V4: Application tuple
const APP_TUPLE    = 'tuple(uint256 id, uint256 bountyId, address builder, string proposalIpfsHash, uint8 status, uint256 appliedAt)';

export const REGISTRY_ABI = [
  `function getBounty(uint256) view returns (${BOUNTY_TUPLE})`,
  `function getSubmission(uint256) view returns (${SUB_TUPLE})`,
  `function getBountySubmissions(uint256) view returns (${SUB_TUPLE}[])`,
  'function getCreatorBounties(address) view returns (uint256[])',
  `function getBuilderSubmissions(address) view returns (${SUB_TUPLE}[])`,
  'function hasSubmitted(uint256,address) view returns (bool)',
  'function bountyCount() view returns (uint256)',
  'function submissionCount() view returns (uint256)',
  `function getAllBounties(uint256,uint256) view returns (${BOUNTY_TUPLE}[],uint256)`,
  `function getActiveBounties(uint256,uint256) view returns (${BOUNTY_TUPLE}[],uint256)`,
  `function getBountiesByCategory(string,uint256,uint256) view returns (${BOUNTY_TUPLE}[],uint256)`,
  `function getFeaturedBounties() view returns (${BOUNTY_TUPLE}[])`,
  // V4: Application views
  'function hasApplied(uint256,address) view returns (bool)',
  'function isApprovedApplicant(uint256,address) view returns (bool)',
  `function getBountyApplications(uint256) view returns (${APP_TUPLE}[])`,
  `function getBuilderApplications(address) view returns (${APP_TUPLE}[])`,
  `function getApplication(uint256) view returns (${APP_TUPLE})`,
];

// V3 reputation structs
const BUILDER_STATS_TUPLE  = 'tuple(uint256 submissionCount, uint256 winCount, uint256 totalEarned, uint256 firstActivity, uint256 lastActivity, uint256 fraudCount, uint256 disputeLost)';
const CREATOR_STATS_TUPLE  = 'tuple(uint256 bountiesPosted, uint256 bountiesCompleted, uint256 totalPaid, uint256 firstActivity, uint256 lastActivity, uint256 cancelCount, uint256 disputeLost, uint256 fraudCancelCount)';

export const REPUTATION_ABI = [
  'function builders(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
  'function creators(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
  `function getBuilderStats(address) view returns (${BUILDER_STATS_TUPLE})`,
  `function getCreatorStats(address) view returns (${CREATOR_STATS_TUPLE})`,
  'function getBuilderScore(address) view returns (uint256)',
  'function getCreatorScore(address) view returns (uint256)',
  'function getWinRate(address) view returns (uint256)',
  'function getCompletionRate(address) view returns (uint256)',
  'function isSuspicious(address,bool) view returns (bool)',
  'event BuilderUpdated(address indexed builder, uint256 winCount, uint256 totalEarned)',
  'event CreatorUpdated(address indexed creator, uint256 completed, uint256 totalPaid)',
];

export const IDENTITY_ABI = [
  'function setUsername(string) external',
  'function proposeLink(address) external',
  'function cancelProposal() external',
  'function confirmLink(address) external',
  'function unlinkWallet(address) external',
  'function claimPrimary(address) external',
  'function initiateClaim(address) external',
  'function finalizeClaim() external',
  'function cancelClaim() external',
  'function getPendingClaim(address) view returns (uint256,address)',
  'function getUsernameCooldownEnd(string) view returns (uint256)',
  'function getPrimary(address) view returns (address)',
  'function getIdentity(address) view returns (string,address,address[],uint256,uint256)',
  'function getUsername(address) view returns (string)',
  'function resolveUsername(string) view returns (address)',
  'function isUsernameAvailable(string, address) view returns (bool)',
  'function getPendingLink(address) view returns (address)',
  'function getIncomingProposal(address) view returns (address)',
  'function MAX_LINKED_WALLETS() view returns (uint256)',
  'event UsernameSet(address indexed wallet, string username)',
  'event UsernameAdminCleared(address indexed wallet, string oldUsername)',
  'event WalletLinkProposed(address indexed primary, address indexed proposed)',
  'event WalletLinkCancelled(address indexed primary, address indexed cancelled)',
  'event WalletLinked(address indexed primary, address indexed linked)',
  'event WalletUnlinked(address indexed primary, address indexed removed)',
  'event PrimaryClaimed(address indexed newPrimary, address indexed oldPrimary)',
];

export const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

export const BOUNTY_TYPES  = { 0: 'OPEN' };
export const BOUNTY_STATUS = { 0: 'ACTIVE', 1: 'REVIEWING', 2: 'COMPLETED', 3: 'EXPIRED', 4: 'CANCELLED', 5: 'DISPUTED' };
export const SUB_STATUS    = { 0: 'PENDING', 1: 'APPROVED', 2: 'REJECTED' };
// V4: Application status enum
export const APP_STATUS    = { 0: 'PENDING', 1: 'APPROVED', 2: 'REJECTED' };
export const REWARD_TYPES  = { 0: 'NATIVE', 1: 'ERC20' };

export const CATEGORIES = ['dev', 'design', 'content', 'growth', 'research', 'audit', 'other'];

export const CATEGORY_LABELS = {
  dev:      'Development',
  design:   'Design',
  content:  'Content',
  growth:   'Growth',
  research: 'Research',
  audit:    'Security Audit',
  other:    'Other',
};

// Fallback constants — always prefer on-chain values fetched at runtime
export const DISPUTE_DEPOSIT_MON    = 0.01;  // fallback only
export const FEATURED_FEE_MON      = 0.5;   // fallback only
// V4 fallbacks (updated from V3)
export const CREATOR_STAKE_BPS_DEFAULT     = 300;    // 3%
export const SUBMISSION_STAKE_BPS_DEFAULT  = 200;    // 2%
export const MIN_CREATOR_STAKE_MON         = 0.01;   // 0.01 MON minimum
export const MAX_CREATOR_STAKE_MON         = 50;     // 50 MON maximum
export const MIN_SUBMISSION_STAKE_MON      = 0.005;  // 0.005 MON minimum
export const MAX_SUBMISSION_STAKE_MON      = 5;      // 5 MON cap
export const MIN_REVIEW_WINDOW_SECS        = 86400;  // 24h
export const GRACE_PERIOD_REJECT_SECS      = 7200;   // 2h
