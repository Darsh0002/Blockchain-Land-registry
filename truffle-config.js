module.exports = {
  contracts_build_directory: "./frontend/abi",
  networks: {
    // Ganache GUI default port is 7545
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*", // Match any network id
    },
    // Ganache CLI or Truffle Develop default port is 8545
    ganacheCli: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
    },
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.20",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        evmVersion: "paris",  // Required: Ganache doesn't support PUSH0 (shanghai/cancun default)
      },
    },
  },
};

