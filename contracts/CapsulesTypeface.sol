// SPDX-License-Identifier: GPL-3.0

/// @title Capsules Typeface

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

    function isSupportedByte(bytes1) external pure returns (bool) {
        // TODO
        return true;
        // All basic Latin letters, digits, symbols, punctuation
        // return b >= 0x00000020 && b <= 0x0000007E;
    }

    function isSupportedBytes4(bytes4) external pure returns (bool) {
        // TODO
        return true;
        // All basic Latin letters, digits, symbols, punctuation
        // return b >= 0x00000020 && b <= 0x0000007E;
    }

    /// @notice Mint pure color Capsule token to caller when caller sets fontSrc
    function _afterSetSource(Font calldata font, bytes calldata)
        internal
        override(Typeface)
    {
        capsuleToken.mintPureColorForFontWeight(msg.sender, font.weight);
    }
}
