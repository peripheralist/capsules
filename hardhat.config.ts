import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import * as fs from "fs";

function mnemonic() {
  try {
    return fs.readFileSync("./mnemonic.txt").toString().trim();
  } catch (e) {
    console.log("Couldn't read mnemonic", e);
  }
  return "";
}

function deployerPk() {
  try {
    return fs.readFileSync("./pk.txt").toString().trim();
  } catch (e) {
    console.log("Couldn't read pk", e);
  }
  return "";
}

const infuraId = "643e4d7aeffa4bd1b56c33e0c99b7604";

module.exports = {
  networks: {
    hardhat: {
      chainId: 1337,
      // accounts: [
      //   {
      //     privateKey:
      //       "c6cbd7d76bc5baca530c875663711b947efa6a86a900a9e8645ce32e5821484e",
      //     balance: "100000000000000000000000",
      //   },
      // ],
    },
    localhost: {
      url: "http://localhost:8545",
    },
    // Ethereum
    mainnet: {
      url: "https://mainnet.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
      chainId: 1,
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
      chainId: 11155111,
    },
    // Base
    base: {
      url: "https://mainnet.base.org",
      accounts: [deployerPk()],
      chainId: 8453,
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [deployerPk()],
      chainId: 84532,
    },
    // Optimism
    optimism: {
      url: "https://optimism-mainnet.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
      chainId: 10,
      gasPrice: undefined, // Let the network determine gas price
    },
    optimismSepolia: {
      url: "https://optimism-sepolia.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
      chainId: 11155420,
      gasPrice: undefined, // Let the network determine gas price
    },
    // Arbitrum
    arbitrum: {
      url: "https://arbitrum-mainnet.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
      chainId: 42161,
    },
    arbitrumSepolia: {
      url: "https://arbitrum-sepolia.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
      chainId: 421614,
    },
    // Legacy testnets (deprecated)
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
    },
    goerli: {
      url: "https://goerli.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
    },
    kovan: {
      url: "https://kovan.infura.io/v3/" + infuraId,
      accounts: [deployerPk()],
    },
  },
  etherscan: {
    apiKey: {
      // Ethereum
      mainnet: `5NE8T9T1Q6PT9DTHC5DTB8GU4BK76W7SMQ`,
      sepolia: `5NE8T9T1Q6PT9DTHC5DTB8GU4BK76W7SMQ`,
      // Base (uses Basescan API key)
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      // Optimism (uses Optimistic Etherscan API key)
      optimism: process.env.OPTIMISM_API_KEY || "",
      optimismSepolia: process.env.OPTIMISM_API_KEY || "",
      // Arbitrum (uses Arbiscan API key)
      arbitrum: process.env.ARBISCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
      // Legacy testnets
      rinkeby: `5NE8T9T1Q6PT9DTHC5DTB8GU4BK76W7SMQ`,
      goerli: `5NE8T9T1Q6PT9DTHC5DTB8GU4BK76W7SMQ`,
      kovan: `5NE8T9T1Q6PT9DTHC5DTB8GU4BK76W7SMQ`,
    },
  },
  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    dev: 1,
    fee: 2,
  },
  paths: {
    sources: "./contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 100000000,
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    // externalArtifacts: ["externalArtifacts/*.json"], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 14,
    coinmarketcap: "cde088de-a8a7-493c-84d8-e9ecd6fac3a9",
  },
};
