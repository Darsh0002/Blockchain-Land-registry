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
};

