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

    // /// @notice Returns true if bytes1 char is supported by CapsulesTypeface. Requires less gas than checking supported bytes2 chars.
    // function isSupportedByte(bytes1 char) external pure returns (bool) {
    //     // Optimize gas by first checking outer bound of byte ranges
    //     if (char < 0x20) return false;

    //     return (char <= 0x7e ||
    //         (char >= 0xa0 && char <= 0xa8) ||
    //         (char >= 0xab && char <= 0xac) ||
    //         (char >= 0xaf && char <= 0xb1) ||
    //         char == 0xb4 ||
    //         (char >= 0xb6 && char <= 0xb7) ||
    //         (char >= 0xba && char <= 0xbb) ||
    //         (char >= 0xbf && char <= 0xc4) ||
    //         (char >= 0xc6 && char <= 0xcf) ||
    //         (char >= 0xd1 && char <= 0xd7) ||
    //         (char >= 0xd9 && char <= 0xdc) ||
    //         (char >= 0xe0 && char <= 0xe4) ||
    //         (char >= 0xe6 && char <= 0xef) ||
    //         (char >= 0xf1 && char <= 0xfc) ||
    //         char == 0xff);
    // }

    /// @notice Returns true if bytes2 char is supported by CapsulesTypeface.
    function isSupportedBytes2(bytes2 char) external pure returns (bool) {
        // Optimize gas by first checking outer bounds of byte ranges
        if (char < 0x0020 || char > 0xe069) return false;

        return ((char >= 0x0020 && char <= 0x007e) ||
            (char >= 0x00a0 && char <= 0x00a8) ||
            (char >= 0x00ab && char <= 0x00ac) ||
            (char >= 0x00af && char <= 0x00b1) ||
            char == 0x00b4 ||
            (char >= 0x00b6 && char <= 0x00b7) ||
            (char >= 0x00ba && char <= 0x00bb) ||
            (char >= 0x00bf && char <= 0x00c4) ||
            (char >= 0x00c6 && char <= 0x00cf) ||
            (char >= 0x00d1 && char <= 0x00d7) ||
            (char >= 0x00d9 && char <= 0x00dc) ||
            (char >= 0x00e0 && char <= 0x00e4) ||
            (char >= 0x00e6 && char <= 0x00ef) ||
            (char >= 0x00f1 && char <= 0x00fc) ||
            (char >= 0x00ff && char <= 0x0101) ||
            (char >= 0x0112 && char <= 0x0113) ||
            (char >= 0x0128 && char <= 0x012b) ||
            char == 0x0131 ||
            (char >= 0x014c && char <= 0x014d) ||
            (char >= 0x0168 && char <= 0x016b) ||
            char == 0x0178 ||
            char == 0x018e ||
            char == 0x0192 ||
            char == 0x0262 ||
            char == 0x026a ||
            char == 0x0274 ||
            (char >= 0x0280 && char <= 0x0281) ||
            char == 0x028f ||
            char == 0x0299 ||
            char == 0x029c ||
            char == 0x029f ||
            (char >= 0x02c2 && char <= 0x02c3) ||
            char == 0x02c6 ||
            char == 0x02dc ||
            char == 0x039e ||
            char == 0x03c0 ||
            char == 0x0e3f ||
            (char >= 0x1d00 && char <= 0x1d01) ||
            char == 0x1d05 ||
            char == 0x1d07 ||
            (char >= 0x1d0a && char <= 0x1d0b) ||
            (char >= 0x1d0d && char <= 0x1d0e) ||
            (char >= 0x1d18 && char <= 0x1d19) ||
            char == 0x1d1b ||
            (char >= 0x2013 && char <= 0x2015) ||
            (char >= 0x2017 && char <= 0x201a) ||
            (char >= 0x201c && char <= 0x201e) ||
            (char >= 0x2020 && char <= 0x2022) ||
            char == 0x2026 ||
            char == 0x2030 ||
            (char >= 0x2032 && char <= 0x2033) ||
            (char >= 0x2039 && char <= 0x203a) ||
            char == 0x203c ||
            char == 0x203e ||
            char == 0x2044 ||
            char == 0x20a8 ||
            char == 0x20ac ||
            char == 0x20b4 ||
            char == 0x20bd ||
            char == 0x20bf ||
            char == 0x2184 ||
            (char >= 0x2190 && char <= 0x2199) ||
            (char >= 0x21ba && char <= 0x21bb) ||
            char == 0x2206 ||
            char == 0x220f ||
            (char >= 0x2211 && char <= 0x2212) ||
            char == 0x221a ||
            char == 0x221e ||
            char == 0x222b ||
            char == 0x2248 ||
            char == 0x2260 ||
            (char >= 0x2264 && char <= 0x2265) ||
            (char >= 0x2302 && char <= 0x2304) ||
            char == 0x231b ||
            char == 0x23cf ||
            (char >= 0x23e9 && char <= 0x23ea) ||
            (char >= 0x23ed && char <= 0x23ef) ||
            (char >= 0x23f8 && char <= 0x23fa) ||
            char == 0x25b2 ||
            char == 0x25b6 ||
            char == 0x25bc ||
            char == 0x25c0 ||
            char == 0x25ca ||
            char == 0x2600 ||
            char == 0x2610 ||
            char == 0x2612 ||
            char == 0x2630 ||
            (char >= 0x2639 && char <= 0x263a) ||
            char == 0x263c ||
            char == 0x2665 ||
            (char >= 0x2680 && char <= 0x2685) ||
            (char >= 0x2690 && char <= 0x2691) ||
            char == 0x26a1 ||
            char == 0x2713 ||
            (char >= 0x2b05 && char <= 0x2b0d) ||
            char == 0x2b95 ||
            char == 0xa730 ||
            char == 0xa7af ||
            (char >= 0xe000 && char <= 0xe02b) ||
            char == 0xe069);
    }

    /// @notice Mint pure color Capsule token to sender when sender sets fontSrc.
    function _afterSetSource(Font calldata font, bytes calldata)
        internal
        override(Typeface)
    {
        capsuleToken.mintPureColorForFont(msg.sender, font);
    }
}
