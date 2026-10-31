/**
 * Main Application Logic & UI Controller
 */

const App = {
  activeFilter: "all",
  cachedLands: [],

  async init() {
    console.log("Initializing SafeLand Registry Application...");
    Wallet.init();

    // Check if wallet is already connected
    if (Wallet.isInstalled() && window.ethereum.selectedAddress) {
      await Wallet.connect();
    }

    // Set up default JSON-RPC provider (Ganache localhost 7545)
    const provider = Wallet.signer || new ethers.providers.JsonRpcProvider("http://127.0.0.1:7545");
    const loaded = await ContractService.init(provider);

    if (loaded && ContractService.registryAddress) {
      document.getElementById("displayContractAddr").textContent = Wallet.formatAddress(ContractService.registryAddress);
      document.getElementById("displayContractAddr").title = ContractService.registryAddress;
    } else {
      document.getElementById("displayContractAddr").textContent = "Not deployed on active network";
    }

    this.bindEvents();
    await this.loadAndRenderLands();
  },

  bindEvents() {
    // Wallet connect button
    document.getElementById("btnConnectWallet").addEventListener("click", async () => {
      try {
        const connected = await Wallet.connect();
        if (connected) {
          ContractService.updateSigner(Wallet.signer);
          this.showToast("MetaMask wallet connected successfully! You are ready to buy and sell.", "success");
          await this.loadAndRenderLands();
        }
      } catch (err) {
        this.showToast(err.message || "Failed to connect wallet", "error");
      }
    });

    // Refresh button
    document.getElementById("btnRefreshTable").addEventListener("click", () => {
      this.loadAndRenderLands();
    });

    // Filter chips
    document.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
        e.target.classList.add("active");
        this.activeFilter = e.target.getAttribute("data-filter");
        this.renderTable();
      });
    });

    // Register land form
    const registerForm = document.getElementById("registerLandForm");
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleRegisterLand();
    });

    // Live preview for Pure functions (Acreage & Stamp Duty)
    const areaInput = document.getElementById("landArea");
    const priceInput = document.getElementById("landPrice");

    const updateLiveCalculations = async () => {
      const area = parseFloat(areaInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;

      if (area > 0) {
        const scaledAcre = await ContractService.convertSqFtToAcres(area);
        const acres = (parseFloat(scaledAcre) / 1000).toFixed(3);
        document.getElementById("calcAcreage").textContent = `${acres} Acres`;
      } else {
        document.getElementById("calcAcreage").textContent = "0.000 Acres";
      }

      if (price > 0) {
        const duty = await ContractService.calculateStampDuty(price, 500); // 5%
        document.getElementById("calcStampDuty").textContent = `${parseFloat(duty).toFixed(4)} ETH`;
      } else {
        document.getElementById("calcStampDuty").textContent = "0.0000 ETH";
      }
    };

    areaInput.addEventListener("input", updateLiveCalculations);
    priceInput.addEventListener("input", updateLiveCalculations);

    // Modal close buttons
    document.getElementById("btnCloseHistoryModal").addEventListener("click", () => this.closeModal("historyModal"));
    document.getElementById("btnCloseHistoryBtn").addEventListener("click", () => this.closeModal("historyModal"));
    document.getElementById("btnClosePriceModal").addEventListener("click", () => this.closeModal("updatePriceModal"));
    document.getElementById("btnCancelPriceModal").addEventListener("click", () => this.closeModal("updatePriceModal"));

    // Modal form submit
    document.getElementById("updatePriceForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handlePriceModalSubmit();
    });
  },

  async onAccountChanged(newAccount) {
    ContractService.updateSigner(Wallet.signer);
    this.showToast(`Active account switched to ${Wallet.formatAddress(newAccount)}`, "info");
    await this.loadAndRenderLands();
  },

  onDisconnected() {
    this.showToast("Wallet disconnected", "info");
    this.renderTable();
  },

  /**
   * Requirement 5: Load and render data in table
   */
  async loadAndRenderLands() {
    const tbody = document.getElementById("landsTableBody");
    try {
      if (!ContractService.registryContract) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state-box"><div>Smart contracts not detected on this network. Please ensure Ganache is running.</div></td></tr>`;
        return;
      }

      // Fetch all lands from smart contract
      const rawLands = await ContractService.getAllLands();

      // Format data into clean JavaScript objects
      this.cachedLands = rawLands.map((item) => ({
        id: item.id.toNumber ? item.id.toNumber() : parseInt(item.id.toString()),
        location: item.location,
        areaSqFt: item.areaSqFt.toNumber ? item.areaSqFt.toNumber() : parseInt(item.areaSqFt.toString()),
        landNumber: item.landNumber.toNumber ? item.landNumber.toNumber() : parseInt(item.landNumber.toString()),
        currentOwner: item.currentOwner,
        priceWei: item.price,
        priceEth: ethers.utils.formatEther(item.price),
        isForSale: item.isForSale,
        status: item.status, // 0: Registered, 1: ForSale, 2: Sold
        registeredAt: item.registeredAt ? new Date(item.registeredAt.toNumber() * 1000) : null,
      }));

      // Update quick stats
      document.getElementById("statTotalLands").textContent = this.cachedLands.length;
      const forSaleCount = this.cachedLands.filter((l) => l.isForSale).length;
      document.getElementById("statForSaleLands").textContent = forSaleCount;

      this.renderTable();
    } catch (err) {
      console.error("Failed to load lands:", err);
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state-box"><div>Error loading properties: ${err.message}</div></td></tr>`;
    }
  },

  renderTable() {
    const tbody = document.getElementById("landsTableBody");
    tbody.innerHTML = "";

    // Apply active filter
    let filtered = [...this.cachedLands];
    if (this.activeFilter === "for-sale") {
      filtered = filtered.filter((l) => l.isForSale);
    } else if (this.activeFilter === "my-lands") {
      filtered = filtered.filter((l) => Wallet.isCurrentUser(l.currentOwner));
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state-box">
            <div class="empty-icon">📂</div>
            <div style="font-weight: 700;">No properties found in this category</div>
            <div style="font-size: 0.8rem; margin-top: 4px;">Try selecting "All Properties" or register a new one below!</div>
          </td>
        </tr>`;
      return;
    }

    filtered.forEach((land) => {
      const isOwner = Wallet.isCurrentUser(land.currentOwner);
      const acres = ((land.areaSqFt * 1000) / 43560 / 1000).toFixed(3);

      // Plain English status badges
      let statusBadge = "";
      if (land.isForSale) {
        statusBadge = `<span class="status-pill status-for-sale">🟢 Available to Buy</span>`;
      } else if (land.status === 2) {
        statusBadge = `<span class="status-pill status-sold">🤝 Sold</span>`;
      } else {
        statusBadge = `<span class="status-pill status-registered">🔒 Not for Sale</span>`;
      }

      // Plain English action buttons
      let actionButtons = `
        <button class="btn btn-sm btn-secondary" onclick="App.viewHistory(${land.id}, '${escape(land.location)}')" title="View permanent digital deed history">
          📜 History
        </button>
      `;

      if (isOwner) {
        if (land.isForSale) {
          actionButtons += `
            <button class="btn btn-sm btn-secondary" onclick="App.openPriceModal(${land.id}, 'update', '${land.priceEth}')" title="Change the asking price">
              ✏️ Price
            </button>
            <button class="btn btn-sm btn-danger" onclick="App.delistLand(${land.id})" title="Remove this property from the marketplace">
              🚫 Stop Selling
            </button>
          `;
        } else {
          actionButtons += `
            <button class="btn btn-sm btn-primary" onclick="App.openPriceModal(${land.id}, 'list', '${land.priceEth}')" title="List this property for buyers">
              🏷️ Put For Sale
            </button>
          `;
        }
      } else if (land.isForSale) {
        actionButtons += `
          <button class="btn btn-sm btn-success" onclick="App.buyLand(${land.id}, '${land.priceWei}', '${land.priceEth}')" title="Buy directly from the owner with ETH">
            🛒 Buy (${land.priceEth} ETH)
          </button>
        `;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${land.id}</strong></td>
        <td>
          <div style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem;">${land.location}</div>
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-weight: 600; color: #475569;">#${land.landNumber}</span>
        </td>
        <td>
          <div style="font-weight: 700;">${land.areaSqFt.toLocaleString()} sq ft</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">~${acres} acres</div>
        </td>
        <td>
          <div class="owner-badge">
            <span>${Wallet.formatAddress(land.currentOwner)}</span>
            ${isOwner ? '<span class="you-tag">YOU OWN THIS</span>' : ''}
          </div>
        </td>
        <td>
          <div style="font-weight: 800; color: #0f172a; font-size: 1rem;">${land.priceEth} ETH</div>
        </td>
        <td>${statusBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            ${actionButtons}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  /**
   * Register new land parcel
   */
  async handleRegisterLand() {
    if (!Wallet.account) {
      this.showToast("Please connect your MetaMask wallet first!", "error");
      await Wallet.connect();
      return;
    }

    const location = document.getElementById("landLocation").value.trim();
    const areaSqFt = parseInt(document.getElementById("landArea").value);
    const landNumber = parseInt(document.getElementById("landNumber").value);
    const priceEth = parseFloat(document.getElementById("landPrice").value);
    const listForSale = document.getElementById("landListForSale").checked;

    if (!location || isNaN(areaSqFt) || isNaN(landNumber) || isNaN(priceEth)) {
      this.showToast("Please fill out all property details accurately.", "error");
      return;
    }

    const submitBtn = document.getElementById("btnSubmitRegister");
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ Confirm in MetaMask...</span>`;

    try {
      this.showToast("Please approve the registration transaction in your MetaMask wallet...", "info");
      const receipt = await ContractService.registerLand(
        location,
        areaSqFt,
        landNumber,
        priceEth,
        listForSale
      );

      console.log("Registered:", receipt);
      this.showToast(`🎉 Property successfully registered on blockchain!`, "success");

      // Reset form & reload
      document.getElementById("registerLandForm").reset();
      document.getElementById("calcAcreage").textContent = "0.000 Acres";
      document.getElementById("calcStampDuty").textContent = "0.0000 ETH";

      await Wallet.updateState();
      await this.loadAndRenderLands();
    } catch (err) {
      console.error(err);
      this.showToast(err.reason || err.message || "Failed to register property", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  },

  /**
   * Requirement 6: Buy Land (Direct payment to seller EOA)
   */
  async buyLand(landId, priceWei, priceEth) {
    if (!Wallet.account) {
      this.showToast("Please connect your MetaMask wallet first!", "error");
      await Wallet.connect();
      return;
    }

    const confirmed = confirm(
      `Buy Property #${landId} for ${priceEth} ETH?\n\n` +
      `💰 Direct Payment: Your ${priceEth} ETH will be transferred directly to the seller with zero middleman commissions.\n` +
      `📜 Deed Transfer: Ownership deed will be transferred to your wallet address immediately.`
    );
    if (!confirmed) return;

    try {
      this.showToast("Please approve the purchase transaction in MetaMask...", "info");
      const receipt = await ContractService.buyLand(landId, priceWei);

      this.showToast(`🎉 Congratulations! You are now the official owner of Property #${landId}!`, "success");

      await Wallet.updateState();
      await this.loadAndRenderLands();
    } catch (err) {
      console.error(err);
      this.showToast(err.reason || err.message || "Purchase failed or was canceled", "error");
    }
  },

  /**
   * Delist land
   */
  async delistLand(landId) {
    if (!confirm(`Are you sure you want to stop selling Property #${landId}? It will be marked as "Not for Sale".`)) return;

    try {
      this.showToast("Updating property status...", "info");
      await ContractService.delistLand(landId);
      this.showToast(`Property #${landId} has been removed from marketplace.`, "success");
      await this.loadAndRenderLands();
    } catch (err) {
      this.showToast(err.reason || err.message || "Failed to update property status", "error");
    }
  },

  /**
   * Open modal to update price or list for sale
   */
  openPriceModal(landId, action, currentPriceEth) {
    document.getElementById("modalLandId").value = landId;
    document.getElementById("modalActionType").value = action;
    document.getElementById("modalPriceInput").value = currentPriceEth || "1.0";

    const title = action === "list" ? `🏷️ Put Property #${landId} For Sale` : `✏️ Change Price for Property #${landId}`;
    const hint = action === "list" ? "Enter the selling price in ETH for buyers" : "Enter the new asking price in ETH";

    document.getElementById("priceModalTitle").textContent = title;
    document.getElementById("modalPriceHint").textContent = hint;

    document.getElementById("updatePriceModal").classList.add("active");
  },

  async handlePriceModalSubmit() {
    const landId = parseInt(document.getElementById("modalLandId").value);
    const action = document.getElementById("modalActionType").value;
    const priceEth = parseFloat(document.getElementById("modalPriceInput").value);

    if (isNaN(priceEth) || priceEth <= 0) {
      this.showToast("Please enter a valid price in ETH greater than 0", "error");
      return;
    }

    try {
      this.closeModal("updatePriceModal");
      this.showToast("Please confirm the price update in MetaMask...", "info");

      if (action === "list") {
        await ContractService.listLandForSale(landId, priceEth);
        this.showToast(`Property #${landId} is now available for sale at ${priceEth} ETH!`, "success");
      } else {
        await ContractService.updatePrice(landId, priceEth);
        this.showToast(`Price for Property #${landId} updated to ${priceEth} ETH!`, "success");
      }

      await this.loadAndRenderLands();
    } catch (err) {
      this.showToast(err.reason || err.message || "Operation failed", "error");
    }
  },

  /**
   * View ownership deed history (Requirement 6 Contract-to-Contract)
   */
  async viewHistory(landId, encodedLocation) {
    const location = unescape(encodedLocation);
    document.getElementById("historyModalSubtitle").textContent = `Official Deed Trail for Property #${landId} (${location})`;
    const tbody = document.getElementById("historyTableBody");
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state-box"><div>Fetching verified records from OwnershipHistory contract...</div></td></tr>`;

    document.getElementById("historyModal").classList.add("active");

    try {
      const records = await ContractService.getLandHistory(landId);

      if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state-box"><div>No past transfers found.</div></td></tr>`;
        return;
      }

      tbody.innerHTML = "";
      records.forEach((rec, index) => {
        const fromAddr = rec.from === "0x0000000000000000000000000000000000000000"
          ? `<span style="color: #2563eb; font-weight: 700;">🏛️ Initial Government Deed Mint</span>`
          : `<span class="owner-badge">${Wallet.formatAddress(rec.from)}</span>`;

        const toAddr = `<span class="owner-badge">${Wallet.formatAddress(rec.to)}</span>`;
        const price = ethers.utils.formatEther(rec.price);
        const date = new Date(rec.timestamp.toNumber ? rec.timestamp.toNumber() * 1000 : parseInt(rec.timestamp.toString()) * 1000).toLocaleString();

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>#${index + 1}</strong></td>
          <td>${fromAddr}</td>
          <td>${toAddr}</td>
          <td><strong>${price} ETH</strong></td>
          <td><span style="font-size: 0.82rem; color: var(--text-muted);">${date}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state-box"><div>Could not load deed history: ${err.message}</div></td></tr>`;
    }
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
  },

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "❌";

    toast.innerHTML = `
      <div style="font-size: 1.2rem;">${icon}</div>
      <div style="flex: 1; font-weight: 500;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
