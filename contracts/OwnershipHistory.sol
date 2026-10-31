// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OwnershipHistory
 * @dev Manages the immutable audit trail of land ownership transfers.
 * Demonstrates Contract-to-Contract interaction when invoked by LandRegistry.
 */
contract OwnershipHistory {
    struct TransferRecord {
        address from;
        address to;
        uint256 price;
        uint256 timestamp;
    }

    address public admin;
    address public registryContract;

    // Mapping from landId => array of TransferRecord
    mapping(uint256 => TransferRecord[]) private landHistory;

    event TransferRecorded(
        uint256 indexed landId,
        address indexed from,
        address indexed to,
        uint256 price,
        uint256 timestamp
    );
    event RegistryContractUpdated(address indexed previousRegistry, address indexed newRegistry);

    modifier onlyAuthorized() {
        require(
            msg.sender == registryContract || msg.sender == admin,
            "OwnershipHistory: Caller is not authorized"
        );
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "OwnershipHistory: Only admin can perform this action");
        _;
    }

    /**
     * @dev Requirement 4: Constructor executes once on deployment
     */
    constructor() {
        admin = msg.sender;
    }

    /**
     * @dev Set the authorized LandRegistry contract address.
     */
    function setRegistryContract(address _registry) external onlyAdmin {
        require(_registry != address(0), "OwnershipHistory: Invalid registry address");
        emit RegistryContractUpdated(registryContract, _registry);
        registryContract = _registry;
    }

    /**
     * @dev Requirement 6: Contract-to-Contract callable function to append deed transfer.
     */
    function recordTransfer(
        uint256 _landId,
        address _from,
        address _to,
        uint256 _price
    ) external onlyAuthorized {
        require(_to != address(0), "OwnershipHistory: Invalid buyer address");

        landHistory[_landId].push(
            TransferRecord({
                from: _from,
                to: _to,
                price: _price,
                timestamp: block.timestamp
            })
        );

        emit TransferRecorded(_landId, _from, _to, _price, block.timestamp);
    }

    /**
     * @dev Requirement 8: View function to read ownership history of a parcel.
     */
    function getHistory(uint256 _landId) external view returns (TransferRecord[] memory) {
        return landHistory[_landId];
    }

    /**
     * @dev Requirement 8: View function to get number of transfer records.
     */
    function getHistoryCount(uint256 _landId) external view returns (uint256) {
        return landHistory[_landId].length;
    }
}

