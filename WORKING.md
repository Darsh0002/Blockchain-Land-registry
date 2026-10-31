# 📖 Land Registry DApp - System Architecture & Workflow Guide

This document provides a comprehensive, step-by-step breakdown of how the **Blockchain Land Registry** operates, from low-level smart contract mechanics to the user interface.

---

## 🏛️ System Architecture Diagram
![alt text](<1. Blockchain Land Registry Architecture.png>)
```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Frontend)"]
        UI["Web Dashboard (index.html, style.css)"]
        App["UI Controller (app.js)"]
        WalletMgr["Wallet Manager (wallet.js)"]
        ContractSvc["Contract Bridge (contract.js)"]
        MM["MetaMask Extension"]
    end

    subgraph BlockchainLayer ["Ethereum Blockchain (Ganache Testnet)"]
        subgraph Contracts ["Smart Contracts"]
            LR["LandRegistry.sol\n- Parcellation\n- Marketplace\n- Table Functions\n- Pure & View Utilities"]
            OH["OwnershipHistory.sol\n- Immutable Deed History\n- Contract-to-Contract Target"]
        end
        
        subgraph Accounts ["Accounts (EOAs)"]
            Seller["Seller EOA\n(Receives ETH on Sale)"]
            Buyer["Buyer EOA\n(Purchases with ETH)"]
        end
    end

    UI --> App
    App --> WalletMgr
    App --> ContractSvc
    WalletMgr <--> MM
    ContractSvc <--> MM
    MM <-->|"JSON-RPC (Port 7545)"| BlockchainLayer
    ContractSvc -->|"Calls View / State Functions"| LR
    LR -->|"Contract-to-Contract (recordTransfer)"| OH
    LR -->|"Contract-to-Account (ETH Transfer)"| Seller
    Buyer -->|"ETH Payment (msg.value)"| LR
```

---

## 🔄 End-to-End Workflows

### 1. Wallet Connection & Network Synchronization Workflow
*(Satisfies Requirement 2: Connect Wallet)*

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend (index.html)
    participant Wallet as wallet.js
    participant MM as MetaMask
    participant Chain as Ganache Node (127.0.0.1:7545)

    User->>UI: Clicks "Connect MetaMask"
    UI->>Wallet: Wallet.connect()
    Wallet->>MM: eth_requestAccounts
    MM-->>User: Prompts account permission popup
    User->>MM: Approves connection
    MM-->>Wallet: Returns active account address
    Wallet->>MM: wallet_switchEthereumChain (0x539 / 1337)
    opt Network not added yet
        MM-->>Wallet: Error 4902 (Not Found)
        Wallet->>MM: wallet_addEthereumChain (Ganache Local)
        MM-->>User: Prompt to add Ganache Local
        User->>MM: Approves
    end
    Wallet->>Chain: getBalance(address)
    Chain-->>Wallet: Account balance in Wei
    Wallet->>UI: Renders address, 99.99 ETH balance, "🟢 Connected" badge
```

**Key Highlights:**
- **Zero-Friction Onboarding**: Automatically detects whether the user is on the local network (`0x539`) and prompts MetaMask to switch seamlessly.
- **Dynamic Event Handling**: Listens to `accountsChanged` and `chainChanged` events; switching accounts in MetaMask instantly updates the UI without page reload.

---

### 2. Land Parcels Table Querying Workflow
*(Satisfies Requirement 5: Table Function & Requirement 8: View Function)*

```mermaid
sequenceDiagram
    autonumber
    participant UI as Frontend Table
    participant App as app.js
    participant Service as contract.js
    participant LR as LandRegistry.sol

    App->>Service: ContractService.getAllLands()
    Service->>LR: getAllLands() [view]
    LR-->>Service: Land[] (Array of all struct Land records)
    Service-->>App: Raw Land objects
    loop For each land parcel
        App->>Service: convertSqFtToAcres(areaSqFt) [pure]
        Service->>LR: convertSqFtToAcres(areaSqFt)
        LR-->>App: Scaled acreage value
        App->>UI: Appends <tr> row with Parcel ID, Survey #, Owner, Price, Badges & Actions
    end
    App->>UI: Updates quick stat counters (Total Lands, Lands For Sale)
```

**Key Highlights:**
- **Batch Retrieval**: Rather than making individual RPC calls for each parcel ID, `getAllLands()` returns an array of structs in a single call, optimizing network performance.
- **Smart Ownership Detection**: The UI compares `land.currentOwner` with the connected account; if identical, it tags the parcel with a **`YOU`** badge and displays management actions (**Price**, **Delist**) rather than a **Buy** button.

---

### 3. Registering a New Land Parcel Workflow
*(Satisfies Requirement 3: One Function, Requirement 6: Contract-to-Contract, Requirement 7: `require`, Requirement 8: `pure`)*

```mermaid
sequenceDiagram
    autonumber
    actor User as Property Owner
    participant Form as Register Form
    participant App as app.js
    participant MM as MetaMask
    participant LR as LandRegistry.sol
    participant OH as OwnershipHistory.sol

    User->>Form: Enters Location, Survey #, Area (sq ft), Asking Price (ETH)
    Form->>App: Input event on Area / Price
    App->>LR: convertSqFtToAcres(area) [pure]
    App->>LR: calculateStampDuty(price, 500) [pure]
    LR-->>App: Calculated Acres and 5% Stamp Duty in ETH
    App->>Form: Real-time calculation preview updated live!
    User->>Form: Clicks "Register Land Parcel"
    Form->>App: Submits form data
    App->>MM: Invokes registerLand(...) transaction
    MM-->>User: Prompts transaction confirmation & gas fee
    User->>MM: Confirms
    MM->>LR: registerLand(location, area, landNumber, price, listForSale)
    
    rect rgb(240, 248, 255)
        Note over LR: Execution inside Smart Contract
        LR->>LR: require(location.length > 0)
        LR->>LR: require(areaSqFt > 0)
        LR->>LR: require(landNumber > 0)
        LR->>LR: totalLandsCount++
        LR->>LR: lands[newId] = Land(...)
        LR->>LR: allLandIds.push(newId)
        LR->>OH: recordTransfer(newId, address(0), msg.sender, price) [Contract-to-Contract]
        OH->>OH: landHistory[newId].push(TransferRecord)
        LR->>LR: emit LandRegistered(...)
    end

    LR-->>MM: Transaction mined (Receipt)
    MM-->>App: Success receipt
    App->>User: Displays success toast with Tx hash
    App->>App: Automatically refreshes the table!
```

**Key Highlights:**
- **Contract-to-Contract Initial Logging**: Upon creation, `LandRegistry` calls `OwnershipHistory.recordTransfer(...)` with `from: 0x0`, creating an immutable genesis deed for the parcel.
- **Live Pure Functions**: The form demonstrates `pure` functions before transaction submission, computing acreage and government stamp duty dynamically.

---

### 4. Buying Land & Ether Settlement Workflow
*(Satisfies Requirement 6: Contract-to-Account & Contract-to-Contract, Requirement 7: `require`)*

```mermaid
sequenceDiagram
    autonumber
    actor Buyer as Buyer EOA
    participant UI as DApp Table
    participant MM as MetaMask
    participant LR as LandRegistry.sol
    participant Seller as Seller EOA
    participant OH as OwnershipHistory.sol

    Buyer->>UI: Clicks "Buy (1.5 ETH)" on Parcel #1
    UI->>Buyer: Shows confirmation dialog
    Buyer->>UI: Confirms purchase
    UI->>MM: Invokes buyLand(1) with value: 1.5 ETH
    MM-->>Buyer: Prompts MetaMask transaction popup
    Buyer->>MM: Approves 1.5 ETH payment + gas
    MM->>LR: buyLand(1) { value: 1.5 ether }

    rect rgb(255, 250, 240)
        Note over LR: State Validation (require)
        LR->>LR: require(land.isForSale == true)
        LR->>LR: require(msg.sender != land.currentOwner)
        LR->>LR: require(msg.value >= land.price)
        
        Note over LR: State Transition (Checks-Effects-Interactions)
        LR->>LR: address payable previousOwner = land.currentOwner
        LR->>LR: land.currentOwner = payable(msg.sender)
        LR->>LR: land.isForSale = false
        LR->>LR: land.status = LandStatus.Sold
        
        Note over LR: Financial Settlement (Contract-to-Account)
        LR->>Seller: previousOwner.call{value: 1.5 ETH}("")
        Seller-->>LR: Ether accepted (Balance increases by 1.5 ETH)
        
        Note over LR: Deed Audit Trail (Contract-to-Contract)
        LR->>OH: recordTransfer(1, previousOwner, msg.sender, 1.5 ETH)
        OH->>OH: Appends TransferRecord to parcel history

        opt Excess Ether Sent
            LR->>Buyer: payable(msg.sender).call{value: refundAmount}("")
        end

        LR->>LR: emit LandPurchased(1, previousOwner, msg.sender, price)
    end

    LR-->>MM: Transaction confirmed
    MM-->>UI: Receipt received
    UI->>Buyer: Displays success alert!
    UI->>UI: Table refreshes: Buyer is now tagged as "YOU"!
```

**Key Highlights:**
- **Contract-to-Account**: Ether moves from the buyer's wallet, through the contract, and directly into the seller's Externally Owned Account (`previousOwner.call{value: salePrice}("")`).
- **Reentrancy Protection**: State variables (`land.currentOwner`, `isForSale`) are updated *before* transferring Ether, adhering strictly to the **Checks-Effects-Interactions (CEI)** security pattern.
- **Contract-to-Contract Deed Logging**: Concurrently triggers `OwnershipHistory.recordTransfer(...)` to permanently log the deed change on-chain.

---

### 5. Viewing Immutable Deed Audit Trail Workflow
*(Satisfies Requirement 6: Contract-to-Contract Historical Query)*

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Frontend
    participant Modal as History Modal
    participant Service as contract.js
    participant OH as OwnershipHistory.sol

    User->>UI: Clicks "📜 History" button on any parcel
    UI->>Modal: Opens modal popup in loading state
    UI->>Service: ContractService.getLandHistory(landId)
    Service->>OH: getHistory(landId) [view]
    OH-->>Service: TransferRecord[] (from, to, price, timestamp)
    Service-->>Modal: Formatted historical deed records
    Modal->>User: Displays chronological table of all past deeds with addresses & timestamps
```

**Key Highlights:**
- Demonstrates distributed separation of concerns: property market operations live in `LandRegistry.sol`, while historical transfer audits live in `OwnershipHistory.sol`.

---

## 🛡️ Security & Access Control Mechanics

| Modifier / Guard | Target Contract | Purpose | Protection Mechanism |
|---|---|---|---|
| `onlyContractOwner` | `LandRegistry.sol` | Admin operations (e.g. updating the history contract link) | `require(msg.sender == contractOwner, "Not authorized");` |
| `onlyLandOwner(uint256 _id)` | `LandRegistry.sol` | Listing parcel, updating price, delisting | `require(lands[_id].currentOwner == msg.sender, "Only land owner");` |
| `landExists(uint256 _id)` | `LandRegistry.sol` | Validates parcel existence | `require(lands[_id].id != 0, "Land parcel does not exist");` |
| `onlyAuthorized` | `OwnershipHistory.sol` | Prevents arbitrary modification of deed records | `require(msg.sender == registryContract || msg.sender == admin);` |
| Checks-Effects-Interactions | `LandRegistry.sol` | Prevents reentrancy during Ether transfer | State updated before `.call{value: ...}` external transfer |

---

## 🎯 Viva & Presentation Cheat-Sheet

When presenting or demonstrating this project, follow this roadmap to showcase all 9 requirements:

1. **Show Contracts (Req 1, 4, 7, 8)**:
   - Open [`contracts/LandRegistry.sol`](file:///contracts/LandRegistry.sol). Point to the **Constructor** at lines 77–82, **Modifiers** at lines 57–72, **pure functions** (`convertSqFtToAcres`, `calculateStampDuty`) at lines 235–251, and `require` statements in `buyLand` at lines 174–177.
2. **Show Contract-to-Contract (Req 6)**:
   - Point to line 189 in `LandRegistry.sol` where `historyContract.recordTransfer(...)` is called, and show the implementation in [`contracts/OwnershipHistory.sol`](file:///contracts/OwnershipHistory.sol).
3. **Show Contract-to-Account (Req 6)**:
   - Point to line 186 in `LandRegistry.sol` where Ether is forwarded to the seller via `previousOwner.call{value: salePrice}("")`.
4. **Show Wallet Connection (Req 2)**:
   - Show the green **`🟢 Connected`** badge, address, and live ETH balance in the top bar of the frontend.
5. **Show Table (Req 5)**:
   - Demonstrate the dynamic table in the browser with search, filters (**All Parcels**, **For Sale Only**, **My Parcels**), and the **`YOU`** ownership badge.
6. **Show Test Suite (Req 9)**:
   - In terminal, run `npm test` and show all **14 tests passing** with 100% green checkmarks.

