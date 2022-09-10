// SPDX-License-Identifier: GPL-3.0

/**
  @title ICapsuleRenderer

  @author peri

  @notice Interface for CapsuleRenderer contract
 */

pragma solidity ^0.8.13;

import "./ICapsuleToken.sol";
import "./ITypeface.sol";

interface ICapsuleRenderer {
    function typeface() external view returns (address);

    function svgOf(Capsule memory capsule)
        external
        view
        returns (string memory);

    function stringText(bytes4[16][8] memory)
        external
        view
        returns (string[8] memory);

    function isValidFont(Font memory font) external view returns (bool);

    function isValidText(bytes4[16][8] memory line)
        external
        view
        returns (bool);
}
