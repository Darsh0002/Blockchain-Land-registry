const OwnershipHistory = artifacts.require("OwnershipHistory");
const LandRegistry = artifacts.require("LandRegistry");

module.exports = async function (deployer, network, accounts) {
  // 1. Deploy OwnershipHistory contract
  await deployer.deploy(OwnershipHistory);
  const historyInstance = await OwnershipHistory.deployed();
  console.log("OwnershipHistory deployed at:", historyInstance.address);

  // 2. Deploy LandRegistry contract with OwnershipHistory address in constructor
  await deployer.deploy(LandRegistry, historyInstance.address);
  const registryInstance = await LandRegistry.deployed();
  console.log("LandRegistry deployed at:", registryInstance.address);

  // 3. Authorize LandRegistry to call OwnershipHistory.recordTransfer
  await historyInstance.setRegistryContract(registryInstance.address);
  console.log("Authorized LandRegistry in OwnershipHistory.");

  // 4. (Optional seed data for demonstration): Register initial land parcels if on local testnet
  if (network === "development" || network === "ganacheCli") {
    const admin = accounts[0];
    const seller = accounts[1] || accounts[0];

    try {
      // Seed Land 1: Listed for sale at 1.5 ETH
      await registryInstance.registerLand(
        "Plot 42, Green Valley Hills, Sector 5",
        2400, // area in sq ft
        101,  // survey number
        web3.utils.toWei("1.5", "ether"),
        true, // list for sale
        { from: seller }
      );

      // Seed Land 2: Not listed for sale
      await registryInstance.registerLand(
        "Commercial Plot 12B, IT Tech Park",
        5000, // area in sq ft
        205,  // survey number
        web3.utils.toWei("5.0", "ether"),
        false, // not for sale
        { from: admin }
      );

      console.log("Seeded initial demo land parcels successfully!");
    } catch (err) {
      console.log("Notice: Sample land seeding skipped or completed:", err.message);
    }
  }
};

