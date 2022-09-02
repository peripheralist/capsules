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

    /// @notice Return true if bytes1 char is supported by font.
    /// @param char 1-byte character to check if allowed.
    /// @return true True if allowed.
    function isSupportedByte(bytes1 char) external view returns (bool);

    /// @notice Return true if bytes2 char is supported by font.
    /// @param char 2-byte character to check if allowed.
    /// @return true True if allowed.
    function isSupportedBytes2(bytes2 char) external view returns (bool);

    /// @notice Return true if bytes3 char is supported by font.
    /// @param char 3-byte character to check if allowed.
    /// @return true True if allowed.
    function isSupportedBytes3(bytes3 char) external view returns (bool);

    /// @notice Return true if bytes4 char is supported by font.
    /// @param char 4-byte character to check if allowed.
    /// @return true True if allowed.
    function isSupportedBytes4(bytes4 char) external view returns (bool);

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
