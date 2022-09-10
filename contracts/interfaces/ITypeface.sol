// SPDX-License-Identifier: MIT

/**
  @title ITypeface

  @author peri

  @notice Interface for Typeface contract
 */

pragma solidity ^0.8.0;

struct Font {
    uint256 weight;
    string style;
}

interface ITypeface {
    /// @notice Emitted when the source is set for a font.
    /// @param font The font the source has been set for.
    event SetSource(Font font);

    /// @notice Emitted when the source hash is set for a font.
    /// @param font The font the source hash has been set for.
    /// @param sourceHash The source hash that was set.
    event SetSourceHash(Font font, bytes32 sourceHash);

    /// @notice Returns the typeface name.
    function name() external view returns (string memory);

    /// @notice Check if typeface includes a glyph for a specific character code point.
    /// @dev 3 bytes supports the entirety of the Basic Multilingual Plane (BMP) of unicodes.
    /// @param codePoint Character code point.
    /// @return true True if supported.
    function supportsCodePoint(bytes3 codePoint) external view returns (bool);

    /// @notice Return source data of Font.
    /// @param font Font to return source data for.
    /// @return source Source data of font.
    function sourceOf(Font memory font) external view returns (bytes memory);

    /// @notice Checks if source data has been stored for font.
    /// @param font Font to check if source data exists for.
    /// @return true True if source exists.
    function hasSource(Font memory font) external view returns (bool);

    /// @notice Stores source data for a font.
    /// @param font Font to store source data for.
    /// @param source Source data of font.
    function setSource(Font memory font, bytes memory source) external;
}

interface IASCIITypeface is ITypeface {
    /// @notice Check if typeface includes a glyph for a specific character code point.
    /// @dev 1 byte supports all ASCII unicodes.
    /// @param codePoint Character code point.
    /// @return true True if supported.
    function supportsCodePoint(bytes1 codePoint) external view returns (bool);
}

interface IBMPTypeface is ITypeface {
    /// @notice Check if typeface includes a glyph for a specific character code point.
    /// @dev 2 bytes supports the entirety of the Basic Multilingual Plane (BMP) of unicodes.
    /// @param codePoint Character code point.
    /// @return true True if supported.
    function supportsCodePoint(bytes2 codePoint) external view returns (bool);
}
