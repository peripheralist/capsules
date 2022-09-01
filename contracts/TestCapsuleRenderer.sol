// SPDX-License-Identifier: GPL-3.0

/// @title Capsules Renderer

/// @author peri

/// @notice Renders SVG images for Capsules tokens.

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

    /// @notice Returns html-safe version of text.
    /// @param text Text to render safe.
    /// @return safeText Text string array that can be safely rendered in html.
    function htmlSafeText(bytes4[16][8] memory text)
        external
        pure
        returns (string[8] memory safeText)
    {
        for (uint256 i; i < 8; i++) {
            safeText[i] = _htmlSafeLine(text[i]);
        }
    }

    /// @notice Returns html-safe version of a line of text
    /// @dev Iterates through each byte in line of text and replaces each byte as needed to create a string that will render in html without issue. Ensures that no illegal characters or 0x00 bytes remain.
    /// @param line Line of text to render safe.
    /// @return safeLine Text string that can be safely rendered in html.
    function _htmlSafeLine(bytes4[16] memory line)
        internal
        pure
        returns (string memory safeLine)
    {
        // Build bytes in reverse to allow trimming trailing whitespace
        for (uint256 i = 16; i > 0; i--) {
            bytes4 char = line[i - 1];

            // 0x0 bytes should not be rendered.
            if (char == bytes4(0)) continue;

            // Some bytes may not render properly in SVG text, so we replace them with their matching "html name code".
            if (char == 0x0000003c) {
                // Replace `<`
                safeLine = string.concat("&lt;", safeLine);
            } else if (char == 0x0000003E) {
                // Replace `>`
                safeLine = string.concat("&gt;", safeLine);
            } else if (char == 0x00000026) {
                // Replace `&`
                safeLine = string.concat("&amp;", safeLine);
            } else {
                // Add bytes4 character while removing individual 0x0 bytes, which cannot be rendered.
                for (uint256 j = 4; j > 0; j--) {
                    if (char[j - 1] != bytes1(0)) {
                        safeLine = string(
                            abi.encodePacked(char[j - 1], safeLine)
                        );
                    }
                }
            }
        }
    }
}
