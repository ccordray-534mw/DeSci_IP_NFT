pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract DeSciIPNFTFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;
    uint256 public cooldownSeconds = 60;

    bool public paused;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    uint256 public currentBatchId;
    bool public batchOpen;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event CooldownSecondsSet(uint256 oldCooldown, uint256 newCooldown);
    event Paused(address account);
    event Unpaused(address account);
    event BatchOpened(uint256 batchId);
    event BatchClosed(uint256 batchId);
    event EncryptedContributionSubmitted(address indexed contributor, uint256 indexed batchId, bytes32 encryptedShare, bytes32 encryptedTotal);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId, bytes32 stateHash);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 totalShares, uint256 totalValue);

    error NotOwner();
    error NotProvider();
    error PausedError();
    error CooldownActive();
    error BatchNotOpen();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidBatchState();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true;
        emit ProviderAdded(owner);
        currentBatchId = 1; // Start with batch 1
    }

    function transferOwnership(address newOwner) public onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function addProvider(address provider) public onlyOwner {
        if (!isProvider[provider]) {
            isProvider[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    function removeProvider(address provider) public onlyOwner {
        if (isProvider[provider]) {
            isProvider[provider] = false;
            emit ProviderRemoved(provider);
        }
    }

    function setCooldownSeconds(uint256 newCooldown) public onlyOwner {
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = newCooldown;
        emit CooldownSecondsSet(oldCooldown, newCooldown);
    }

    function pause() public onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() public onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function openBatch() public onlyOwner whenNotPaused {
        if (batchOpen) revert InvalidBatchState(); // Or simply allow reopening if it's closed
        batchOpen = true;
        currentBatchId++;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() public onlyOwner whenNotPaused {
        if (!batchOpen) revert InvalidBatchState();
        batchOpen = false;
        emit BatchClosed(currentBatchId);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded(euint32 storage item, uint32 value) internal {
        if (!item.isInitialized()) {
            item.asEuint32(value);
        }
    }

    function _requireInitialized(euint32 storage item) internal view {
        if (!item.isInitialized()) revert("NotInitialized");
    }

    function submitEncryptedContribution(
        euint32 memory encryptedShare,
        euint32 memory encryptedTotalValue
    ) public onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (!batchOpen) revert BatchNotOpen();

        lastSubmissionTime[msg.sender] = block.timestamp;

        // In a real scenario, these would be processed/accumulated.
        // For this example, we just emit them.
        emit EncryptedContributionSubmitted(
            msg.sender,
            currentBatchId,
            encryptedShare.toBytes32(),
            encryptedTotalValue.toBytes32()
        );
    }

    function requestTotalValueDecryption(uint256 batchIdToDecrypt) public onlyOwner whenNotPaused {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }

        // Example: We want to decrypt a "totalValue" for a specific batch.
        // This value would have been computed and stored encrypted.
        // For this example, we'll assume it's stored in a mapping.
        // In a real contract, this would be the result of FHE operations.
        euint32 storage encryptedTotalValueForBatch = encryptedBatchTotals[batchIdToDecrypt];
        _requireInitialized(encryptedTotalValueForBatch);

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = encryptedTotalValueForBatch.toBytes32();

        bytes32 stateHash = _hashCiphertexts(cts);

        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({ batchId: batchIdToDecrypt, stateHash: stateHash, processed: false });
        lastDecryptionRequestTime[msg.sender] = block.timestamp;

        emit DecryptionRequested(requestId, batchIdToDecrypt, stateHash);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        DecryptionContext storage ctx = decryptionContexts[requestId];

        // 1. Replay Guard
        if (ctx.processed) revert ReplayAttempt();

        // 2. State Verification
        // Rebuild cts array in the exact same order as in requestTotalValueDecryption
        euint32 storage encryptedTotalValueForBatch = encryptedBatchTotals[ctx.batchId];
        _requireInitialized(encryptedTotalValueForBatch); // Ensure it's still initialized

        bytes32[] memory currentCts = new bytes32[](1);
        currentCts[0] = encryptedTotalValueForBatch.toBytes32();
        bytes32 currentStateHash = _hashCiphertexts(currentCts);

        if (currentStateHash != ctx.stateHash) {
            revert StateMismatch();
        }

        // 3. Proof Verification
        FHE.checkSignatures(requestId, cleartexts, proof);

        // 4. Decode & Finalize
        // cleartexts is abi.encodePacked(cleartext1, cleartext2, ...)
        // We only have one uint32 value
        uint32 totalValue = abi.decode(cleartexts, (uint32));

        ctx.processed = true;
        emit DecryptionCompleted(requestId, ctx.batchId, 1, totalValue); // 1 total share for this example

        // Optional: Do something with the decrypted totalValue
    }

    // Example storage for encrypted data that might be decrypted
    // In a real contract, this would be populated by FHE operations.
    mapping(uint256 => euint32) internal encryptedBatchTotals;

    // Example function to set an encrypted total for a batch (for testing/demonstration)
    // In a real contract, this would be the result of accumulating encrypted contributions.
    function setEncryptedBatchTotal(uint256 batchId, euint32 memory encryptedTotal) public onlyOwner {
        encryptedBatchTotals[batchId] = encryptedTotal;
    }
}