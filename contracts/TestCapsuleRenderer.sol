// SPDX-License-Identifier: GPL-3.0

/**
  @title Capsules Renderer

  @author peri

  @notice Empty CapsuleRenderer for testing.
 */

pragma solidity 0.8.14;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ITypeface.sol";
import "./interfaces/ICapsuleRenderer.sol";
import "./interfaces/ICapsuleToken.sol";
import "./utils/Base64.sol";

contract TestCapsuleRenderer is ICapsuleRenderer {
    constructor() {}

    /// @notice Return Base64-encoded square SVG for Capsule
    /// @return svg SVG for Capsule
    function svgOf(Capsule memory) external pure returns (string memory) {
        return "test";
    }

    function htmlSafeText(bytes2[16][8] memory)
        external
        pure
        returns (string[8] memory)
    {}
}
