import { expect } from "chai";
import { utils } from "ethers";

import { FONTS } from "../fonts";
import { UNICODES } from "../unicodes";
import { pureColors } from "../pureColors";
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
  stringTextToBytesText,
  wallets,
  deployCapsuleMetadata,
  validHexes,
  stringToBytes32,
} from "../scripts/utils";
import { ethers } from "hardhat";
import { SignerWithAddress } from "hardhat-deploy-ethers/signers";

export let capsulesTypeface: CapsulesTypeface;
export let capsuleToken: CapsuleToken;
export let capsuleRenderer: CapsuleRenderer;
export let testRenderer: CapsuleRenderer;
export let capsuleMetadata: CapsuleMetadata;

async function deployContracts() {
  const { deployer, owner, feeReceiver } = await wallets();

  const nonce = await deployer.getTransactionCount();
  const expectedCapsuleTokenAddress = utils.getContractAddress({
    from: deployer.address,
    nonce: nonce + 5,
  });

  const { contract: _capsuleMetadata } = await deployCapsuleMetadata();
  capsuleMetadata = _capsuleMetadata;

  const { contract: _capsulesTypeface } = await deployCapsulesTypeface(
    expectedCapsuleTokenAddress,
    owner.address,
    owner.address
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
}

async function store400(owner: SignerWithAddress) {
  const normal400Font = {
    weight: 400,
    style: "normal",
  };
  const normal400Src = Buffer.from(FONTS[400]);
  return signingContract(capsulesTypeface, owner).setSource(
    normal400Font,
    normal400Src,
    { gasLimit: 30000000 }
  );
}

async function unpause() {
  const { owner } = await wallets();

  return signingContract(capsuleToken, owner).unpause();
}

describe("Capsules", async () => {
  describe("Deployment", async () => {
    before(async () => {
      await deployContracts();
    });

    it("Deploy should set owner, fee receiver, donation address, and contract addresses", async () => {
      const { owner, feeReceiver } = await wallets();

      expect(await capsuleToken.owner()).to.equal(owner.address);
      expect(await capsuleToken.feeReceiver()).to.equal(feeReceiver.address);
      expect(await capsuleToken.capsulesTypeface()).to.equal(
        capsulesTypeface.address
      );
      expect(await capsuleToken.defaultRenderer()).to.equal(
        capsuleRenderer.address
      );
      expect(await capsuleToken.capsuleMetadata()).to.equal(
        capsuleMetadata.address
      );

      expect(await capsulesTypeface.capsuleToken()).to.equal(
        capsuleToken.address
      );
      expect(await capsulesTypeface.operator()).to.equal(owner.address);
      expect(await capsulesTypeface.donationAddress()).to.equal(owner.address);

      expect(await capsuleRenderer.capsulesTypeface()).to.equal(
        capsulesTypeface.address
      );

      const TestRenderer = await ethers.getContractFactory(
        "TestCapsuleRenderer"
      );
      testRenderer = (await TestRenderer.deploy()) as CapsuleRenderer;
    });
  });

  describe("Initialize", async () => {
    before(async () => {
      await deployContracts();
    });

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

    it("Mint should revert while paused", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      return expect(
        minter1CapsuleToken.mint(
          "0x0005ff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote,
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Valid mintGift should revert while paused", async () => {
      const { minter1, owner } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      await signingContract(capsuleToken, owner).setGiftCounts(
        [minter1.address],
        [1]
      );

      return expect(
        minter1CapsuleToken.mintGift(
          "0x0005ff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote
        )
      ).to.be.revertedWith("Pausable: paused");
    });

    it("mintPureColorForFont should revert while paused", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mintPureColorForFont(
          minter1.address,
          {
            weight: 100,
            style: "normal",
          }
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

      // const gwei = 20;
      // console.log(`Estimating gas to store fonts at ${gwei} GWEI...`);
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
      //       (gas.toNumber() * gwei * 1e-9).toString().substring(0, 6) +
      //       "ETH" // 20 gwei
      //   );
      // }

      // Store first font
      const tx = store400(owner);
      await expect(tx)
        .to.emit(capsuleToken, "MintCapsule")
        .withArgs(1, owner.address, pureColors[3], [400, "normal"], emptyNote);
      await expect(tx)
        .to.emit(capsulesTypeface, "SetSource")
        .withArgs([400, "normal"]);
    });

    it("CapsulesTypeface contract should return correct patron", async () => {
      const { owner } = await wallets();

      await expect(
        await capsulesTypeface.patronOf({ weight: 400, style: "normal" })
      ).to.equal(owner.address);
    });

    it("Address that stores font src should receive Capsule NFT", async () => {
      const { owner } = await wallets();

      return expect(await capsuleToken.balanceOf(owner.address)).to.equal(1);
    });
  });

  describe("Mint fonts", async () => {
    before(async () => {
      await deployContracts();
      await unpause();
    });

    it("Should mint fonts", async () => {
      const { owner } = await wallets();

      // for (let i = 0; i < validHexes().length; i++) {
      //   const b = validHexes()[i];
      //   expect(b).to.equal(colorStringToBytes(await capsuleRenderer.test(b)));
      //   console.log(i, b, await capsuleRenderer.test(b));
      // }

      for (let i = 1; i <= 7; i++) {
        const weight = i * 100;
        const src = Buffer.from(FONTS[weight as keyof typeof FONTS]);

        await signingContract(capsulesTypeface, owner).setSource(
          {
            weight,
            style: "normal",
          },
          src,
          {
            gasLimit: 30000000,
          }
        );

        // Sanity check that all tokenURI will render
        expect((await capsuleToken.tokenURI(i)).length).to.be.greaterThan(0);
      }
    });
  });

  describe("Minting", async () => {
    before(async () => {
      const { owner } = await wallets();
      await deployContracts();
      await unpause();
      await store400(owner);
    });

    it("Mint pure color as non-CapsulesTypeface should revert", async () => {
      const { minter1 } = await wallets();

      expect(minter1.address).to.not.equal(capsulesTypeface.address);

      return expect(
        signingContract(capsuleToken, minter1).mintPureColorForFont(
          minter1.address,
          {
            weight: 100,
            style: "normal",
          }
        )
      ).to.be.revertedWith(`NotCapsulesTypeface()`);
    });

    it("Mint with invalid font weight (not stored yet) should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint(
          "0x0005ff",
          {
            weight: 100,
            style: "normal",
          },
          emptyNote,
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith(
        `InvalidFontForRenderer("${capsuleRenderer.address}")`
      );
    });

    it("Mint with invalid font style should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint(
          "0x0005ff",
          {
            weight: 400,
            style: "asdf",
          },
          emptyNote,
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith(
        `InvalidFontForRenderer("${capsuleRenderer.address}")`
      );
    });

    it("Mint with invalid color should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint(
          "0x0000fe",
          {
            weight: 100,
            style: "normal",
          },
          emptyNote,
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith("InvalidColor()");
    });

    it("Mint with low price should revert", async () => {
      const { owner } = await wallets();

      return expect(
        signingContract(capsuleToken, owner).mint(
          "0x0005ff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote,
          {
            value: mintPrice.sub(1),
          }
        )
      ).to.be.revertedWith("ValueBelowMintPrice()");
    });

    it("Mint pure color should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint(
          "0x0000ff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote,
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith("PureColorNotAllowed()");
    });

    it("Mint with valid color and text should succeed", async () => {
      const { minter1 } = await wallets();

      await signingContract(capsuleToken, minter1).mint(
        "0x000aff",
        {
          weight: 400,
          style: "normal",
        },
        stringTextToBytesText(["®"]),
        {
          value: mintPrice,
        }
      );
    });

    it("Mint with valid color and text should succeed", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const color = "0x00aaff";

      const font = {
        weight: 400,
        style: "normal",
      };

      const text = stringTextToBytesText(["asdf"]);

      return expect(
        minter1CapsuleToken.mint(color, font, text, {
          value: mintPrice,
        })
      )
        .to.emit(minter1CapsuleToken, "MintCapsule")
        .withArgs(3, minter1.address, color, [400, "normal"], text);
    });

    it("Mint already minted color should revert", async () => {
      const { minter1 } = await wallets();

      const color = "0x00aaff";

      const tokenIdOfColor = await capsuleToken.tokenIdOfColor(color);

      expect(tokenIdOfColor.toNumber()).to.be.greaterThan(0);

      return expect(
        signingContract(capsuleToken, minter1).mint(
          color,
          {
            weight: 400,
            style: "normal",
          },
          emptyNote,
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith(`ColorAlreadyMinted(${tokenIdOfColor})`);
    });
  });

  describe("Gifts", async () => {
    before(async () => {
      const { owner } = await wallets();

      await deployContracts();
      await unpause();
      await store400(owner);
    });

    it("Set gift counts should fail for non-owner", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).setGiftCounts(
          [minter1.address],
          [1]
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Set gift counts should succeed for owner", async () => {
      const { minter1, owner } = await wallets();

      const tx = await signingContract(capsuleToken, owner).setGiftCounts(
        [minter1.address],
        [1]
      );

      await expect(tx)
        .to.emit(capsuleToken, "SetGiftCount")
        .withArgs(minter1.address, 1);
    });

    it("Should return correct giftCount", async () => {
      const { minter1 } = await wallets();

      expect(await capsuleToken.giftCountOf(minter1.address)).to.equal(1);
    });

    it("Mint gift should revert if no gift available", async () => {
      const { minter2 } = await wallets();

      expect(await capsuleToken.giftCountOf(minter2.address)).to.equal(0);

      await expect(
        signingContract(capsuleToken, minter2).mintGift(
          "0x0005ff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote
        )
      ).to.be.revertedWith("NoGiftAvailable");
    });

    it("Mint gift should succeed if giftCount > 0", async () => {
      const { minter1 } = await wallets();

      const initialGiftCount = await capsuleToken.giftCountOf(minter1.address);

      expect(initialGiftCount.toNumber()).to.be.greaterThan(0);

      const tx = signingContract(capsuleToken, minter1).mintGift(
        "0x0005ff",
        {
          weight: 400,
          style: "normal",
        },
        emptyNote
      );

      expect(tx).to.emit(capsuleToken, "MintGift").withArgs(minter1.address);

      expect(tx)
        .to.emit(capsuleToken, "MintCapsule")
        .withArgs(2, minter1.address, "0x0005ff", [400, "normal"], emptyNote);

      await expect(
        (await capsuleToken.giftCountOf(minter1.address)).toNumber()
      ).to.equal(initialGiftCount.toNumber() - 1);
    });
  });

  describe("Capsule owner", async () => {
    before(async () => {
      const { minter1 } = await wallets();

      await deployContracts();
      await unpause();
      await store400(minter1);
    });

    it("mintAsOwner should fail if not owner", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mintAsOwner(
          minter1.address,
          "0x0005ff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Owner mint should succeed while paused if owner", async () => {
      const { owner } = await wallets();

      await signingContract(capsuleToken, owner).pause();

      await expect(
        signingContract(capsuleToken, owner).mintAsOwner(
          owner.address,
          "0x0005ff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote
        )
      )
        .to.emit(capsuleToken, "MintCapsule")
        .withArgs(2, owner.address, "0x0005ff", [400, "normal"], emptyNote);

      await signingContract(capsuleToken, owner).unpause();
    });

    it("Owner mint should succeed while not paused if owner", async () => {
      const { owner } = await wallets();

      await expect(
        signingContract(capsuleToken, owner).mintAsOwner(
          owner.address,
          "0x000aff",
          {
            weight: 400,
            style: "normal",
          },
          emptyNote
        )
      )
        .to.emit(capsuleToken, "MintCapsule")
        .withArgs(3, owner.address, "0x000aff", [400, "normal"], emptyNote);
    });

    it("Set text of non-owned capsule should revert", async () => {
      const { minter2 } = await wallets();

      const id = 1;

      const owner = await capsuleToken.ownerOf(id);

      return expect(
        signingContract(capsuleToken, minter2).setText(id, emptyNote)
      ).to.be.revertedWith(`NotCapsuleOwner("${owner}")`);
    });

    it("Set valid font of non-owned capsule should revert", async () => {
      const { minter2 } = await wallets();

      const id = 1;

      const capsuleOwner = await capsuleToken.ownerOf(id);

      expect(capsuleOwner).to.not.equal(minter2.address);

      return expect(
        signingContract(capsuleToken, minter2).setFont(id, {
          weight: 400,
          style: "normal",
        })
      ).to.be.revertedWith(`NotCapsuleOwner("${capsuleOwner}")`);
    });

    it("Set text and font of non-owned capsule should revert", async () => {
      const { minter2 } = await wallets();

      const id = 1;

      const capsuleOwner = await capsuleToken.ownerOf(id);

      expect(capsuleOwner).to.not.equal(minter2.address);

      await expect(
        signingContract(capsuleToken, minter2).setTextAndFont(id, emptyNote, {
          weight: 400,
          style: "normal",
        })
      ).to.be.revertedWith(`NotCapsuleOwner("${capsuleOwner}")`);
    });

    it("Set text and font of owned Capsule should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      const tx = signingContract(capsuleToken, minter1).setTextAndFont(
        id,
        emptyNote,
        {
          weight: 400,
          style: "normal",
        }
      );

      await expect(tx)
        .to.emit(capsuleToken, "SetCapsuleFont")
        .withArgs(1, [400, "normal"]);

      await expect(tx)
        .to.emit(capsuleToken, "SetCapsuleText")
        .withArgs(1, emptyNote);
    });

    it("Set valid font weight on owned Capsule should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      const capsuleOwner = await capsuleToken.ownerOf(id);

      expect(capsuleOwner).to.equal(minter1.address);

      return expect(
        signingContract(capsuleToken, minter1).setFont(id, {
          weight: 400,
          style: "normal",
        })
      )
        .to.emit(capsuleToken, "SetCapsuleFont")
        .withArgs(id, [400, "normal"]);
    });

    it("Set invalid font style on owned Capsule should revert", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      const capsuleOwner = await capsuleToken.ownerOf(id);

      expect(capsuleOwner).to.equal(minter1.address);

      return expect(
        signingContract(capsuleToken, minter1).setFont(id, {
          weight: 400,
          style: "asdf",
        })
      ).to.be.revertedWith(
        `InvalidFontForRenderer("${capsuleRenderer.address}")`
      );
    });

    it("Set text on owned Capsule should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      const capsuleOwner = await capsuleToken.ownerOf(id);

      expect(capsuleOwner).to.equal(minter1.address);

      const text = stringTextToBytesText(["asdf"]);

      await expect(signingContract(capsuleToken, minter1).setText(id, text))
        .to.emit(capsuleToken, "SetCapsuleText")
        .withArgs(id, text);
    });

    it("Set invalid renderer on owned Capsule should revert", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      // Ensure Capsule is using default renderer
      await expect(await minter1CapsuleToken.rendererOf(id)).to.equal(
        await minter1CapsuleToken.defaultRenderer()
      );

      // Set new renderer
      await expect(
        minter1CapsuleToken.setRendererOf(id, testRenderer.address)
      ).to.be.revertedWith("InvalidRenderer()");
    });

    it("Add valid renderer as owner should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const newRendererAddress = testRenderer.address;

      await expect(ownerCapsuleToken.addValidRenderer(newRendererAddress))
        .to.emit(capsuleToken, "AddValidRenderer")
        .withArgs(newRendererAddress);
    });

    it("Should return correct isValidRenderer()", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      expect(
        await ownerCapsuleToken.isValidRenderer(testRenderer.address)
      ).to.equal(true);
    });

    it("Set renderer of owned Capsule should succeed and Capsule should return SVG from new renderer", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      const capsuleOwner = await capsuleToken.ownerOf(id);

      expect(capsuleOwner).to.equal(minter1.address);

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      // Ensure Capsule is using default renderer
      await expect(await minter1CapsuleToken.rendererOf(id)).to.equal(
        await minter1CapsuleToken.defaultRenderer()
      );

      // Set new renderer
      await expect(minter1CapsuleToken.setRendererOf(id, testRenderer.address))
        .to.emit(minter1CapsuleToken, "SetCapsuleRenderer")
        .withArgs(id, testRenderer.address);

      await expect(await minter1CapsuleToken.rendererOf(id)).to.equal(
        testRenderer.address
      );

      // Ensure CapsuleToken svgOf is using new renderer
      const svgFromCapsuleToken = await minter1CapsuleToken.svgOf(id);
      const capsule = await minter1CapsuleToken.capsuleOf(1);
      const svgFromTestRenderer = await testRenderer[
        "svgOf((uint256,bytes3,(uint256,string),bytes32[8],bool))"
      ](capsule);
      await expect(svgFromCapsuleToken).to.equal(svgFromTestRenderer);
    });
  });

  describe("Admin", async () => {
    before(async () => {
      await deployContracts();
    });

    it("Set default renderer as non-owner should revert", async () => {
      const { minter1, renderer2 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      return expect(
        minter1CapsuleToken.setDefaultRenderer(renderer2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Add valid renderer as owner should succeed", async () => {
      const { owner, renderer2 } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      await expect(ownerCapsuleToken.addValidRenderer(renderer2.address))
        .to.emit(capsuleToken, "AddValidRenderer")
        .withArgs(renderer2.address);
    });

    it("Should return correct isValidRenderer()", async () => {
      const { owner, renderer2 } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      expect(
        await ownerCapsuleToken.isValidRenderer(renderer2.address)
      ).to.equal(true);
    });

    it("Set default renderer as owner should succeed", async () => {
      const { owner, renderer2 } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      await expect(ownerCapsuleToken.setDefaultRenderer(renderer2.address))
        .to.emit(capsuleToken, "SetDefaultRenderer")
        .withArgs(renderer2.address);
    });

    it("Should return correct defaultRenderer", async () => {
      const { owner, renderer2 } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      expect(await ownerCapsuleToken.defaultRenderer()).to.equal(
        renderer2.address
      );
    });

    it("Set metadata address as non-owner should revert", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      return expect(
        minter1CapsuleToken.setCapsuleMetadata(minter1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Set metadata address as owner should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const newMetadataAddress = owner.address;

      expect(await ownerCapsuleToken.setCapsuleMetadata(newMetadataAddress))
        .to.emit(capsuleToken, "SetCapsuleMetadata")
        .withArgs(newMetadataAddress);

      expect(await ownerCapsuleToken.capsuleMetadata()).to.equal(
        newMetadataAddress
      );
    });

    it("Set feeReceiver as non-owner should revert", async () => {
      const { minter1, newFeeReceiver } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      return expect(
        minter1CapsuleToken.setFeeReceiver(newFeeReceiver.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Set feeReceiver as owner should succeed", async () => {
      const { owner, newFeeReceiver } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      await expect(ownerCapsuleToken.setFeeReceiver(newFeeReceiver.address))
        .to.emit(capsuleToken, "SetFeeReceiver")
        .withArgs(newFeeReceiver.address);

      expect(await ownerCapsuleToken.feeReceiver()).to.equal(
        newFeeReceiver.address
      );

      expect((await ownerCapsuleToken.royaltyInfo(0, 0))[0]).to.equal(
        newFeeReceiver.address
      );
    });

    it("Set royalty as non-owner should revert", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      return expect(minter1CapsuleToken.setRoyalty(50)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Set too high royalty as owner should revert", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      return expect(ownerCapsuleToken.setRoyalty(100000)).to.be.revertedWith(
        "Amount too high"
      );
    });

    it("Set valid royalty as owner should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const newRoyalty = 69;

      await expect(ownerCapsuleToken.setRoyalty(newRoyalty))
        .to.emit(capsuleToken, "SetRoyalty")
        .withArgs(newRoyalty);

      return expect(await ownerCapsuleToken.royalty()).to.equal(newRoyalty);
    });

    it("setContractURI as non-owner should revert", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      return expect(
        minter1CapsuleToken.setContractURI("asdf")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("setContractURI as owner should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const newContractURI = "asdf";

      await expect(ownerCapsuleToken.setContractURI(newContractURI))
        .to.emit(capsuleToken, "SetContractURI")
        .withArgs(newContractURI);

      return expect(await ownerCapsuleToken.contractURI()).to.equal(
        newContractURI
      );
    });

    it("Pause as non-owner should revert", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      return expect(minter1CapsuleToken.pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });

    it("Unpause as owner should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      return expect(ownerCapsuleToken.unpause()).to.emit(
        capsuleToken,
        "Unpaused"
      );
    });

    it("Pause as owner should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      return expect(ownerCapsuleToken.pause()).to.emit(capsuleToken, "Paused");
    });
  });

  describe("Royalties", async () => {
    before(async () => {
      await deployContracts();
    });

    it("Contract should receive ETH and withdraw to feeReceiver", async () => {
      const { owner, feeReceiver } = await wallets();

      const value = 69;

      await expect(
        await owner.sendTransaction({
          to: capsuleToken.address,
          value,
        })
      ).to.changeEtherBalance(capsuleToken, value);

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const initialBalance = await owner.provider?.getBalance(
        capsuleToken.address
      );

      const tx = ownerCapsuleToken.withdraw();

      await expect(tx)
        .to.emit(capsuleToken, "Withdraw")
        .withArgs(feeReceiver.address, initialBalance);

      await expect(await tx).to.changeEtherBalance(feeReceiver, initialBalance);
    });
  });

  describe.skip("Text validation", async () => {
    before(async () => {
      const { owner } = await wallets();
      await deployContracts();
      await unpause();
      await store400(owner);
    });

    it("Should mint and validate unicodes", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const hexes = validHexes();

      const count = UNICODES.length;

      let invalids: string[] = [];

      process.stdout.write(`Minting Capsules... 0/${count}`);

      for (let i = 0; i < count; i++) {
        const unicode = UNICODES[i].toString(16).padStart(4, "0");
        const char = String.fromCharCode(UNICODES[i]);

        // Randomize size of text to estimate average gas cost
        let line: string = "";
        for (let i = 0; i < Math.ceil(Math.random() * 16); i++) {
          line += char;
        }

        const lines: string[] = [];
        for (let i = 0; i < Math.ceil(Math.random() * 8); i++) {
          lines.push(line);
        }

        process.stdout.cursorTo(20);
        process.stdout.write(
          `${i + 1}/${count} - "u${unicode}" "${char}" ${lines.length} lines`
        );

        await minter1CapsuleToken.mint(
          hexes[i],
          {
            weight: 400,
            style: "normal",
          },
          stringTextToBytesText(lines),
          {
            value: mintPrice,
          }
        );

        const isValid = await minter1CapsuleToken.isValidCapsuleText(i + 2);

        if (!isValid) {
          invalids.push(`"u${unicode}" "${char}" ${stringToBytes32(char)}`);
        }
      }

      console.log("Invalids:", invalids);

      expect(invalids.length).to.equal(0);
    });

    it("Invalid text should be invalid on edit", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const id = 2;

      const invalidCodes: number[] = [];
      // all bytes2 range
      for (let i = 0; i < 0xffff; i++) {
        if (!UNICODES.includes(i)) invalidCodes.push(i);
      }

      let valids: string[] = [];

      process.stdout.write(`Editing Capsule ${id}... 0/${invalidCodes.length}`);

      for (let i = 0; i < invalidCodes.length; i++) {
        const unicode = invalidCodes[i];
        const char = String.fromCharCode(unicode);

        // Randomize size of text to estimate average gas cost
        let line: string = "";
        for (let i = 0; i < Math.ceil(Math.random() * 16); i++) {
          line += char;
        }

        const lines: string[] = [];
        for (let i = 0; i < Math.ceil(Math.random() * 8); i++) {
          lines.push(line);
        }

        const formattedUnicode = "u" + unicode.toString(16).padStart(4, "0");

        process.stdout.cursorTo(20);
        process.stdout.write(
          `${i + 1}/${invalidCodes.length} - "${formattedUnicode}" "${char}" ${
            lines.length
          } lines`
        );

        await minter1CapsuleToken.setText(id, stringTextToBytesText(lines));

        if (await minter1CapsuleToken.isValidCapsuleText(id)) {
          valids.push(
            `"${formattedUnicode}" "${char}" ${stringToBytes32(char)}`
          );
        }
      }

      console.log("Valids:", valids);

      expect(valids.length).to.equal(0);
    });
  });
});
