import chalk from "chalk";
import { BigNumber, Contract, Signer } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import * as fs from "fs";
import { ethers } from "hardhat";

import { FONTS } from "../fonts";
import { pureColors } from "../pureColors";
import {
  CapsuleMetadata,
  CapsuleRenderer,
  CapsuleToken,
} from "../typechain-types";
import { CapsulesTypeface } from "../typechain-types/CapsulesTypeface";

export const mintPrice = ethers.utils.parseEther("0.01");

export const maxSupply = 7957;

export const getDeployer = async () => (await ethers.getSigners())[0];

export const validHexes = () => {
  let hexes: string[] = [];

  const toHex = (num: number) =>
    BigNumber.from(num).toHexString().split("0x")[1];

  for (let r = 0; r <= 255; r += 5) {
    for (let g = 0; g <= 255; g += 5) {
      for (let b = 0; b <= 255; b += 5) {
        if (r === 255 || g === 255 || b === 255) {
          hexes.push("0x" + toHex(r) + toHex(g) + toHex(b));
        }
      }
    }
  }

  return hexes.filter((h) => !pureColors.includes(h));
};

// export const totalSupply = async (capsulesTokenAddress: string) =>
//   await signingContract(capsulesTokenAddress).totalSupply();

export const fonts = Object.keys(FONTS).map((weight) => ({
  weight: parseInt(weight) as keyof typeof FONTS,
  style: "normal",
}));

export const fontHashes = Object.values(FONTS).map((font) =>
  keccak256(Buffer.from(font))
);

export const stringTextToBytesText = (text: string[]) => {
  const lines = [];
  for (let i = 0; i < 8; i++) {
    lines.push(stringToBytes32(text.length > i ? text[i] : undefined));
  }
  return lines;
};

export const stringToBytes32 = (str?: string) => {
  let bytes32: string = "";
  for (let i = 0; i < 16; i++) {
    let byte = "0000";
    if (str && str.length > i) {
      byte = str[i].charCodeAt(0).toString(16).padStart(4, "0");
    }
    bytes32 += byte;
  }
  return "0x" + bytes32;
};

export const emptyNote = stringTextToBytesText([]);

export async function skipToBlockNumber(seconds: number) {
  await ethers.provider.send("evm_mine", [seconds]);
}

export async function mintCapsulesWithTexts(
  capsulesToken: CapsuleToken,
  signer: Signer,
  texts: string[][]
) {
  let hexes: string[] = [];

  const capsules = signingContract(capsulesToken, signer);

  const toHex = (num: number) =>
    BigNumber.from(num).toHexString().split("0x")[1];

  for (let r = 0; r <= 255; r += 5) {
    for (let g = 0; g <= 255; g += 5) {
      for (let b = 0; b <= 255; b += 5) {
        if (r === 255 || g === 255 || b === 255) {
          hexes.push("0x" + toHex(r) + toHex(g) + toHex(b));
        }
      }
    }
  }

  const skip = (await capsules.totalSupply()).toNumber();

  const validHexes = hexes.filter((h) => !pureColors.includes(h)).slice(skip);

  const count = Math.min(texts.length, validHexes.length);

  const startTime = new Date().valueOf();
  process.stdout.write(`Minting Capsules... 0/${count}`);

  for (let i = 0; i < count; i++) {
    await capsules
      .mint(
        validHexes[i],
        {
          weight: 400,
          style: "normal",
        },
        stringTextToBytesText(texts[i]),
        {
          value: mintPrice,
        }
      )
      .then(() => {
        process.stdout.cursorTo(11);
        process.stdout.write(`${i + 1}/${count}`);
      });
  }

  process.stdout.cursorTo(21);
  process.stdout.write(`(${new Date().valueOf() - startTime}ms)`);
  process.stdout.write("\n");
}

export async function wallets() {
  const [
    deployer,
    owner,
    feeReceiver,
    newFeeReceiver,
    minter1,
    minter2,
    renderer2,
  ] = await ethers.getSigners();

  return {
    deployer,
    owner,
    feeReceiver,
    newFeeReceiver,
    minter1,
    minter2,
    renderer2,
  };
}

export async function deployCapsulesTypeface(
  capsuleTokenAddress: string,
  donationAddress: string,
  operatorAddress: string,
  verbose?: boolean
) {
  const { deployer } = await wallets();

  if (verbose) console.log("🪄 Deploying CapsulesTypeface...");

  // Initially set operator to deployer address so we can set hashes in this script
  const args = [capsuleTokenAddress, donationAddress, deployer.address];

  const CapsulesTypeface = await ethers.getContractFactory("CapsulesTypeface");
  const capsulesTypeface = (await CapsulesTypeface.deploy(
    ...args
  )) as CapsulesTypeface;

  if (verbose) {
    console.log(
      "✅ Deployed CapsulesTypeface " + chalk.magenta(capsulesTypeface.address)
    );
  }

  // Set sourceHashes as operator
  await capsulesTypeface.setSourceHashes(fonts, fontHashes);

  // Set operator to indended operator address
  await capsulesTypeface.setOperator(operatorAddress);

  return { contract: capsulesTypeface, args };
}

export async function deployCapsuleToken(
  capsulesTypefaceAddress: string,
  capsuleRendererAddress: string,
  capsuleMetadataAddress: string,
  ownerAddress: string,
  feeReceiverAddress: string,
  verbose?: boolean
) {
  if (verbose) console.log("🪄 Deploying CapsuleToken...");

  const Capsules = await ethers.getContractFactory("CapsuleToken");

  const royalty = 50;

  const args = [
    capsulesTypefaceAddress,
    capsuleRendererAddress,
    capsuleMetadataAddress,
    feeReceiverAddress,
    pureColors,
    royalty,
  ];

  const deployedContract = (await Capsules.deploy(...args)) as CapsuleToken;

  if (verbose) {
    console.log(
      "✅ Deployed CapsuleToken " + chalk.magenta(deployedContract.address)
    );

    console.log(
      `Transferring ownership of CapsuleToken to ${chalk.cyan(ownerAddress)}...`
    );
  }

  const transferTx = await (
    await deployedContract.transferOwnership(ownerAddress)
  ).wait();

  if (verbose) {
    if (!transferTx.status) {
      console.log(chalk.red("Transfer failed"));
    } else {
      console.log("➡️  Transfer complete");
    }
  }

  return { contract: deployedContract, args };
}

export async function deployCapsuleRenderer(
  capsulesTypefaceAddress: string,
  verbose?: boolean
) {
  if (verbose) console.log("🪄 Deploying CapsuleRenderer...");

  const CapsuleRenderer = await ethers.getContractFactory("CapsuleRenderer");

  const args = [capsulesTypefaceAddress];

  const capsuleRenderer = (await CapsuleRenderer.deploy(
    ...args
  )) as CapsuleRenderer;

  if (verbose) {
    console.log(
      "✅ Deployed CapsuleRenderer " + chalk.magenta(capsuleRenderer.address)
    );
  }

  return { contract: capsuleRenderer, args };
}

export async function deployCapsuleMetadata(verbose?: boolean) {
  if (verbose) console.log("🪄 Deploying CapsuleMetadata...");

  const CapsuleMetadata = await ethers.getContractFactory("CapsuleMetadata");

  const capsuleMetadata = (await CapsuleMetadata.deploy()) as CapsuleMetadata;

  if (verbose) {
    console.log(
      "✅ Deployed CapsuleMetadata " + chalk.magenta(capsuleMetadata.address)
    );
  }

  return { contract: capsuleMetadata, args: [] };
}

export const signingContract = <C extends Contract>(
  contract: C,
  signer?: Signer
) =>
  new Contract(
    contract.address,
    contract.interface,
    signer ?? ethers.provider
  ) as C;

export const colorStringToBytes = (str: string) => `0x${str.split("#")[1]}`;
