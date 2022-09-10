// SPDX-License-Identifier: GPL-3.0

/**
  @title Capsules Token

  @author peri

  @notice Each Capsule token has a unique color and a custom text rendered as a SVG. The text and font for a Capsule can be updated at any time by its owner.

  @dev `bytes3` type is used to store the RGB hex-encoded color that is unique to each Capsule. 

  `bytes4[16][8]` type is used to store text: 8 lines of 16 characters, where each character is utf8-encoded as a bytes4 value. Although many characters can be encoded using fewer than 4 bytes, bytes4 is used to ensure that all characters are supported.

  To avoid high gas costs, text isn't validated when minting or editing. Instead, we rely on the Renderer contract to render a safe image even if the Capsule text is invalid.
 */

pragma solidity 0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ERC721A.sol";
import "./interfaces/ICapsuleMetadata.sol";
import "./interfaces/ICapsuleRenderer.sol";
import "./interfaces/ICapsuleToken.sol";
import "./interfaces/ITypeface.sol";

/*                                                                                */
/*              000    000   0000    0000  0   0  0      00000   0000             */
/*             0   0  0   0  0   0  0      0   0  0      0      0                 */
/*             0      00000  0000    000   0   0  0      0000    000              */
/*             0   0  0   0  0          0  0   0  0      0          0             */
/*              000   0   0  0      0000    000   00000  00000  0000              */
/*                                                                                */

error ValueBelowMintPrice();
error InvalidFontForRenderer(address renderer);
error InvalidColor();
error PureColorNotAllowed();
error NotCapsulesTypeface();
error ColorAlreadyMinted(uint256 capsuleId);
error NotCapsuleOwner(address owner);
error CapsuleLocked();

contract CapsuleToken is
    ICapsuleToken,
    ERC721A,
    IERC2981,
    Ownable,
    Pausable,
    ReentrancyGuard
{
    /* -------------------------------------------------------------------------- */
    /*       0   0   000   0000   00000  00000  00000  00000  0000    0000        */
    /*       00 00  0   0  0   0    0    0        0    0      0   0  0            */
    /*       0 0 0  0   0  0   0    0    00000    0    00000  0000    000         */
    /*       0   0  0   0  0   0    0    0        0    0      0 0        0        */
    /*       0   0   000   0000   00000  0      00000  00000  0  0   0000         */
    /* -------------------------------------------------------------------------- */
    /* -------------------------------- MODIFIERS ------------------------------- */
    /* -------------------------------------------------------------------------- */

    /// @notice Require that the value sent is at least MINT_PRICE.
    modifier requireMintPrice() {
        if (msg.value < MINT_PRICE) revert ValueBelowMintPrice();
        _;
    }

    /// @notice Require that the font is valid for a given renderer.
    modifier onlyValidFontForRenderer(Font memory font, address renderer) {
        if (!isValidFontForRenderer(font, renderer))
            revert InvalidFontForRenderer(renderer);
        _;
    }

    /// @notice Require that the color is valid and unminted.
    modifier onlyMintableColor(bytes3 color) {
        uint256 capsuleId = tokenIdOfColor[color];
        if (_exists(capsuleId)) revert ColorAlreadyMinted(capsuleId);
        if (!isValidColor(color)) revert InvalidColor();
        _;
    }

    /// @notice Require that the color is not pure.
    modifier onlyImpureColor(bytes3 color) {
        if (isPureColor(color)) revert PureColorNotAllowed();
        _;
    }

    /// @notice Require that the sender is the CapsulesTypeface contract.
    modifier onlyCapsulesTypeface() {
        if (msg.sender != capsulesTypeface) revert NotCapsulesTypeface();
        _;
    }

    /// @notice Require that the Capsule is unlocked.
    modifier onlyUnlockedCapsule(uint256 capsuleId) {
        if (isLocked(capsuleId)) revert CapsuleLocked();
        _;
    }

    /// @notice Require that the sender owns the Capsule.
    modifier onlyCapsuleOwner(uint256 capsuleId) {
        address owner = ownerOf(capsuleId);
        if (owner != msg.sender) revert NotCapsuleOwner(owner);
        _;
    }

    /* -------------------------------------------------------------------------- */
    /*  000    000   0   0   0000  00000  0000   0   0   000   00000  000   0000  */
    /* 0   0  0   0  00  0  0        0    0   0  0   0  0   0    0   0   0  0   0 */
    /* 0      0   0  0 0 0   000     0    0000   0   0  0        0   0   0  0000  */
    /* 0   0  0   0  0  00      0    0    0  0   0   0  0   0    0   0   0  0  0  */
    /*  000    000   0   0  0000     0    0   0   000    000     0    000   0   0 */
    /* -------------------------------------------------------------------------- */
    /* ------------------------------- CONSTRUCTOR ------------------------------ */
    /* -------------------------------------------------------------------------- */

    constructor(
        address _capsulesTypeface,
        address _defaultCapsuleRenderer,
        address _capsuleMetadata,
        address _feeReceiver,
        bytes3[] memory _pureColors,
        uint256 _royalty
    ) ERC721A("Capsules", "CAPS") {
        capsulesTypeface = _capsulesTypeface;
        defaultCapsuleRenderer = _defaultCapsuleRenderer;
        capsuleMetadata = _capsuleMetadata;
        feeReceiver = _feeReceiver;
        pureColors = _pureColors;
        emit SetPureColors(_pureColors);
        royalty = _royalty;

        _pause();
    }

    /* -------------------------------------------------------------------------- */
    /*       0   0   000   0000   00000   000   0000   0      00000   0000        */
    /*       0   0  0   0  0   0    0    0   0  0   0  0      0      0            */
    /*       0   0  00000  0000     0    00000  0000   0      0000    000         */
    /*        0 0   0   0  0  0     0    0   0  0   0  0      0          0        */
    /*         0    0   0  0   0  00000  0   0  0000   00000  00000  0000         */
    /* -------------------------------------------------------------------------- */
    /* -------------------------------- VARIABLES ------------------------------- */
    /* -------------------------------------------------------------------------- */

    /// Price to mint a Capsule
    uint256 public constant MINT_PRICE = 1e16; // 0.01 ETH

    /// CapsulesTypeface address
    address public immutable capsulesTypeface;

    /// Default CapsuleRenderer address
    address public defaultCapsuleRenderer;

    /// CapsuleMetadata address
    address public capsuleMetadata;

    /// Mapping of minted color to Capsule ID
    mapping(bytes3 => uint256) public tokenIdOfColor;

    /// Array of pure colors
    bytes3[] public pureColors;

    /// Address to receive fees
    address public feeReceiver;

    /// Royalty amount out of 1000
    uint256 public royalty;

    /// Mapping of Capsule ID to text
    mapping(uint256 => bytes4[16][8]) internal _textOf;

    /// Mapping of Capsule ID to color
    mapping(uint256 => bytes3) internal _colorOf;

    /// Mapping of Capsule ID to font
    mapping(uint256 => Font) internal _fontOf;

    /// Mapping of Capsule ID to renderer address
    mapping(uint256 => address) internal _rendererOf;

    /// Mapping of Capsule ID to locked state
    mapping(uint256 => bool) internal _locked;

    /* -------------------------------------------------------------------------- */
    /*           00000  0   0  00000  00000  0000   0   0   000   0               */
    /*           0       0 0     0    0      0   0  00  0  0   0  0               */
    /*           0000     0      0    0000   0000   0 0 0  00000  0               */
    /*           0       0 0     0    0      0  0   0  00  0   0  0               */
    /*           00000  0   0    0    00000  0   0  0   0  0   0  00000           */
    /* -------------------------------------------------------------------------- */
    /* --------------------------- EXTERNAL FUNCTIONS --------------------------- */
    /* -------------------------------------------------------------------------- */

    /// @notice Mints a Capsule to sender, saving gas by not setting text.
    /// @param color Color for Capsule.
    /// @param font Font of Capsule.
    /// @return capsuleId ID of minted Capsule.
    function mint(bytes3 color, Font calldata font)
        external
        payable
        requireMintPrice
        onlyImpureColor(color)
        nonReentrant
        returns (uint256)
    {
        return _mintCapsule(msg.sender, color, font);
    }

    /// @notice Mint a Capsule to sender while setting its text. Saves gas by skipping text validation.
    /// @param color Color for Capsule.
    /// @param font Font of Capsule.
    /// @param text Text for Capsule.
    /// @return capsuleId ID of minted Capsule.
    function mintWithText(
        bytes3 color,
        Font calldata font,
        bytes4[16][8] calldata text
    )
        external
        payable
        whenNotPaused
        requireMintPrice
        onlyMintableColor(color)
        onlyImpureColor(color)
        onlyValidFontForRenderer(font, defaultCapsuleRenderer)
        nonReentrant
        returns (uint256 capsuleId)
    {
        address to = msg.sender;

        _mint(to, 1, new bytes(0), false);

        capsuleId = _storeNewCapsuleData(color, font);

        _textOf[capsuleId] = text;

        emit MintCapsule(capsuleId, to, color);
    }

    /// @notice Allows the CapsulesTypeface to mint a pure color Capsule.
    /// @param to address to receive Capsule.
    /// @param font font of Capsule.
    /// @return capsuleId ID of minted Capsule.
    function mintPureColorForFont(address to, Font calldata font)
        external
        onlyCapsulesTypeface
        nonReentrant
        returns (uint256)
    {
        return _mintCapsule(to, pureColorForFontWeight(font.weight), font);
    }

    /// @notice Return token URI for Capsule, using the CapsuleMetadata contract.
    /// @param capsuleId ID of Capsule token.
    /// @return metadata Metadata string for Capsule.
    function tokenURI(uint256 capsuleId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(capsuleId), "ERC721A: URI query for nonexistent token");

        return
            ICapsuleMetadata(capsuleMetadata).metadataOf(
                capsuleOf(capsuleId),
                svgOf(capsuleId)
            );
    }

    /// @notice Return SVG image from the Capsule's renderer.
    /// @param capsuleId ID of Capsule token.
    /// @return svg Encoded SVG image of Capsule.
    function svgOf(uint256 capsuleId) public view returns (string memory) {
        return
            ICapsuleRenderer(rendererOf(capsuleId)).svgOf(capsuleOf(capsuleId));
    }

    /// @notice Returns all data for Capsule token.
    /// @param capsuleId ID of Capsule.
    /// @return capsule Data for Capsule with ID.
    function capsuleOf(uint256 capsuleId) public view returns (Capsule memory) {
        bytes3 color = _colorOf[capsuleId];

        return
            Capsule({
                id: capsuleId,
                font: _fontOf[capsuleId],
                text: _textOf[capsuleId],
                color: color,
                isPure: isPureColor(color),
                isLocked: _locked[capsuleId]
            });
    }

    /// @notice Check if color is pure.
    /// @param color Color to check.
    /// @return true True if color is pure.
    function isPureColor(bytes3 color) public view returns (bool) {
        bytes3[] memory _pureColors = pureColors;

        unchecked {
            for (uint256 i; i < _pureColors.length; i++) {
                if (color == _pureColors[i]) return true;
            }
        }

        return false;
    }

    /// @notice Returns the pure color matching a specific font weight.
    /// @param fontWeight Font weight to return pure color for.
    /// @return color Color for font weight.
    function pureColorForFontWeight(uint256 fontWeight)
        public
        view
        returns (bytes3)
    {
        // 100 == pureColors[0]
        // 200 == pureColors[1]
        // 300 == pureColors[2]
        // etc...
        return pureColors[(fontWeight / 100) - 1];
    }

    /// @notice Returns Capsule text as readable string from the Capsule's renderer.
    /// @param capsuleId ID of Capsule.
    /// @return stringText Formatted Capsule text.
    function stringTextOf(uint256 capsuleId)
        public
        view
        returns (string[8] memory)
    {
        return
            ICapsuleRenderer(rendererOf(capsuleId)).stringText(
                _textOf[capsuleId]
            );
    }

    /// @notice Returns color of Capsule.
    /// @param capsuleId ID of Capsule.
    /// @return color Color of Capsule as bytes3.
    function colorOf(uint256 capsuleId) public view returns (bytes3) {
        return _colorOf[capsuleId];
    }

    /// @notice Returns text of Capsule.
    /// @param capsuleId ID of Capsule.
    /// @return text Text of Capsule.
    function textOf(uint256 capsuleId)
        public
        view
        returns (bytes4[16][8] memory)
    {
        return _textOf[capsuleId];
    }

    /// @notice Returns font of Capsule.
    /// @param capsuleId ID of Capsule.
    /// @return font Font of Capsule.
    function fontOf(uint256 capsuleId) public view returns (Font memory) {
        return _fontOf[capsuleId];
    }

    /// @notice Returns renderer of Capsule. If Capsule has no renderer is set, the default renderer will be used.
    /// @param capsuleId ID of Capsule.
    /// @return renderer Address of renderer.
    function rendererOf(uint256 capsuleId) public view returns (address) {
        if (_rendererOf[capsuleId] != address(0)) return _rendererOf[capsuleId];

        return defaultCapsuleRenderer;
    }

    /// @notice Check if Capsule is locked.
    /// @param capsuleId ID of Capsule.
    /// @return locked True if Capsule is locked.
    function isLocked(uint256 capsuleId) public view returns (bool) {
        return _locked[capsuleId];
    }

    /// @notice Check if font is valid for a CapsuleRenderer.
    /// @param renderer CapsuleRenderer contract address.
    /// @param font Font to check validity of.
    /// @return true True if font is valid.
    function isValidFontForRenderer(Font memory font, address renderer)
        public
        view
        returns (bool)
    {
        return ICapsuleRenderer(renderer).isValidFont(font);
    }

    /// @notice Check if color is valid.
    /// @dev A color is valid if at least one byte == 0xff AND all bytes are evenly divisible by 0x05.
    /// @param color Color to check validity of.
    /// @return true True if color is valid.
    function isValidColor(bytes3 color) public pure returns (bool) {
        // At least one byte must equal 0xff
        if (color[0] < 0xff && color[1] < 0xff && color[2] < 0xff) {
            return false;
        }

        // All bytes must be divisible by 5
        unchecked {
            for (uint256 i; i < 3; i++) {
                if (uint8(color[i]) % 5 != 0) return false;
            }
        }

        return true;
    }

    /// @notice Withdraws balance of this contract to the feeReceiver address.
    function withdraw() external nonReentrant {
        uint256 balance = address(this).balance;

        payable(feeReceiver).transfer(balance);

        emit Withdraw(feeReceiver, balance);
    }

    /// @notice EIP2981 royalty standard
    function royaltyInfo(uint256, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        // TODO verify correct
        return (payable(this), (salePrice * royalty) / 1000);
    }

    /// @notice EIP2981 standard Interface return. Adds to ERC721A Interface returns.
    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(IERC165, ERC721A)
        returns (bool)
    {
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /// @dev Allows contract to receive ETH
    receive() external payable {}

    /* -------------------------------------------------------------------------- */
    /*                      000   0   0  0   0  00000  0000                       */
    /*                     0   0  0   0  00  0  0      0   0                      */
    /*                     0   0  0   0  0 0 0  0000   0000                       */
    /*                     0   0  0 0 0  0  00  0      0  0                       */
    /*                      000    0 0   0   0  00000  0   0                      */
    /* -------------------------------------------------------------------------- */
    /* ------------------------ CAPSULE OWNER FUNCTIONS ------------------------- */
    /* -------------------------------------------------------------------------- */

    /// @notice Allows Capsule owner to edit the Capsule text, font, and locked state.
    /// @param capsuleId ID of Capsule.
    /// @param text New text for Capsule.
    /// @param font New font for Capsule.
    /// @param lock Lock capsule, preventing any future edits.
    function editCapsule(
        uint256 capsuleId,
        bytes4[16][8] calldata text,
        Font calldata font,
        bool lock
    ) public {
        _editCapsule(capsuleId, text, font, lock);
    }

    /// @notice Allows Capsule owner to lock a Capsule, preventing any future edits.
    /// @param capsuleId ID of Capsule to lock.
    function lockCapsule(uint256 capsuleId) external {
        _lockCapsule(capsuleId);
    }

    /// @notice Allows Capsule owner to set its renderer contract. If renderer is the zero address, the Capsule will use the default renderer.
    /// @dev Does not check validity of the current Capsule text or font with the new renderer.
    /// @param capsuleId ID of Capsule.
    /// @param renderer Address of new renderer.
    function setRendererOf(uint256 capsuleId, address renderer)
        external
        onlyCapsuleOwner(capsuleId)
    {
        _rendererOf[capsuleId] = renderer;

        emit SetRendererOf(capsuleId, renderer);
    }

    /// @notice Burns a Capsule.
    /// @param capsuleId ID of Capsule to burn.
    function burn(uint256 capsuleId) external onlyCapsuleOwner(capsuleId) {
        _burn(capsuleId);
    }

    /* -------------------------------------------------------------------------- */
    /*                      000   0000   0   0  00000  0   0                      */
    /*                     0   0  0   0  00 00    0    00  0                      */
    /*                     00000  0   0  0 0 0    0    0 0 0                      */
    /*                     0   0  0   0  0   0    0    0  00                      */
    /*                     0   0  0000   0   0  00000  0   0                      */
    /* -------------------------------------------------------------------------- */
    /* ---------------------------- ADMIN FUNCTIONS ----------------------------- */
    /* -------------------------------------------------------------------------- */

    /// @notice Allows the owner of this contract to update the defaultCapsuleRenderer contract.
    /// @param renderer Address of new default defaultCapsuleRenderer contract.
    function setDefaultCapsuleRenderer(address renderer) external onlyOwner {
        defaultCapsuleRenderer = renderer;

        emit SetDefaultCapsuleRenderer(renderer);
    }

    /// @notice Allows the owner of this contract to update the CapsuleMetadata contract.
    /// @param _capsuleMetadata Address of new default CapsuleMetadata contract.
    function setCapsuleMetadata(address _capsuleMetadata) external onlyOwner {
        capsuleMetadata = _capsuleMetadata;

        emit SetCapsuleMetadata(_capsuleMetadata);
    }

    /// @notice Allows the owner of this contract to update the feeReceiver address.
    /// @param newFeeReceiver Address of new feeReceiver.
    function setFeeReceiver(address newFeeReceiver) external onlyOwner {
        feeReceiver = newFeeReceiver;

        emit SetFeeReceiver(newFeeReceiver);
    }

    /// @notice Allows the owner of this contract to update the royalty amount.
    /// @param royaltyAmount New royalty amount.
    function setRoyalty(uint256 royaltyAmount) external onlyOwner {
        require(royaltyAmount <= 1000, "Amount too high");

        royalty = royaltyAmount;

        emit SetRoyalty(royaltyAmount);
    }

    /// @notice Allows the contract owner to pause the contract.
    /// @dev Can only be called by the owner when the contract is unpaused.
    function pause() external override onlyOwner {
        _pause();
    }

    /// @notice Allows the contract owner to unpause the contract.
    /// @dev Can only be called by the owner when the contract is paused.
    function unpause() external override onlyOwner {
        _unpause();
    }

    /* -------------------------------------------------------------------------- */
    /*           00000  0   0  00000  00000  0000   0   0   000   0               */
    /*             0    00  0    0    0      0   0  00  0  0   0  0               */
    /*             0    0 0 0    0    0000   0000   0 0 0  00000  0               */
    /*             0    0  00    0    0      0  0   0  00  0   0  0               */
    /*           00000  0   0    0    00000  0   0  0   0  0   0  00000           */
    /* -------------------------------------------------------------------------- */
    /* --------------------------- INTERNAL FUNCTIONS --------------------------- */
    /* -------------------------------------------------------------------------- */

    /// @notice ERC721A override to start tokenId at 1 instead of 0.
    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    /// @notice Mints a Capsule.
    /// @param to Address to receive capsule.
    /// @param color Color of Capsule.
    /// @param font Font of Capsule.
    /// @return capsuleId ID of minted Capsule.
    function _mintCapsule(
        address to,
        bytes3 color,
        Font calldata font
    )
        internal
        whenNotPaused
        onlyMintableColor(color)
        onlyValidFontForRenderer(font, defaultCapsuleRenderer)
        returns (uint256 capsuleId)
    {
        _mint(to, 1, new bytes(0), false);

        capsuleId = _storeNewCapsuleData(color, font);

        emit MintCapsule(capsuleId, to, color);
    }

    function _editCapsule(
        uint256 capsuleId,
        bytes4[16][8] calldata text,
        Font calldata font,
        bool lock
    )
        internal
        onlyCapsuleOwner(capsuleId)
        onlyUnlockedCapsule(capsuleId)
        onlyValidFontForRenderer(font, rendererOf(capsuleId))
    {
        _textOf[capsuleId] = text;
        _fontOf[capsuleId] = font;

        emit EditCapsule(capsuleId);

        if (lock) _lockCapsule(capsuleId);
    }

    function _lockCapsule(uint256 capsuleId)
        internal
        onlyCapsuleOwner(capsuleId)
        onlyUnlockedCapsule(capsuleId)
    {
        _locked[capsuleId] = true;

        emit LockCapsule(capsuleId);
    }

    /// @notice Check if all lines of text are empty.
    /// @param text Text to check.
    /// @return true if text is empty.
    function _isEmptyText(bytes4[16][8] memory text)
        internal
        pure
        returns (bool)
    {
        for (uint256 i; i < 8; i++) {
            if (!_isEmptyLine(text[i])) return false;
        }
        return true;
    }

    /// @notice Check if line is empty.
    /// @dev Returns true if every byte of text is 0x00.
    /// @param line line to check.
    /// @return true if line is empty.
    function _isEmptyLine(bytes4[16] memory line) internal pure returns (bool) {
        for (uint256 i; i < 16; i++) {
            if (line[i] != bytes4(0)) return false;
        }
        return true;
    }

    function _storeNewCapsuleData(bytes3 color, Font memory font)
        private
        returns (uint256 capsuleId)
    {
        capsuleId = _currentIndex - 1;

        tokenIdOfColor[color] = capsuleId;
        _colorOf[capsuleId] = color;
        _fontOf[capsuleId] = font;
    }
}
