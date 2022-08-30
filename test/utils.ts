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
import { CapsulesTypeface } from "../typechain-types/CapsulesTypeface";
import { capsuleRenderer, capsuleToken, capsulesTypeface } from "./Capsules";

export const mintPrice = ethers.utils.parseEther("0.01");

export const maxSupply = 7957;

export const totalSupply = async () => await capsulesContract().totalSupply();

export const indent = "      " + chalk.bold("- ");

export const fonts = Object.keys(FONTS).map((weight) => ({
  weight: parseInt(weight) as keyof typeof FONTS,
  style: "normal",
}));

export const fontHashes = Object.values(FONTS).map((font) =>
  keccak256(Buffer.from(font))
);

export const textToBytes4Lines = (text: string[]) => {
  const lines = [];
  for (let i = 0; i < 8; i++) {
    lines.push(stringToBytes4Line(text.length > i ? text[i] : undefined));
  }
  return lines;
};

export const stringToBytes4Line = (str?: string) => {
  const arr: string[] = [];
  for (let i = 0; i < 16; i++) {
    let byte = "00000000";
    if (str?.length) {
      byte = Buffer.from(str[i], "utf8").toString("hex").padStart(8, "0");
    }
    arr.push("0x" + byte);
  }
  return arr;
};

export const emptyNote = textToBytes4Lines([]);

export async function skipToBlockNumber(seconds: number) {
  await ethers.provider.send("evm_mine", [seconds]);
}

export async function mintValidUnlockedCapsules(
  signer: Signer,
  count?: number
) {
  let hexes: string[] = [];

  const capsules = capsulesContract(signer);

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
  process.stdout.write(`${indent}Minting Capsules... 0/${_count}`);

  for (let i = 0; i < _count; i++) {
    await capsules
      .mint(validHexes[i], 400, {
        value: mintPrice,
        gasLimit: 30000000,
      })
      .then(() => {
        process.stdout.cursorTo(indent.length + 11);
        process.stdout.write(`${i + 1}/${_count}`);
      });
  }

  process.stdout.cursorTo(indent.length + 21);
  process.stdout.write(`(${new Date().valueOf() - startTime}ms)`);
  process.stdout.write("\n");
}

export async function wallets() {
  const [deployer, owner, feeReceiver, minter1, minter2] =
    await ethers.getSigners();

  return { deployer, owner, feeReceiver, minter1, minter2 };
}

export async function deployCapsulesTypeface(capsuleTokenAddress: string) {
  const _fonts = Object.keys(FONTS).map((weight) => ({
    weight: parseInt(weight) as keyof typeof FONTS,
    style: "normal",
  }));
  const hashes = Object.values(FONTS).map((font) =>
    keccak256(Buffer.from(font))
  );

  console.log("fonts", { _fonts, hashes });

  const CapsulesTypeface = await ethers.getContractFactory("CapsulesTypeface");
  const capsulesTypeface = (await CapsulesTypeface.deploy(
    _fonts,
    hashes,
    capsuleTokenAddress
  )) as CapsulesTypeface;

  console.log(
    indent +
      "Deployed CapsulesTypeface " +
      chalk.magenta(capsulesTypeface.address)
  );

  return capsulesTypeface;
}

export async function deployCapsuleToken(
  capsulesTypefaceAddress: string,
  capsuleRendererAddress: string,
  capsuleMetadataAddress: string
) {
  const { feeReceiver, owner } = await wallets();
  const Capsules = await ethers.getContractFactory("CapsuleToken");

  const royalty = 50;

  const capsules = (await Capsules.deploy(
    capsulesTypefaceAddress,
    capsuleRendererAddress,
    capsuleMetadataAddress,
    feeReceiver.address,
    reservedColors,
    royalty
  )) as CapsuleToken;

  await capsules.transferOwnership(owner.address);

  console.log(
    indent + "Deployed CapsuleToken " + chalk.magenta(capsules.address)
  );

  return capsules;
}

export async function deployCapsuleRenderer(capsulesTypefaceAddress: string) {
  const CapsuleRenderer = await ethers.getContractFactory("CapsuleRenderer");

  const capsuleRenderer = (await CapsuleRenderer.deploy(
    capsulesTypefaceAddress
  )) as CapsuleRenderer;

  console.log(
    indent +
      "Deployed CapsuleRenderer " +
      chalk.magenta(capsuleRenderer.address)
  );

  return capsuleRenderer;
}

export async function deployCapsuleMetadata() {
  const CapsuleMetadata = await ethers.getContractFactory("CapsuleMetadata");

  const capsuleMetadata = (await CapsuleMetadata.deploy()) as CapsuleMetadata;

  console.log(
    indent +
      "Deployed CapsuleMetadata " +
      chalk.magenta(capsuleMetadata.address)
  );

  return capsuleMetadata;
}

export const capsulesContract = (signer?: Signer) =>
  new Contract(
    capsuleToken.address,
    JSON.parse(
      fs
        .readFileSync(
          "./artifacts/contracts/CapsuleToken.sol/CapsuleToken.json"
        )
        .toString()
    ).abi,
    signer ?? ethers.provider
  ) as CapsuleToken;

export const capsuleRendererContract = (signer?: Signer) =>
  new Contract(
    capsuleRenderer.address,
    JSON.parse(
      fs
        .readFileSync(
          "./artifacts/contracts/CapsuleRenderer.sol/CapsuleRenderer.json"
        )
        .toString()
    ).abi,
    signer ?? ethers.provider
  ) as CapsuleRenderer;

export const capsulesTypefaceContract = (signer?: Signer) =>
  new Contract(
    capsulesTypeface.address,
    JSON.parse(
      fs
        .readFileSync(
          "./artifacts/contracts/CapsulesTypeface.sol/CapsulesTypeface.json"
        )
        .toString()
    ).abi,
    signer ?? ethers.provider
  ) as CapsulesTypeface;
