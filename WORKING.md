# 📖 SafeLand DApp - Architecture & Complete Workflow Guide

This document provides a comprehensive, step-by-step breakdown of how the **SafeLand Decentralized Registry** operates, from smart contract logic and role-based access controls to the user interface.

---

## 🏛️ System Architecture Diagram

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Frontend)"]
        UI["Modern Web Dashboard\n(Tailwind CSS + HTML)"]
        App["UI Controller\n(app.js - Role & View Logic)"]
        WalletMgr["Wallet Manager\n(wallet.js - MetaMask & Switcher)"]
        ContractSvc["Contract Bridge\n(contract.js - Ethers.js)"]
        MM["MetaMask Browser Extension"]
    end

    subgraph BlockchainLayer ["Ethereum Blockchain (Ganache Local)"]
        subgraph Contracts ["Smart Contracts"]
            LR["LandRegistry.sol\n- onlyContractOwner on registerLand()\n- onlyLandOwner on pricing/listing\n- buyLand() with CEI pattern\n- Pure & View Utilities"]
            OH["OwnershipHistory.sol\n- Immutable Deed History\n- Contract-to-Contract Target"]
        end
        
        subgraph Accounts ["Participant EOAs"]
            Govt["🏛️ Government Land Authority EOA\n0xFc8D...7569 (Contract Owner)"]
            CitizenBuyer["👤 Citizen Buyer EOA\n(Purchases allotment with ETH)"]
            CitizenSeller["👤 Citizen Seller EOA\n(Receives ETH on resale)"]
        end
    end

    UI --> App
    App --> WalletMgr
    App --> ContractSvc
    WalletMgr <--> MM
    ContractSvc <--> MM
    MM <-->|"JSON-RPC (Port 7545)"| BlockchainLayer
    Govt -->|"Mints official parcels\n(onlyContractOwner)"| LR
    CitizenBuyer -->|"Direct ETH Payment\n(msg.value)"| LR
    LR -->|"Contract-to-Account\n(ETH Transfer)"| CitizenSeller
    LR -->|"Contract-to-Contract\n(recordTransfer)"| OH
```

---

## 👥 Role-Based Access Control Architecture

The platform partitions user actions across two distinct roles:

| Feature / Operation | 🏛️ Government Authority (`0xFc8D...7569`) | 👤 Citizen (`0x271c...74B0`, etc.) |
|---|---|---|
| **Connect Wallet** | Shows `🏛️ Government Authority` badge | Shows `👤 Citizen` badge |
| **Register Land Parcel** | ✅ Allowed (`onlyContractOwner`) | ❌ Reverts with `"Not authorized"` |
| **Registration Form UI** | ✅ Form visible | ❌ Replaced with Citizen Purchase Notice |
| **Buy Government Allotment** | ❌ Reverts (Owner cannot buy own land) | ✅ Allowed with direct ETH payment |
| **List / Delist Owned Land** | ✅ Allowed for lands owned | ✅ Allowed for lands owned |
| **Update Asking Price** | ✅ Allowed for lands owned | ✅ Allowed for lands owned |
| **Deed Transfer History** | ✅ Publicly auditable | ✅ Publicly auditable |
| **Directory Owner Badge** | Displays `🏛️ GOVT PROPERTY` | Displays regular formatted address |

---

## 🔄 End-to-End Workflows

### 1. Wallet Connection & One-Click Account Switching
*(Satisfies Requirement 2: Connect Wallet)*

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Tailwind Frontend
    participant Wallet as wallet.js
    participant App as app.js
    participant MM as MetaMask
    participant LR as LandRegistry.sol

    User->>UI: Clicks "Connect MetaMask Wallet"
    UI->>Wallet: Wallet.connect()
    Wallet->>MM: eth_requestAccounts
    MM-->>User: Prompts account authorization popup
    User->>MM: Approves connection
    MM-->>Wallet: Returns active account address
    Wallet->>MM: wallet_switchEthereumChain (0x539 / 1337)
    Wallet->>UI: Renders short address, balance, and "🟢 Connected" badge
    App->>LR: contractOwner() [view]
    LR-->>App: 0xFc8D...7569 (Govt Authority)
    alt Active account == contractOwner
        App->>UI: Sets role badge to "🏛️ Government Authority" & shows Registration Form
    else Active account != contractOwner
        App->>UI: Sets role badge to "👤 Citizen" & shows Citizen Notice
    end

    opt User wants to change role
        User->>UI: Clicks "🔄 Switch Account"
        UI->>Wallet: Wallet.switchAccount()
        Wallet->>MM: wallet_requestPermissions({eth_accounts: {}})
        MM-->>User: Opens account picker popup directly
        User->>MM: Selects another account
        MM-->>Wallet: Returns selected account
        Wallet->>App: onAccountChanged(newAccount)
        App->>UI: Instantly updates role badge, visible sections, and table badges
    end
```

**Key Highlights:**
- **Zero-Friction Switching**: The dedicated **Switch Account** button calls `wallet_requestPermissions` so users can jump between Government and Citizen profiles without manually opening extension menus.
- **Dynamic Role Badge**: Header reflects the active account's permissions in real-time.

---

### 2. Government Land Registration Workflow
*(Satisfies Requirement 1: Access Control, Requirement 3: Data Op, Requirement 4: Constructor, Requirement 6: Contract-to-Contract, Requirement 7: `require`, Requirement 8: `pure`)*

```mermaid
sequenceDiagram
    autonumber
    actor Govt as 🏛️ Govt Authority
    participant Form as Register Form
    participant App as app.js
    participant MM as MetaMask
    participant LR as LandRegistry.sol
    participant OH as OwnershipHistory.sol

    Govt->>Form: Enters Location, Survey #, Area (sq ft), Price (ETH)
    Form->>App: Input event on Area & Price fields
    App->>LR: convertSqFtToAcres(area) [pure]
    App->>LR: calculateStampDuty(price, 500) [pure]
    LR-->>App: Returns scaled acres and 5% stamp duty
    App->>Form: Updates live calculation preview tiles
    Govt->>Form: Clicks "Register This Parcel on Blockchain"
    Form->>App: Submits parcel data
    App->>MM: Sends registerLand(location, area, survey#, price, listForSale)
    MM-->>Govt: Prompts confirmation popup
    Govt->>MM: Confirms transaction
    MM->>LR: registerLand(...)

    rect rgb(240, 248, 255)
        Note over LR: Smart Contract Validations & Execution
        LR->>LR: require(msg.sender == contractOwner, "Not authorized")
        LR->>LR: require(bytes(location).length > 0)
        LR->>LR: require(areaSqFt > 0)
        LR->>LR: require(landNumber > 0)
        LR->>LR: totalLandsCount++
        LR->>LR: lands[newId] = Land(...)
        LR->>LR: allLandIds.push(newId)
        LR->>OH: recordTransfer(newId, address(0), msg.sender, price) [Contract-to-Contract]
        OH->>OH: landHistory[newId].push(genesisRecord)
        LR->>LR: emit LandRegistered(...)
        LR->>LR: emit LandListedForSale(...)
    end

    LR-->>MM: Transaction mined (Receipt)
    MM-->>App: Transaction success
    App->>Govt: Displays success toast
    App->>App: Refreshes table via getAllLands() -> Parcel displays "🏛️ GOVT PROPERTY"
```

**Key Highlights:**
- **On-Chain Enforcement**: The `onlyContractOwner` modifier ensures that only the authorized government administrator can mint new parcels.
- **Contract-to-Contract Genesis Deed**: Automatically invokes `OwnershipHistory.recordTransfer(...)` with `from: address(0)`, anchoring an immutable origin deed.

---

### 3. Citizen Land Purchase & Ether Settlement Workflow
*(Satisfies Requirement 6: Contract-to-Account & Contract-to-Contract, Requirement 7: `require`)*

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as 👤 Citizen Buyer
    participant UI as Marketplace Table
    participant MM as MetaMask
    participant LR as LandRegistry.sol
    participant Seller as 🏛️ Govt / Seller EOA
    participant OH as OwnershipHistory.sol

    Buyer->>UI: Clicks "🛒 Buy (X ETH)" on available parcel
    UI->>Buyer: Shows purchase confirmation summary
    Buyer->>UI: Confirms purchase
    UI->>MM: Invokes buyLand(landId) with value: X ETH
    MM-->>Buyer: Prompts MetaMask payment popup
    Buyer->>MM: Approves ETH payment
    MM->>LR: buyLand(landId) { value: X ETH }

    rect rgb(255, 250, 240)
        Note over LR: State Validations (require)
        LR->>LR: require(land.isForSale == true)
        LR->>LR: require(msg.sender != land.currentOwner)
        LR->>LR: require(msg.value >= land.price)

        Note over LR: State Transition (Checks-Effects-Interactions)
        LR->>LR: address payable previousOwner = land.currentOwner
        LR->>LR: land.currentOwner = payable(msg.sender)
        LR->>LR: land.isForSale = false
        LR->>LR: land.status = LandStatus.Sold

        Note over LR: Financial Settlement (Contract-to-Account)
        LR->>Seller: previousOwner.call{value: salePrice}("")
        Seller-->>LR: ETH balance credited

        Note over LR: Audit Trail (Contract-to-Contract)
        LR->>OH: recordTransfer(landId, previousOwner, msg.sender, price)
        OH->>OH: Appends TransferRecord to parcel history

        opt Excess Payment
            LR->>Buyer: payable(msg.sender).call{value: refundAmount}("")
        end

        LR->>LR: emit LandPurchased(landId, previousOwner, msg.sender, price)
    end

    LR-->>MM: Transaction confirmed
    MM-->>UI: Receipt received
    UI->>Buyer: Displays success toast
    UI->>UI: Table refreshes: Buyer is now tagged as "YOU OWN THIS"!
```

**Key Highlights:**
- **Contract-to-Account**: Ether moves securely from the buyer, through the smart contract, and directly to the seller's Externally Owned Account without escrow lockups.
- **CEI Security Pattern**: All internal ownership and status variables are modified *before* triggering the external Ether call, mitigating reentrancy attacks.

---

### 4. Immutable Historical Deed Audit Trail Workflow
*(Satisfies Requirement 6: Contract-to-Contract Historical Query & Requirement 8: View Function)*

```mermaid
sequenceDiagram
    autonumber
    actor User as Citizen / Auditor
    participant UI as Frontend
    participant Modal as History Modal
    participant Service as contract.js
    participant OH as OwnershipHistory.sol

    User->>UI: Clicks "📜 History" button on any parcel
    UI->>Modal: Opens modal popup in loading state
    UI->>Service: ContractService.getLandHistory(landId)
    Service->>OH: getHistory(landId) [view]
    OH-->>Service: TransferRecord[] (from, to, price, timestamp)
    Service-->>Modal: Formats records (translates address(0) to "Initial Government Deed Mint")
    Modal->>User: Displays chronological table with addresses, prices paid, and timestamps
```

---

## 🛡️ Security & Access Control Reference

| Modifier / Pattern | Contract | Protected Method | Security Mechanism |
|---|---|---|---|
| `onlyContractOwner` | `LandRegistry.sol` | `registerLand()`, `updateHistoryContract()` | `require(msg.sender == contractOwner, "Not authorized: Only contract owner can perform this");` |
| `onlyLandOwner(id)` | `LandRegistry.sol` | `listLandForSale()`, `delistLand()`, `updatePrice()` | `require(lands[_id].currentOwner == msg.sender, "Not authorized: Only the land owner can perform this");` |
| `landExists(id)` | `LandRegistry.sol` | `buyLand()`, `getLand()` | `require(lands[_id].id != 0, "Land parcel does not exist");` |
| `onlyAuthorized` | `OwnershipHistory.sol` | `recordTransfer()` | `require(msg.sender == registryContract \|\| msg.sender == admin);` |
| **Checks-Effects-Interactions (CEI)** | `LandRegistry.sol` | `buyLand()` | Updates owner and status state variables before making external `.call{value: ...}`. |

---

## 🎯 Viva & Presentation Cheat-Sheet

When demonstrating the project, follow this 5-minute walkthrough to cover all requirements:

1. **Show Role-Based Minting (Req 1, 3, 4, 7)**:
   - Connect with Account 0 (`0xFc8D...7569`). Point to the **`🏛️ Government Authority`** badge.
   - Point to line 127 in `LandRegistry.sol` showing the `onlyContractOwner` modifier on `registerLand()`.
   - Register a property: watch the live pure function acreage & stamp duty calculations update in real time.
2. **Show Directory & Govt Badge (Req 5, 8)**:
   - Notice the newly minted property appears in the table with the **`🏛️ GOVT PROPERTY`** badge.
   - Point to `getAllLands()` in `LandRegistry.sol` lines 261–267.
3. **Show Account Switching (Req 2)**:
   - Click **`🔄 Switch Account`** in the top bar. Pick Account 1 (`0x271c...74B0`).
   - The UI automatically updates: role badge switches to **`👤 Citizen`**, the registration form disappears, and the Citizen Purchase Portal notice appears.
4. **Show Purchase & Contract-to-Account (Req 6, 7)**:
   - As Citizen, click **`🛒 Buy`** on the government property.
   - Confirm in MetaMask: Ether transfers to Government Account 0, deed transfers to Citizen Account 1.
   - The parcel now displays **`YOU OWN THIS`** for the citizen.
5. **Show Contract-to-Contract Deed History (Req 6)**:
   - Click **`📜 History`** on the purchased property: show the immutable deed trail from `Initial Government Deed Mint` $\rightarrow$ Citizen purchase with full timestamps.
6. **Show Test Suite (Req 9)**:
   - In terminal, run `npx truffle test` and demonstrate **15 passing tests (100% green)**.
