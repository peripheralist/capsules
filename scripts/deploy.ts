/* eslint no-use-before-define: "warn" */
import chalk from "chalk";
import fs from "fs";
import { ethers } from "hardhat";

import { reservedColors } from "../reservedColors";
import { fontHashes, fonts } from "../test/utils";
import {
  CapsuleRenderer,
  CapsuleToken,
  CapsulesTypeface,
} from "../typechain-types";

const network = process.env.HARDHAT_NETWORK;
// const ownerAddress = "0x63A2368F4B509438ca90186cb1C15156713D5834";
const ownerAddress = "0x817738DC393d682Ca5fBb268707b99F2aAe96baE";
const feeReceiverAddress = "0x817738DC393d682Ca5fBb268707b99F2aAe96baE";

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

const deployCapsulesTypeface = async (
  capsuleTokenAddress: string
): Promise<CapsulesTypeface> => {
  const deployer = await getDeployer();

  console.log("Deploying CapsulesTypeface with the account:", deployer.address);

  const args = [fonts, fontHashes, capsuleTokenAddress];

  console.log("Deploying with args:", args);

  const CapsulesTypefaceFactory = await ethers.getContractFactory(
    "CapsulesTypeface"
  );
  const capsulesTypeface = (await CapsulesTypefaceFactory.deploy(
    ...args
  )) as CapsulesTypeface;

  console.log(
    chalk.green(` ✔ CapsulesTypeface deployed for network:`),
    process.env.HARDHAT_NETWORK,
    "\n",
    chalk.magenta(capsulesTypeface.address),
    `tx: ${capsulesTypeface.deployTransaction.hash}`
  );

  writeFiles(
    "CapsulesTypeface",
    capsulesTypeface.address,
    args.map((a) => JSON.stringify(a))
  );

  return capsulesTypeface;
};

export async function deployCapsuleMetadata() {
  const deployer = await getDeployer();
  console.log("Deploying CapsuleRenderer with the account:", deployer.address);

  const CapsuleMetadata = await ethers.getContractFactory("CapsuleMetadata");

  const capsuleMetadata = (await CapsuleMetadata.deploy()) as CapsuleRenderer;

  console.log(
    chalk.green(` ✔ CapsuleMetadata deployed for network:`),
    process.env.HARDHAT_NETWORK,
    "\n",
    chalk.magenta(capsuleMetadata.address),
    `tx: ${capsuleMetadata.deployTransaction.hash}`
  );

  writeFiles(
    "CapsuleMetadata",
    capsuleMetadata.address,
    [].map((a) => JSON.stringify(a))
  );

  return capsuleMetadata;
}

export async function deployCapsuleRenderer(capsulesTypefaceAddress: string) {
  const deployer = await getDeployer();
  console.log("Deploying CapsuleRenderer with the account:", deployer.address);

  const CapsuleRenderer = await ethers.getContractFactory("CapsuleRenderer");

  const args = [capsulesTypefaceAddress];

  const capsuleRenderer = (await CapsuleRenderer.deploy(
    ...args
  )) as CapsuleRenderer;

  console.log(
    chalk.green(` ✔ CapsuleRenderer deployed for network:`),
    process.env.HARDHAT_NETWORK,
    "\n",
    chalk.magenta(capsuleRenderer.address),
    `tx: ${capsuleRenderer.deployTransaction.hash}`
  );

  writeFiles(
    "CapsuleRenderer",
    capsuleRenderer.address,
    args.map((a) => JSON.stringify(a))
  );

  return capsuleRenderer;
}

const deployCapsuleToken = async (
  capsulesTypefaceAddress: string,
  capsuleRendererAddress: string,
  capsuleMetadataAddress: string
): Promise<CapsuleToken> => {
  const deployer = await getDeployer();
  console.log("Deploying CapsuleToken with the account:", deployer.address);

  const royalty = 50;

  const args = [
    capsulesTypefaceAddress,
    capsuleRendererAddress,
    capsuleMetadataAddress,
    feeReceiverAddress,
    reservedColors,
    royalty,
  ];

  const Capsules = await ethers.getContractFactory("CapsuleToken");

  const capsuleToken = (await Capsules.deploy(...args)) as CapsuleToken;

  console.log(
    chalk.green(` ✔ CapsuleToken deployed for network:`),
    process.env.HARDHAT_NETWORK,
    "\n",
    chalk.magenta(capsuleToken.address),
    `tx: ${capsuleToken.deployTransaction.hash}`
  );

  writeFiles(
    "CapsuleToken",
    capsuleToken.address,
    args.map((a) => JSON.stringify(a))
  );

  await capsuleToken.transferOwnership(ownerAddress);

  console.log(
    "Transferred CapsuleToken ownership to " + chalk.bold(ownerAddress)
  );

  return capsuleToken;
};

const main = async () => {
  console.log("✨ Deploying ✨");

  console.log("Block number:", await ethers.provider.getBlockNumber());

  const deployer = await getDeployer();
  let nonce = await deployer.getTransactionCount();
  const expectedCapsuleTokenAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: nonce + 2,
  });

  const capsulesTypeface = await deployCapsulesTypeface(
    expectedCapsuleTokenAddress
  );

  const capsuleRenderer = await deployCapsuleRenderer(capsulesTypeface.address);

  const capsuleMetadata = await deployCapsuleMetadata();

  await deployCapsuleToken(
    capsulesTypeface.address,
    capsuleRenderer.address,
    capsuleMetadata.address
  );

  console.log("Done");
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
