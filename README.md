# 🏛️ Decentralized Blockchain Land Registry DApp

A secure, tamper-proof Land Deed Registry and Marketplace decentralized application (DApp) built on the **Ethereum blockchain** using **Solidity**, **Truffle Framework**, **Ethers.js**, and **MetaMask**.

---

## 📋 Course Requirements Compliance Matrix

This project is meticulously designed to meet and exceed all 9 academic & technical requirements:

| # | Requirement | Implementation in Project | File & Code Reference |
|---|---|---|---|
| **1** | **Properly Written Smart Contract** | Well-structured contracts with structs, enums, events, state variables, and access control modifiers (`onlyContractOwner`, `onlyLandOwner`, `landExists`, `onlyAuthorized`). | [`contracts/LandRegistry.sol`](file:///contracts/LandRegistry.sol)<br>[`contracts/OwnershipHistory.sol`](file:///contracts/OwnershipHistory.sol) |
| **2** | **Connect Wallet** | Full MetaMask integration with automatic network switching, real-time balance tracking, account change listeners, and clean status indicators. | [`frontend/js/wallet.js`](file:///frontend/js/wallet.js) |
| **3** | **One Function (Data Op)** | Operational state-changing functions: `registerLand()`, `listLandForSale()`, `updatePrice()`, `delistLand()`, and `buyLand()`. | [`contracts/LandRegistry.sol#L94-L180`](file:///contracts/LandRegistry.sol#L94-L180) |
| **4** | **One Constructor** | `constructor(address _historyContractAddress)` initializes the contract owner (`msg.sender`) and securely binds the deployed `OwnershipHistory` contract once at deployment. | [`contracts/LandRegistry.sol#L77-L82`](file:///contracts/LandRegistry.sol#L77-L82) |
| **5** | **Table Function** | `struct Land`, `mapping(uint256 => Land)`, array `allLandIds`, and `getAllLands()` view function returning all land parcels, dynamically populated into an interactive table with live search & filters. | [`contracts/LandRegistry.sol#L225-L232`](file:///contracts/LandRegistry.sol#L225-L232)<br>[`frontend/index.html#L90-L115`](file:///frontend/index.html#L90-L115) |
| **6** | **Contract-to-Account & Contract-to-Contract** | • **Contract-to-Account**: In `buyLand()`, Ether sent by the buyer is transferred directly to the seller's Externally Owned Account (EOA) via `(bool sent, ) = previousOwner.call{value: salePrice}("")` with excess refunded.<br>• **Contract-to-Contract**: `LandRegistry` invokes `historyContract.recordTransfer(...)` in `OwnershipHistory.sol` on registration and purchase. | [`contracts/LandRegistry.sol#L170-L200`](file:///contracts/LandRegistry.sol#L170-L200)<br>[`contracts/OwnershipHistory.sol#L57-L73`](file:///contracts/OwnershipHistory.sol#L57-L73) |
| **7** | **`require` Keyword** | Validates conditions across all operations: caller authorization, non-empty location, positive area/price, parcel existence, buyer != seller, sufficient Ether sent, reverting if failed. | Throughout [`contracts/LandRegistry.sol`](file:///contracts/LandRegistry.sol) |
| **8** | **`pure` and `view` Keywords** | • `view`: `getLand()`, `getAllLands()`, `getLandCount()`, `getHistory()`.<br>• `pure`: `convertSqFtToAcres()` and `calculateStampDuty()` (reads/modifies zero state). | [`contracts/LandRegistry.sol#L235-L251`](file:///contracts/LandRegistry.sol#L235-L251) |
| **9** | **Truffle Framework** | Truffle configuration for compilation, automated migrations, artifact generation to `frontend/abi/`, and 14 passing automated unit tests. | [`truffle-config.js`](file:///truffle-config.js)<br>[`migrations/2_deploy_contracts.js`](file:///migrations/2_deploy_contracts.js)<br>[`test/landRegistry.test.js`](file:///test/landRegistry.test.js) |

---

## 📂 Project Directory Structure

```
blockchain-land-registry/
├── contracts/
│   ├── LandRegistry.sol          # Main registry & marketplace contract
│   ├── OwnershipHistory.sol      # Audit trail contract (Contract-to-Contract)
│   └── Migrations.sol            # Truffle deployment migration manager
├── migrations/
│   ├── 1_initial_migration.js    # Deploys Migrations contract
│   └── 2_deploy_contracts.js     # Deploys, links contracts & seeds demo parcels
├── test/
│   └── landRegistry.test.js      # 14 Mocha/Chai automated unit tests
├── frontend/
│   ├── index.html                # Responsive web dashboard
│   ├── css/
│   │   └── style.css             # Fintech-themed UI styling
│   ├── js/
│   │   ├── wallet.js             # MetaMask Web3 connection & network manager
│   │   ├── contract.js           # Ethers.js smart contract interaction service
│   │   └── app.js                # Table rendering, filter logic & event handlers
│   └── abi/                      # Auto-generated contract ABIs (Truffle build)
├── scripts/
│   ├── start-ganache.js          # Standalone local Ganache blockchain engine
│   └── test-runner.js            # Standalone zero-config automated test runner
├── truffle-config.js             # Truffle networks & Solidity 0.8.20 compiler config
├── package.json                  # NPM dependencies and runner scripts
├── README.md                     # Configuration & setup guide
└── WORKING.md                    # In-depth architectural workflow & user journey guide
```

---

## ⚙️ Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18+ (tested up to v24)
- **NPM**: v9+
- **Truffle**: `npm install -g truffle`
- **MetaMask**: Browser extension for Chrome / Brave / Firefox / Edge

---

## 🚀 Step-by-Step Configuration & Setup

### 1. Install Project Dependencies
In the root directory, install the required packages:
```bash
npm install
```

### 2. Start the Local Ganache Blockchain
Launch the built-in local Ethereum blockchain engine:
```bash
npm run ganache
```
*Output:*
```text
=======================================================
🚀 Local Ganache Blockchain started on http://127.0.0.1:7545
   Network ID: 5777 | Chain ID: 1337
   Default 10 accounts initialized with 100 ETH each
   MetaMask RPC URL: http://127.0.0.1:7545
   MetaMask Chain ID: 1337
=======================================================
```
> **Note**: Leave this terminal window open while interacting with the DApp.

---

### 3. Compile the Smart Contracts
Compile the Solidity 0.8.20 smart contracts:
```bash
npm run compile
```
Artifacts and ABIs are automatically written to `frontend/abi/`.

---

### 4. Deploy Contracts & Seed Demo Parcels
Run Truffle migrations against your running Ganache node:
```bash
npm run migrate
```
This script automatically:
1. Deploys `OwnershipHistory.sol`
2. Deploys `LandRegistry.sol`, passing `OwnershipHistory`'s address to the constructor
3. Authorizes `LandRegistry` inside `OwnershipHistory` for Contract-to-Contract deed logging
4. Seeds 2 demo land parcels for immediate testing

---

### 5. Run the Automated Test Suite
Run the 14 comprehensive unit tests:
```bash
npm test
```
*Or run the standalone runner (spins up Ganache, tests, and terminates automatically):*
```bash
npm run test:auto
```
*Expected test output:*
```text
  Contract: LandRegistry & OwnershipHistory Test Suite
    1. Constructor and Initialization
      ✔ should set the contractOwner correctly upon deployment
      ✔ should set the historyContract address in LandRegistry
      ✔ should revert if initialized with zero address
    2. Land Registration & Table Functions (Req 3, 5, 7)
      ✔ should register a new land and log initial deed in OwnershipHistory (Contract-to-Contract)
      ✔ should return all lands for frontend table display via getAllLands()
      ✔ should revert if invalid inputs are passed to registerLand (require checks)
    3. Listing, Price Updates, and Delisting Access Control (Req 1, 7)
      ✔ should allow only the land owner to list land for sale
      ✔ should allow land owner to update price and delist
    4. Buy Land: Contract-to-Account & Contract-to-Contract (Req 6 & 7)
      ✔ should revert if land owner tries to buy their own land
      ✔ should revert if insufficient Ether is sent
      ✔ should execute purchase: transfer ETH to seller (Contract-to-Account) and record history (Contract-to-Contract)
      ✔ should refund excess payment back to the buyer
    5. Pure & View Functions (Req 8)
      ✔ convertSqFtToAcres (pure) calculates acre values scaled by 1000
      ✔ calculateStampDuty (pure) calculates stamp duty correctly

  14 passing (1s)
```

---

### 6. Start the Frontend Application
Start the local HTTP web server:
```bash
npm start
```
The browser will automatically open:
👉 **`http://localhost:3000/frontend/`**

---

## 🦊 MetaMask Configuration Guide

### Network Details
- **Network Name**: `Ganache Local`
- **RPC URL**: `http://127.0.0.1:7545`
- **Chain ID**: `1337`
- **Currency Symbol**: `ETH`

### Importing Test Accounts
The local Ganache blockchain initializes 10 test accounts funded with **100 ETH** each using the deterministic mnemonic:
`hire swift coffee arena float jungle spray base pulse palace faculty collect`

#### Account 1 (Contract Deployer & Demo Parcel Owner):
- **Address**: `0xFc8D23D9D365F6879BeF73A89D2C243C8D707569`
- **Private Key**: `0x199320296ae3722a8abda082dc0a6729ce9ec10db7c34ef73b50c0c704f08f86`

#### Account 2 (Demo Seller):
- **Address**: `0x271c1C63B830da3367f11694148A44986f3874B0`
- **Private Key**: `0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d`

In MetaMask:
1. Click the account circle $\rightarrow$ **Add account or hardware wallet** $\rightarrow$ **Import account**.
2. Paste the private key above and click **Import**.
3. Open `http://localhost:3000/frontend/` and click **"Connect MetaMask"**.
