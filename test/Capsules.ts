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

  const { contract: _capsuleMetadata } = await deployCapsuleMetadata();
  capsuleMetadata = _capsuleMetadata;

  const nonce = await deployer.getTransactionCount();
  const expectedCapsuleTokenAddress = utils.getContractAddress({
    from: deployer.address,
    nonce: nonce + 2, // This should be 3 (see deploy.ts) unsure why 2 works
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

      expect(await capsuleToken.defaultRenderer()).to.equal(
        capsuleRenderer.address
      );

      expect(await capsuleToken.capsuleMetadata()).to.equal(
        capsuleMetadata.address
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
          {
            value: mintPrice,
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

      const _fonts = Object.keys(FONTS).map((weight) => ({
        weight: parseInt(weight) as keyof typeof FONTS,
        style: "normal",
      }));

      const gwei = 10;
      console.log(`Estimating gas to store fonts at ${gwei} GWEI...`);
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
            (gas.toNumber() * gwei * 1e-9).toString().substring(0, 6) +
            "ETH" // 20 gwei
        );
      }

      // Store first font
      const tx = store400(owner);
      await expect(tx)
        .to.emit(capsuleToken, "MintCapsule")
        .withArgs(1, owner.address, pureColors[3]);
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
    before(async () => {
      const { owner } = await wallets();
      await deployContracts();
      await unpause();
      await store400(owner);
    });

    it("Mint with invalid font weight should revert", async () => {
      const { minter1 } = await wallets();

      return expect(
        signingContract(capsuleToken, minter1).mint(
          "0x0005ff",
          {
            weight: 100,
            style: "normal",
          },
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
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith("InvalidColor()");
    });

    it("Mint with invalid text should succeed", async () => {
      const { minter1 } = await wallets();

      await signingContract(capsuleToken, minter1).mintWithText(
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

    it("Mint with low price should revert", async () => {
      const { owner } = await wallets();

      return expect(
        signingContract(capsuleToken, owner).mint(
          "0x0005ff",
          {
            weight: 400,
            style: "normal",
          },
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
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith("PureColorNotAllowed()");
    });

    it("Mint with valid color should succeed", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const color = "0x0005ff";

      return expect(
        minter1CapsuleToken.mint(
          color,
          {
            weight: 400,
            style: "normal",
          },
          {
            value: mintPrice,
          }
        )
      )
        .to.emit(minter1CapsuleToken, "MintCapsule")
        .withArgs(3, minter1.address, color);
    });

    it("Mint with valid color and text should succeed", async () => {
      const { minter1 } = await wallets();

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      const color = "0x00aaff";

      const text = stringTextToBytesText(["asdf"]);

      return expect(
        minter1CapsuleToken.mintWithText(
          color,
          {
            weight: 400,
            style: "normal",
          },
          text,
          {
            value: mintPrice,
          }
        )
      )
        .to.emit(minter1CapsuleToken, "MintCapsule")
        .withArgs(4, minter1.address, color);
    });

    it("Mint already minted color should revert", async () => {
      const { minter1 } = await wallets();

      const color = "0x0005ff";

      const tokenIdOfColor = await capsuleToken.tokenIdOfColor(color);

      return expect(
        signingContract(capsuleToken, minter1).mint(
          color,
          {
            weight: 400,
            style: "normal",
          },
          {
            value: mintPrice,
          }
        )
      ).to.be.revertedWith(`ColorAlreadyMinted(${tokenIdOfColor})`);
    });
  });

  describe("Capsule owner", async () => {
    before(async () => {
      const { minter1 } = await wallets();

      await deployContracts();
      await unpause();
      await store400(minter1);
    });

    it("Edit non-owned capsule should revert", async () => {
      const { minter2 } = await wallets();

      const id = 1;

      const owner = await capsuleToken.ownerOf(id);

      return expect(
        signingContract(capsuleToken, minter2).editCapsule(
          id,
          emptyNote,
          {
            weight: 400,
            style: "normal",
          },
          false
        )
      ).to.be.revertedWith(`NotCapsuleOwner("${owner}")`);
    });

    it("Edit owned capsule with valid text and font should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      return signingContract(capsuleToken, minter1).editCapsule(
        id,
        emptyNote,
        {
          weight: 400,
          style: "normal",
        },
        false
      );
    });

    it("Edit with invalid font weight should revert", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      return expect(
        signingContract(capsuleToken, minter1).editCapsule(
          id,
          emptyNote,
          {
            weight: 69,
            style: "normal",
          },
          false
        )
      ).to.be.revertedWith(
        `InvalidFontForRenderer("${capsuleRenderer.address}")`
      );
    });

    it("Edit with invalid font style should revert", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      return expect(
        signingContract(capsuleToken, minter1).editCapsule(
          id,
          emptyNote,
          {
            weight: 400,
            style: "asdf",
          },
          false
        )
      ).to.be.revertedWith(
        `InvalidFontForRenderer("${capsuleRenderer.address}")`
      );
    });

    it("Edit with invalid text should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      await signingContract(capsuleToken, minter1).editCapsule(
        id,
        stringTextToBytesText(["®"]),
        {
          weight: 400,
          style: "normal",
        },
        false
      );
    });

    it("Lock non-owned capsule should revert", async () => {
      const { minter1, minter2 } = await wallets();

      const id = 1;

      return expect(
        signingContract(capsuleToken, minter2).lockCapsule(id)
      ).to.be.revertedWith(`NotCapsuleOwner("${minter1.address}")`);
    });

    it("Lock owned capsule should succeed", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      return signingContract(capsuleToken, minter1).lockCapsule(id);
    });

    it("Edit locked capsule should revert", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      return expect(
        signingContract(capsuleToken, minter1).editCapsule(
          id,
          emptyNote,
          {
            weight: 400,
            style: "normal",
          },
          false
        )
      ).to.be.revertedWith("CapsuleLocked()");
    });

    it("Set invalid renderer should revert", async () => {
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

    it("Set default renderer as owner should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const newRendererAddress = testRenderer.address;

      await expect(ownerCapsuleToken.setDefaultRenderer(newRendererAddress))
        .to.emit(capsuleToken, "SetDefaultRenderer")
        .withArgs(newRendererAddress);

      expect(await ownerCapsuleToken.defaultRenderer()).to.equal(
        newRendererAddress
      );
    });

    it("Set renderer should succeed and Capsule should return SVG from new renderer", async () => {
      const { minter1 } = await wallets();

      const id = 1;

      const minter1CapsuleToken = signingContract(capsuleToken, minter1);

      // Ensure Capsule is using default renderer
      await expect(await minter1CapsuleToken.rendererOf(id)).to.equal(
        await minter1CapsuleToken.defaultRenderer()
      );

      // Set new renderer
      await expect(minter1CapsuleToken.setRendererOf(id, testRenderer.address))
        .to.emit(minter1CapsuleToken, "SetRendererOf")
        .withArgs(id, testRenderer.address);

      await expect(await minter1CapsuleToken.rendererOf(id)).to.equal(
        testRenderer.address
      );

      // Ensure CapsuleToken svgOf is using new renderer
      const svgFromCapsuleToken = await minter1CapsuleToken.svgOf(id);
      const capsule = await minter1CapsuleToken.capsuleOf(1);
      const svgFromTestRenderer = await testRenderer[
        "svgOf((uint256,bytes3,(uint256,string),bytes32[8],bool,bool))"
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

      return expect(await ownerCapsuleToken.feeReceiver()).to.equal(
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

    it("Set valid royalty should succeed", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const newRoyalty = 69;

      await expect(ownerCapsuleToken.setRoyalty(newRoyalty))
        .to.emit(capsuleToken, "SetRoyalty")
        .withArgs(newRoyalty);

      return expect(await ownerCapsuleToken.royalty()).to.equal(newRoyalty);
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

      await expect(ownerCapsuleToken.withdraw())
        .to.changeEtherBalance(feeReceiver, initialBalance)
        .to.emit(capsuleToken, "Withdraw")
        .withArgs(feeReceiver.address, initialBalance);
    });
  });

  describe("Text validation", async () => {
    before(async () => {
      const { owner } = await wallets();
      await deployContracts();
      await unpause();
      await store400(owner);
    });

    it("Should mint and validate unicodes", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const hexes = validHexes();

      const count = UNICODES.length;

      let invalids: string[] = [];

      process.stdout.write(`Minting Capsules... 0/${count}`);

      for (let i = 0; i < count; i++) {
        const unicode = UNICODES[i].toString(16).padStart(4, "0");
        const char = String.fromCharCode(UNICODES[i]);
        process.stdout.cursorTo(20);
        process.stdout.write(`${i + 1}/${count} - "u${unicode}" "${char}"`);

        await ownerCapsuleToken.mintWithText(
          hexes[i],
          {
            weight: 400,
            style: "normal",
          },
          stringTextToBytesText([char]),
          {
            value: mintPrice,
          }
        );

        const isValid = await ownerCapsuleToken.isValidCapsuleText(i + 2);

        if (!isValid) {
          invalids.push(`"u${unicode}" "${char}" ${stringToBytes32(char)}`);
        }
      }

      console.log("Invalids:", invalids);

      expect(invalids.length).to.equal(0);
    });

    it("Invalid text should be invalid", async () => {
      const { owner } = await wallets();

      const ownerCapsuleToken = signingContract(capsuleToken, owner);

      const id = 1;

      expect(await ownerCapsuleToken.isValidCapsuleText(id)).to.equal(true);

      await ownerCapsuleToken.editCapsule(
        id,
        stringTextToBytesText(["💩"]),
        {
          weight: 400,
          style: "normal",
        },
        false
      );

      expect(await ownerCapsuleToken.isValidCapsuleText(id)).to.equal(false);
    });
  });
});
