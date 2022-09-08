import chalk from "chalk";
import { BigNumber, Contract, Signer } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import * as fs from "fs";
import { ethers } from "hardhat";

import { FONTS } from "../fonts";
import { reservedColors } from "../reservedColors";
import {
  CapsuleMetadata,
  CapsuleRenderer,
  CapsuleToken,
} from "../typechain-types";
import { CapsulesToken } from "../typechain-types/CapsulesToken";
import { CapsulesTypeface } from "../typechain-types/CapsulesTypeface";

export const mintPrice = ethers.utils.parseEther("0.01");

export const maxSupply = 7957;

// export const totalSupply = async (capsulesTokenAddress: string) =>
//   await signingContract(capsulesTokenAddress).totalSupply();

export const fonts = Object.keys(FONTS).map((weight) => ({
  weight: parseInt(weight) as keyof typeof FONTS,
  style: "normal",
}));

export const fontHashes = Object.values(FONTS).map((font) =>
  keccak256(Buffer.from(font))
);

export const textToBytes2Lines = (text: string[]) => {
  const lines = [];
  for (let i = 0; i < 8; i++) {
    lines.push(stringToBytes2Line(text.length > i ? text[i] : undefined));
  }
  return lines;
};

export const stringToBytes2Line = (str?: string) => {
  const arr: string[] = [];
  for (let i = 0; i < 16; i++) {
    let byte = "00000000";
    if (str && str.length > i) {
      byte = Buffer.from(str[i]).toString("hex").padStart(8, "0");
    }
    arr.push("0x" + byte);
  }
  return arr;
};

export const emptyNote = textToBytes2Lines([]);

export async function skipToBlockNumber(seconds: number) {
  await ethers.provider.send("evm_mine", [seconds]);
}

export async function mintValidUnlockedCapsules(
  capsulesToken: CapsulesToken,
  signer: Signer,
  count?: number
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

  const validHexes = hexes
    .filter((h) => !reservedColors.includes(h))
    .slice(skip);

  const _count =
    count !== undefined
      ? Math.min(count, validHexes.length)
      : validHexes.length;

  const startTime = new Date().valueOf();
  process.stdout.write(`Minting Capsules... 0/${_count}`);

  for (let i = 0; i < _count; i++) {
    await capsules
      .mint(validHexes[i], 400, {
        value: mintPrice,
        gasLimit: 30000000,
      })
      .then(() => {
        process.stdout.cursorTo(11);
        process.stdout.write(`${i + 1}/${_count}`);
      });
  }

  process.stdout.cursorTo(21);
  process.stdout.write(`(${new Date().valueOf() - startTime}ms)`);
  process.stdout.write("\n");
}

export async function wallets() {
  const [deployer, owner, feeReceiver, minter1, minter2] =
    await ethers.getSigners();

  return { deployer, owner, feeReceiver, minter1, minter2 };
}

export async function deployCapsulesTypeface(capsuleTokenAddress: string) {
  console.log("🪄 Deploying CapsulesTypeface...");

  const _fonts = Object.keys(FONTS).map((weight) => ({
    weight: parseInt(weight) as keyof typeof FONTS,
    style: "normal",
  }));
  const hashes = Object.values(FONTS).map((font) =>
    keccak256(Buffer.from(font))
  );

  const args = [_fonts, hashes, capsuleTokenAddress];

  const CapsulesTypeface = await ethers.getContractFactory("CapsulesTypeface");
  const capsulesTypeface = (await CapsulesTypeface.deploy(
    ...args
  )) as CapsulesTypeface;

  console.log(
    "✅ Deployed CapsulesTypeface " + chalk.magenta(capsulesTypeface.address)
  );

  return { contract: capsulesTypeface, args };
}

export async function deployCapsuleToken(
  capsulesTypefaceAddress: string,
  capsuleRendererAddress: string,
  capsuleMetadataAddress: string,
  ownerAddress: string,
  feeReceiverAddress: string
) {
  console.log("🪄 Deploying CapsuleToken...");

  const Capsules = await ethers.getContractFactory("CapsuleToken");

  const royalty = 50;

  const args = [
    capsulesTypefaceAddress,
    capsuleRendererAddress,
    capsuleMetadataAddress,
    feeReceiverAddress,
    reservedColors,
    royalty,
  ];

  const deployedContract = (await Capsules.deploy(...args)) as CapsuleToken;

  console.log(
    "✅ Deployed CapsuleToken " + chalk.magenta(deployedContract.address)
  );

  console.log(
    `Transferring ownership of CapsuleToken to ${chalk.cyan(ownerAddress)}...`
  );

  await deployedContract.transferOwnership(ownerAddress);

  console.log("➡️  Transfer complete");

  return { contract: deployedContract, args };
}

export async function deployCapsuleRenderer(capsulesTypefaceAddress: string) {
  console.log("🪄 Deploying CapsuleRenderer...");

  const CapsuleRenderer = await ethers.getContractFactory("CapsuleRenderer");

  const args = [capsulesTypefaceAddress];

  const capsuleRenderer = (await CapsuleRenderer.deploy(
    ...args
  )) as CapsuleRenderer;

  console.log(
    "✅ Deployed CapsuleRenderer " + chalk.magenta(capsuleRenderer.address)
  );

  return { contract: capsuleRenderer, args };
}

export async function deployCapsuleMetadata() {
  console.log("🪄 Deploying CapsuleMetadata...");

  const CapsuleMetadata = await ethers.getContractFactory("CapsuleMetadata");

  const capsuleMetadata = (await CapsuleMetadata.deploy()) as CapsuleMetadata;

  console.log(
    "✅ Deployed CapsuleMetadata " + chalk.magenta(capsuleMetadata.address)
  );

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

// export const capsulesContract = (address: string, signer?: Signer) =>
//   new Contract(
//     address,
//     JSON.parse(
//       fs
//         .readFileSync(
//           "./artifacts/contracts/CapsuleToken.sol/CapsuleToken.json"
//         )
//         .toString()
//     ).abi,
//     signer ?? ethers.provider
//   ) as CapsuleToken;
