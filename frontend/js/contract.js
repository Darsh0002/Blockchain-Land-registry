/**
 * Smart Contract Interaction Module (Ethers.js)
 */

const ContractService = {
  registryContract: null,
  historyContract: null,
  registryAddress: null,
  historyAddress: null,
  registryAbi: null,
  historyAbi: null,

  // Initialize contracts by loading ABI and deployed network addresses
  async init(providerOrSigner) {
    try {
      // 1. Fetch compiled Truffle artifacts from /abi/ directory
      const [registryArtifact, historyArtifact] = await Promise.all([
        fetch("./abi/LandRegistry.json").then((r) => r.json()),
        fetch("./abi/OwnershipHistory.json").then((r) => r.json()),
      ]);

      this.registryAbi = registryArtifact.abi;
      this.historyAbi = historyArtifact.abi;

      // Determine current network ID
      const network = await providerOrSigner.provider
        ? await providerOrSigner.provider.getNetwork()
        : await providerOrSigner.getNetwork();

      const chainId = network.chainId.toString();

      // Look up deployed address in truffle artifact networks (or fallback to known Ganache dev ids 5777 / 1337)
      const regNetworks = registryArtifact.networks || {};
      const histNetworks = historyArtifact.networks || {};

      const regDeployment = regNetworks[chainId] || regNetworks["5777"] || regNetworks["1337"] || Object.values(regNetworks).pop();
      const histDeployment = histNetworks[chainId] || histNetworks["5777"] || histNetworks["1337"] || Object.values(histNetworks).pop();

      if (regDeployment) {
        this.registryAddress = regDeployment.address;
      }
      if (histDeployment) {
        this.historyAddress = histDeployment.address;
      }

      console.log("Loaded LandRegistry at:", this.registryAddress);
      console.log("Loaded OwnershipHistory at:", this.historyAddress);

      if (this.registryAddress) {
        this.registryContract = new ethers.Contract(
          this.registryAddress,
          this.registryAbi,
          providerOrSigner
        );
      }

      if (this.historyAddress) {
        this.historyContract = new ethers.Contract(
          this.historyAddress,
          this.historyAbi,
          providerOrSigner
        );
      }

      return true;
    } catch (err) {
      console.error("Error loading contract artifacts:", err);
      return false;
    }
  },

  // Switch contract runner (Signer vs Provider)
  updateSigner(signer) {
    if (this.registryContract && this.registryAddress) {
      this.registryContract = this.registryContract.connect(signer);
    }
    if (this.historyContract && this.historyAddress) {
      this.historyContract = this.historyContract.connect(signer);
    }
  },

  /**
   * Fetch the Government Authority address (contractOwner) from the blockchain
   */
  async getContractOwner() {
    if (!this.registryContract) return null;
    return await this.registryContract.contractOwner();
  },

  /**
   * Requirement 5: Table Function - Fetch all registered land structs
   */
  async getAllLands() {
    if (!this.registryContract) throw new Error("Contract not initialized");
    return await this.registryContract.getAllLands();
  },

  /**
   * View details of a specific land
   */
  async getLand(landId) {
    if (!this.registryContract) throw new Error("Contract not initialized");
    return await this.registryContract.getLand(landId);
  },

  /**
   * Requirement 3: Operational Function - Register a new land parcel
   */
  async registerLand(location, areaSqFt, landNumber, priceInEth, listForSale) {
    if (!this.registryContract) throw new Error("Contract not initialized");
    const priceInWei = ethers.utils.parseEther(priceInEth.toString());
    const tx = await this.registryContract.registerLand(
      location,
      areaSqFt,
      landNumber,
      priceInWei,
      listForSale
    );
    return await tx.wait();
  },

  /**
   * List land for sale
   */
  async listLandForSale(landId, priceInEth) {
    if (!this.registryContract) throw new Error("Contract not initialized");
    const priceInWei = ethers.utils.parseEther(priceInEth.toString());
    const tx = await this.registryContract.listLandForSale(landId, priceInWei);
    return await tx.wait();
  },

  /**
   * Delist land from market
   */
  async delistLand(landId) {
    if (!this.registryContract) throw new Error("Contract not initialized");
    const tx = await this.registryContract.delistLand(landId);
    return await tx.wait();
  },

  /**
   * Update asking price of an owned parcel
   */
  async updatePrice(landId, newPriceInEth) {
    if (!this.registryContract) throw new Error("Contract not initialized");
    const priceInWei = ethers.utils.parseEther(newPriceInEth.toString());
    const tx = await this.registryContract.updatePrice(landId, priceInWei);
    return await tx.wait();
  },

  /**
   * Requirement 6: Contract-to-Account Purchase Function
   * Transfers Ether to the seller and calls OwnershipHistory contract
   */
  async buyLand(landId, priceInWei) {
    if (!this.registryContract) throw new Error("Contract not initialized");
    const tx = await this.registryContract.buyLand(landId, {
      value: priceInWei,
    });
    return await tx.wait();
  },

  /**
   * Requirement 8: Pure Function - Convert SqFt to Acres (scaled by 1000)
   */
  async convertSqFtToAcres(sqFt) {
    if (!this.registryContract) return ((sqFt * 1000) / 43560).toFixed(0);
    try {
      const res = await this.registryContract.convertSqFtToAcres(sqFt);
      return res.toString();
    } catch (e) {
      return ((sqFt * 1000) / 43560).toFixed(0);
    }
  },

  /**
   * Requirement 8: Pure Function - Calculate Stamp Duty (500 bps = 5%)
   */
  async calculateStampDuty(priceInEth, rateBps = 500) {
    const priceInWei = ethers.utils.parseEther(priceInEth.toString());
    if (!this.registryContract) return ethers.utils.formatEther(priceInWei.mul(rateBps).div(10000));
    try {
      const dutyWei = await this.registryContract.calculateStampDuty(priceInWei, rateBps);
      return ethers.utils.formatEther(dutyWei);
    } catch (e) {
      return (parseFloat(priceInEth) * 0.05).toFixed(4);
    }
  },

  /**
   * Requirement 6: Contract-to-Contract Historical Deed Query
   */
  async getLandHistory(landId) {
    if (!this.historyContract) throw new Error("OwnershipHistory contract not loaded");
    return await this.historyContract.getHistory(landId);
  },
};

window.ContractService = ContractService;

