# 🏛️ SafeLand | Decentralized Blockchain Land Registry DApp

A secure, tamper-proof Land Deed Registry and Marketplace decentralized application (DApp) built on the **Ethereum blockchain** using **Solidity**, **Truffle Framework**, **Ethers.js**, **Tailwind CSS**, and **MetaMask**.

Features a **Government Authority & Citizen Architecture**: only authorized government revenue officers can mint official survey deeds onto the public ledger, while citizens can seamlessly verify, buy, sell, and inspect immutable deed transfer histories.

---

## 📋 Course Requirements Compliance Matrix

This project is meticulously designed to meet and exceed all 9 academic & technical requirements:

| # | Requirement | Implementation in Project | File & Code Reference |
|---|---|---|---|
| **1** | **Properly Written Smart Contract** | Well-structured contracts with structs, enums, events, state variables, and access control modifiers (`onlyContractOwner`, `onlyLandOwner`, `landExists`, `onlyAuthorized`). | [`contracts/LandRegistry.sol`](file:///contracts/LandRegistry.sol)<br>[`contracts/OwnershipHistory.sol`](file:///contracts/OwnershipHistory.sol) |
| **2** | **Connect Wallet** | Full MetaMask integration with network auto-switching, real-time balance tracking, one-click **Account Switching**, and role indicators (`🏛️ Government Authority` vs `👤 Citizen`). | [`frontend/js/wallet.js`](file:///frontend/js/wallet.js)<br>[`frontend/js/app.js`](file:///frontend/js/app.js) |
| **3** | **One Function (Data Op)** | Operational state-changing functions: `registerLand()` (Govt only), `listLandForSale()`, `updatePrice()`, `delistLand()`, and `buyLand()`. | [`contracts/LandRegistry.sol#L121-L242`](file:///contracts/LandRegistry.sol#L121-L242) |
| **4** | **One Constructor** | `constructor(address _historyContractAddress)` initializes the contract owner (`msg.sender` = Govt Authority) and securely links the deployed `OwnershipHistory` contract once at deployment. | [`contracts/LandRegistry.sol#L101-L105`](file:///contracts/LandRegistry.sol#L101-L105) |
| **5** | **Table Function** | `struct Land`, `mapping(uint256 => Land)`, array `allLandIds`, and `getAllLands()` view function returning all land parcels, dynamically populated into an interactive table with live search & filters. | [`contracts/LandRegistry.sol#L261-L267`](file:///contracts/LandRegistry.sol#L261-L267)<br>[`frontend/index.html`](file:///frontend/index.html) |
| **6** | **Contract-to-Account & Contract-to-Contract** | • **Contract-to-Account**: In `buyLand()`, Ether sent by the buyer is transferred directly to the seller's Externally Owned Account (EOA) via `(bool sent, ) = previousOwner.call{value: salePrice}("")` with excess refunded.<br>• **Contract-to-Contract**: `LandRegistry` invokes `historyContract.recordTransfer(...)` in `OwnershipHistory.sol` on registration and purchase. | [`contracts/LandRegistry.sol#L227-L238`](file:///contracts/LandRegistry.sol#L227-L238)<br>[`contracts/OwnershipHistory.sol`](file:///contracts/OwnershipHistory.sol) |
| **7** | **`require` Keyword** | Validates conditions across all operations: caller authorization, non-empty location, positive area/price, parcel existence, buyer != seller, sufficient Ether sent, reverting if failed. | Throughout [`contracts/LandRegistry.sol`](file:///contracts/LandRegistry.sol) |
| **8** | **`pure` and `view` Keywords** | • `view`: `getLand()`, `getAllLands()`, `getLandCount()`, `getHistory()`.<br>• `pure`: `convertSqFtToAcres()` and `calculateStampDuty()` (reads/modifies zero blockchain state). | [`contracts/LandRegistry.sol#L277-L293`](file:///contracts/LandRegistry.sol#L277-L293) |
| **9** | **Truffle Framework** | Truffle configuration for compilation with `evmVersion: "paris"`, automated migrations, artifact generation to `frontend/abi/`, and **15 passing automated unit tests**. | [`truffle-config.js`](file:///truffle-config.js)<br>[`migrations/2_deploy_contracts.js`](file:///migrations/2_deploy_contracts.js)<br>[`test/landRegistry.test.js`](file:///test/landRegistry.test.js) |

---

## 👥 Government & Citizen Dual-Role Architecture

To reflect real-world land administration, the DApp implements role-based privilege separation:

```
                  ┌─────────────────────────────────────────┐
                  │       Ethereum Smart Contract Layer     │
                  └────────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     Government Authority      │             │            Citizen            │
│  Account: 0xFc8D...7569       │             │  Account: 0x271c...74B0, etc. │
├───────────────────────────────┤             ├───────────────────────────────┤
│ • Registers official parcels  │             │ • Browses verified registry   │
│ • Assigns govt survey numbers │             │ • Buys land with direct ETH   │
│ • Listed as "🏛️ Govt Property"│             │ • Resells & updates prices    │
│ • Restricted by modifier      │             │ • Inspects digital deed trail │
└───────────────────────────────┘             └───────────────────────────────┘
```

- **Government Land Authority (`0xFc8D23D9D365F6879BeF73A89D2C243C8D707569`)**:
  - Only this account can call `registerLand(...)`. Attempts by citizens revert with `"Not authorized: Only contract owner can perform this"`.
  - Properties held by this account display a distinct **`🏛️ Govt Property`** badge in the directory.
- **Citizen Accounts**:
  - Connect their MetaMask wallet, browse government allotments and peer-listed lands.
  - Buy land directly with ETH (zero middlemen commissions).
  - List parcels for resale, update asking prices, or delist at will.

---

## 📂 Project Directory Structure

```
blockchain-land-registry/
├── contracts/
│   ├── LandRegistry.sol          # Main registry & marketplace contract (with onlyContractOwner minting)
│   ├── OwnershipHistory.sol      # Audit trail contract (Contract-to-Contract target)
│   └── Migrations.sol            # Truffle deployment migration manager
├── migrations/
│   ├── 1_initial_migration.js    # Deploys Migrations contract
│   └── 2_deploy_contracts.js     # Deploys, links contracts & authorizes deed logging
├── test/
│   └── landRegistry.test.js      # 15 Mocha/Chai automated unit tests
├── frontend/
│   ├── index.html                # Modern minimalist dashboard with Tailwind CSS
│   ├── css/
│   │   └── style.css             # Component styling (modals, pills, toast animations, tags)
│   ├── js/
│   │   ├── wallet.js             # MetaMask Web3 connection, account switching & network manager
│   │   ├── contract.js           # Ethers.js contract interaction service & direct Ganache signer
│   │   └── app.js                # Table rendering, filter logic, role-aware UI & event handlers
│   └── abi/                      # Auto-generated contract ABIs (Truffle build)
├── scripts/
│   ├── start-ganache.js          # Standalone local Ganache blockchain engine
│   └── test-runner.js            # Standalone zero-config automated test runner
├── truffle-config.js             # Truffle networks & Solidity 0.8.20 compiler (evmVersion: "paris")
├── package.json                  # NPM dependencies and runner scripts
├── README.md                     # Configuration & setup guide
└── WORKING.md                    # In-depth architectural workflow & user journey guide
```

---

## ⚙️ Prerequisites

Ensure you have the following installed on your machine:
- **Node.js**: v18+ (tested with v20 and v24)
- **NPM**: v9+
- **Truffle**: `npm install -g truffle`
- **Ganache**: Ganache GUI (Port `7545`) or Ganache CLI
- **MetaMask**: Browser extension for Chrome / Brave / Edge / Firefox

---

## 🚀 Step-by-Step Configuration & Setup

### 1. Install Project Dependencies
In the root directory:
```bash
npm install
```

### 2. Start the Local Ganache Blockchain
Launch Ganache using either of the following two options:

#### Option A: Built-in Command (Fastest)
Start the bundled local Ethereum blockchain node:
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
> **Note**: Keep this terminal window open while using the DApp.

#### Option B: Ganache GUI Workspace
Open Ganache GUI and launch your workspace (e.g. `ossified-dime`) with:
- **RPC Server**: `HTTP://127.0.0.1:7545`
- **Network ID**: `5777`
- **Chain ID**: `1337`
- **Mnemonic**: `hire swift coffee arena float jungle spray base pulse palace faculty collect`

### 3. Compile the Smart Contracts
Compile the Solidity 0.8.20 smart contracts (configured with `evmVersion: "paris"` in `truffle-config.js` to ensure Ganache EVM compatibility):
```bash
npx truffle compile
```
Artifacts and ABIs are automatically written to `frontend/abi/`.

### 4. Deploy Contracts
Deploy fresh contracts to your running Ganache node:
```bash
npx truffle migrate --reset
```
This script:
1. Deploys `OwnershipHistory.sol`
2. Deploys `LandRegistry.sol`, passing `OwnershipHistory`'s address to the constructor
3. Authorizes `LandRegistry` inside `OwnershipHistory` for Contract-to-Contract deed logging

### 5. Run the Automated Test Suite
Execute the **15 automated unit tests**:
```bash
npx truffle test
```
*Expected test output:*
```text
  Contract: LandRegistry & OwnershipHistory Test Suite
    1. Constructor and Initialization
      ✔ should set the contractOwner correctly upon deployment
      ✔ should set the historyContract address in LandRegistry
      ✔ should revert if initialized with zero address (106ms)
    2. Government Land Registration & Table Functions (Req 3, 5, 7)
      ✔ should allow only Government Authority (admin) to register land and log deed in OwnershipHistory (Contract-to-Contract) (234ms)
      ✔ should revert when a citizen (non-admin) tries to register land
      ✔ should return all lands for frontend table display via getAllLands() (402ms)
      ✔ should revert if invalid inputs are passed to registerLand (require checks)
    3. Listing, Price Updates, and Delisting Access Control (Req 1, 7)
      ✔ should allow only the land owner (citizen) to list land for sale (98ms)
      ✔ should allow land owner to update price and delist (202ms)
    4. Buy Land: Contract-to-Account & Contract-to-Contract (Req 6 & 7)
      ✔ should revert if land owner (govt) tries to buy their own land
      ✔ should revert if insufficient Ether is sent
      ✔ should execute citizen purchase: transfer ETH to govt (Contract-to-Account) and record history (Contract-to-Contract) (178ms)
      ✔ should refund excess payment back to the citizen buyer (134ms)
    5. Pure & View Functions (Req 8)
      ✔ convertSqFtToAcres (pure) calculates acre values scaled by 1000
      ✔ calculateStampDuty (pure) calculates stamp duty correctly

  15 passing (5s)
```

### 6. Start the Frontend Application
Start the local HTTP web server:
```bash
npm start
```
The browser will automatically open:
👉 **`http://localhost:3000`**

---

## 🦊 MetaMask Configuration & Accounts

### Network Configuration in MetaMask
- **Network Name**: `Ganache Local`
- **RPC URL**: `http://127.0.0.1:7545`
- **Chain ID**: `1337`
- **Currency Symbol**: `ETH`

### Test Accounts
Import both accounts into MetaMask using their private keys:

#### Account 0: 🏛️ Government Land Authority
- **Address**: `0xFc8D23D9D365F6879BeF73A89D2C243C8D707569`
- **Private Key**: `0x199320296ae3722a8abda082dc0a6729ce9ec10db7c34ef73b50c0c704f08f86`
- **Role**: Contract Deployer & Admin. Sees the parcel registration form, can mint official survey deeds onto the blockchain.

#### Account 1: 👤 Citizen Account
- **Address**: `0x271c1C63B830da3367f11694148A44986f3874B0`
- **Private Key**: `0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d`
- **Role**: Citizen. Sees the Citizen Purchase Portal, can buy available parcels with ETH and resell them.

> 💡 **Developer Pro-Tip**: Whenever you run `truffle migrate --reset`, Ganache resets account transaction nonces back to 0. In MetaMask, navigate to **Settings → Advanced → "Clear activity and nonce data"** to keep MetaMask in sync with Ganache.
