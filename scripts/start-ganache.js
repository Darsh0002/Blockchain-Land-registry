// Local Ganache provider launcher using Truffle's bundled Ganache engine
const path = require("path");
let ganache;

try {
  ganache = require("ganache");
} catch (e) {
  // Fall back to Truffle's bundled ganache
  const trufflePath = path.resolve(
    process.env.APPDATA,
    "npm/node_modules/truffle/node_modules/ganache"
  );
  ganache = require(trufflePath);
}

const PORT = 7545;
const NETWORK_ID = 5777;

const server = ganache.server({
  port: PORT,
  network_id: NETWORK_ID,
  chain: {
    networkId: NETWORK_ID,
    chainId: 1337,
  },
  wallet: {
    totalAccounts: 10,
    defaultBalance: 100, // 100 ETH per account
    mnemonic: "hire swift coffee arena float jungle spray base pulse palace faculty collect",
  },
  logging: {
    quiet: false,
  },
});

server.listen(PORT, (err) => {
  if (err) {
    console.error("Failed to start Ganache:", err);
    process.exit(1);
  }
  console.log(`=======================================================`);
  console.log(`🚀 Local Ganache Blockchain started on http://127.0.0.1:${PORT}`);
  console.log(`   Network ID: ${NETWORK_ID} | Chain ID: 1337`);
  console.log(`   Default 10 accounts initialized with 100 ETH each`);
  console.log(`   MetaMask RPC URL: http://127.0.0.1:${PORT}`);
  console.log(`   MetaMask Chain ID: 1337`);
  console.log(`=======================================================`);
});

