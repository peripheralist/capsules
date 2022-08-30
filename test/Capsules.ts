import { expect } from "chai";
import { utils } from "ethers";

import { FONTS } from "../fonts";
import { reservedColors } from "../reservedColors";
import {
  CapsuleRenderer,
  CapsuleMetadata,
  CapsuleToken,
  CapsulesTypeface,
} from "../typechain-types";
import {
  capsulesContract,
  capsulesTypefaceContract,
  deployCapsuleRenderer,
  deployCapsuleToken,
  deployCapsulesTypeface,
  emptyNote,
  mintPrice,
  textToBytes4Lines,
  wallets,
  deployCapsuleMetadata,
} from "./utils";

export let capsulesTypeface: CapsulesTypeface;
export let capsuleToken: CapsuleToken;
export let capsuleRenderer: CapsuleRenderer;
export let capsuleMetadata: CapsuleMetadata;

describe("Capsules", async () => {
  before(async () => {
    const { deployer } = await wallets();

    capsuleMetadata = await deployCapsuleMetadata();

    let nonce = await deployer.getTransactionCount();
    const expectedCapsuleTokenAddress = utils.getContractAddress({
      from: deployer.address,
      nonce: nonce + 2,
    });

    capsulesTypeface = await deployCapsulesTypeface(
      expectedCapsuleTokenAddress
    );

    capsuleRenderer = await deployCapsuleRenderer(capsulesTypeface.address);

    capsuleToken = await deployCapsuleToken(
      capsulesTypeface.address,
      capsuleRenderer.address,
      capsuleMetadata.address
    );
  });

  describe("Deployment", async () => {
    it("Deploy should set owner, fee receiver, and contract addresses", async () => {
      const { owner, feeReceiver } = await wallets();

      const capsules = capsulesContract();

      expect(await capsules.owner()).to.equal(owner.address);
      expect(await capsules.feeReceiver()).to.equal(feeReceiver.address);
      expect(await capsules.capsulesTypeface()).to.equal(
        capsulesTypeface.address
      );

      expect(await capsulesTypeface.capsuleToken()).to.equal(
        capsuleToken.address
      );

      expect(await capsuleRenderer.capsulesTypeface()).to.equal(
        capsulesTypeface.address
      );

      expect(await capsules.defaultCapsuleRenderer()).to.equal(
        capsuleRenderer.address
      );

      expect(await capsules.capsuleMetadata()).to.equal(
        capsuleMetadata.address
      );
    });
  });

  describe("Initialize", async () => {
    it("Valid setSource while paused should revert", async () => {
      const { owner } = await wallets();

      const ownerCapsulesTypeface = capsulesTypefaceContract(owner);

      // Store first font
      return expect(
        ownerCapsulesTypeface.setSource(
          {
            weight: 400,
            style: "normal",
          },
          Buffer.from(FONTS[400])
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should unpause", async () => {
      const { owner } = await wallets();
      const ownerCapsules = capsulesContract(owner);
      return expect(ownerCapsules.unpause())
        .to.emit(ownerCapsules, "Unpaused")
        .withArgs(owner.address);
    });

    it("Should store first font and mint Capsule token", async () => {
      const { owner } = await wallets();

      const _fonts = Object.keys(FONTS).map((weight) => ({
        weight: parseInt(weight) as keyof typeof FONTS,
        style: "normal",
      }));

      console.log("Estimating gas to store fonts...");
      // Estimate gas to store all fonts
      for (let i = 0; i < _fonts.length; i++) {
        const weight = _fonts[i].weight;

        const gas = await capsulesTypeface.estimateGas.setSource(
          _fonts[i],
          Buffer.from(FONTS[weight])
        );

        console.log(
          weight,
          "=> " +
            (gas.toNumber() * 20 * 1e-9).toString().substring(0, 6) +
            "ETH" // 20 gwei
        );
      }

      // Store first font
      const normal400Font = {
        weight: 400,
        style: "normal",
      };
      const normal400Src = Buffer.from(FONTS[400]);
      const tx = capsulesTypefaceContract(owner).setSource(
        normal400Font,
        normal400Src
      );
      await expect(tx)
        .to.emit(capsuleToken, "MintCapsule")
        .withArgs(1, owner.address, reservedColors[3]);
      await expect(tx)
        .to.emit(capsulesTypeface, "SetSource")
        .withArgs([400, "normal"]);
    });

    it("Address that stores font src should receive Capsule NFT", async () => {
      const { owner } = await wallets();

      return expect(await capsuleToken.balanceOf(owner.address)).to.equal(1);
    });

    it("setFontSrc should revert if already set", async () => {
      const { owner } = await wallets();

      const ownerCapsulesTypeface = capsulesTypefaceContract(owner);

      // Store first font
      return expect(
        ownerCapsulesTypeface.setSource(
          {
            weight: 400,
            style: "normal",
          },
          Buffer.from(FONTS[400])
        )
      ).to.be.revertedWith("Typeface: font source already exists");
    });
  });

  describe("Minting", async () => {
    it("Mint with unset font weight should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        capsulesContract(minter1).mint("0x0005ff", 100, {
          value: mintPrice,
        })
      ).to.be.revertedWith("InvalidFontWeight()");
    });

    it("Mint with invalid color should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        capsulesContract(minter1).mint("0x0000fe", 400, {
          value: mintPrice,
        })
      ).to.be.revertedWith("InvalidColor()");
    });

    // it("Mint with invalid text should revert", async () => {
    //   const { minter1 } = await wallets();

    //   await expect(
    //     capsulesContract(minter1).mintWithText(
    //       "0x000aff",
    //       400,
    //       textToBytes4Lines(["💩"]),
    //       {
    //         value: mintPrice,
    //       }
    //     )
    //   ).to.be.revertedWith("InvalidText()");
    // });

    it("Mint with low price should revert", async () => {
      const { owner } = await wallets();

      return expect(
        capsulesContract(owner).mint("0x0005ff", 400, {
          value: mintPrice.sub(1),
        })
      ).to.be.revertedWith("ValueBelowMintPrice()");
    });

    it("Mint pure color should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        capsulesContract(minter1).mint("0x0000ff", 400, {
          value: mintPrice,
        })
      ).to.be.revertedWith("PureColorNotAllowed()");
    });

    it("Mint with valid color should succeed", async () => {
      const { minter1 } = await wallets();

      const minter1Capsules = capsulesContract(minter1);

      const fontWeight = 400;

      const color = "0x0005ff";

      return expect(
        minter1Capsules.mint(color, fontWeight, {
          value: mintPrice,
        })
      )
        .to.emit(minter1Capsules, "MintCapsule")
        .withArgs(2, minter1.address, color);
    });

    it("Mint with valid color and text should succeed", async () => {
      const { minter1 } = await wallets();

      const minter1Capsules = capsulesContract(minter1);

      const fontWeight = 400;

      const color = "0x000aff";

      const text = textToBytes4Lines([""]);

      return expect(
        minter1Capsules.mintWithText(color, fontWeight, text, {
          value: mintPrice,
        })
      )
        .to.emit(minter1Capsules, "MintCapsule")
        .withArgs(3, minter1.address, color);
    });

    it("Mint already minted color should revert", async () => {
      const { minter1 } = await wallets();

      const minter1Capsules = capsulesContract(minter1);

      const color = "0x0005ff";

      const tokenIdOfColor = await capsuleToken.tokenIdOfColor(color);

      return expect(
        minter1Capsules.mint(color, 400, {
          value: mintPrice,
        })
      ).to.be.revertedWith(`ColorAlreadyMinted(${tokenIdOfColor})`);
    });

    // it("Should mint all capsules", async () => {
    //   const { minter2 } = await wallets();

    //   await mintValidUnlockedCapsules(minter2);
    // });
  });

  describe("Capsule owner", async () => {
    it("Edit non-owned capsule should revert", async () => {
      const { minter2 } = await wallets();

      const id = 2;

      const owner = await capsuleToken.ownerOf(id);

      return expect(
        capsulesContract(minter2).editCapsule(id, emptyNote, 400, false)
      ).to.be.revertedWith(`NotCapsuleOwner("${owner}")`);
    });

    it("Edit owned capsule should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return capsulesContract(minter1).editCapsule(id, emptyNote, 400, false);
    });

    it("Set invalid font weight should revert", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return expect(
        capsulesContract(minter1).editCapsule(id, emptyNote, 69, false)
      ).to.be.revertedWith("InvalidFontWeight()");
    });

    // it("Set invalid text should revert", async () => {
    //   const { minter1 } = await wallets();

    //   const id = 2;

    //   await expect(
    //     capsulesContract(minter1).editCapsule(
    //       id,
    //       textToBytes4Lines(["👽"]),
    //       400,
    //       false
    //     )
    //   ).to.be.revertedWith("InvalidText()");
    // });

    it("Lock non-owned capsule should revert", async () => {
      const { minter1, minter2 } = await wallets();

      const id = 2;

      return expect(
        capsulesContract(minter2).lockCapsule(id)
      ).to.be.revertedWith(`NotCapsuleOwner("${minter1.address}")`);
    });

    it("Lock owned capsule should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return capsulesContract(minter1).lockCapsule(id);
    });

    it("Edit locked capsule should revert", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return expect(
        capsulesContract(minter1).editCapsule(id, emptyNote, 400, false)
      ).to.be.revertedWith("CapsuleLocked()");
    });
  });

  describe("Admin", async () => {
    it("Should withdraw balance to fee receiver", async () => {
      const { minter1, feeReceiver } = await wallets();

      const minter1Capsules = capsulesContract(minter1);

      const initialFeeReceiverBalance = await feeReceiver.getBalance();

      const capsulesBalance1 = await feeReceiver.provider?.getBalance(
        capsuleToken.address
      );

      await expect(minter1Capsules.withdraw())
        .to.emit(minter1Capsules, "Withdraw")
        .withArgs(feeReceiver.address, capsulesBalance1);

      expect(await feeReceiver.getBalance()).to.equal(
        initialFeeReceiverBalance.add(capsulesBalance1!)
      );

      expect(
        await feeReceiver.provider?.getBalance(capsuleToken.address)
      ).to.equal(0);
    });
  });
});
