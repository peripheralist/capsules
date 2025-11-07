# Capsules

On-chain typeface and NFT project featuring unique colors and editable text rendered as SVGs on-chain.

## Repository Structure

```
capsules/
├── contracts/              # Solidity smart contracts
│   ├── CapsulesTypeface.sol              # Simple typeface contract (no token integration)
│   ├── CapsulesTypefaceExperience.sol    # Typeface with CapsuleToken integration
│   ├── CapsuleToken.sol                   # NFT token contract
│   ├── CapsuleRenderer.sol                # SVG rendering logic
│   ├── CapsuleMetadata.sol                # Metadata generation
│   ├── Typeface.sol                       # Base typeface contract
│   ├── TypefaceExpandable.sol             # Expandable typeface base
│   └── interfaces/                        # Contract interfaces
├── scripts/               # Deployment and utility scripts
│   ├── deploy-typeface.ts                 # Deploy CapsulesTypeface (no token)
│   ├── store-fonts.ts                     # Store font data on-chain
│   ├── deploy.ts                          # Deploy full system (Experience version)
│   └── utils.ts                           # Shared utilities
├── test/                  # Contract tests
├── deployments/           # Deployment artifacts (see below)
├── fonts.ts              # Base64-encoded font data
├── pureColors.ts         # Pure color definitions
└── hardhat.config.ts     # Hardhat configuration
```

## Deployment Artifacts

Deployment artifacts are stored in the `deployments/` directory, organized by contract type and network:

### CapsulesTypeface (Simple, No Token Integration)
```
deployments/typeface/
├── mainnet/
│   ├── CapsulesTypeface.json          # Contract ABI and address
│   └── CapsulesTypeface.arguments.js  # Constructor arguments
├── base/
├── optimism/
├── arbitrum/
├── sepolia/
├── baseSepolia/
├── optimismSepolia/
└── arbitrumSepolia/
```

### CapsulesTypefaceExperience (Full System with Token Integration)
```
deployments/
├── mainnet/
│   ├── CapsulesTypefaceExperience.json
│   ├── CapsuleToken.json
│   ├── CapsuleRenderer.json
│   └── CapsuleMetadata.json
└── [other networks...]
```

## Contract History

### Original Deployment (Ethereum Mainnet)

The **CapsulesTypefaceExperience** contract was originally deployed to Ethereum mainnet as "CapsulesTypeface". This version includes full integration with:
- **CapsuleToken**: NFT contract that mints tokens when fonts are stored
- **CapsuleRenderer**: Renders Capsules as SVGs
- **CapsuleMetadata**: Generates token metadata
- **Patron System**: Tracks which address stored each font

This integrated system creates an "experience" where storing fonts on-chain mints special NFTs to the patron.

### Multi-Chain Deployment (New)

**CapsulesTypeface**—a simplified version of the (now) CapsulesTypefaceExperience contract without any token integration—is  deployed to other chains (Base, Optimism, Arbitrum, testnets, etc.). This allows the typeface to be used across multiple chains without the complexity of the full NFT system.

**Key Differences:**
- **CapsulesTypeface**: Simple, standalone typeface contract
- **CapsulesTypefaceExperience**: Full system with NFT minting and patron tracking

## Setup

### Prerequisites
- Node.js v16+
- Hardhat
- A `pk.txt` file in the root directory containing your deployer private key

### Installation

```bash
npm install
```

### Configuration

The project supports the following networks (configured in `hardhat.config.ts`):

**Mainnets:**
- `mainnet` - Ethereum
- `base` - Base
- `optimism` - Optimism
- `arbitrum` - Arbitrum

**Testnets:**
- `sepolia` - Ethereum Sepolia
- `baseSepolia` - Base Sepolia
- `optimismSepolia` - Optimism Sepolia
- `arbitrumSepolia` - Arbitrum Sepolia

## Running Scripts

### 1. Deploy CapsulesTypeface Contract

Deploys the simple typeface contract and sets font hashes.

```bash
npx hardhat run scripts/deploy-typeface.ts --network <network-name>
```

**Example:**
```bash
npx hardhat run scripts/deploy-typeface.ts --network base
npx hardhat run scripts/deploy-typeface.ts --network optimismSepolia
```

**What it does:**
1. Deploys `CapsulesTypeface` contract
2. Sets source hashes for all fonts using `setSourceHashes()`
3. Saves deployment artifacts to `deployments/typeface/<network>/`

**Output:**
- `deployments/typeface/<network>/CapsulesTypeface.json` - Contract ABI and address
- `deployments/typeface/<network>/CapsulesTypeface.arguments.js` - Constructor arguments

**Constants used:**
- `OPERATOR_ADDRESS`: in order to allow the deployer wallet (from pk.txt) to store fonts using `scripts/store-fonts.ts`, this must be the deployer address 
- `DONATION_ADDRESS`: funds receiver for the Typeface contract

### 2. Store Fonts On-Chain

Stores the actual font data on-chain for a previously deployed contract.

```bash
npx hardhat run scripts/store-fonts.ts --network <network-name>
```

**Example:**
```bash
npx hardhat run scripts/store-fonts.ts --network base
npx hardhat run scripts/store-fonts.ts --network optimismSepolia
```

**What it does:**
1. Reads deployment info from `deployments/typeface/<network>/CapsulesTypeface.json`
2. Connects to the deployed contract
3. For each font (100, 200, 300, etc.):
   - Checks if already stored (skips if yes)
   - Converts base64 font data to bytes
   - Calls `setSource()` with the font data
   - Shows gas usage and progress
4. Transfers operator role to `OWNER_ADDRESS` after all fonts are stored

**Features:**
- **Idempotent**: Can be run multiple times, skips already-stored fonts
- **Resumable**: If interrupted, re-run to continue where it left off
- **Progress tracking**: Shows real-time progress with gas usage
- **Network-specific gas limits**: Automatically adjusts for each network

**Gas Limits by Network:**
- Sepolia: 15M gas per transaction
- Other networks: 25M gas per transaction

**Note:** Storing fonts is expensive! Each font requires a separate transaction with significant gas costs.

### 3. Deploy Full System (CapsulesTypefaceExperience)

For deploying the full integrated system with token functionality:

```bash
npx hardhat run scripts/deploy.ts --network <network-name>
```

**What it deploys:**
1. `CapsuleMetadata`
2. `CapsulesTypefaceExperience` (with token integration)
3. `CapsuleRenderer`
4. `CapsuleToken`

**Note:** This is the original system deployed on Ethereum mainnet.

## Development

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Verify Contracts

After deployment, verify on block explorers:

```bash
npx hardhat verify --network <network-name> <contract-address> <constructor-args>
```

## Network-Specific Considerations

### Optimism Networks (Optimism, Optimism Sepolia)
- Requires minimum `maxPriorityFeePerGas` of 1 gwei
- Scripts automatically handle this for Optimism networks

### Sepolia
- Lower block gas limit (~16.7M)
- Scripts use 15M gas limit to stay under cap

### Base, Arbitrum
- Standard gas limits apply (25M)
- Base uses public RPC endpoints
- Arbitrum has higher gas limits but cost is tied to L1

## Font Data

Font data is stored in `fonts.ts` as base64-encoded strings:

```typescript
export const FONTS = {
  100: "d09GRk9UVE8AAC8M...", // Thin
  200: "d09GRk9UVE8AAC8Y...", // Extra Light
  300: "d09GRk9UVE8AADAo...", // Light
  // ... etc
};
```

When storing on-chain, the base64 strings are converted to bytes using `Buffer.from(fontData)`, which treats each character as a byte. This ensures the data can be read back as base64 directly from the contract.

## Deployment Workflow

### Standard Deployment (Simple Typeface)

```bash
# 1. Deploy contract
npx hardhat run scripts/deploy-typeface.ts --network base

# 2. Store fonts (can be done later when gas is cheaper)
npx hardhat run scripts/store-fonts.ts --network base

# 3. (Optional) Verify on block explorer
npx hardhat verify --network base <contract-address> \
  "0x63A2368F4B509438ca90186cb1C15156713D5834" \
  "0xE1054192960FA3c6178E90f6Bc14cbe6146413e4"
```

### Multi-Chain Deployment

```bash
# Deploy to multiple chains
npx hardhat run scripts/deploy-typeface.ts --network base
npx hardhat run scripts/deploy-typeface.ts --network optimism
npx hardhat run scripts/deploy-typeface.ts --network arbitrum

# Store fonts on each chain (can be parallelized)
npx hardhat run scripts/store-fonts.ts --network base
npx hardhat run scripts/store-fonts.ts --network optimism
npx hardhat run scripts/store-fonts.ts --network arbitrum
```

## License

GPL-3.0
