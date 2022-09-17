// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./Typeface.sol";
import "./interfaces/ITypefaceExpandable.sol";

/**
  @title TypefaceExpandable

  @author peri

  @notice TypefaceExpandable is an extension of the Typeface contract that allows an operator to add or modify font hashes after the contract has been deployed, as long as a source for the font hasn't been stored yet.
 */

abstract contract TypefaceExpandable is Typeface, ITypefaceExpandable {
    error FontAlreadyStored(Font font);
    error NotOperator();

    /// @notice Require that the sender is the operator address.
    modifier onlyOperator() {
        if (msg.sender != _operator) revert NotOperator();
        _;
    }

    /// @notice Require that all fonts have not been stored.
    modifier onlyUnstoredFonts(Font[] calldata fonts) {
        for (uint256 i; i < fonts.length; i++) {
            Font memory font = fonts[i];
            if (hasSource(font)) revert FontAlreadyStored(font);
        }
        _;
    }

    /// Address with permission to add font hashes
    address public _operator;

    /// @notice Allows operator to set new font hashes.
    /// @param fonts Array of fonts to set hashes for.
    /// @param hashes Array of hashes to set for fonts.
    function setFontSourceHashes(
        Font[] calldata fonts,
        bytes32[] calldata hashes
    ) external onlyOperator onlyUnstoredFonts(fonts) {
        _setFontSourceHashes(fonts, hashes);
    }

    /// @notice Returns operator of contract.
    function operator() external view returns (address) {
        return _operator;
    }

    /// @notice Allows operator to set new operator.
    /// @param __operator New operator address.
    function setOperator(address __operator) external onlyOperator {
        _setOperator(__operator);
    }

    constructor(
        string memory __name,
        address __operator,
        address donationAddress
    ) Typeface(__name, donationAddress) {
        _setOperator(__operator);
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(Typeface)
        returns (bool)
    {
        return
            interfaceId == type(ITypefaceExpandable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _setOperator(address __operator) internal {
        _operator = __operator;

        emit SetOperator(__operator);
    }
}
