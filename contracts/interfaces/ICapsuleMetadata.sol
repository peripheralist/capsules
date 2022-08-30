// SPDX-License-Identifier: GPL-3.0

/// @title Interface for Capsules Renderer

pragma solidity ^0.8.13;

import "./ICapsuleToken.sol";

interface ICapsuleMetadata {
    function tokenUri(Capsule memory capsule, string memory image)
        external
        view
        returns (string memory);
}
