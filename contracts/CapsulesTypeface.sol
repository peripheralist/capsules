// SPDX-License-Identifier: GPL-3.0

/**
  @title Capsules Typeface

  @author peri

  @notice Capsules Typeface stored on-chain using the Typeface contract. 7 "normal" fonts are supported, with weights 100-700. All characters require 2 or less bytes to encode.
 */

pragma solidity ^0.8.0;

import "./interfaces/ICapsuleToken.sol";
import "./Typeface.sol";

contract CapsulesTypeface is Typeface {
    /// Address of Capsules Token contract
    ICapsuleToken public immutable capsuleToken;

    constructor(
        Font[] memory fonts,
        bytes32[] memory hashes,
        address _capsuleToken
    ) Typeface("Capsules") {
        _setFontSourceHashes(fonts, hashes);

        capsuleToken = ICapsuleToken(_capsuleToken);
    }

    /// @notice Returns true if bytes4 char is supported by Capsules typeface.
    function isSupportedChar(bytes4 char) external pure returns (bool) {
        // TODO update to use utf8 encoding

        // Optimize gas by first checking outer bounds of byte ranges
        if (char < 0x00000020 || char > 0x0000e069) return false;

        return ((char >= 0x00000020 && char <= 0x0000007e) ||
            (char >= 0x000000a0 && char <= 0x000000a8) ||
            (char >= 0x000000ab && char <= 0x000000ac) ||
            (char >= 0x000000af && char <= 0x000000b1) ||
            char == 0x000000b4 ||
            (char >= 0x000000b6 && char <= 0x000000b7) ||
            (char >= 0x000000ba && char <= 0x000000bb) ||
            (char >= 0x000000bf && char <= 0x000000c4) ||
            (char >= 0x000000c6 && char <= 0x000000cf) ||
            (char >= 0x000000d1 && char <= 0x000000d7) ||
            (char >= 0x000000d9 && char <= 0x000000dc) ||
            (char >= 0x000000e0 && char <= 0x000000e4) ||
            (char >= 0x000000e6 && char <= 0x000000ef) ||
            (char >= 0x000000f1 && char <= 0x000000fc) ||
            (char >= 0x000000ff && char <= 0x00000101) ||
            (char >= 0x00000112 && char <= 0x00000113) ||
            (char >= 0x00000128 && char <= 0x0000012b) ||
            char == 0x00000131 ||
            (char >= 0x0000014c && char <= 0x0000014d) ||
            (char >= 0x00000168 && char <= 0x0000016b) ||
            char == 0x00000178 ||
            char == 0x0000018e ||
            char == 0x00000192 ||
            char == 0x00000262 ||
            char == 0x0000026a ||
            char == 0x00000274 ||
            (char >= 0x00000280 && char <= 0x00000281) ||
            char == 0x0000028f ||
            char == 0x00000299 ||
            char == 0x0000029c ||
            char == 0x0000029f ||
            (char >= 0x000002c2 && char <= 0x000002c3) ||
            char == 0x000002c6 ||
            char == 0x000002dc ||
            char == 0x0000039e ||
            char == 0x000003c0 ||
            char == 0x00000e3f ||
            (char >= 0x00001d00 && char <= 0x00001d01) ||
            char == 0x00001d05 ||
            char == 0x00001d07 ||
            (char >= 0x00001d0a && char <= 0x00001d0b) ||
            (char >= 0x00001d0d && char <= 0x00001d0e) ||
            (char >= 0x00001d18 && char <= 0x00001d19) ||
            char == 0x00001d1b ||
            (char >= 0x00002013 && char <= 0x00002015) ||
            (char >= 0x00002017 && char <= 0x0000201a) ||
            (char >= 0x0000201c && char <= 0x0000201e) ||
            (char >= 0x00002020 && char <= 0x00002022) ||
            char == 0x00002026 ||
            char == 0x00002030 ||
            (char >= 0x00002032 && char <= 0x00002033) ||
            (char >= 0x00002039 && char <= 0x0000203a) ||
            char == 0x0000203c ||
            char == 0x0000203e ||
            char == 0x00002044 ||
            char == 0x000020a8 ||
            char == 0x000020ac ||
            char == 0x000020b4 ||
            char == 0x000020bd ||
            char == 0x000020bf ||
            char == 0x00002184 ||
            (char >= 0x00002190 && char <= 0x00002199) ||
            (char >= 0x000021ba && char <= 0x000021bb) ||
            char == 0x00002206 ||
            char == 0x0000220f ||
            (char >= 0x00002211 && char <= 0x00002212) ||
            char == 0x0000221a ||
            char == 0x0000221e ||
            char == 0x0000222b ||
            char == 0x00002248 ||
            char == 0x00002260 ||
            (char >= 0x00002264 && char <= 0x00002265) ||
            (char >= 0x00002302 && char <= 0x00002304) ||
            char == 0x0000231b ||
            char == 0x000023cf ||
            (char >= 0x000023e9 && char <= 0x000023ea) ||
            (char >= 0x000023ed && char <= 0x000023ef) ||
            (char >= 0x000023f8 && char <= 0x000023fa) ||
            char == 0x000025b2 ||
            char == 0x000025b6 ||
            char == 0x000025bc ||
            char == 0x000025c0 ||
            char == 0x000025ca ||
            char == 0x00002600 ||
            char == 0x00002610 ||
            char == 0x00002612 ||
            char == 0x00002630 ||
            (char >= 0x00002639 && char <= 0x0000263a) ||
            char == 0x0000263c ||
            char == 0x00002665 ||
            (char >= 0x00002680 && char <= 0x00002685) ||
            (char >= 0x00002690 && char <= 0x00002691) ||
            char == 0x000026a1 ||
            char == 0x00002713 ||
            (char >= 0x00002b05 && char <= 0x00002b0d) ||
            char == 0x00002b95 ||
            char == 0x0000a730 ||
            char == 0x0000a7af ||
            (char >= 0x0000e000 && char <= 0x0000e02b) ||
            char == 0x0000e069);
    }

    /// @notice Mint pure color Capsule token to sender when sender sets font source.
    function _afterSetSource(Font calldata font, bytes calldata)
        internal
        override(Typeface)
    {
        capsuleToken.mintPureColorForFont(msg.sender, font);
    }
}
