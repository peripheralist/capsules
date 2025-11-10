import chalk from "chalk";
import * as fs from "fs";
import { ethers } from "hardhat";
import { FONTS } from "../fonts";

// Constants
const OWNER_ADDRESS = "0x63A2368F4B509438ca90186cb1C15156713D5834";

// Font setup helpers
const fonts = Object.keys(FONTS).map((weight) => ({
  weight: parseInt(weight) as keyof typeof FONTS,
  style: "normal",
}));

// Helper to get tx overrides based on network
const getTxOverrides = (network: string) => {
  const isOptimism = network === "optimism" || network === "optimismSepolia";
  const isSepolia = network === "sepolia";

  let overrides: any = {};

  if (isOptimism) {
    overrides.maxPriorityFeePerGas = ethers.utils.parseUnits("1", "gwei");
    overrides.maxFeePerGas = ethers.utils.parseUnits("10", "gwei");
  }

  return overrides;
};

// Helper to get gas limit based on network
const getGasLimit = (network: string) => {
  const isSepolia = network === "sepolia";
  const isOptimism = network === "optimism" || network === "optimismSepolia";

  // Sepolia has a lower block gas limit (~16.7M)
  if (isSepolia) return 16777216;

  // Optimism - use lower limit to avoid "insufficient funds" error
  // (Optimism reserves funds upfront based on gas limit)
  if (isOptimism) return 23000000;

  // Other networks (Base, Arbitrum, etc.)
  return 25000000;
};

async function main() {
  const network = process.env.HARDHAT_NETWORK;

  if (!network) {
    throw new Error("Network not specified. Use --network flag.");
  }

  console.log(
    `💾 Storing fonts for CapsulesTypeface on ${chalk.greenBright(
      network
    )} 💾\n`
  );

  // Load deployment info
  const deploymentPath = `deployments/typeface/${network}/CapsulesTypeface.json`;
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `Deployment file not found at ${deploymentPath}. Please deploy the contract first using:\n  npx hardhat run scripts/deploy-typeface.ts --network ${network}`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath).toString());
  const contractAddress = deployment.address;

  console.log(`Contract Address: ${chalk.magenta(contractAddress)}\n`);

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`Using signer: ${chalk.cyan(signer.address)}`);
  console.log(`Block number: ${await ethers.provider.getBlockNumber()}\n`);

  // Connect to deployed contract
  const CapsulesTypeface = await ethers.getContractFactory(
    "CapsulesTypeface"
  );
  const capsulesTypeface = CapsulesTypeface.attach(contractAddress);

  // Verify we can interact with contract
  const currentOperator = await capsulesTypeface.operator();
  console.log(`Current operator: ${chalk.cyan(currentOperator)}\n`);

  // Store fonts
  console.log(`📝 Storing font sources (${fonts.length} fonts)...`);
  console.log(
    chalk.yellow(
      "⚠️  This will take a while due to large data size. Progress will be shown below:\n"
    )
  );

  let totalGasUsed = ethers.BigNumber.from(0);
  const startTime = Date.now();

  const alreadyStored: number[] = [];
  const failed: number[] = [];
  const stored: number[] = [];

  for (let i = 0; i < fonts.length; i++) {
    const font = fonts[i];
    const fontData = FONTS[font.weight as keyof typeof FONTS];

    process.stdout.write(
      `   [${i + 1}/${fonts.length}] Font weight ${font.weight}... `
    );

    try {
      // Check if font is already stored
      process.stdout.write(`checking... `);
      const hasSource = await capsulesTypeface.hasSource(font);
      if (hasSource) {
        console.log(chalk.blue("⊙ Already stored, skipping"));
        alreadyStored.push(font.weight);
        continue;
      }
      process.stdout.write(`not stored. `);

      const fontBytes = Buffer.from(fontData);
      const fontSizeKB = (fontBytes.length / 1024).toFixed(2);

      console.log(`(${fontSizeKB}KB)`);
      process.stdout.write(`      Estimating gas... `);

      // Try to estimate gas first
      let estimatedGas;
      try {
        estimatedGas = await capsulesTypeface.estimateGas.setSource(
          font,
          fontBytes
        );
        console.log(chalk.gray(`${estimatedGas.toString()} gas`));
      } catch (estimateError: any) {
        console.log(chalk.red("✗"));
        const errMsg = estimateError.reason || estimateError.message || "Gas estimation failed";
        throw new Error(errMsg);
      }

      process.stdout.write(`      Sending transaction... `);
      const setSourceTx = await capsulesTypeface.setSource(
        font,
        fontBytes,
        {
          gasLimit: getGasLimit(network),
          ...getTxOverrides(network),
        }
      );

      process.stdout.write(`waiting for confirmation... `);
      const receipt = await setSourceTx.wait();

      totalGasUsed = totalGasUsed.add(receipt.gasUsed);
      stored.push(font.weight);

      console.log(chalk.green("✓") + ` (used ${receipt.gasUsed.toString()} gas)`);

      // Add a small delay to ensure transaction is fully processed before next one
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      const errorMsg = error.message || error.reason || error.error?.message || "Unknown error";
      console.log(chalk.red("      ✗ Failed") + ` - ${errorMsg}`);
      failed.push(font.weight);
      // Continue to next font instead of throwing
      continue;
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log("\n" + chalk.green("✅ Font storage complete!\n"));
  console.log("📊 Summary:");

  if (stored.length > 0) {
    console.log(`   ${chalk.green("Stored:")} ${stored.join(", ")}`);
  }

  if (alreadyStored.length > 0) {
    console.log(`   ${chalk.blue("Already stored:")} ${alreadyStored.join(", ")}`);
  }

  if (failed.length > 0) {
    console.log(`   ${chalk.red("Failed:")} ${failed.join(", ")}`);
  }

  console.log(`\n   Total Gas Used: ${chalk.yellow(totalGasUsed.toString())}`);
  console.log(`   Time Elapsed:   ${chalk.yellow(duration + "s")}\n`);

  // Transfer operator if:
  // 1. All fonts stored in this run (none failed, none already stored), OR
  // 2. All fonts are now stored (none failed, all were already stored)
  const allFontsStoredNow = failed.length === 0 && alreadyStored.length === 0;
  const allFontsWereAlreadyStored = failed.length === 0 && alreadyStored.length === fonts.length;
  const shouldTransferOperator = allFontsStoredNow || allFontsWereAlreadyStored;

  if (currentOperator.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
    if (shouldTransferOperator) {
      console.log(
        `🔄 Transferring operator role to ${chalk.cyan(OWNER_ADDRESS)}...`
      );
      const setOperatorTx = await capsulesTypeface.setOperator(OWNER_ADDRESS, {
        ...getTxOverrides(network),
      });
      await setOperatorTx.wait();
      console.log("✅ Operator role transferred successfully\n");
    } else {
      console.log(
        chalk.yellow(
          `⚠️  Not transferring operator role - some fonts failed.\n` +
          `   Run the script again after all fonts are stored to transfer operator.\n`
        )
      );
    }
  } else {
    console.log(
      chalk.blue(
        `ℹ️  Operator is already set to ${OWNER_ADDRESS}, skipping transfer\n`
      )
    );
  }

  console.log(chalk.green("🎉 Font storage completed!\n"));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(chalk.red("\n❌ Font storage failed:"));
    console.error(error);
    process.exit(1);
  });
