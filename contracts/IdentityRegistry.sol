// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IdentityRegistry
 * @notice On-chain identity system for NadWork. Allows users to:
 *   1. Set a human-readable username (e.g. "alice") tied to their wallet
 *   2. Link backup wallets to their primary identity
 *   3. Recover their identity if the primary wallet is lost (by claiming
 *      primary from a pre-linked backup wallet)
 *
 * All reputation data in ReputationRegistry is stored under the *primary*
 * wallet address. getPrimary() resolves any wallet to its canonical primary,
 * so history is automatically aggregated after a wallet switch.
 *
 * Two-step wallet linking (propose + confirm) ensures both wallets have signed
 * a transaction, preventing griefing attacks where a random address is forcibly
 * linked to someone else's identity.
 */
contract IdentityRegistry {
    address public owner;

    // ── Structs ───────────────────────────────────────────────────────────────

    struct Identity {
        string   username;        // human-readable handle, unique per wallet
        address  primaryWallet;   // canonical address used for reputation storage
        address[] linkedWallets;  // additional wallets controlled by same user
        uint256  createdAt;
        uint256  updatedAt;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    // wallet address → their identity record
    mapping(address => Identity) private _identities;

    // username (lowercase) → wallet address that owns it; zero = unclaimed
    mapping(string => address) private _usernameTaken;

    // wallet B → wallet A: means "B is a linked wallet whose primary is A"
    // If not set (address(0)), the wallet IS its own primary.
    mapping(address => address) private _primaryOf;

    // Pending link proposals: proposer → proposed new wallet
    // wallet A proposes to add wallet B → _pendingLink[A] = B
    mapping(address => address) private _pendingLink;

    // Reverse lookup: proposed wallet → primary that proposed it
    // wallet B was proposed by wallet A → _proposedBy[B] = A
    mapping(address => address) private _proposedBy;

    // ── Constants ─────────────────────────────────────────────────────────────

    uint256 public constant MAX_LINKED_WALLETS = 1;

    // ── Events ────────────────────────────────────────────────────────────────

    event UsernameSet(address indexed wallet, string username);
    event UsernameAdminCleared(address indexed wallet, string oldUsername);
    event WalletLinkProposed(address indexed primary, address indexed proposed);
    event WalletLinkCancelled(address indexed primary, address indexed cancelled);
    event WalletLinked(address indexed primary, address indexed linked);
    event WalletUnlinked(address indexed primary, address indexed removed);
    event PrimaryClaimed(address indexed newPrimary, address indexed oldPrimary);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Identity: not owner");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Identity: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── Username Management ───────────────────────────────────────────────────

    /**
     * @notice Claim a permanent username. Once set, it CANNOT be changed or cleared.
     *         Must be 1–32 chars, lowercase alphanumeric + hyphen, globally unique.
     *         Must be called from the primary wallet directly.
     *
     * Design rationale: immutable usernames tie reputation permanently to an identity.
     *   A user who earned reputation as "alice" cannot rebrand as "bob" to mislead others,
     *   and no one can snipe a released username to inherit its reputation history.
     */
    function setUsername(string calldata username) external {
        // Only the primary wallet may claim a username.
        require(_primaryOf[msg.sender] == address(0), "Identity: must call from primary wallet");
        address caller = msg.sender;

        // Username is permanent — cannot be set again once claimed.
        require(bytes(_identities[caller].username).length == 0, "Identity: username already set and cannot be changed");

        require(bytes(username).length >= 3,  "Identity: username too short (min 3 chars)");
        require(bytes(username).length <= 32, "Identity: username too long (max 32 chars)");
        string memory lower = _toLower(username);
        require(_isValidUsername(lower), "Identity: invalid characters (a-z, 0-9, hyphen only)");
        require(_usernameTaken[lower] == address(0), "Identity: username taken");

        _usernameTaken[lower]          = caller;
        _identities[caller].username   = lower;
        _identities[caller].updatedAt  = block.timestamp;
        if (_identities[caller].createdAt == 0) {
            _identities[caller].createdAt    = block.timestamp;
            _identities[caller].primaryWallet = caller;
        }

        emit UsernameSet(caller, lower);
    }

    // ── Wallet Linking ────────────────────────────────────────────────────────

    /**
     * @notice Step 1 — Primary wallet proposes to link a new backup wallet.
     *         The proposed wallet must then call confirmLink() to complete.
     *         Must be called directly by the primary wallet (not a linked wallet).
     *         Maximum of MAX_LINKED_WALLETS (1) backup wallet allowed per identity.
     *         Cannot overwrite an existing pending proposal — cancel it first.
     * @param newWallet Address of the wallet to add as a backup.
     */
    function proposeLink(address newWallet) external {
        require(_primaryOf[msg.sender] == address(0), "Identity: must call from primary wallet");
        require(newWallet != address(0),              "Identity: zero address");
        require(newWallet != msg.sender,              "Identity: cannot link self");
        require(_primaryOf[newWallet] == address(0),  "Identity: wallet already linked to another identity");
        require(newWallet != owner,                   "Identity: cannot link owner address");
        require(
            _identities[msg.sender].linkedWallets.length < MAX_LINKED_WALLETS,
            "Identity: maximum linked wallets reached (max 1)"
        );
        // Disallow silently overwriting an existing pending proposal.
        // The proposer must cancel first to avoid confusing the previously-proposed wallet.
        require(_pendingLink[msg.sender] == address(0), "Identity: pending proposal already exists, cancel it first");

        _pendingLink[msg.sender] = newWallet;
        _proposedBy[newWallet]   = msg.sender;
        emit WalletLinkProposed(msg.sender, newWallet);
    }

    /**
     * @notice Cancel an existing pending link proposal.
     *         Must be called by the primary wallet that originally proposed.
     */
    function cancelProposal() external {
        require(_primaryOf[msg.sender] == address(0), "Identity: must call from primary wallet");
        address proposed = _pendingLink[msg.sender];
        require(proposed != address(0), "Identity: no pending proposal");
        delete _pendingLink[msg.sender];
        delete _proposedBy[proposed];
        emit WalletLinkCancelled(msg.sender, proposed);
    }

    /**
     * @notice Step 2 — Backup wallet confirms the link proposed by primaryWallet.
     *         After this, both wallets are associated under the same identity and
     *         getPrimary(msg.sender) will return primaryWallet.
     * @param primaryWallet Address that called proposeLink() earlier.
     */
    function confirmLink(address primaryWallet) external {
        require(_pendingLink[primaryWallet] == msg.sender, "Identity: no pending proposal from that primary");
        require(_primaryOf[msg.sender] == address(0),      "Identity: already linked to another primary");
        // Prevent a wallet that already has linked wallets (i.e. is someone else's primary)
        // from becoming a secondary. That would create circular/ambiguous references.
        require(_identities[msg.sender].linkedWallets.length == 0, "Identity: wallet already has linked wallets, cannot become secondary");
        // Re-check limit atomically (prevents TOCTOU if primary linked wallets changed between propose and confirm)
        require(
            _identities[primaryWallet].linkedWallets.length < MAX_LINKED_WALLETS,
            "Identity: maximum linked wallets reached (max 1)"
        );

        _primaryOf[msg.sender] = primaryWallet;

        // Register this wallet in the primary's linked list
        _identities[primaryWallet].linkedWallets.push(msg.sender);
        _identities[primaryWallet].updatedAt = block.timestamp;

        // Ensure the primary has its own createdAt
        if (_identities[primaryWallet].createdAt == 0) {
            _identities[primaryWallet].createdAt    = block.timestamp;
            _identities[primaryWallet].primaryWallet = primaryWallet;
        }

        delete _pendingLink[primaryWallet];
        delete _proposedBy[msg.sender];
        emit WalletLinked(primaryWallet, msg.sender);
    }

    /**
     * @notice Remove a linked wallet from your identity.
     *         Two authorized callers:
     *         (A) The primary wallet can remove any of its linked wallets.
     *         (B) A linked wallet can remove itself (self-unlink) by passing its own address.
     * @param linkedWallet The wallet to unlink.
     */
    function unlinkWallet(address linkedWallet) external {
        address actualPrimary;

        if (_primaryOf[msg.sender] == address(0)) {
            // Case A: caller is a primary wallet. It may remove any linked wallet.
            actualPrimary = msg.sender;
            require(_primaryOf[linkedWallet] == actualPrimary, "Identity: wallet not linked to you");
        } else {
            // Case B: caller is a linked wallet removing itself.
            require(linkedWallet == msg.sender, "Identity: linked wallet can only unlink itself");
            actualPrimary = _primaryOf[msg.sender];
        }

        delete _primaryOf[linkedWallet];

        // Remove from the primary's linkedWallets array (swap-and-pop)
        address[] storage lw = _identities[actualPrimary].linkedWallets;
        for (uint256 i = 0; i < lw.length; i++) {
            if (lw[i] == linkedWallet) {
                lw[i] = lw[lw.length - 1];
                lw.pop();
                break;
            }
        }
        _identities[actualPrimary].updatedAt = block.timestamp;
        emit WalletUnlinked(actualPrimary, linkedWallet);
    }

    // ── Primary Recovery ──────────────────────────────────────────────────────

    /**
     * @notice If your old primary wallet is lost, use a pre-linked backup wallet
     *         to claim primary status. After this call, msg.sender becomes the
     *         new primary wallet for the identity. ReputationRegistry lookups
     *         will use msg.sender as the canonical address going forward, while
     *         all historical on-chain data from the old primary is still accessible
     *         via its raw address.
     *
     *         Requires: msg.sender was previously linked to lostPrimary via
     *         proposeLink + confirmLink.
     *
     * @param lostPrimary The old primary wallet address to take over from.
     */
    function claimPrimary(address lostPrimary) external {
        require(lostPrimary != address(0), "Identity: zero address");
        require(_primaryOf[msg.sender] == lostPrimary, "Identity: not linked to that wallet");

        // The caller is now its own primary
        _primaryOf[msg.sender] = address(0);

        // Transfer username (if any) to the new primary.
        // The username is immutable once set, so we only re-point the lookup mapping
        // and copy it to the new primary record. The old record is left as-is on-chain
        // (history is preserved), but future lookups will resolve to msg.sender.
        string memory uname = _identities[lostPrimary].username;
        if (bytes(uname).length > 0) {
            _usernameTaken[uname]            = msg.sender;
            _identities[msg.sender].username = uname;
        }

        // Transfer creation timestamp for continuity
        _identities[msg.sender].createdAt    = _identities[lostPrimary].createdAt > 0
            ? _identities[lostPrimary].createdAt
            : block.timestamp;
        _identities[msg.sender].primaryWallet = msg.sender;
        _identities[msg.sender].updatedAt     = block.timestamp;

        // Transfer all remaining linked wallets from lostPrimary to msg.sender.
        // This prevents orphan wallets whose _primaryOf still points to lostPrimary.
        address[] storage lw = _identities[lostPrimary].linkedWallets;
        uint256 len = lw.length;
        for (uint256 i = 0; i < len; i++) {
            address w = lw[i];
            if (w != msg.sender) {
                // Reassign this wallet's primary to msg.sender
                _primaryOf[w] = msg.sender;
                _identities[msg.sender].linkedWallets.push(w);
            }
        }
        // Clear the old primary's linked wallet list
        delete _identities[lostPrimary].linkedWallets;
        // FIX M-SC-5: Clear stale username on old primary to prevent stale lookups
        if (bytes(uname).length > 0) {
            delete _identities[lostPrimary].username;
        }

        emit PrimaryClaimed(msg.sender, lostPrimary);
    }

    // ── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Resolve a wallet to its canonical primary address. If wallet has
     *         no primary set, returns the wallet itself. Used by ReputationRegistry
     *         to aggregate scores across linked wallets.
     */
    function getPrimary(address wallet) external view returns (address) {
        address p = _primaryOf[wallet];
        return p != address(0) ? p : wallet;
    }

    /**
     * @notice Get full identity record for a wallet.
     */
    function getIdentity(address wallet) external view returns (
        string memory username,
        address primaryWallet,
        address[] memory linkedWallets,
        uint256 createdAt,
        uint256 updatedAt
    ) {
        // Resolve to primary for the canonical record
        address primary = _primaryOf[wallet] != address(0) ? _primaryOf[wallet] : wallet;
        Identity storage id = _identities[primary];
        return (
            id.username,
            primary,
            id.linkedWallets,
            id.createdAt,
            id.updatedAt
        );
    }

    /**
     * @notice Get the username for a given wallet (resolves to primary first).
     *         Returns empty string if no username is set.
     */
    function getUsername(address wallet) external view returns (string memory) {
        address primary = _primaryOf[wallet] != address(0) ? _primaryOf[wallet] : wallet;
        return _identities[primary].username;
    }

    /**
     * @notice Look up a wallet address by username. Returns address(0) if not found.
     */
    function resolveUsername(string calldata username) external view returns (address) {
        return _usernameTaken[_toLower(username)];
    }

    /**
     * @notice Check if a username is available (not taken by any wallet).
     *         Since usernames are immutable once set, this is a pure availability check.
     *         Pass the caller's address so frontend can also warn if the user already
     *         has a username claimed (they cannot claim another).
     * @param username The username to check.
     * @param caller   The address intending to claim the username (pass address(0) to skip check).
     *                 If provided and the caller already has a username set, returns false.
     */
    function isUsernameAvailable(string calldata username, address caller) external view returns (bool) {
        if (bytes(username).length < 3 || bytes(username).length > 32) return false;
        string memory lower = _toLower(username);
        if (!_isValidUsername(lower)) return false;
        // If name is already taken, it's not available (period — no "re-use by same owner")
        if (_usernameTaken[lower] != address(0)) return false;
        // If caller already owns a username, they cannot claim another
        if (caller != address(0)) {
            address primary = _primaryOf[caller] != address(0) ? _primaryOf[caller] : caller;
            if (bytes(_identities[primary].username).length > 0) return false;
        }
        return true;
    }

    /**
     * @notice Get the pending link proposal from a primary wallet, if any.
     *         Returns address(0) if no pending proposal.
     */
    function getPendingLink(address primary) external view returns (address) {
        return _pendingLink[primary];
    }

    /**
     * @notice Reverse lookup — get the primary wallet that proposed to link this address.
     *         Used by the backup wallet to auto-detect its own invitation without needing
     *         to know the primary's address in advance.
     *         Returns address(0) if no incoming proposal exists for this wallet.
     */
    function getIncomingProposal(address wallet) external view returns (address) {
        return _proposedBy[wallet];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /**
     * @notice Admin can forcibly remove a username that violates terms
     *         (e.g. impersonation, slurs). Freed names remain unclaimable for 90 days
     *         as a spam deterrent — implement off-chain; here we just clear storage.
     *         NOTE: Since usernames are otherwise immutable, admin is the sole
     *         exception and must be used responsibly.
     */
    function adminClearUsername(address wallet) external onlyOwner {
        address primary = _primaryOf[wallet] != address(0) ? _primaryOf[wallet] : wallet;
        string memory uname = _identities[primary].username;
        require(bytes(uname).length > 0, "Identity: no username");
        delete _usernameTaken[uname];
        _identities[primary].username  = "";
        _identities[primary].updatedAt = block.timestamp;
        emit UsernameAdminCleared(primary, uname);
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    function _isValidUsername(string memory s) internal pure returns (bool) {
        bytes memory b = bytes(s);
        if (b.length < 3 || b.length > 32) return false;
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool isLower  = (c >= 0x61 && c <= 0x7A); // a-z
            bool isDigit  = (c >= 0x30 && c <= 0x39); // 0-9
            bool isHyphen = (c == 0x2D);               // -
            if (!isLower && !isDigit && !isHyphen) return false;
        }
        // Hyphen cannot be first or last
        if (b[0] == 0x2D || b[b.length - 1] == 0x2D) return false;
        return true;
    }

    function _toLower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory result = new bytes(b.length);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c >= 0x41 && c <= 0x5A) {
                result[i] = bytes1(uint8(c) + 32); // A-Z → a-z
            } else {
                result[i] = c;
            }
        }
        return string(result);
    }
}
