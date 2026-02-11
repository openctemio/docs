---
layout: default
title: CTIS Web3 Asset Schema
parent: CTIS Schema Reference
nav_order: 5
---

# CTIS Web3 Asset Schema

The Web3 Asset schema provides blockchain-specific technical details for smart contracts, wallets, tokens, DeFi protocols, and NFT collections.

**Schema Location**: `schemas/ctis/v1/web3-asset.json`

---

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `chain` | string | Blockchain network name |
| `chain_id` | integer | EVM Chain ID (1=mainnet, 137=polygon, 56=bsc) |
| `network_type` | string | Network type: `mainnet`, `testnet`, `devnet` |
| `address` | string | Contract/wallet address (EVM format: `0x...`) |
| `contract` | [SmartContractDetails](#smartcontractdetails) | Smart contract details |
| `wallet` | [WalletDetails](#walletdetails) | Wallet details |
| `token` | [TokenDetails](#tokendetails) | Token details |
| `defi` | [DeFiDetails](#defidetails) | DeFi protocol details |
| `nft` | [NFTCollectionDetails](#nftcollectiondetails) | NFT collection details |

### Supported Chains

| Chain | Chain ID | Description |
|-------|----------|-------------|
| `ethereum` | 1 | Ethereum Mainnet |
| `polygon` | 137 | Polygon PoS |
| `bsc` | 56 | BNB Smart Chain |
| `arbitrum` | 42161 | Arbitrum One |
| `optimism` | 10 | Optimism |
| `avalanche` | 43114 | Avalanche C-Chain |
| `fantom` | 250 | Fantom Opera |
| `base` | 8453 | Base |
| `solana` | - | Solana (non-EVM) |
| `near` | - | NEAR Protocol |
| `cosmos` | - | Cosmos Hub |

---

## Object Definitions

### SmartContractDetails

Smart contract-specific technical details.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Contract name |
| `address` | string | Contract address (0x format) |
| `deployer_address` | string | Address that deployed the contract |
| `deployment_tx_hash` | string | Transaction hash of deployment |
| `deployment_block` | integer | Block number of deployment |
| `deployed_at` | string (ISO 8601) | Deployment timestamp |
| `verified` | boolean | Verified on block explorer (Etherscan, etc.) |
| `compiler_version` | string | Solidity compiler version |
| `evm_version` | string | Target EVM version |
| `optimization_enabled` | boolean | Compiler optimization enabled |
| `optimization_runs` | integer | Number of optimization runs |
| `contract_type` | string | Type: `erc20`, `erc721`, `erc1155`, `proxy`, `multisig`, `defi`, `governance`, `custom` |
| `is_proxy` | boolean | Is this a proxy contract |
| `implementation_address` | string | Implementation contract (if proxy) |
| `proxy_type` | string | Proxy pattern: `transparent`, `uups`, `beacon`, `diamond`, `minimal` |
| `is_upgradeable` | boolean | Can be upgraded |
| `owner_address` | string | Current owner address |
| `ownership_renounced` | boolean | Ownership has been renounced |
| `source_code_url` | string | URL to verified source code |
| `abi` | string | Contract ABI (JSON string) |
| `bytecode_hash` | string | Hash of deployed bytecode |
| `source_code_hash` | string | Hash of source code |
| `license` | string | SPDX license identifier |
| `libraries` | array[[Library](#library)] | Linked libraries |
| `interfaces` | array[string] | Implemented interfaces (ERC20, ERC721, etc.) |
| `balance` | string | Contract balance in wei |
| `tx_count` | integer | Total transaction count |

### Library

External library reference.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Library name |
| `address` | string | **Yes** | Library address |

---

### WalletDetails

Wallet-specific details.

| Field | Type | Description |
|-------|------|-------------|
| `wallet_type` | string | Type: `eoa`, `multisig`, `smart_wallet`, `mpc` |
| `required_signatures` | integer | Signatures required (multisig) |
| `total_owners` | integer | Total number of owners |
| `owners` | array[string] | List of owner addresses |
| `provider` | string | Wallet provider: `metamask`, `ledger`, `safe`, `argent`, `coinbase`, `rainbow`, `trustwallet` |
| `balance` | string | Native token balance in wei |
| `token_balances` | array[[TokenBalance](#tokenbalance)] | ERC20 token balances |
| `nft_count` | integer | Number of NFTs owned |
| `first_tx_at` | string (ISO 8601) | First transaction timestamp |
| `last_tx_at` | string (ISO 8601) | Last transaction timestamp |
| `tx_count` | integer | Total transaction count |
| `ens_name` | string | ENS domain name |
| `labels` | array[string] | Wallet labels: `exchange`, `whale`, `hacker`, `contract`, `bridge`, `defi`, `nft_trader` |

### TokenBalance

Token balance information.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contract_address` | string | **Yes** | Token contract address |
| `balance` | string | **Yes** | Raw balance |
| `symbol` | string | No | Token symbol |
| `name` | string | No | Token name |
| `decimals` | integer | No | Token decimals (0-18) |
| `balance_formatted` | string | No | Human-readable balance |
| `usd_value` | number | No | USD value |

---

### TokenDetails

Token-specific details (ERC20, ERC721, etc.).

| Field | Type | Description |
|-------|------|-------------|
| `standard` | string | Token standard: `erc20`, `erc721`, `erc1155`, `bep20`, `spl` |
| `symbol` | string | Token symbol |
| `name` | string | Token name |
| `decimals` | integer | Decimals (0-18) |
| `total_supply` | string | Total supply |
| `max_supply` | string | Maximum supply (if capped) |
| `mintable` | boolean | Can mint new tokens |
| `burnable` | boolean | Can burn tokens |
| `pausable` | boolean | Has pause functionality |
| `has_blacklist` | boolean | Has blacklist functionality |
| `has_transfer_fee` | boolean | Charges transfer fee |
| `transfer_fee_percent` | number | Fee percentage (0-100) |
| `holder_count` | integer | Number of holders |
| `market_cap_usd` | number | Market capitalization (USD) |
| `price_usd` | number | Current price (USD) |
| `liquidity_usd` | number | Total liquidity (USD) |
| `trading_pairs` | array[[TradingPair](#tradingpair)] | DEX trading pairs |
| `is_honeypot` | boolean | Detected as honeypot |
| `honeypot_reason` | string | Honeypot detection reason |

### TradingPair

DEX trading pair information.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dex` | string | **Yes** | DEX name: `uniswap_v2`, `uniswap_v3`, `sushiswap`, `pancakeswap`, `curve`, `balancer` |
| `pair_address` | string | **Yes** | Pair contract address |
| `quote_token` | string | **Yes** | Quote token (ETH, USDC, etc.) |
| `liquidity_usd` | number | No | Liquidity in USD |

---

### DeFiDetails

DeFi protocol-specific details.

| Field | Type | Description |
|-------|------|-------------|
| `protocol_name` | string | Protocol name |
| `protocol_type` | string | Type: `dex`, `lending`, `yield`, `bridge`, `derivatives`, `insurance`, `staking`, `liquid_staking` |
| `version` | string | Protocol version |
| `tvl_usd` | number | Total Value Locked (USD) |
| `supported_chains` | array[string] | Chains where protocol is deployed |
| `core_contracts` | array[[CoreContract](#corecontract)] | Core protocol contracts |
| `governance_token` | string | Governance token address |
| `audited` | boolean | Has been audited |
| `audit_reports` | array[[AuditReport](#auditreport)] | Audit reports |
| `has_bug_bounty` | boolean | Has bug bounty program |
| `bug_bounty_platform` | string | Platform: `immunefi`, `hackerone`, `code4rena`, `sherlock`, `hats` |
| `max_bounty_usd` | number | Maximum bounty amount (USD) |
| `timelock_duration` | integer | Timelock duration in seconds |
| `paused` | boolean | Protocol is currently paused |

### CoreContract

DeFi protocol core contract.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Contract name |
| `address` | string | **Yes** | Contract address |
| `role` | string | No | Role: `router`, `factory`, `vault`, `controller`, `oracle`, `governance`, `timelock` |

### AuditReport

Security audit report.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `auditor` | string | **Yes** | Auditor: `trail_of_bits`, `openzeppelin`, `consensys_diligence`, `certik`, `hacken`, `peckshield`, `slowmist`, `quantstamp`, `cyfrin` |
| `report_url` | string | No | URL to audit report |
| `date` | string (ISO 8601) | No | Audit date |
| `scope` | string | No | Audit scope |
| `critical_count` | integer | No | Critical findings count |
| `high_count` | integer | No | High findings count |
| `medium_count` | integer | No | Medium findings count |
| `low_count` | integer | No | Low findings count |

---

### NFTCollectionDetails

NFT collection-specific details.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Collection name |
| `symbol` | string | Collection symbol |
| `standard` | string | Token standard: `erc721`, `erc1155` |
| `total_supply` | integer | Total tokens minted |
| `max_supply` | integer | Maximum supply |
| `holder_count` | integer | Number of unique holders |
| `floor_price` | string | Floor price (native token) |
| `floor_price_usd` | number | Floor price (USD) |
| `total_volume` | string | Total trading volume (native) |
| `total_volume_usd` | number | Total trading volume (USD) |
| `royalty_percent` | number | Royalty percentage (0-100) |
| `royalty_recipient` | string | Royalty recipient address |
| `marketplaces` | array[string] | Listed on: `opensea`, `blur`, `looksrare`, `x2y2`, `rarible`, `foundation` |
| `revealed` | boolean | Metadata revealed |
| `base_uri` | string | Base URI for metadata |
| `metadata_storage` | string | Storage: `ipfs`, `arweave`, `centralized`, `onchain` |
| `creator` | string | Creator address |

---

## Examples

### Smart Contract Asset

```json
{
  "type": "smart_contract",
  "name": "Uniswap V3 Router",
  "identifier": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  "web3": {
    "chain": "ethereum",
    "chain_id": 1,
    "network_type": "mainnet",
    "address": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
    "contract": {
      "name": "SwapRouter02",
      "address": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      "deployer_address": "0x6C9FC64A53c1b71FB3f9Af64d1ae3A4931A5f4E9",
      "deployment_block": 14756845,
      "deployed_at": "2022-05-05T00:00:00Z",
      "verified": true,
      "compiler_version": "v0.8.15+commit.e14f2714",
      "evm_version": "london",
      "optimization_enabled": true,
      "optimization_runs": 1000000,
      "contract_type": "defi",
      "is_proxy": false,
      "is_upgradeable": false,
      "ownership_renounced": true,
      "source_code_url": "https://etherscan.io/address/0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45#code",
      "license": "GPL-2.0-or-later",
      "interfaces": ["ISwapRouter", "IMulticall"]
    }
  }
}
```

### Multisig Wallet Asset

```json
{
  "type": "wallet",
  "name": "Protocol Treasury",
  "identifier": "0x0EFcCBb9E2C09Ea29551879bd9Da32362b32fc89",
  "web3": {
    "chain": "ethereum",
    "chain_id": 1,
    "address": "0x0EFcCBb9E2C09Ea29551879bd9Da32362b32fc89",
    "wallet": {
      "wallet_type": "multisig",
      "required_signatures": 3,
      "total_owners": 5,
      "owners": [
        "0x123...",
        "0x456...",
        "0x789...",
        "0xabc...",
        "0xdef..."
      ],
      "provider": "safe",
      "balance": "50000000000000000000",
      "token_balances": [
        {
          "contract_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "symbol": "USDC",
          "decimals": 6,
          "balance": "5000000000000",
          "balance_formatted": "5,000,000.00",
          "usd_value": 5000000
        }
      ],
      "tx_count": 1523,
      "labels": ["defi", "whale"]
    }
  }
}
```

### ERC20 Token Asset

```json
{
  "type": "smart_contract",
  "name": "USDC Token",
  "identifier": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "web3": {
    "chain": "ethereum",
    "chain_id": 1,
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "token": {
      "standard": "erc20",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "total_supply": "26000000000000000",
      "mintable": true,
      "burnable": true,
      "pausable": true,
      "has_blacklist": true,
      "has_transfer_fee": false,
      "holder_count": 1850000,
      "market_cap_usd": 26000000000,
      "price_usd": 1.0,
      "liquidity_usd": 500000000,
      "trading_pairs": [
        {
          "dex": "uniswap_v3",
          "pair_address": "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
          "quote_token": "ETH",
          "liquidity_usd": 150000000
        }
      ],
      "is_honeypot": false
    }
  }
}
```

### DeFi Protocol Asset

```json
{
  "type": "smart_contract",
  "name": "Aave V3 Pool",
  "identifier": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  "web3": {
    "chain": "ethereum",
    "chain_id": 1,
    "address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    "defi": {
      "protocol_name": "Aave",
      "protocol_type": "lending",
      "version": "3.0",
      "tvl_usd": 12500000000,
      "supported_chains": ["ethereum", "polygon", "arbitrum", "optimism", "avalanche", "base"],
      "core_contracts": [
        {
          "name": "Pool",
          "address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
          "role": "vault"
        },
        {
          "name": "PoolAddressesProvider",
          "address": "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
          "role": "controller"
        },
        {
          "name": "AaveOracle",
          "address": "0x54586bE62E3c3580375aE3723C145253060Ca0C2",
          "role": "oracle"
        }
      ],
      "governance_token": "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",
      "audited": true,
      "audit_reports": [
        {
          "auditor": "trail_of_bits",
          "date": "2022-10-01T00:00:00Z",
          "scope": "Aave V3 Core",
          "critical_count": 0,
          "high_count": 1,
          "medium_count": 5,
          "low_count": 12
        },
        {
          "auditor": "openzeppelin",
          "date": "2022-09-15T00:00:00Z",
          "report_url": "https://blog.openzeppelin.com/aave-v3-audit/"
        }
      ],
      "has_bug_bounty": true,
      "bug_bounty_platform": "immunefi",
      "max_bounty_usd": 250000,
      "timelock_duration": 86400,
      "paused": false
    }
  }
}
```

### NFT Collection Asset

```json
{
  "type": "smart_contract",
  "name": "Bored Ape Yacht Club",
  "identifier": "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
  "web3": {
    "chain": "ethereum",
    "chain_id": 1,
    "address": "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    "nft": {
      "name": "Bored Ape Yacht Club",
      "symbol": "BAYC",
      "standard": "erc721",
      "total_supply": 10000,
      "max_supply": 10000,
      "holder_count": 6500,
      "floor_price": "25000000000000000000",
      "floor_price_usd": 45000,
      "total_volume": "850000000000000000000000",
      "total_volume_usd": 1500000000,
      "royalty_percent": 2.5,
      "royalty_recipient": "0xA858DDc0445d8131daC4d1DE01f834ffcbA52Ef1",
      "marketplaces": ["opensea", "blur", "looksrare"],
      "revealed": true,
      "base_uri": "ipfs://QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/",
      "metadata_storage": "ipfs",
      "creator": "0xBA5BDe662c17e2aDFF1075610382B9B691296350"
    }
  }
}
```

---

## Related Documentation

- [Asset Schema](ctis-asset.md) - Base asset schema with `web3` field
- [Web3 Finding Schema](ctis-web3-finding.md) - Smart contract vulnerabilities
