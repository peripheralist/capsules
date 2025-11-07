// SPDX-License-Identifier: MIT

/**
  @title ITypefaceExpandable

  @author peri

  @notice Interface for TypefaceExpandable contract
 */

pragma solidity ^0.8.8;

import "./ITypeface.sol";

interface ITypefaceExpandable is ITypeface {
    event SetOperator(address operator);

    function operator() external view returns (address);

    function setSourceHashes(Font[] memory fonts, bytes32[] memory hashes)
        external;

    function setOperator(address operator) external;
}
