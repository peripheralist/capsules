import chalk from "chalk";
import * as fs from "fs";
import { ethers } from "hardhat";
import { keccak256 } from "ethers/lib/utils";
import { FONTS } from "../fonts";

// Constants
const OPERATOR_ADDRESS = "0xE1054192960FA3c6178E90f6Bc14cbe6146413e4";
const DONATION_ADDRESS = "0x63A2368F4B509438ca90186cb1C15156713D5834";

// Font setup helpers
const fonts = Object.keys(FONTS).map((weight) => ({
  weight: parseInt(weight) as keyof typeof FONTS,
  style: "normal",
}));

const fontHashes = Object.values(FONTS).map((font) =>
  keccak256(Buffer.from(font))
);

const writeDeploymentFiles = (
  network: string,
  contractName: string,
  contractAddress: string,
  args: any[]
) => {
  // Read contract artifact
  const contract = JSON.parse(
    fs
      .readFileSync(
        `artifacts/contracts/${contractName}.sol/${contractName}.json`
      )
      .toString()
  );

  // Create deployments directory if it doesn't exist
  const deployDir = `deployments/typeface/${network}`;
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  // Write contract JSON
  fs.writeFileSync(
    `${deployDir}/${contractName}.json`,
    JSON.stringify(
      {
        address: contractAddress,
        abi: contract.abi,
      },
      null,
      2
    )
  );

  // Write arguments file
  fs.writeFileSync(
    `${deployDir}/${contractName}.arguments.js`,
    `module.exports = ${JSON.stringify(args, null, 2)};`
  );

  console.log(
    "⚡️ Contract artifacts saved to:",
    chalk.yellow(`${deployDir}/${contractName}.*`),
    "\n"
  );
};

// Helper to get tx overrides for Optimism networks
const getTxOverrides = (network: string) => {
  const isOptimism = network === "optimism" || network === "optimismSepolia";
  return isOptimism
    ? {
        maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei"),
        maxFeePerGas: ethers.utils.parseUnits("10", "gwei"),
      }
    : {};
};

async function main() {
  const network = process.env.HARDHAT_NETWORK;

  if (!network) {
    throw new Error("Network not specified. Use --network flag.");
  }

  console.log(
    `✨ Deploying CapsulesTypeface to ${chalk.greenBright(network)} ✨\n`
  );

  // Get deployer (operator address from pk.txt)
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer address: ${chalk.cyan(deployer.address)}`);
  console.log(`Block number: ${await ethers.provider.getBlockNumber()}\n`);

  // Verify deployer address matches expected operator
  if (deployer.address.toLowerCase() !== OPERATOR_ADDRESS.toLowerCase()) {
    console.log(
      chalk.yellow(
        `⚠️  Warning: Deployer address ${deployer.address} does not match expected operator ${OPERATOR_ADDRESS}`
      )
    );
  }

  // Step 1: Deploy CapsulesTypeface
  console.log("🪄 Deploying CapsulesTypeface...");
  const CapsulesTypeface = await ethers.getContractFactory(
    "CapsulesTypeface"
  );

  const capsulesTypeface = await CapsulesTypeface.deploy(
    DONATION_ADDRESS,
    OPERATOR_ADDRESS
  );

  await capsulesTypeface.deployed();

  console.log(
    "✅ Deployed CapsulesTypeface " +
      chalk.magenta(capsulesTypeface.address) +
      "\n"
  );

  // Step 2: Set source hashes
  console.log(`📝 Setting source hashes for ${fonts.length} fonts...`);
  const setHashesTx = await capsulesTypeface.setSourceHashes(fonts, fontHashes, {
    gasLimit: 10000000, // 10M gas limit
    ...getTxOverrides(network),
  });
  await setHashesTx.wait();
  console.log("✅ Source hashes set successfully\n");

  // Step 3: Save deployment files
  const args = [DONATION_ADDRESS, OPERATOR_ADDRESS];
  writeDeploymentFiles(
    network,
    "CapsulesTypeface",
    capsulesTypeface.address,
    args
  );

  // Summary
  console.log(chalk.green("🎉 Deployment completed successfully!\n"));
  console.log("📋 Summary:");
  console.log(`   Contract Address: ${chalk.magenta(capsulesTypeface.address)}`);
  console.log(`   Donation Address: ${chalk.cyan(DONATION_ADDRESS)}`);
  console.log(`   Operator Address: ${chalk.cyan(OPERATOR_ADDRESS)}`);
  console.log(`   Network:          ${chalk.greenBright(network)}\n`);

  console.log("💡 Next steps:");
  console.log(
    `   1. Store fonts: ${chalk.cyan(
      `npx hardhat run scripts/store-fonts.ts --network ${network}`
    )}`
  );
  console.log("   2. Verify contract on block explorer (if desired)");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("\n❌ Deployment failed:"));
    console.error(error);
    process.exit(1);
  });
