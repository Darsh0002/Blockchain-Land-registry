// Self-contained automated test runner that spins up Ganache, runs Truffle tests, and shuts down
const path = require("path");
const { spawn, exec } = require("child_process");

let ganache;
try {
  ganache = require("ganache");
} catch (e) {
  const trufflePath = path.resolve(
    process.env.APPDATA,
    "npm/node_modules/truffle/node_modules/ganache"
  );
  ganache = require(trufflePath);
}

const server = ganache.server({
  port: 7545,
  network_id: 5777,
  chain: { networkId: 5777, chainId: 1337 },
  wallet: {
    totalAccounts: 10,
    defaultBalance: 100,
  },
  logging: { quiet: true },
});

server.listen(7545, (err) => {
  if (err) {
    console.error("Failed to start Ganache test server:", err);
    process.exit(1);
  }
  console.log("⚡ Ganache test node listening on port 7545. Executing Truffle test suite...\n");

  const isWindows = process.platform === "win32";
  const truffleCmd = isWindows ? "truffle.cmd" : "truffle";

  const testProc = spawn(truffleCmd, ["test"], {
    stdio: "inherit",
    shell: true,
  });

  testProc.on("close", (code) => {
    server.close(() => {
      console.log("\n🏁 Test execution completed.");
      process.exit(code);
    });
  });
});

