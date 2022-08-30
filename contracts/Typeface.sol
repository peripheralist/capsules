// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ITypeface.sol";

/**
  @title Typeface
  @author peri
  @notice The Typeface contract allows storing and retrieving font source data. Font sources can be large and cost large amounts of gas to store. To avoid surpassing gas limits in deploying a contract with font source data, only a hash of the data is stored when the contract is deployed. This allows font data to be stored later in separate transactions, provided the data matches the corresponding hash. Fonts are identified by the Font struct, which includes "style" and "weight" properties.

  Two functions allow specifying which characters are supported by a typeface. ASCII characters can be encoded in a single byte, so typefaces using only this charset can override `isSupportedByte(bytes1)` to determine if a character is supported. For more complex characters requiring more than 1 byte to encode, `isSupportedBytes4(bytes4)` should be used.
 */

abstract contract Typeface is ITypeface {
    /// @notice Mapping of weight => style => font source data as bytes.
    mapping(uint256 => mapping(string => bytes)) private _source;

    /// @notice Mapping of weight => style => keccack256 hash of font source data as bytes.
    mapping(uint256 => mapping(string => bytes32)) private _sourceHash;

    /// @notice Mapping of weight => style => true if font source has been stored. This serves as a gas-efficient way to check if a font source has been stored without getting the entire source data.
    mapping(uint256 => mapping(string => bool)) private _hasSource;

    /// @notice Typeface name
    string private _name;

    /// @notice Return typeface name.
    /// @return name Name of typeface
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /// @notice Return source bytes for font.
    /// @param font Font to check source of.
    /// @return source Font source data as bytes.
    function sourceOf(Font memory font)
        public
        view
        virtual
        returns (bytes memory)
    {
        return _source[font.weight][font.style];
    }

    /// @notice Return true if font source exists.
    /// @param font Font to check if source exists for.
    /// @return true True if font source exists.
    function hasSource(Font memory font) public view virtual returns (bool) {
        return _hasSource[font.weight][font.style];
    }

    /// @notice Return hash of source bytes for font.
    /// @param font Font to return source hash of.
    /// @return sourceHash Hash of source for font.
    function sourceHash(Font memory font)
        public
        view
        virtual
        returns (bytes32)
    {
        return _sourceHash[font.weight][font.style];
    }

    /// @notice Sets source for Font.
    /// @dev The keccack256 hash of the source must equal the sourceHash of the font.
    /// @param font Font to set source for.
    /// @param source Font source as bytes.
    function setSource(Font calldata font, bytes calldata source) public {
        require(
            _hasSource[font.weight][font.style] == false,
            "Typeface: font source already exists"
        );

        require(
            keccak256(source) == _sourceHash[font.weight][font.style],
            "Typeface: Invalid font"
        );

        _beforeSetSource(font, source);

        _source[font.weight][font.style] = source;
        _hasSource[font.weight][font.style] = true;

        emit SetSource(font);

        _afterSetSource(font, source);
    }

    /// @notice Sets hash of source data for each font in a list.
    /// @dev Length of fonts and hashes arrays must be equal. Each hash from hashes array will be set for the font with matching index in the fonts array.
    /// @param fonts Array of fonts to set hashes for.
    /// @param hashes Array of hashes to set for fonts.
    function _setFontSourceHashes(Font[] memory fonts, bytes32[] memory hashes)
        internal
    {
        require(
            fonts.length == hashes.length,
            "Typeface: Unequal number of fonts and hashes"
        );

        for (uint256 i; i < fonts.length; i++) {
            _sourceHash[fonts[i].weight][fonts[i].style] = hashes[i];

            emit SetSourceHash(fonts[i], hashes[i]);
        }
    }

    constructor(string memory __name) {
        _name = __name;
    }

    /// @notice Function called before setSource() is called.
    function _beforeSetSource(Font calldata font, bytes calldata src)
        internal
        virtual
    {}

    /// @notice Function called after setSource() is called.
    function _afterSetSource(Font calldata font, bytes calldata src)
        internal
        virtual
    {}
}
