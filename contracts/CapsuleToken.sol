// SPDX-License-Identifier: GPL-3.0

/**
  @title Capsules Token

  @author peri

  @notice Each Capsule token has a unique color and a custom text rendered as a SVG. The text and fontWeight for a Capsule can be updated at any time by its owner.

  @dev `bytes3` type is used to store the rgb hex-encoded color that is unique to each capsule. `bytes2[16][8]` type is used to store text for Capsules: 8 lines of 16 bytes2 characters each. Because the Capsules typeface is not limited to ascii characters (1 byte), we use bytes2 to support characters that require more than 1 byte to encode.
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

error ValueBelowMintPrice();
error InvalidText();
error InvalidFontWeight();
error InvalidColor();
error PureColorNotAllowed();
error NotCapsulesTypeface();
error ColorAlreadyMinted(uint256 capsuleId);
error NotCapsuleOwner(address owner);
error CapsuleLocked();
error CapsuleRendererLocked();

contract CapsuleToken is
    ICapsuleToken,
    ERC721A,
    IERC2981,
    Ownable,
    Pausable,
    ReentrancyGuard
{
    /* -------------------------------------------------------------------------- */
    /* -------------------------------- MODIFIERS ------------------------------- */
    /* -------------------------------------------------------------------------- */
    /*       O   O   OOO   OOOO   OOOOO  OOOOO  OOOOO  OOOOO  OOOO    OOOO        */
    /*       OO OO  O   O  O   O    O    O        O    O      O   O  O            */
    /*       O O O  O   O  O   O    O    OOOOO    O    OOOOO  OOOO    OOO         */
    /*       O   O  O   O  O   O    O    O        O    O      O O        O        */
    /*       O   O   OOO   OOOO   OOOOO  O      OOOOO  OOOOO  O  O   OOOO         */

    /// @notice Require that the value sent is at least MINT_PRICE
    modifier requireMintPrice() {
        if (msg.value < MINT_PRICE) revert ValueBelowMintPrice();
        _;
    }

    /// @notice Require that the text is valid
    modifier onlyValidText(bytes2[16][8] memory text) {
        if (!isValidText(text)) revert InvalidText();
        _;
    }

    /// @notice Require that the text is valid
    modifier onlyValidFontWeight(uint256 fontWeight) {
        if (!_isValidFontWeight(fontWeight)) revert InvalidFontWeight();
        _;
    }

    /// @notice Require that the color is valid and unminted
    modifier onlyMintableColor(bytes3 color) {
        uint256 capsuleId = tokenIdOfColor[color];
        if (_exists(capsuleId)) revert ColorAlreadyMinted(capsuleId);
        if (!_isValidColor(color)) revert InvalidColor();
        _;
    }

    /// @notice Require that the color is not pure
    modifier onlyImpureColor(bytes3 color) {
        if (isPureColor(color)) revert PureColorNotAllowed();
        _;
    }

    /// @notice Require that the sender is the Capsules Typeface contract
    modifier onlyCapsulesTypeface() {
        if (msg.sender != capsulesTypeface) revert NotCapsulesTypeface();
        _;
    }

    /// @notice Require that the Capsule is unlocked
    modifier onlyUnlockedCapsule(uint256 capsuleId) {
        if (isLocked(capsuleId)) revert CapsuleLocked();
        _;
    }

    /// @notice Require that the sender is the Capsule owner
    modifier onlyCapsuleOwner(uint256 capsuleId) {
        address owner = ownerOf(capsuleId);
        if (owner != msg.sender) revert NotCapsuleOwner(owner);
        _;
    }

    /* -------------------------------------------------------------------------- */
    /* ------------------------------- CONSTRUCTOR ------------------------------ */
    /* -------------------------------------------------------------------------- */
    /*  000    OOO   O   0   OOO0  OOOOO  OOOO   O   O   OOO   0OOOO  000   0000  */
    /* O   O  O   O  O0  O  0        0    0   0  O   0  O   O    0   0   0  0   0 */
    /* O      O   O  O 0 O   0O0     O    00O0   O   0  O        O   0   0  0000  */
    /* O   O  O   O  O  0O      0    0    0  0   O   0  O   0    0   0   0  0  0  */
    /*  000    OOO   O   0  OOO0     0    O   0   OOO    00O     O    000   0   0 */

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
    /* -------------------------------- VARIABLES ------------------------------- */
    /* -------------------------------------------------------------------------- */
    /*       O   O   OOO   OOOO   OOOOO   OOO   OOOO   O      OOOO0   OOOO        */
    /*       O   O  O   O  O   O    O    O   0  O   0  O      O      O            */
    /*       O   O  O000O  O000     O    OOOOO  O000   O      OOOO    OOO         */
    /*        0 0   O   O  O  O     O    O   0  O   0  O      O          O        */
    /*         0    0   0  0   O  OOOOO  O   0  OOOO   OOOOO  O0000  OOOO         */

    /// Price to mint a Capsule
    uint256 public constant MINT_PRICE = 1e16; // 0.01 ETH

    /// Capsules typeface address
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
    mapping(uint256 => bytes2[16][8]) internal _textOf;

    /// Mapping of Capsule ID to color
    mapping(uint256 => bytes3) internal _colorOf;

    /// Mapping of Capsule ID to font weight
    mapping(uint256 => uint256) internal _fontWeightOf;

    /// Mapping of Capsule ID to renderer address
    mapping(uint256 => address) internal _rendererOf;

    /// Mapping of Capsule ID to locked state
    mapping(uint256 => bool) internal _locked;

    /* -------------------------------------------------------------------------- */
    /* --------------------------- EXTERNAL FUNCTIONS --------------------------- */
    /* -------------------------------------------------------------------------- */
    /*           O000O  0   0  OOOO0  OOOOO  OOOO   O   O   OOO   O               */
    /*           O       0 0     0    O      O   0  00  0  O   0  O               */
    /*           O00O     0      0    O000   OOOO   0 O 0  OOOOO  O               */
    /*           O       0 0     0    O      O  0   0  00  O   0  O               */
    /*           O0000  0   0    O    OOOOO  O   0  O   0  O   0  O0000           */

    /// @notice Mints a Capsule to sender, saving gas by not setting text.
    /// @dev Requires active sale, min value of `MINT_PRICE`, valid font weight, unminted & impure color.
    /// @param color Color for Capsule.
    /// @param fontWeight FontWeight of Capsule.
    /// @return capsuleId ID of minted Capsule.
    function mint(bytes3 color, uint256 fontWeight)
        external
        payable
        requireMintPrice
        onlyImpureColor(color)
        nonReentrant
        returns (uint256)
    {
        return _mintCapsule(msg.sender, color, fontWeight);
    }

    /// @notice Mint a Capsule to sender while setting its text. Saves gas by skipping text validation.
    /// @dev Requires active sale, min value of `MINT_PRICE`, valid font weight, unminted & impure color.
    /// @param color Color for Capsule.
    /// @param fontWeight FontWeight of Capsule.
    /// @param text Text for Capsule. 8 lines of 16 bytes3 characters in 2d array.
    /// @return capsuleId ID of minted Capsule.
    function mintWithText(
        bytes3 color,
        uint256 fontWeight,
        bytes2[16][8] calldata text
    ) external payable nonReentrant returns (uint256 capsuleId) {
        return _mintWithText(color, fontWeight, text);
    }

    /// @notice Mint a Capsule to sender while setting its text. Requires more gas to validate text.
    /// @dev Requires active sale, min value of `MINT_PRICE`, valid font weight, unminted & impure color.
    /// @param color Color for Capsule.
    /// @param fontWeight FontWeight of Capsule.
    /// @param text Text for Capsule. 8 lines of 16 bytes3 characters in 2d array.
    /// @return capsuleId ID of minted Capsule.
    function mintWithValidText(
        bytes3 color,
        uint256 fontWeight,
        bytes2[16][8] calldata text
    ) external payable onlyValidText(text) nonReentrant returns (uint256) {
        return _mintWithText(color, fontWeight, text);
    }

    /// @notice Mint a Capsule to sender.
    /// @dev Requires active sale and pure color. No option to lock Capsule.
    /// @param fontWeight fontWeight of Capsule.
    /// @return capsuleId ID of minted Capsule.
    function mintPureColorForFontWeight(address to, uint256 fontWeight)
        external
        onlyCapsulesTypeface
        nonReentrant
        returns (uint256)
    {
        return _mintCapsule(to, pureColorForFontWeight(fontWeight), fontWeight);
    }

    /// @notice Return token URI for Capsule, using the capsuleMetadata contract.
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

    /// @notice Return SVG image of Capsule, using that Capsule's renderer contract.
    /// @param capsuleId ID of Capsule token.
    /// @return svg SVG image of Capsule.
    function svgOf(uint256 capsuleId) public view returns (string memory) {
        return
            ICapsuleRenderer(rendererOf(capsuleId)).svgOf(capsuleOf(capsuleId));
    }

    /// @notice Returns all data for Capsule token with ID.
    /// @param capsuleId ID of Capsule.
    /// @return capsule Data for Capsule with ID.
    function capsuleOf(uint256 capsuleId) public view returns (Capsule memory) {
        bytes3 color = _colorOf[capsuleId];

        return
            Capsule({
                id: capsuleId,
                fontWeight: _fontWeightOf[capsuleId],
                text: _textOf[capsuleId],
                color: color,
                isPure: isPureColor(color),
                isLocked: _locked[capsuleId]
            });
    }

    /// @notice Check if color is valid for minting.
    /// @param color Color to check validity of.
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
        // Map fontWeight to pure color
        // 100 == pureColors[0]
        // 200 == pureColors[1]
        // 300 == pureColors[2]
        // ...
        return pureColors[(fontWeight / 100) - 1];
    }

    /// @notice Returns formatted version of Capsule text that is safe to render in HTML, using the renderer for that Capsule.
    /// @param capsuleId ID of Capsule.
    /// @return safeText Formatted Capsule text.
    function htmlSafeTextOf(uint256 capsuleId)
        external
        view
        returns (string[8] memory)
    {
        return
            ICapsuleRenderer(rendererOf(capsuleId)).htmlSafeText(
                _textOf[capsuleId]
            );
    }

    /// @notice Returns color of Capsule token with ID.
    /// @param capsuleId ID of Capsule.
    /// @return color Color of Capsule as bytes3.
    function colorOf(uint256 capsuleId) external view returns (bytes3) {
        return _colorOf[capsuleId];
    }

    /// @notice Returns text of Capsule token with ID.
    /// @param capsuleId ID of Capsule.
    /// @return text Text of Capsule as nested bytes2 array.
    function textOf(uint256 capsuleId)
        external
        view
        returns (bytes2[16][8] memory)
    {
        return _textOf[capsuleId];
    }

    /// @notice Returns font weight of Capsule token with ID.
    /// @param capsuleId ID of Capsule.
    /// @return fontWeight Font weight of Capsule.
    function fontWeightOf(uint256 capsuleId) external view returns (uint256) {
        return _fontWeightOf[capsuleId];
    }

    /// @notice Returns renderer of Capsule token with ID. If no renderer is set, will return the default renderer.
    /// @param capsuleId ID of Capsule.
    /// @return renderer Address of renderer.
    function rendererOf(uint256 capsuleId) public view returns (address) {
        if (_rendererOf[capsuleId] != address(0)) return _rendererOf[capsuleId];

        return defaultCapsuleRenderer;
    }

    /// @notice Check if Capsule is locked.
    /// @param capsuleId ID of Capsule
    /// @return locked True if Capsule is locked.
    function isLocked(uint256 capsuleId) public view returns (bool) {
        return _locked[capsuleId];
    }

    /// @notice Withdraws balance of this contract to the feeReceiver address.
    function withdraw() external nonReentrant {
        uint256 balance = address(this).balance;

        payable(feeReceiver).transfer(balance);

        emit Withdraw(feeReceiver, balance);
    }

    /// @notice Check if text is valid.
    /// @dev Text is valid if every bytes is supported by CapsulesTypeface, or is 0x00.
    /// @param text Text to check validity of. 8 lines of 16 bytes3 characters in 2d array.
    /// @return true True if text is valid.
    function isValidText(bytes2[16][8] memory text) public view returns (bool) {
        unchecked {
            for (uint256 i; i < 8; i++) {
                bytes2[16] memory line = text[i];

                for (uint256 j; j < 16; j++) {
                    bytes2 char = line[j];

                    // return false if any single character is unsupported
                    if (
                        !ITypeface(capsulesTypeface).isSupportedBytes2(char) &&
                        char != bytes2(0)
                    ) {
                        return false;
                    }
                }
            }
        }

        return true;
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
        // TODO verify correct
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /// @dev Allows contract to receive ETH
    receive() external payable {}

    /* -------------------------------------------------------------------------- */
    /* ------------------------ CAPSULE OWNER FUNCTIONS ------------------------- */
    /* -------------------------------------------------------------------------- */
    /*                      OOO   O   0  O   O  OOOOO  OOOO                       */
    /*                     O   O  O   O  00  0  O      0   0                      */
    /*                     O   O  O   O  0 O 0  OOOO   00O0                       */
    /*                     O   O  O 0 O  0  00  O      0  0                       */
    /*                      OOO    O O   O   O  O0000  O   O                      */

    /// @notice Allows the owner of the Capsule to update the Capsule text, fontWeight, and locked state.
    /// @param capsuleId ID of Capsule.
    /// @param text New text for Capsule. 8 lines of 16 bytes3 characters in 2d array.
    /// @param fontWeight New font weight for Capsule.
    function editCapsule(
        uint256 capsuleId,
        bytes2[16][8] calldata text,
        uint256 fontWeight,
        bool lock
    ) public {
        _editCapsule(capsuleId, text, fontWeight, lock);
    }

    /// @notice Allows the owner of the Capsule to update the Capsule text, fontWeight, and locked state.
    /// @param capsuleId ID of Capsule.
    /// @param text New text for Capsule. 8 lines of 16 bytes3 characters in 2d array.
    /// @param fontWeight New font weight for Capsule.
    /// @param lock Locks capsule.
    function editCapsuleWithValidText(
        uint256 capsuleId,
        bytes2[16][8] calldata text,
        uint256 fontWeight,
        bool lock
    ) public onlyValidText(text) {
        _editCapsule(capsuleId, text, fontWeight, lock);
    }

    /// @notice Allows Capsule owner to lock a Capsule, permanently preventing it from being edited.
    /// @param capsuleId ID of Capsule to lock.
    function lockCapsule(uint256 capsuleId) external {
        _lockCapsule(capsuleId);
    }

    /// @notice Allows the owner of a Capsule to set its renderer contract. If renderer is the zero address, the Capsule will use the default renderer.
    /// @param capsuleId ID of Capsule to set renderer for.
    /// @param renderer Address of new renderer.
    function setRendererOf(uint256 capsuleId, address renderer)
        external
        onlyCapsuleOwner(capsuleId)
    {
        _rendererOf[capsuleId] = renderer;

        emit SetRendererOf(capsuleId, renderer);
    }

    /// @notice Burns a Capsule token.
    /// @param capsuleId ID of Capsule token to burn.
    function burn(uint256 capsuleId) external onlyCapsuleOwner(capsuleId) {
        _burn(capsuleId);
    }

    /* -------------------------------------------------------------------------- */
    /* ---------------------------- ADMIN FUNCTIONS ----------------------------- */
    /* -------------------------------------------------------------------------- */
    /*                      OOO   O000   O   O  OOOOO  O   0                      */
    /*                     O   O  O   O  00 00    0    00  0                      */
    /*                     O000O  O   O  0 O 0    O    0 O 0                      */
    /*                     O   O  O   O  0   0    0    0  00                      */
    /*                     0   0  0O0O   O   O  O0000  O   O                      */

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

    /// @notice Allows the owner of this contract to update feeReceiver.
    /// @param _feeReceiver Address of new feeReceiver.
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        feeReceiver = _feeReceiver;

        emit SetFeeReceiver(_feeReceiver);
    }

    /// @notice Allows the owner of this contract to update the royalty amount.
    /// @param _royalty New royalty amount.
    function setRoyalty(uint256 _royalty) external onlyOwner {
        require(_royalty <= 1000, "Amount too high");

        royalty = _royalty;

        emit SetRoyalty(_royalty);
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
    /* --------------------------- INTERNAL FUNCTIONS --------------------------- */
    /* -------------------------------------------------------------------------- */
    /*           O000O  0   0  OOOO0  OOOOO  OOOO   O   O   OOO   O               */
    /*             0    00  0    0    O      O   0  00  0  O   0  O               */
    /*             0    0 0 0    0    O000   OOOO   0 O 0  OOOOO  O               */
    /*             0    0  00    0    O      O  0   0  00  O   0  O               */
    /*           O0000  0   0    O    OOOOO  O   0  O   0  O   0  O0000           */

    /// @notice ERC721A override to start tokenId at 1 instead of 0.
    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    /// @notice Mints a Capsule.
    /// @dev Stores Capsule data in `_capsuleOf`, and mapping `tokenIdOfColor`.
    /// @param to Address to receive capsule.
    /// @param color Color of Capsule.
    /// @param fontWeight FontWeight of Capsule.
    /// @return capsuleId ID of minted Capsule.
    function _mintCapsule(
        address to,
        bytes3 color,
        uint256 fontWeight
    )
        internal
        whenNotPaused
        onlyMintableColor(color)
        onlyValidFontWeight(fontWeight)
        returns (uint256 capsuleId)
    {
        _mint(to, 1, new bytes(0), false);

        capsuleId = _storeNewCapsuleData(color, fontWeight);

        emit MintCapsule(capsuleId, to, color);
    }

    function _mintWithText(
        bytes3 color,
        uint256 fontWeight,
        bytes2[16][8] calldata text
    )
        internal
        whenNotPaused
        requireMintPrice
        onlyMintableColor(color)
        onlyImpureColor(color)
        onlyValidFontWeight(fontWeight)
        returns (uint256 capsuleId)
    {
        address to = msg.sender;

        _mint(to, 1, new bytes(0), false);

        capsuleId = _storeNewCapsuleData(color, fontWeight);

        _textOf[capsuleId] = text;

        emit MintCapsule(capsuleId, to, color);
    }

    function _editCapsule(
        uint256 capsuleId,
        bytes2[16][8] calldata text,
        uint256 fontWeight,
        bool lock
    )
        internal
        onlyCapsuleOwner(capsuleId)
        onlyUnlockedCapsule(capsuleId)
        onlyValidFontWeight(fontWeight)
    {
        _textOf[capsuleId] = text;
        _fontWeightOf[capsuleId] = fontWeight;

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

    /// @notice Check if font weight is valid.
    /// @dev A fontWeight is valid if its source has been set in the CapsulesTypeface contract.
    /// @param fontWeight Font weight to check validity of.
    /// @return true True if font weight is valid.
    function _isValidFontWeight(uint256 fontWeight)
        internal
        view
        returns (bool)
    {
        return
            ITypeface(capsulesTypeface).hasSource(
                Font({weight: fontWeight, style: "normal"})
            );
    }

    /// @notice Check if color is valid.
    /// @dev A bytes3 color is valid if at least one byte == 0xFF (255), AND all byte values are evenly divisible by 5.
    /// @param color Folor to check validity of.
    /// @return true True if color is valid.
    function _isValidColor(bytes3 color) internal pure returns (bool) {
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

    function _storeNewCapsuleData(bytes3 color, uint256 fontWeight)
        private
        returns (uint256 capsuleId)
    {
        capsuleId = _currentIndex - 1;

        tokenIdOfColor[color] = capsuleId;
        _colorOf[capsuleId] = color;
        _fontWeightOf[capsuleId] = fontWeight;
    }
}
