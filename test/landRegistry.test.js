const OwnershipHistory = artifacts.require("OwnershipHistory");
const LandRegistry = artifacts.require("LandRegistry");

contract("LandRegistry & OwnershipHistory Test Suite", (accounts) => {
  const [admin, seller, buyer, unauthorized] = accounts;

  let historyContract;
  let registryContract;

  beforeEach(async () => {
    // 1. Deploy OwnershipHistory
    historyContract = await OwnershipHistory.new({ from: admin });

    // 2. Deploy LandRegistry with historyContract address (Constructor Requirement 4)
    registryContract = await LandRegistry.new(historyContract.address, { from: admin });

    // 3. Authorize LandRegistry in OwnershipHistory
    await historyContract.setRegistryContract(registryContract.address, { from: admin });
  });

  describe("1. Constructor and Initialization", () => {
    it("should set the contractOwner correctly upon deployment", async () => {
      const owner = await registryContract.contractOwner();
      assert.equal(owner, admin, "Admin should be the contract owner");
    });

    it("should set the historyContract address in LandRegistry", async () => {
      const linkedHistory = await registryContract.historyContract();
      assert.equal(
        linkedHistory.toLowerCase(),
        historyContract.address.toLowerCase(),
        "History contract address should match"
      );
    });

    it("should revert if initialized with zero address", async () => {
      try {
        await LandRegistry.new("0x0000000000000000000000000000000000000000", { from: admin });
        assert.fail("Deployment with zero address should have reverted");
      } catch (err) {
        assert(err.message.includes("Invalid history contract address"));
      }
    });
  });

  describe("2. Land Registration & Table Functions (Req 3, 5, 7)", () => {
    it("should register a new land and log initial deed in OwnershipHistory (Contract-to-Contract)", async () => {
      const price = web3.utils.toWei("2", "ether");
      const tx = await registryContract.registerLand(
        "Plot 101, Palm Avenue",
        2000,
        555,
        price,
        true,
        { from: seller }
      );

      // Check event
      const event = tx.logs.find((l) => l.event === "LandRegistered");
      assert.isOk(event, "LandRegistered event should be emitted");
      assert.equal(event.args.landId.toString(), "1");
      assert.equal(event.args.location, "Plot 101, Palm Avenue");
      assert.equal(event.args.owner, seller);

      // Check totalLandsCount
      const count = await registryContract.getLandCount();
      assert.equal(count.toString(), "1");

      // Check Land struct details via getLand (view)
      const land = await registryContract.getLand(1);
      assert.equal(land.location, "Plot 101, Palm Avenue");
      assert.equal(land.areaSqFt.toString(), "2000");
      assert.equal(land.landNumber.toString(), "555");
      assert.equal(land.currentOwner, seller);
      assert.equal(land.price.toString(), price);
      assert.equal(land.isForSale, true);

      // Check Contract-to-Contract call in OwnershipHistory
      const history = await historyContract.getHistory(1);
      assert.equal(history.length, 1, "Should have 1 history record");
      assert.equal(history[0].from, "0x0000000000000000000000000000000000000000");
      assert.equal(history[0].to, seller);
    });

    it("should return all lands for frontend table display via getAllLands()", async () => {
      await registryContract.registerLand("Plot A", 1000, 1, web3.utils.toWei("1", "ether"), true, { from: seller });
      await registryContract.registerLand("Plot B", 2500, 2, web3.utils.toWei("3", "ether"), false, { from: admin });

      const allLands = await registryContract.getAllLands();
      assert.equal(allLands.length, 2, "Should return 2 lands for table");
      assert.equal(allLands[0].location, "Plot A");
      assert.equal(allLands[1].location, "Plot B");
    });

    it("should revert if invalid inputs are passed to registerLand (require checks)", async () => {
      try {
        await registryContract.registerLand("", 1000, 10, 100, true, { from: seller });
        assert.fail("Should have reverted on empty location");
      } catch (err) {
        assert(err.message.includes("Location cannot be empty"));
      }

      try {
        await registryContract.registerLand("Location", 0, 10, 100, true, { from: seller });
        assert.fail("Should have reverted on zero area");
      } catch (err) {
        assert(err.message.includes("Area must be greater than zero"));
      }
    });
  });

  describe("3. Listing, Price Updates, and Delisting Access Control (Req 1, 7)", () => {
    beforeEach(async () => {
      await registryContract.registerLand(
        "Suburban Parcel 77",
        1500,
        777,
        web3.utils.toWei("1", "ether"),
        false,
        { from: seller }
      );
    });

    it("should allow only the land owner to list land for sale", async () => {
      const newPrice = web3.utils.toWei("2.5", "ether");

      // Non-owner attempt should fail
      try {
        await registryContract.listLandForSale(1, newPrice, { from: unauthorized });
        assert.fail("Unauthorized account should not list land");
      } catch (err) {
        assert(err.message.includes("Only the land owner can perform this"));
      }

      // Owner lists land
      await registryContract.listLandForSale(1, newPrice, { from: seller });
      const land = await registryContract.getLand(1);
      assert.equal(land.isForSale, true);
      assert.equal(land.price.toString(), newPrice);
    });

    it("should allow land owner to update price and delist", async () => {
      const price1 = web3.utils.toWei("2", "ether");
      await registryContract.listLandForSale(1, price1, { from: seller });

      // Update price
      const price2 = web3.utils.toWei("3", "ether");
      await registryContract.updatePrice(1, price2, { from: seller });
      let land = await registryContract.getLand(1);
      assert.equal(land.price.toString(), price2);

      // Delist
      await registryContract.delistLand(1, { from: seller });
      land = await registryContract.getLand(1);
      assert.equal(land.isForSale, false);
    });
  });

  describe("4. Buy Land: Contract-to-Account & Contract-to-Contract (Req 6 & 7)", () => {
    const salePrice = web3.utils.toWei("2", "ether");

    beforeEach(async () => {
      await registryContract.registerLand(
        "Oceanview Lot #9",
        3000,
        909,
        salePrice,
        true,
        { from: seller }
      );
    });

    it("should revert if land owner tries to buy their own land", async () => {
      try {
        await registryContract.buyLand(1, { from: seller, value: salePrice });
        assert.fail("Land owner cannot buy their own land");
      } catch (err) {
        assert(err.message.includes("Owner cannot buy their own land"));
      }
    });

    it("should revert if insufficient Ether is sent", async () => {
      try {
        const insufficientAmount = web3.utils.toWei("1", "ether");
        await registryContract.buyLand(1, { from: buyer, value: insufficientAmount });
        assert.fail("Should revert when value < price");
      } catch (err) {
        assert(err.message.includes("Ether sent is less than land asking price"));
      }
    });

    it("should execute purchase: transfer ETH to seller (Contract-to-Account) and record history (Contract-to-Contract)", async () => {
      const sellerBalanceBefore = BigInt(await web3.eth.getBalance(seller));

      // Buyer purchases land
      const tx = await registryContract.buyLand(1, { from: buyer, value: salePrice });

      // Verify event
      const event = tx.logs.find((l) => l.event === "LandPurchased");
      assert.isOk(event, "LandPurchased event must be emitted");
      assert.equal(event.args.previousOwner, seller);
      assert.equal(event.args.newOwner, buyer);
      assert.equal(event.args.price.toString(), salePrice);

      // Verify Contract-to-Account: Seller received the sale price
      const sellerBalanceAfter = BigInt(await web3.eth.getBalance(seller));
      const balanceDiff = sellerBalanceAfter - sellerBalanceBefore;
      assert.equal(
        balanceDiff.toString(),
        salePrice,
        "Seller must receive the full land purchase price in Ether"
      );

      // Verify new owner and status
      const land = await registryContract.getLand(1);
      assert.equal(land.currentOwner, buyer, "Buyer is now the current owner");
      assert.equal(land.isForSale, false, "Land is no longer for sale");

      // Verify Contract-to-Contract: OwnershipHistory has the new record
      const history = await historyContract.getHistory(1);
      assert.equal(history.length, 2, "Should have 2 history records (registration + purchase)");
      assert.equal(history[1].from, seller);
      assert.equal(history[1].to, buyer);
      assert.equal(history[1].price.toString(), salePrice);
    });

    it("should refund excess payment back to the buyer", async () => {
      const paymentAmount = web3.utils.toWei("3", "ether"); // 1 ETH extra
      const buyerBalanceBefore = BigInt(await web3.eth.getBalance(buyer));

      const tx = await registryContract.buyLand(1, {
        from: buyer,
        value: paymentAmount,
        gasPrice: "20000000000",
      });

      const gasUsed = BigInt(tx.receipt.gasUsed);
      const gasCost = gasUsed * BigInt(20000000000);

      const buyerBalanceAfter = BigInt(await web3.eth.getBalance(buyer));
      const expectedBalance = buyerBalanceBefore - BigInt(salePrice) - gasCost;

      // Allow slight difference due to calculation precision
      const diff = buyerBalanceAfter > expectedBalance ? buyerBalanceAfter - expectedBalance : expectedBalance - buyerBalanceAfter;
      assert(diff < BigInt(1000000000), "Buyer should be refunded excess 1 ETH");
    });
  });

  describe("5. Pure & View Functions (Req 8)", () => {
    it("convertSqFtToAcres (pure) calculates acre values scaled by 1000", async () => {
      // 43,560 sq ft = 1.000 acre -> returns 1000
      const acresScaled = await registryContract.convertSqFtToAcres(43560);
      assert.equal(acresScaled.toString(), "1000");

      // 87,120 sq ft = 2.000 acres -> returns 2000
      const acresScaled2 = await registryContract.convertSqFtToAcres(87120);
      assert.equal(acresScaled2.toString(), "2000");
    });

    it("calculateStampDuty (pure) calculates stamp duty correctly", async () => {
      const price = web3.utils.toWei("10", "ether");
      // 5% rate = 500 basis points
      const duty = await registryContract.calculateStampDuty(price, 500);
      const expectedDuty = web3.utils.toWei("0.5", "ether");
      assert.equal(duty.toString(), expectedDuty);
    });
  });
});

