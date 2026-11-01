/**
 * Wallet Connection Module (MetaMask Integration - Requirement 2)
 */

const Wallet = {
  provider: null,
  signer: null,
  account: null,
  network: null,
  balance: null,

  // Check if MetaMask or compatible web3 browser extension is installed
  isInstalled() {
    return typeof window.ethereum !== "undefined";
  },

  // Initialize and attach event listeners
  init() {
    if (!this.isInstalled()) {
      console.warn("MetaMask is not installed.");
      return;
    }

    // Wrap window.ethereum in Ethers.js Web3Provider
    this.provider = new ethers.providers.Web3Provider(window.ethereum);

    // Listen for account change in MetaMask
    window.ethereum.on("accountsChanged", (accounts) => {
      console.log("Account changed:", accounts);
      if (accounts.length > 0) {
        this.account = accounts[0];
        this.signer = this.provider.getSigner();
        this.updateState();
        if (window.App && window.App.onAccountChanged) {
          window.App.onAccountChanged(this.account);
        }
      } else {
        this.reset();
        if (window.App && window.App.onDisconnected) {
          window.App.onDisconnected();
        }
      }
    });

    // Listen for network / chain changes
    window.ethereum.on("chainChanged", (chainId) => {
      console.log("Network chain changed to:", chainId);
      window.location.reload();
    });
  },

  // Ensure user is on Ganache Local network (Chain ID 1337 = 0x539)
  async ensureGanacheNetwork() {
    if (!window.ethereum) return;
    const GANACHE_CHAIN_ID_HEX = "0x539"; // 1337 in hex
    try {
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId === GANACHE_CHAIN_ID_HEX) return; // Already on Ganache!

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: GANACHE_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      if (
        switchError.code === 4902 ||
        switchError.code === -32603 ||
        switchError.data?.originalError?.code === 4902
      ) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: GANACHE_CHAIN_ID_HEX,
                chainName: "Ganache Local",
                rpcUrls: ["http://127.0.0.1:7545"],
                nativeCurrency: {
                  name: "Ether",
                  symbol: "ETH",
                  decimals: 18,
                },
              },
            ],
          });
        } catch (addError) {
          console.warn("Could not auto-add Ganache network:", addError);
        }
      } else {
        console.warn("Network switch notice:", switchError.message);
      }
    }
  },

  // Prompt user to connect wallet
  async connect() {
    if (!this.isInstalled()) {
      alert("MetaMask is not installed! Please install MetaMask extension to interact with this DApp.");
      window.open("https://metamask.io/download/", "_blank");
      return false;
    }

    try {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);

      // Step 1: Request access to MetaMask accounts FIRST (this authorizes the origin!)
      const accounts = await this.provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) return false;

      this.account = accounts[0];
      this.signer = this.provider.getSigner();

      // Step 2: Now that origin is authorized, safely ensure Ganache network
      try {
        await this.ensureGanacheNetwork();
      } catch (e) {
        console.warn("Network switch skipped:", e);
      }

      // Step 3: Refresh state and balance
      await this.updateState();
      return true;
    } catch (error) {
      console.error("Wallet connection error:", error);
      throw error;
    }
  },

  /**
   * Open MetaMask account picker so the user can choose a different account.
   * Uses wallet_requestPermissions which always shows the account selection UI.
   */
  async switchAccount() {
    if (!this.isInstalled()) return;
    try {
      // wallet_requestPermissions always opens MetaMask's account chooser
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      // After user picks an account, eth_accounts returns the selected one
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await this.provider.send("eth_accounts", []);
      if (accounts && accounts.length > 0) {
        this.account = accounts[0];
        this.signer = this.provider.getSigner();
        await this.updateState();
        return true;
      }
    } catch (err) {
      if (err.code === 4001) {
        console.log("User cancelled account switch.");
      } else {
        console.error("Account switch error:", err);
      }
    }
    return false;
  },

  // Refresh balance & network
  async updateState() {
    if (!this.account || !this.provider) return;

    try {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      const balanceWei = await this.provider.getBalance(this.account);
      this.balance = ethers.utils.formatEther(balanceWei);
      this.network = await this.provider.getNetwork();

      this.renderWalletUI();
    } catch (err) {
      console.error("Failed to update wallet state:", err);
    }
  },

  reset() {
    this.account = null;
    this.signer = null;
    this.balance = null;
    this.network = null;
    this.renderWalletUI();
  },

  // Render wallet status to DOM
  renderWalletUI() {
    const btnConnect = document.getElementById("btnConnectWallet");
    const btnSwitch = document.getElementById("btnSwitchAccount");
    const btnText = document.getElementById("walletBtnText");
    const badge = document.getElementById("connectionBadge");
    const displayAccount = document.getElementById("displayAccount");
    const displayBalance = document.getElementById("displayBalance");
    const displayNetwork = document.getElementById("displayNetwork");

    if (this.account) {
      const shortAddr = this.formatAddress(this.account);
      btnText.textContent = shortAddr;
      btnConnect.classList.remove("btn-primary");
      btnConnect.classList.add("btn-outline");

      // Show Switch Account button once connected
      if (btnSwitch) btnSwitch.style.display = "inline-flex";

      badge.textContent = "🟢 Connected";
      badge.className = "badge badge-success";

      displayAccount.textContent = shortAddr;
      displayAccount.title = this.account;

      displayBalance.textContent = `${parseFloat(this.balance || 0).toFixed(4)} ETH`;

      const netName =
        this.network
          ? this.network.chainId === 1337 || this.network.chainId === 5777
            ? "Ganache Local"
            : this.network.name
          : "-";
      displayNetwork.textContent = netName;
    } else {
      btnText.textContent = "Connect MetaMask";
      btnConnect.classList.add("btn-primary");
      btnConnect.classList.remove("btn-outline");

      // Hide Switch Account button when disconnected
      if (btnSwitch) btnSwitch.style.display = "none";

      badge.textContent = "⚪ Disconnected";
      badge.className = "badge badge-neutral";

      displayAccount.textContent = "Not Connected";
      displayBalance.textContent = "0.0000 ETH";
      displayNetwork.textContent = "-";
    }
  },

  // Format Ethereum address for clean display (e.g. 0x1234...abcd)
  formatAddress(addr) {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  },

  // Check if a given address is the currently connected wallet
  isCurrentUser(addr) {
    if (!this.account || !addr) return false;
    return this.account.toLowerCase() === addr.toLowerCase();
  },
};

window.Wallet = Wallet;
