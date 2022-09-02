// SPDX-License-Identifier: GPL-3.0

/// @title ICapsuleRenderer

/// @author peri

/// @notice Interface for CapsuleRenderer contract

pragma solidity ^0.8.13;

import "./ICapsuleToken.sol";

interface ICapsuleRenderer {
    function svgOf(Capsule memory capsule)
        external
        view
        returns (string memory);

    function htmlSafeText(bytes4[16][8] memory line)
        external
        pure
        returns (string[8] memory safeText);
}
