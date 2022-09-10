// SPDX-License-Identifier: GPL-3.0

/**
  @title Capsules Renderer

  @author peri

  @notice Renders SVG images for Capsules tokens.
 */

pragma solidity 0.8.14;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ITypeface.sol";
import "./interfaces/ICapsuleRenderer.sol";
import "./interfaces/ICapsuleToken.sol";
import "./utils/Base64.sol";

struct SvgSpecs {
    // Capsule color formatted as RGB hex color code
    bytes hexColor;
    // ID for row elements used on top and bottom edges of svg.
    bytes edgeRowId;
    // ID for row elements placed behind text rows.
    bytes textRowId;
    // Number of non-empty lines in Capsule text. Only trailing empty lines are excluded.
    uint256 linesCount;
    // Number of characters in the longest line of text.
    uint256 charWidth;
    // Width of the text area (in dots).
    uint256 textAreaWidthDots;
    // Height of the text area (in dots).
    uint256 textAreaHeightDots;
}

contract CapsuleRenderer is ICapsuleRenderer {
    /// Address of CapsulesTypeface contract
    address public immutable capsulesTypeface;

    constructor(address _capsulesTypeface) {
        capsulesTypeface = _capsulesTypeface;
    }

    function typeface() external view returns (address) {
        return capsulesTypeface;
    }

    /// @notice Return Base64-encoded SVG for Capsule.
    /// @param capsule Capsule data to return SVG for.
    /// @return svg SVG for Capsule.
    function svgOf(Capsule memory capsule)
        external
        view
        returns (string memory)
    {
        return svgOf(capsule, false);
    }

    /// @notice Return Base64-encoded SVG for Capsule. Can optionally return a square ratio image, regardless of text content shape.
    /// @param capsule Capsule to return SVG for.
    /// @param square Fit image to square with content centered.
    /// @return base64Svg Base64-encoded SVG for Capsule.
    function svgOf(Capsule memory capsule, bool square)
        public
        view
        returns (string memory base64Svg)
    {
        uint256 dotSize = 4;

        // If text is empty or invalid, use default text
        if (_isEmptyText(capsule.text) || !isValidText(capsule.text)) {
            capsule = Capsule({
                text: _defaultTextOf(capsule.color),
                id: capsule.id,
                color: capsule.color,
                font: capsule.font,
                isPure: capsule.isPure,
                isLocked: capsule.isLocked
            });
        }

        SvgSpecs memory specs = _svgSpecsOf(capsule);

        // Define reusable <g> elements to minimize overall SVG size
        bytes memory defs;
        {
            bytes
                memory dots1x12 = '<g id="dots1x12"><circle cx="2" cy="2" r="1.5"></circle><circle cx="2" cy="6" r="1.5"></circle><circle cx="2" cy="10" r="1.5"></circle><circle cx="2" cy="14" r="1.5"></circle><circle cx="2" cy="18" r="1.5"></circle><circle cx="2" cy="22" r="1.5"></circle><circle cx="2" cy="26" r="1.5"></circle><circle cx="2" cy="30" r="1.5"></circle><circle cx="2" cy="34" r="1.5"></circle><circle cx="2" cy="38" r="1.5"></circle><circle cx="2" cy="42" r="1.5"></circle><circle cx="2" cy="46" r="1.5"></circle></g>';

            // <g> row of dots 1 dot high that spans entire canvas width
            // If Capsule is locked, trim start and end dots and translate group
            bytes memory edgeRowDots;
            edgeRowDots = abi.encodePacked('<g id="', specs.edgeRowId, '">');
            if (capsule.isLocked) {
                for (uint256 i; i < specs.textAreaWidthDots; i++) {
                    edgeRowDots = abi.encodePacked(
                        edgeRowDots,
                        '<circle cx="',
                        Strings.toString(dotSize * i + 2),
                        '" cy="2" r="1.5"></circle>'
                    );
                }
            } else {
                for (uint256 i = 1; i < specs.textAreaWidthDots - 1; i++) {
                    edgeRowDots = abi.encodePacked(
                        edgeRowDots,
                        '<circle cx="',
                        Strings.toString(dotSize * i + 2),
                        '" cy="2" r="1.5"></circle>'
                    );
                }
            }
            edgeRowDots = abi.encodePacked(edgeRowDots, "</g>");

            // <g> row of dots with text height that spans entire canvas width
            bytes memory textRowDots;
            textRowDots = abi.encodePacked('<g id="', specs.textRowId, '">');
            for (uint256 i; i < specs.textAreaWidthDots; i++) {
                textRowDots = abi.encodePacked(
                    textRowDots,
                    '<use href="#dots1x12" transform="translate(',
                    Strings.toString(dotSize * i),
                    ')"></use>'
                );
            }
            textRowDots = abi.encodePacked(textRowDots, "</g>");

            defs = abi.encodePacked(dots1x12, edgeRowDots, textRowDots);
        }

        // Define <style> for svg element
        bytes memory style;
        {
            string memory fontWeightString = Strings.toString(
                capsule.font.weight
            );
            style = abi.encodePacked(
                "<style>.capsules-",
                fontWeightString,
                "{ font-size: 40px; white-space: pre; font-family: Capsules-",
                fontWeightString,
                ' } @font-face { font-family: "Capsules-',
                fontWeightString,
                '"; src: url(data:font/truetype;charset=utf-8;base64,',
                ITypeface(capsulesTypeface).sourceOf(capsule.font),
                ') format("opentype")}</style>'
            );
        }

        // Content area group will contain dot background and text.
        bytes memory contentArea;
        {
            // Create <g> element and define color of dots and text.
            contentArea = abi.encodePacked('<g fill="#', specs.hexColor, '"');

            // If square image, translate contentArea group to center of svg viewbox
            if (square) {
                // Square size of the entire svg (in dots) equal to longest edge, including padding of 2 dots
                uint256 squareSizeDots = 2;
                if (specs.textAreaHeightDots >= specs.textAreaWidthDots) {
                    squareSizeDots += specs.textAreaHeightDots;
                } else {
                    squareSizeDots += specs.textAreaWidthDots;
                }

                contentArea = abi.encodePacked(
                    contentArea,
                    ' transform="translate(',
                    Strings.toString(
                        ((squareSizeDots - specs.textAreaWidthDots) / 2) *
                            dotSize
                    ),
                    " ",
                    Strings.toString(
                        ((squareSizeDots - specs.textAreaHeightDots) / 2) *
                            dotSize
                    ),
                    ')"'
                );
            }

            // Add dots by tiling edge row and text row elements defined in `defs`.

            // Add top edge row element
            contentArea = abi.encodePacked(
                contentArea,
                '><g opacity="0.2"><use href="#',
                specs.edgeRowId,
                '"></use>'
            );

            // Add a text row element for each line of text
            for (uint256 i; i < specs.linesCount; i++) {
                contentArea = abi.encodePacked(
                    contentArea,
                    '<use href="#',
                    specs.textRowId,
                    '" transform="translate(0 ',
                    Strings.toString(48 * i + dotSize),
                    ')"></use>'
                );
            }

            // Add bottom edge row element and close <g> group element
            contentArea = abi.encodePacked(
                contentArea,
                '<use href="#',
                specs.edgeRowId,
                '" transform="translate(0 ',
                Strings.toString((specs.textAreaHeightDots - 1) * dotSize),
                ')"></use></g>'
            );
        }

        // Create <g> group of text elements
        bytes memory texts;
        {
            // Create <g> element for texts and position using translate
            texts = '<g transform="translate(10 44)">';

            // Add a <text> element for each line of text, excluding trailing empty lines.
            // Each <text> has its own Y position.
            // Setting class on individual <text> elements increases CSS specificity and helps ensure styles are not overwritten by external stylesheets.
            for (uint256 i; i < specs.linesCount; i++) {
                texts = abi.encodePacked(
                    texts,
                    '<text y="',
                    Strings.toString(48 * i),
                    '" class="capsules-',
                    Strings.toString(capsule.font.weight),
                    '">',
                    _stringLine(capsule.text[i], true),
                    "</text>"
                );
            }

            // Close <g> texts group.
            texts = abi.encodePacked(texts, "</g>");
        }

        // Add texts to content area group and close <g> group.
        contentArea = abi.encodePacked(contentArea, texts, "</g>");

        {
            string memory x;
            string memory y;
            if (square) {
                // Square size of the entire svg (in dots) equal to longest edge, including padding of 2 dots
                uint256 squareSizeDots = 2;
                if (specs.textAreaHeightDots >= specs.textAreaWidthDots) {
                    squareSizeDots += specs.textAreaHeightDots;
                } else {
                    squareSizeDots += specs.textAreaWidthDots;
                }

                // If square image, use square viewbox
                x = Strings.toString(squareSizeDots * dotSize);
                y = Strings.toString(squareSizeDots * dotSize);
            } else {
                // Else fit to text area
                x = Strings.toString(specs.textAreaWidthDots * dotSize);
                y = Strings.toString(specs.textAreaHeightDots * dotSize);
            }

            // Construct parent svg element with defs, style, and content area groups.
            bytes memory svg = abi.encodePacked(
                '<svg viewBox="0 0 ',
                x,
                " ",
                y,
                '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><defs>',
                defs,
                "</defs>",
                style,
                '<rect x="0" y="0" width="100%" height="100%" fill="#000"></rect>',
                contentArea,
                "</svg>"
            );

            // Base64 encode the svg data with prefix
            base64Svg = string(
                abi.encodePacked(
                    "data:image/svg+xml;base64,",
                    Base64.encode(svg)
                )
            );
        }
    }

    /// @notice Check if text is valid.
    /// @dev Text is valid if every bytes is supported by CapsulesTypeface, or is 0x00.
    /// @param text UTF8-encoded text bytes to check validity of.
    /// @return true True if text is valid.
    function isValidText(bytes2[16][8] memory text) public view returns (bool) {
        unchecked {
            for (uint256 i; i < 8; i++) {
                for (uint256 j; j < 16; j++) {
                    bytes2 char = text[i][j];

                    // return false if any single character is unsupported
                    if (
                        !ITypeface(capsulesTypeface).supportsCodePoint(
                            // we can't directly convert bytes2 to bytes3 because 0 byte padding would be added to the right instead of the left
                            bytes3(abi.encodePacked(bytes1(0), char))
                        ) && char != 0
                    ) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    /// @notice Returns default text for a Capsule with specified color
    /// @param color Color of Capsule
    /// @return defaultText Default text for Capsule
    function _defaultTextOf(bytes3 color)
        internal
        pure
        returns (bytes2[16][8] memory defaultText)
    {
        defaultText[0][0] = "C";
        defaultText[0][1] = "A";
        defaultText[0][2] = "P";
        defaultText[0][3] = "S";
        defaultText[0][4] = "U";
        defaultText[0][5] = "L";
        defaultText[0][6] = "E";

        bytes memory _color = _bytes3ToHexChars(color);
        defaultText[1][0] = "#";
        defaultText[1][1] = _color[0];
        defaultText[1][2] = _color[1];
        defaultText[1][3] = _color[2];
        defaultText[1][4] = _color[3];
        defaultText[1][5] = _color[4];
        defaultText[1][6] = _color[5];
    }

    /// @notice Calculate specs used to build SVG for capsule. The SvgSpecs struct allows using memory more efficiently when constructing a SVG for a Capsule.
    /// @param capsule Capsule to calculate specs for
    /// @return specs SVG specs calculated for Capsule
    function _svgSpecsOf(Capsule memory capsule)
        internal
        pure
        returns (SvgSpecs memory)
    {
        // Calculate number of lines of Capsule text to render. Only trailing empty lines are excluded.
        uint256 linesCount;
        for (uint256 i = 8; i > 0; i--) {
            if (!_isEmptyLine(capsule.text[i - 1])) {
                linesCount = i;
                break;
            }
        }

        // Calculate the width of the Capsule text in characters. Equal to the number of non-empty characters in the longest line.
        uint256 charWidth;
        for (uint256 i; i < linesCount; i++) {
            // Reverse iterate over line
            for (uint256 j = 16; j > 0; j--) {
                if (capsule.text[i][j - 1] != 0 && j > charWidth) {
                    charWidth = j;
                }
            }
        }

        // Define the id of the svg row element.
        bytes memory edgeRowId;
        if (capsule.isLocked) {
            edgeRowId = abi.encodePacked("rowL", Strings.toString(charWidth));
        } else {
            edgeRowId = abi.encodePacked("row", Strings.toString(charWidth));
        }

        // Width of the text area (in dots)
        uint256 textAreaWidthDots = charWidth * 5 + (charWidth - 1) + 6;
        // Height of the text area (in dots)
        uint256 textAreaHeightDots = linesCount * 12 + 2;

        return
            SvgSpecs({
                hexColor: _bytes3ToHexChars(capsule.color),
                edgeRowId: edgeRowId,
                textRowId: abi.encodePacked(
                    "textRow",
                    Strings.toString(charWidth)
                ),
                linesCount: linesCount,
                charWidth: charWidth,
                textAreaWidthDots: textAreaWidthDots,
                textAreaHeightDots: textAreaHeightDots
            });
    }

    /// @notice Check if all lines of text are empty.
    /// @dev Returns true if every line of text is empty.
    /// @param text Text to check.
    /// @return true if text is empty.
    function _isEmptyText(bytes2[16][8] memory text)
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
    function _isEmptyLine(bytes2[16] memory line) internal pure returns (bool) {
        for (uint256 i; i < 16; i++) {
            if (line[i] != 0) return false;
        }
        return true;
    }

    /// @notice Returns text formatted as an array of readable strings.
    /// @param text Text to format.
    /// @return _stringText Text string array.
    function stringText(bytes2[16][8] memory text)
        external
        pure
        returns (string[8] memory _stringText)
    {
        for (uint256 i; i < 8; i++) {
            _stringText[i] = _stringLine(text[i], false);
        }
    }

    /// @notice Check if font is valid Capsules typeface font.
    /// @dev A font is valid if its source has been set in the CapsulesTypeface contract.
    /// @param font Font to check.
    /// @return true True if font is valid.
    function isValidFont(Font memory font) external view returns (bool) {
        return ITypeface(capsulesTypeface).hasSource(font);
    }

    /// @notice Returns text formatted as a readable string.
    /// @dev Iterates through each byte in line of text and replaces each byte as needed to create a string that will render in html without issue. Ensures that no illegal characters or 0x00 bytes remain. Non-trailing 0x00 bytes are converted to spaces, trailing 0x00 bytes are trimmed.
    /// @param line Line of text to format.
    /// @param htmlSafe Replace special characters with html-safe codes.
    /// @return stringLine Text string that can be safely rendered in html.
    function _stringLine(bytes2[16] memory line, bool htmlSafe)
        internal
        pure
        returns (string memory stringLine)
    {
        // Build bytes in reverse to more easily trim trailing whitespace
        for (uint256 i = 16; i > 0; i--) {
            bytes2 char = line[i - 1];

            // 0x0 bytes should not be rendered.
            if (char == 0) continue;

            // Some bytes cannot render in SVG text, so we replace them with their "&"-prefixed html name code.
            if (htmlSafe && char == 0x003c) {
                // Replace `<`
                stringLine = string.concat("&lt;", stringLine);
            } else if (htmlSafe && char == 0x003E) {
                // Replace `>`
                stringLine = string.concat("&gt;", stringLine);
            } else if (htmlSafe && char == 0x0026) {
                // Replace `&`
                stringLine = string.concat("&amp;", stringLine);
            } else {
                // If bytes2 character is html-safe, we add it while removing individual 0x0 bytes, which cannot be rendered.
                for (uint256 j = 2; j > 0; j--) {
                    if (char[j - 1] != bytes1(0)) {
                        stringLine = string(
                            abi.encodePacked(char[j - 1], stringLine)
                        );
                    }
                }
            }
        }
    }

    /// @notice Format bytes3 type to 6 hexadecimal ascii bytes
    /// @param b bytes3 value to convert to hex characters
    /// @return o hex character bytes
    function _bytes3ToHexChars(bytes3 b)
        internal
        pure
        returns (bytes memory o)
    {
        uint24 i = uint24(b);
        o = new bytes(6);
        uint24 mask = 0x00000f;
        o[5] = _uint8toByte(uint8(i & mask));
        i = i >> 4;
        o[4] = _uint8toByte(uint8(i & mask));
        i = i >> 4;
        o[3] = _uint8toByte(uint8(i & mask));
        i = i >> 4;
        o[2] = _uint8toByte(uint8(i & mask));
        i = i >> 4;
        o[1] = _uint8toByte(uint8(i & mask));
        i = i >> 4;
        o[0] = _uint8toByte(uint8(i & mask));
    }

    /// @notice Convert uint8 type to ascii byte
    /// @param i uint8 value to convert to ascii byte
    /// @return b ascii byte
    function _uint8toByte(uint8 i) internal pure returns (bytes1 b) {
        uint8 _i = (i > 9)
            ? (i + 87) // ascii a-f
            : (i + 48); // ascii 0-9

        b = bytes1(_i);
    }
}
