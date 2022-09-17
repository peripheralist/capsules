/* eslint no-use-before-define: "warn" */
import chalk from "chalk";
import fs from "fs";
import { ethers } from "hardhat";

import {
  deployCapsuleMetadata,
  deployCapsuleRenderer,
  deployCapsulesTypeface,
  deployCapsuleToken,
} from "./utils";

const network = process.env.HARDHAT_NETWORK;
const ownerAddress = "0x817738DC393d682Ca5fBb268707b99F2aAe96baE";
const feeReceiverAddress = "0x817738DC393d682Ca5fBb268707b99F2aAe96baE";
const typefaceControllerAddress = "0x817738DC393d682Ca5fBb268707b99F2aAe96baE";
const donationAddress = "0x817738DC393d682Ca5fBb268707b99F2aAe96baE";
// 0x817738DC393d682Ca5fBb268707b99F2aAe96baE
// 0x63A2368F4B509438ca90186cb1C15156713D5834

const getDeployer = async () => (await ethers.getSigners())[0];

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
  console.log(`✨ Deploying contracts to ${chalk.greenBright(network)} ✨`);

  const deployer = await getDeployer();

  console.log(`Using deployer address: ${chalk.cyan(deployer.address)}`);

  console.log(`Block number: ${await ethers.provider.getBlockNumber()}`);

  console.log("");

  const nonce = await deployer.getTransactionCount();
  const expectedCapsuleTokenAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: nonce + 3,
  });

  // Deploy CapsuleMetadata
  const { contract: capsuleMetadata } = await deployCapsuleMetadata().then(
    (x) => {
      writeFiles(
        "CapsuleMetadata",
        x.contract.address,
        x.args.map((a) => JSON.stringify(a))
      );
      return x;
    }
  );

  // Deploy CapsulesTypeface
  const { contract: capsulesTypeface } = await deployCapsulesTypeface(
    expectedCapsuleTokenAddress,
    typefaceControllerAddress
  ).then((x) => {
    writeFiles(
      "CapsulesTypeface",
      x.contract.address,
      x.args.map((a) => JSON.stringify(a))
    );
    return x;
  });

  // Deploy CapsuleRenderer
  const { contract: capsuleRenderer } = await deployCapsuleRenderer(
    capsulesTypeface.address
  ).then((x) => {
    writeFiles(
      "CapsuleRenderer",
      x.contract.address,
      x.args.map((a) => JSON.stringify(a))
    );
    return x;
  });

  // Deploy CapsuleToken
  const { contract: capsuleToken } = await deployCapsuleToken(
    capsulesTypeface.address,
    capsuleRenderer.address,
    capsuleMetadata.address,
    ownerAddress,
    feeReceiverAddress
  ).then((x) => {
    writeFiles(
      "CapsuleToken",
      x.contract.address,
      x.args.map((a) => JSON.stringify(a))
    );
    return x;
  });

  if ((await capsulesTypeface.capsuleToken()) !== capsuleToken.address) {
    console.log(
      `🛑 CapsulesTypeface.capsuleToken() wrong address. Actual: ${await capsulesTypeface.capsuleToken()}`
    );
  }
  if ((await capsuleToken.capsulesTypeface()) !== capsulesTypeface.address) {
    console.log(`🛑 CapsuleToken.capsulesTypeface() wrong address.`);
  }
  if ((await capsuleToken.capsuleMetadata()) !== capsuleMetadata.address) {
    console.log(`🛑 CapsuleToken.capsuleMetadata() wrong address.`);
  }
  if ((await capsuleToken.defaultRenderer()) !== capsuleRenderer.address) {
    console.log(`🛑 CapsuleToken.defaultRenderer() wrong address.`);
  }

  console.log("Done");
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
