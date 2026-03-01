import addresses from './addresses.json';

export const ADDRESSES = {
  factory:    import.meta.env.VITE_BOUNTY_FACTORY_ADDRESS      || addresses.BountyFactory      || '',
  registry:   import.meta.env.VITE_BOUNTY_REGISTRY_ADDRESS     || addresses.BountyRegistry     || '',
  escrow:     import.meta.env.VITE_ESCROW_ADDRESS              || addresses.NadWorkEscrow      || '',
  reputation: import.meta.env.VITE_REPUTATION_REGISTRY_ADDRESS || addresses.ReputationRegistry || '',
  identity:   import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS   || addresses.IdentityRegistry   || '',
  usdc:       import.meta.env.VITE_USDC_ADDRESS                || '',
};

// V3: V2 + Fair System (poster stake, submission stake, grace period, tiers)
export const FACTORY_ABI = [
  // createBounty — V3: msg.value = totalReward + posterStake for NATIVE
  'function createBounty(string,string,string,uint8,address,uint256,uint8,uint8[],uint256) payable returns (uint256)',
  // submitWork — V3: msg.value = submissionStake
  'function submitWork(uint256,string) payable returns (uint256)',
  'function approveWinners(uint256,uint256[],uint8[]) external',
  'function rejectSubmission(uint256,uint256) external',
  'function withdrawRejectedStake(uint256,uint256) external',
  'function cancelBounty(uint256) external payable',
  'function expireBounty(uint256) external',
  'function triggerTimeout(uint256) external',
  'function raiseDispute(uint256,uint256) external payable',
  'function resolveDispute(uint256,bool,address) external',
  'function claimDisputeRefund() external',
  'function pendingDisputeRefunds(address) view returns (uint256)',
  'function setFeatured(uint256,bool) external payable',
  // FIX-9: transition bounty to REVIEWING state after deadline
  'function transitionToReviewing(uint256) external',
  // V3 view helpers
  'function getSubmissionStake(uint256) view returns (uint256)',
  'function getPosterStake(uint256) pure returns (uint256)',
  // Constants (pure — Solidity public constant getters are pure, not view)
  'function DISPUTE_DEPOSIT() pure returns (uint256)',
  'function FEATURED_FEE() pure returns (uint256)',
  'function CANCEL_COMP_BPS() pure returns (uint256)',
  'function MAX_WINNERS() pure returns (uint8)',
  'function POSTER_STAKE_BPS() pure returns (uint256)',
  'function MIN_POSTER_STAKE() pure returns (uint256)',
  'function SUBMISSION_STAKE_BPS() pure returns (uint256)',
  'function MIN_SUBMISSION_STAKE() pure returns (uint256)',
  'function MAX_SUBMISSION_STAKE() pure returns (uint256)',
  'function MIN_REVIEW_WINDOW() pure returns (uint256)',
  'function MAX_REVIEW_WINDOW() pure returns (uint256)',
  'function GRACE_PERIOD_REJECT() pure returns (uint256)',
  'function MIN_DURATION() pure returns (uint256)',
  'function MAX_DURATION() pure returns (uint256)',
  // Events
  'event BountyCreated(uint256 indexed bountyId, address indexed poster, uint256 reward)',
  'event WorkSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed hunter)',
  'event WinnersApproved(uint256 indexed bountyId, address[] winners)',
  'event DisputeRaised(uint256 indexed bountyId, uint256 indexed submissionId, address indexed hunter)',
  'event DisputeResolved(uint256 indexed bountyId, bool inFavorOfHunters)',
  'event BountyFeatured(uint256 indexed bountyId)',
  'event BountyCancelled(uint256 indexed bountyId)',
  'event SubmissionStakeRequired(uint256 indexed bountyId, address indexed hunter, uint256 amount)',
  'event BountyEnteredReview(uint256 indexed bountyId, uint256 pendingCount)',
  'event SubmissionRejected(uint256 indexed bountyId, uint256 indexed submissionId, bool inGracePeriod)',
  'event BountyExpired(uint256 indexed bountyId)',
  'event TimeoutTriggered(uint256 indexed bountyId, address triggeredBy)',
  'event DisputeRefundPending(address indexed hunter, uint256 amount)',
  'event PosterStakeSlashedOnCancel(uint256 indexed bountyId, uint256 amount)',
];

// V3 tuple: added reviewDeadline, posterStake to Bounty; gracePeriodExpired, submissionStake to Submission
const BOUNTY_TUPLE = 'tuple(uint256 id, address poster, string ipfsHash, string title, string category, uint8 bountyType, uint8 status, uint8 rewardType, address rewardToken, uint256 totalReward, uint8 winnerCount, uint8[] prizeWeights, uint256 deadline, uint256 createdAt, address[] winners, bool featured, uint256 submissionCount, uint256 reviewDeadline, uint256 posterStake)';
const SUB_TUPLE    = 'tuple(uint256 id, uint256 bountyId, address hunter, string ipfsHash, uint8 status, uint8 rank, uint256 submittedAt, bool disputed, bool gracePeriodExpired, uint256 submissionStake)';

export const REGISTRY_ABI = [
  `function getBounty(uint256) view returns (${BOUNTY_TUPLE})`,
  `function getSubmission(uint256) view returns (${SUB_TUPLE})`,
  `function getBountySubmissions(uint256) view returns (${SUB_TUPLE}[])`,
  'function getPosterBounties(address) view returns (uint256[])',
  `function getHunterSubmissions(address) view returns (${SUB_TUPLE}[])`,
  'function hasSubmitted(uint256,address) view returns (bool)',
  'function bountyCount() view returns (uint256)',
  'function submissionCount() view returns (uint256)',
  `function getAllBounties(uint256,uint256) view returns (${BOUNTY_TUPLE}[],uint256)`,
  `function getActiveBounties(uint256,uint256) view returns (${BOUNTY_TUPLE}[],uint256)`,
  `function getBountiesByCategory(string,uint256,uint256) view returns (${BOUNTY_TUPLE}[],uint256)`,
  `function getFeaturedBounties() view returns (${BOUNTY_TUPLE}[])`,
];

// V3: HunterStats/ProjectStats structs (for typed returns from getHunterStats/getProjectStats)
const HUNTER_STATS_TUPLE  = 'tuple(uint256 submissionCount, uint256 winCount, uint256 totalEarned, uint256 firstActivity, uint256 lastActivity, uint256 fraudCount, uint256 disputeLost)';
const PROJECT_STATS_TUPLE = 'tuple(uint256 bountiesPosted, uint256 bountiesCompleted, uint256 totalPaid, uint256 firstActivity, uint256 lastActivity, uint256 cancelCount, uint256 disputeLost, uint256 fraudCancelCount)';

export const REPUTATION_ABI = [
  // V3: updated structs — hunters has fraudCount+disputeLost; projects has cancelCount+disputeLost+fraudCancelCount
  'function hunters(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
  'function projects(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
  `function getHunterStats(address) view returns (${HUNTER_STATS_TUPLE})`,
  `function getProjectStats(address) view returns (${PROJECT_STATS_TUPLE})`,
  'function getHunterScore(address) view returns (uint256)',
  'function getProjectScore(address) view returns (uint256)',
  'function getWinRate(address) view returns (uint256)',
  'function getCompletionRate(address) view returns (uint256)',
  'function isSuspicious(address,bool) view returns (bool)',
  'event HunterUpdated(address indexed hunter, uint256 winCount, uint256 totalEarned)',
  'event ProjectUpdated(address indexed project, uint256 completed, uint256 totalPaid)',
];

export const IDENTITY_ABI = [
  'function setUsername(string) external',
  'function proposeLink(address) external',
  'function cancelProposal() external',
  'function confirmLink(address) external',
  'function unlinkWallet(address) external',
  'function claimPrimary(address) external',
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

// V2 constants
export const BOUNTY_TYPES  = { 0: 'OPEN' };
export const BOUNTY_STATUS = { 0: 'ACTIVE', 1: 'REVIEWING', 2: 'COMPLETED', 3: 'EXPIRED', 4: 'CANCELLED', 5: 'DISPUTED' };
export const SUB_STATUS    = { 0: 'PENDING', 1: 'APPROVED', 2: 'REJECTED' };
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
export const DISPUTE_DEPOSIT_MON    = 0.01;   // fallback only
export const FEATURED_FEE_MON      = 0.5;    // fallback only
// V3 fallbacks
export const POSTER_STAKE_BPS_DEFAULT      = 500;   // 5%
export const SUBMISSION_STAKE_BPS_DEFAULT  = 100;   // 1%
export const MIN_POSTER_STAKE_MON          = 0.005; // 0.005 MON minimum
export const MIN_SUBMISSION_STAKE_MON      = 0.001; // 0.001 MON minimum
export const MAX_SUBMISSION_STAKE_MON      = 0.1;   // 0.1 MON cap
export const MIN_REVIEW_WINDOW_SECS        = 86400; // 24h
export const GRACE_PERIOD_REJECT_SECS      = 7200;  // 2h
