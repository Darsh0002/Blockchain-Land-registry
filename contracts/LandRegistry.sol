// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface for Contract-to-Contract communication with OwnershipHistory.
 */
interface IOwnershipHistory {
    function recordTransfer(
        uint256 _landId,
        address _from,
        address _to,
        uint256 _price
    ) external;
}

/**
 * @title LandRegistry
 * @dev Comprehensive Land Registry Smart Contract covering all course requirements:
 * 1. Properly written contract with access controls, events, and structs.
 * 2. Connects to frontend wallet for transactions.
 * 3. Operational functions: registerLand, listLandForSale, buyLand, updatePrice, delistLand.
 * 4. Constructor initializing contract owner and OwnershipHistory contract reference.
 * 5. Table Function: getAllLands() and struct Land for frontend table rendering.
 * 6. Contract-to-Account (transferring Ether to seller) & Contract-to-Contract (calling IOwnershipHistory).
 * 7. Extensive use of require statements for validations and reversions.
 * 8. view functions (getLand, getAllLands) and pure functions (convertSqFtToAcres, calculateStampDuty).
 */
contract LandRegistry {
    // Enum representing land lifecycle status
    enum LandStatus {
        Registered,
        ForSale,
        Sold
    }

    // Struct representing land record details (Requirement 5)
    struct Land {
        uint256 id;
        string location;
        uint256 areaSqFt;
        uint256 landNumber;
        address payable currentOwner;
        uint256 price; // in wei
        bool isForSale;
        LandStatus status;
        uint256 registeredAt;
    }

    // Contract state variables
    address public immutable contractOwner;
    IOwnershipHistory public historyContract;
    uint256 public totalLandsCount;

    // Mapping from landId => Land struct
    mapping(uint256 => Land) public lands;

    // Array of all land IDs for iteration and table display
    uint256[] public allLandIds;

    // Events
    event LandRegistered(
        uint256 indexed landId,
        string location,
        uint256 areaSqFt,
        uint256 indexed landNumber,
        address indexed owner,
        uint256 price
    );
    event LandListedForSale(uint256 indexed landId, uint256 price, address indexed owner);
    event LandDelisted(uint256 indexed landId, address indexed owner);
    event LandPurchased(
        uint256 indexed landId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 price
    );
    event LandPriceUpdated(uint256 indexed landId, uint256 oldPrice, uint256 newPrice);
    event HistoryContractUpdated(address indexed previousContract, address indexed newContract);

    // Modifiers (Access Control & Validation)
    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "Not authorized: Only contract owner can perform this");
        _;
    }

    modifier onlyLandOwner(uint256 _id) {
        require(lands[_id].id != 0, "Land parcel does not exist");
        require(lands[_id].currentOwner == msg.sender, "Not authorized: Only the land owner can perform this");
        _;
    }

    modifier landExists(uint256 _id) {
        require(lands[_id].id != 0, "Land parcel does not exist");
        _;
    }

    /**
     * @dev Requirement 4: One Constructor
     * Initializes contract owner and connects to the deployed OwnershipHistory contract.
     */
    constructor(address _historyContractAddress) {
        require(_historyContractAddress != address(0), "Invalid history contract address");
        contractOwner = msg.sender;
        historyContract = IOwnershipHistory(_historyContractAddress);
    }

    /**
     * @dev Update OwnershipHistory contract address if needed (Contract Admin only).
     */
    function updateHistoryContract(address _newHistoryContract) external onlyContractOwner {
        require(_newHistoryContract != address(0), "Invalid history contract address");
        emit HistoryContractUpdated(address(historyContract), _newHistoryContract);
        historyContract = IOwnershipHistory(_newHistoryContract);
    }

    /**
     * @dev Requirement 3: Function to perform operation (register new land).
     * Accessible to users registering their land parcels.
     * Demonstrates Contract-to-Contract call upon registration.
     */
    function registerLand(
        string calldata _location,
        uint256 _areaSqFt,
        uint256 _landNumber,
        uint256 _priceInWei,
        bool _listForSale
    ) external returns (uint256) {
        // Requirement 7: require validations
        require(bytes(_location).length > 0, "Location cannot be empty");
        require(_areaSqFt > 0, "Area must be greater than zero");
        require(_landNumber > 0, "Land number must be greater than zero");

        totalLandsCount++;
        uint256 newId = totalLandsCount;

        LandStatus initialStatus = _listForSale ? LandStatus.ForSale : LandStatus.Registered;

        lands[newId] = Land({
            id: newId,
            location: _location,
            areaSqFt: _areaSqFt,
            landNumber: _landNumber,
            currentOwner: payable(msg.sender),
            price: _priceInWei,
            isForSale: _listForSale,
            status: initialStatus,
            registeredAt: block.timestamp
        });

        allLandIds.push(newId);

        // Requirement 6: Contract-to-Contract call (initial ownership registration)
        historyContract.recordTransfer(newId, address(0), msg.sender, _priceInWei);

        emit LandRegistered(newId, _location, _areaSqFt, _landNumber, msg.sender, _priceInWei);
        if (_listForSale) {
            emit LandListedForSale(newId, _priceInWei, msg.sender);
        }

        return newId;
    }

    /**
     * @dev List an owned land parcel for sale with a specified price.
     */
    function listLandForSale(uint256 _id, uint256 _priceInWei) external onlyLandOwner(_id) {
        require(_priceInWei > 0, "Price must be greater than zero");

        Land storage land = lands[_id];
        land.price = _priceInWei;
        land.isForSale = true;
        land.status = LandStatus.ForSale;

        emit LandListedForSale(_id, _priceInWei, msg.sender);
    }

    /**
     * @dev Delist an owned land parcel from the market.
     */
    function delistLand(uint256 _id) external onlyLandOwner(_id) {
        Land storage land = lands[_id];
        require(land.isForSale, "Land is not currently listed for sale");

        land.isForSale = false;
        land.status = LandStatus.Registered;

        emit LandDelisted(_id, msg.sender);
    }

    /**
     * @dev Update the asking price for a land parcel.
     */
    function updatePrice(uint256 _id, uint256 _newPrice) external onlyLandOwner(_id) {
        require(_newPrice > 0, "Price must be greater than zero");

        Land storage land = lands[_id];
        uint256 oldPrice = land.price;
        land.price = _newPrice;

        emit LandPriceUpdated(_id, oldPrice, _newPrice);
    }

    /**
     * @dev Buy a land parcel listed for sale.
     * Demonstrates:
     * - Requirement 6: Contract-to-Account (transferring Ether to previous owner)
     * - Requirement 6: Contract-to-Contract (calling historyContract.recordTransfer)
     * - Requirement 7: Multiple require checks
     */
    function buyLand(uint256 _id) external payable landExists(_id) {
        Land storage land = lands[_id];

        // Requirement 7 validations
        require(land.isForSale, "Land is not available for sale");
        require(msg.sender != land.currentOwner, "Owner cannot buy their own land");
        require(msg.value >= land.price, "Ether sent is less than land asking price");

        address payable previousOwner = land.currentOwner;
        uint256 salePrice = land.price;

        // State update before external calls (checks-effects-interactions pattern)
        land.currentOwner = payable(msg.sender);
        land.isForSale = false;
        land.status = LandStatus.Sold;

        // Requirement 6: Contract-to-Account -> Forward Ether payment to previous owner EOA
        (bool paymentSuccess, ) = previousOwner.call{value: salePrice}("");
        require(paymentSuccess, "Payment transfer to seller failed");

        // Requirement 6: Contract-to-Contract -> Log deed transfer into OwnershipHistory
        historyContract.recordTransfer(_id, previousOwner, msg.sender, salePrice);

        // Refund any excess Ether sent by buyer
        if (msg.value > salePrice) {
            uint256 refundAmount = msg.value - salePrice;
            (bool refundSuccess, ) = payable(msg.sender).call{value: refundAmount}("");
            require(refundSuccess, "Refund of excess Ether failed");
        }

        emit LandPurchased(_id, previousOwner, msg.sender, salePrice);
    }

    /**
     * @dev Requirement 8: View function to read a single land parcel.
     */
    function getLand(uint256 _id) external view landExists(_id) returns (Land memory) {
        return lands[_id];
    }

    /**
     * @dev Requirement 8: View function to fetch all registered land IDs.
     */
    function getAllLandIds() external view returns (uint256[] memory) {
        return allLandIds;
    }

    /**
     * @dev Requirement 5 & 8: Table Function (view function returning all land structs).
     * Allows the frontend to load and display all records in a single call.
     */
    function getAllLands() external view returns (Land[] memory) {
        Land[] memory items = new Land[](totalLandsCount);
        for (uint256 i = 0; i < totalLandsCount; i++) {
            items[i] = lands[allLandIds[i]];
        }
        return items;
    }

    /**
     * @dev Requirement 8: View function returning total land count.
     */
    function getLandCount() external view returns (uint256) {
        return totalLandsCount;
    }

    /**
     * @dev Requirement 8: Pure function (reads no state, modifies no state).
     * Converts square feet to acres (1 acre = 43,560 sq ft).
     * Returns value scaled by 1,000 for 3-decimal display on frontend.
     */
    function convertSqFtToAcres(uint256 _sqFt) external pure returns (uint256 acresScaledBy1000) {
        require(_sqFt > 0, "Square feet must be greater than zero");
        return (_sqFt * 1000) / 43560;
    }

    /**
     * @dev Requirement 8: Pure function (reads no state, modifies no state).
     * Calculates estimated government stamp duty based on land price and rate in basis points (e.g. 500 = 5%).
     */
    function calculateStampDuty(uint256 _priceInWei, uint256 _rateBasisPoints) external pure returns (uint256) {
        return (_priceInWei * _rateBasisPoints) / 10000;
    }
}

