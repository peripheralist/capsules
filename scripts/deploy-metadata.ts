/* eslint no-use-before-define: "warn" */
import chalk from "chalk";
import fs from "fs";
import { ethers } from "hardhat";

import {
  deployCapsuleMetadata,
  getDeployer,
} from "./utils";

const network = process.env.HARDHAT_NETWORK;
// 0x817738DC393d682Ca5fBb268707b99F2aAe96baE
// 0x63A2368F4B509438ca90186cb1C15156713D5834

const writeFiles = (
  contractName: string,
  contractAddress: string,
  args: string[]
) => {
  const contract = JSON.parse(
    fs
      .readFileSync(
        `artifacts/contracts/${contractName}.sol/${contractName}.json`
      )
      .toString()
  );

  fs.writeFileSync(
    `deployments/${network}/${contractName}.json`,
    `{
      "address": "${contractAddress}", 
      "abi": ${JSON.stringify(contract.abi, null, 2)}
  }`
  );

  fs.writeFileSync(
    `deployments/${network}/${contractName}.arguments.js`,
    `module.exports = [${args}];`
  );

  console.log(
    "⚡️ All contract artifacts saved to:",
    chalk.yellow(`deployments/${network}/${contractName}`),
    "\n"
  );
};

const main = async () => {
  console.log(`✨ Deploying metadata to ${chalk.greenBright(network)} ✨`);

  const deployer = await getDeployer();

  console.log(`Using deployer address: ${chalk.cyan(deployer.address)}`);

  console.log(`Block number: ${await ethers.provider.getBlockNumber()}`);

  console.log("");

  // Deploy CapsuleMetadata
  await deployCapsuleMetadata(true).then((x) => {
    writeFiles(
      "CapsuleMetadata",
      x.contract.address,
      x.args.map((a) => JSON.stringify(a))
    );
    return x;
  });

  console.log("Done");
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
