// SPDX-License-Identifier: MIT

/**
  @title ITypeface

  @author peri

  @notice Interface for Upgradeable Typeface contract.
 */

pragma solidity ^0.8.8;

import "./ITypefaceExpandable.sol";

interface ICapsulesTypeface is ITypefaceExpandable {
    function patronOf(Font calldata font) external view returns (address);
}
