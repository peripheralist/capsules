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
  signingContract,
  deployCapsuleRenderer,
  deployCapsuleToken,
  deployCapsulesTypeface,
  emptyNote,
  mintPrice,
  textToBytes4Lines,
  wallets,
  deployCapsuleMetadata,
} from "../scripts/utils";
import { ethers } from "hardhat";

export let capsulesTypeface: CapsulesTypeface;
export let capsuleToken: CapsuleToken;
export let capsuleRenderer: CapsuleRenderer;
export let capsuleMetadata: CapsuleMetadata;

describe("Capsules", async () => {
  before(async () => {
    const { deployer, owner, feeReceiver } = await wallets();

    const { contract: _capsuleMetadata } = await deployCapsuleMetadata();
    capsuleMetadata = _capsuleMetadata;

    let nonce = await deployer.getTransactionCount();
    const expectedCapsuleTokenAddress = utils.getContractAddress({
      from: deployer.address,
      nonce: nonce + 2,
    });

    const { contract: _capsulesTypeface } = await deployCapsulesTypeface(
      expectedCapsuleTokenAddress
    );
    capsulesTypeface = _capsulesTypeface;

    const { contract: _capsuleRenderer } = await deployCapsuleRenderer(
      capsulesTypeface.address
    );
    capsuleRenderer = _capsuleRenderer;

    const { contract: _capsuleToken } = await deployCapsuleToken(
      capsulesTypeface.address,
      capsuleRenderer.address,
      capsuleMetadata.address,
      owner.address,
      feeReceiver.address
    );
    capsuleToken = _capsuleToken;
  });

  describe("Deployment", async () => {
    it("Deploy should set owner, fee receiver, and contract addresses", async () => {
      const { owner, feeReceiver } = await wallets();

      expect(await capsuleToken.owner()).to.equal(owner.address);
      expect(await capsuleToken.feeReceiver()).to.equal(feeReceiver.address);
      expect(await capsuleToken.capsulesTypeface()).to.equal(
        capsulesTypeface.address
      );

      expect(await capsulesTypeface.capsuleToken()).to.equal(
        capsuleToken.address
      );

      expect(await capsuleRenderer.capsulesTypeface()).to.equal(
        capsulesTypeface.address
      );

      expect(await capsuleToken.defaultCapsuleRenderer()).to.equal(
        capsuleRenderer.address
      );

      expect(await capsuleToken.capsuleMetadata()).to.equal(
        capsuleMetadata.address
      );
    });
  });

  describe("Initialize", async () => {
    it("Valid setSource while paused should revert", async () => {
      const { owner } = await wallets();

      const ownerCapsulesTypeface = signingContract(capsulesTypeface, owner);

      // Store first font
      return expect(
        ownerCapsulesTypeface.setSource(
          {
            weight: 400,
            style: "normal",
          },
          Buffer.from(FONTS[400]),
          { gasLimit: 30000000 }
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should unpause", async () => {
      const { owner } = await wallets();
      const ownerCapsules = signingContract(capsuleToken, owner);
      return expect(ownerCapsules.unpause())
        .to.emit(ownerCapsules, "Unpaused")
        .withArgs(owner.address);
    });

    it("Should store first font and mint Capsule token", async () => {
      const { owner } = await wallets();

      // const _fonts = Object.keys(FONTS).map((weight) => ({
      //   weight: parseInt(weight) as keyof typeof FONTS,
      //   style: "normal",
      // }));

      // console.log("Estimating gas to store fonts...");
      // // Estimate gas to store all fonts
      // for (let i = 0; i < _fonts.length; i++) {
      //   const weight = _fonts[i].weight;

      //   const gas = await capsulesTypeface.estimateGas.setSource(
      //     _fonts[i],
      //     Buffer.from(FONTS[weight])
      //   );

      //   console.log(
      //     weight,
      //     "=> " +
      //       (gas.toNumber() * 20 * 1e-9).toString().substring(0, 6) +
      //       "ETH" // 20 gwei
      //   );
      // }

      // Store first font
      const normal400Font = {
        weight: 400,
        style: "normal",
      };
      const normal400Src = Buffer.from(FONTS[400]);
      const tx = signingContract(capsulesTypeface, owner).setSource(
        normal400Font,
        normal400Src,
        { gasLimit: 30000000 }
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

      // Store first font
      return expect(
        signingContract(capsulesTypeface, owner).setSource(
          {
            weight: 400,
            style: "normal",
          },
          Buffer.from(FONTS[400]),
          { gasLimit: 30000000 }
        )
      ).to.be.revertedWith("Typeface: font source already exists");
    });
  });

  describe("Minting", async () => {
    it("Mint with unset font weight should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint("0x0005ff", 100, {
          value: mintPrice,
        })
      ).to.be.revertedWith("InvalidFontWeight()");
    });

    it("Mint with invalid color should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint("0x0000fe", 400, {
          value: mintPrice,
        })
      ).to.be.revertedWith("InvalidColor()");
    });

    it("Mint with invalid text should revert, if validating text", async () => {
      const { minter1 } = await wallets();

      await expect(
        signingContract(capsuleToken, minter1).mintWithValidText(
          "0x000aff",
          400,
          textToBytes4Lines(["💩"]),
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith("InvalidText()");
    });

    it("Mint with invalid text should succeed, if not validating text", async () => {
      const { minter1 } = await wallets();

      await signingContract(capsuleToken, minter1).mintWithText(
        "0x000aff",
        400,
        textToBytes4Lines(["💩"]),
        {
          value: mintPrice,
        }
      );
    });

    it("Mint with low price should revert", async () => {
      const { owner } = await wallets();

      return expect(
        signingContract(capsuleToken, owner).mint("0x0005ff", 400, {
          value: mintPrice.sub(1),
        })
      ).to.be.revertedWith("ValueBelowMintPrice()");
    });

    it("Mint pure color should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint("0x0000ff", 400, {
          value: mintPrice,
        })
      ).to.be.revertedWith("PureColorNotAllowed()");
    });

    it("Mint with valid color should succeed", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const fontWeight = 400;

      const color = "0x0005ff";

      return expect(
        minter1CapsuleToken.mint(color, fontWeight, {
          value: mintPrice,
        })
      )
        .to.emit(minter1CapsuleToken, "MintCapsule")
        .withArgs(3, minter1.address, color);
    });

    it("Mint with valid color and text should succeed, if not validating text", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const fontWeight = 400;

      const color = "0x00aaff";

      const text = textToBytes4Lines(["asdf"]);

      return expect(
        minter1CapsuleToken.mintWithText(color, fontWeight, text, {
          value: mintPrice,
        })
      )
        .to.emit(minter1CapsuleToken, "MintCapsule")
        .withArgs(4, minter1.address, color);
    });

    it("Mint with valid color and text should succeed, if validating text", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const fontWeight = 400;

      const color = "0x00a0ff";

      const text = textToBytes4Lines(["asdf"]);

      return expect(
        minter1CapsuleToken.mintWithValidText(color, fontWeight, text, {
          value: mintPrice,
        })
      )
        .to.emit(minter1CapsuleToken, "MintCapsule")
        .withArgs(5, minter1.address, color);
    });

    it("Mint already minted color should revert", async () => {
      const { minter1 } = await wallets();

      const color = "0x0005ff";

      const tokenIdOfColor = await capsuleToken.tokenIdOfColor(color);

      return expect(
        signingContract(capsuleToken, minter1).mint(color, 400, {
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
        signingContract(capsuleToken, minter2).editCapsule(
          id,
          emptyNote,
          400,
          false
        )
      ).to.be.revertedWith(`NotCapsuleOwner("${owner}")`);
    });

    it("Edit owned capsule with valid text and font should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return signingContract(capsuleToken, minter1).editCapsule(
        id,
        emptyNote,
        400,
        false
      );
    });

    it("Edit owned capsule with valid text should succeed, if validating text", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return signingContract(capsuleToken, minter1).editCapsuleWithValidText(
        id,
        emptyNote,
        400,
        false
      );
    });

    it("Edit with invalid font weight should revert", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return expect(
        signingContract(capsuleToken, minter1).editCapsule(
          id,
          emptyNote,
          69,
          false
        )
      ).to.be.revertedWith("InvalidFontWeight()");
    });

    it("Edit with invalid text should revert, if validating text", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      await expect(
        signingContract(capsuleToken, minter1).editCapsuleWithValidText(
          id,
          textToBytes4Lines(["👽"]),
          400,
          false
        )
      ).to.be.revertedWith("InvalidText()");
    });

    it("Edit with invalid text should succeed, if not validating text", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      await signingContract(capsuleToken, minter1).editCapsule(
        id,
        textToBytes4Lines(["👽"]),
        400,
        false
      );
    });

    it("Lock non-owned capsule should revert", async () => {
      const { minter1, minter2 } = await wallets();

      const id = 2;

      return expect(
        signingContract(capsuleToken, minter2).lockCapsule(id)
      ).to.be.revertedWith(`NotCapsuleOwner("${minter1.address}")`);
    });

    it("Lock owned capsule should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return signingContract(capsuleToken, minter1).lockCapsule(id);
    });

    it("Edit locked capsule should revert", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      return expect(
        signingContract(capsuleToken, minter1).editCapsule(
          id,
          emptyNote,
          400,
          false
        )
      ).to.be.revertedWith("CapsuleLocked()");
    });

    it("Set renderer should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 2;

      const TestCapsuleRenderer = await ethers.getContractFactory(
        "TestCapsuleRenderer"
      );
      const testCapsuleRenderer =
        (await TestCapsuleRenderer.deploy()) as CapsuleRenderer;

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      await expect(await minter1CapsuleToken.rendererOf(id)).to.equal(
        await minter1CapsuleToken.defaultCapsuleRenderer()
      );

      await expect(
        minter1CapsuleToken.setRendererOf(id, testCapsuleRenderer.address)
      )
        .to.emit(minter1CapsuleToken, "SetRendererOf")
        .withArgs(id, testCapsuleRenderer.address);

      await expect(await minter1CapsuleToken.rendererOf(id)).to.equal(
        testCapsuleRenderer.address
      );

      await expect(await minter1CapsuleToken.svgOf(id)).to.equal("test");
    });
  });

  describe("Admin", async () => {
    it("Should withdraw balance to fee receiver", async () => {
      const { minter1, feeReceiver } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const initialFeeReceiverBalance = await feeReceiver.getBalance();

      const capsulesBalance1 = await feeReceiver.provider?.getBalance(
        capsuleToken.address
      );

      await expect(minter1CapsuleToken.withdraw())
        .to.emit(minter1CapsuleToken, "Withdraw")
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
