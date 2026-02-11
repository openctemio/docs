---
layout: default
title: CTIS Web3 Finding Schema
parent: CTIS Schema Reference
nav_order: 6
---

# CTIS Web3 Finding Schema

The Web3 Finding schema provides smart contract and blockchain-specific vulnerability details, including SWC IDs, attack vectors, and specialized issue types like reentrancy, oracle manipulation, and flash loan attacks.

**Schema Location**: `schemas/ctis/v1/web3-finding.json`

---

## Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `vulnerability_class` | [Web3VulnerabilityClass](#web3vulnerabilityclass) | Vulnerability classification |
| `swc_id` | string | SWC Registry ID (e.g., `SWC-107`) |
| `contract_address` | string | Affected contract address |
| `chain_id` | integer | EVM Chain ID |
| `chain` | string | Chain name |
| `function_signature` | string | Affected function (e.g., `withdraw(uint256)`) |
| `function_selector` | string | 4-byte function selector (e.g., `0x2e1a7d4d`) |
| `vulnerable_pattern` | string | Vulnerable code pattern |
| `bytecode_offset` | integer | Bytecode offset of vulnerability |
| `exploitable_on_mainnet` | boolean | Can be exploited on mainnet |
| `estimated_impact_usd` | number | Estimated impact in USD |
| `affected_value_usd` | number | Value at risk in USD |
| `attack_vector` | string | Attack vector description |
| `poc` | [Web3POC](#web3poc) | Proof of concept |
| `related_tx_hashes` | array[string] | Related transaction hashes |
| `attacker_addresses` | array[string] | Known attacker addresses |
| `detection_tool` | string | Detection tool used |
| `detection_confidence` | string | Confidence level: `high`, `medium`, `low` |
| `is_false_positive` | boolean | Marked as false positive |
| `gas_issue` | [GasIssue](#gasissue) | Gas optimization details |
| `access_control` | [AccessControlIssue](#accesscontrolissue) | Access control issue details |
| `reentrancy` | [ReentrancyIssue](#reentrancyissue) | Reentrancy vulnerability details |
| `oracle_manipulation` | [OracleManipulationIssue](#oraclemanipulationissue) | Oracle manipulation details |
| `flash_loan` | [FlashLoanIssue](#flashloanissue) | Flash loan attack details |

### Detection Tools

| Tool | Description |
|------|-------------|
| `slither` | Trail of Bits static analyzer |
| `mythril` | ConsenSys symbolic execution |
| `securify` | ETH Zurich static analysis |
| `manticore` | Trail of Bits symbolic execution |
| `echidna` | Property-based fuzzer |
| `foundry` | Foundry test framework |
| `aderyn` | Cyfrin static analyzer |
| `wake` | Python-based analyzer |
| `4naly3er` | Gas optimization analyzer |
| `solhint` | Solidity linter |
| `mythx` | ConsenSys MythX service |
| `certora` | Formal verification |
| `custom` | Custom detection |

---

## Web3VulnerabilityClass

Smart contract vulnerability classifications aligned with SWC Registry.

### Reentrancy & Call Issues

| Class | SWC | Description |
|-------|-----|-------------|
| `reentrancy` | SWC-107 | State changes after external calls |
| `unchecked_call` | SWC-104 | Unchecked return values |
| `delegate_call` | SWC-112 | Dangerous delegatecall |
| `self_destruct` | SWC-106 | Unprotected selfdestruct |

### Integer Issues

| Class | SWC | Description |
|-------|-----|-------------|
| `integer_overflow` | SWC-101 | Integer overflow |
| `integer_underflow` | SWC-101 | Integer underflow |

### Access Control

| Class | SWC | Description |
|-------|-----|-------------|
| `access_control` | SWC-115 | Missing/incorrect access controls |
| `tx_origin` | SWC-115 | Authorization through tx.origin |

### Randomness & Dependencies

| Class | SWC | Description |
|-------|-----|-------------|
| `weak_randomness` | SWC-120 | Weak sources of randomness |
| `timestamp_dependence` | SWC-116 | Dependence on block.timestamp |
| `blockhash_dependence` | SWC-120 | Dependence on blockhash |

### DeFi-Specific

| Class | Description |
|-------|-------------|
| `flash_loan_attack` | Flash loan enabled attacks |
| `oracle_manipulation` | Price oracle manipulation |
| `front_running` | Transaction ordering exploitation |
| `sandwich_attack` | Sandwich attack vulnerability |
| `slippage_attack` | Slippage parameter exploitation |
| `price_manipulation` | Price feed manipulation |
| `governance_attack` | Governance mechanism exploitation |
| `liquidity_drain` | Liquidity pool drainage |
| `mev_vulnerability` | MEV extraction vulnerability |

### Token Issues

| Class | Description |
|-------|-------------|
| `honeypot` | Cannot sell after buying |
| `hidden_mint` | Hidden minting capability |
| `hidden_fee` | Hidden transfer fees |
| `blacklist_abuse` | Blacklist function abuse |
| `fake_renounce` | Fake ownership renouncement |

### Proxy & Upgrade

| Class | SWC | Description |
|-------|-----|-------------|
| `storage_collision` | SWC-124 | Storage layout collision |
| `uninitialized_proxy` | SWC-109 | Uninitialized proxy |
| `upgrade_vulnerability` | - | Unsafe upgrade mechanism |

### Signature & Replay

| Class | SWC | Description |
|-------|-----|-------------|
| `signature_malleability` | SWC-117 | Signature malleability |
| `replay_attack` | SWC-121 | Signature replay |

### DoS Attacks

| Class | SWC | Description |
|-------|-----|-------------|
| `dos_gas_limit` | SWC-128 | DoS with block gas limit |
| `unbounded_loop` | SWC-128 | Unbounded loop iteration |
| `dos_block_stuffing` | - | Block stuffing attack |

### Logic Issues

| Class | Description |
|-------|-------------|
| `business_logic` | Business logic flaw |
| `invariant_violation` | Protocol invariant broken |

---

## Object Definitions

### Web3POC

Proof of concept for the vulnerability.

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | POC type: `transaction`, `script`, `foundry_test`, `hardhat_test` |
| `code` | string | POC code or script |
| `tx_data` | string | Transaction calldata |
| `expected_outcome` | string | Expected result description |
| `tested_on` | string | Test environment: `mainnet_fork`, `testnet`, `local` |
| `fork_block_number` | integer | Block number for mainnet fork |

---

### GasIssue

Gas optimization issue details.

| Field | Type | Description |
|-------|------|-------------|
| `current_gas` | integer | Current gas usage |
| `optimized_gas` | integer | Optimized gas usage |
| `savings_percent` | number | Gas savings percentage (0-100) |
| `suggestion` | string | Optimization suggestion |

---

### AccessControlIssue

Access control vulnerability details.

| Field | Type | Description |
|-------|------|-------------|
| `missing_modifier` | string | Missing access modifier |
| `unprotected_function` | string | Unprotected function name |
| `callable_by` | string | Who can call: `anyone`, `owner_only`, `role_based`, `whitelist` |
| `escalation_path` | string | Privilege escalation path |
| `missing_role_check` | string | Missing role check |

---

### ReentrancyIssue

Reentrancy vulnerability details.

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Type: `cross_function`, `cross_contract`, `read_only`, `single_function` |
| `external_call` | string | Vulnerable external call |
| `state_modified_after_call` | string | State variable modified after call |
| `entry_point` | string | Entry point function |
| `callback` | string | Callback function used |
| `max_depth` | integer | Maximum reentrancy depth |

### Reentrancy Types

| Type | Description |
|------|-------------|
| `single_function` | Same function called recursively |
| `cross_function` | Different function in same contract |
| `cross_contract` | Different contract callbacks |
| `read_only` | View function returns stale state |

---

### OracleManipulationIssue

Oracle manipulation vulnerability details.

| Field | Type | Description |
|-------|------|-------------|
| `oracle_type` | string | Oracle: `chainlink`, `uniswap_twap`, `uniswap_spot`, `band`, `tellor`, `custom` |
| `oracle_address` | string | Oracle contract address |
| `manipulation_method` | string | Method: `flash_loan`, `sandwich`, `time_manipulation`, `multi_block` |
| `price_impact_percent` | number | Achievable price impact |
| `missing_checks` | array[string] | Missing validation checks |

### Missing Oracle Checks

| Check | Description |
|-------|-------------|
| `staleness_check` | Not checking if price is stale |
| `min_answer_check` | No minimum price validation |
| `max_answer_check` | No maximum price validation |
| `sequencer_check` | No L2 sequencer uptime check |
| `deviation_check` | No price deviation check |

---

### FlashLoanIssue

Flash loan attack vulnerability details.

| Field | Type | Description |
|-------|------|-------------|
| `provider` | string | Flash loan provider: `aave`, `dydx`, `uniswap`, `balancer`, `compound`, `maker` |
| `attack_type` | string | Attack type |
| `required_capital_usd` | number | Minimum capital needed (usually 0) |
| `potential_profit_usd` | number | Potential profit in USD |
| `attack_steps` | array[string] | Step-by-step attack description |

### Flash Loan Attack Types

| Type | Description |
|------|-------------|
| `price_manipulation` | Manipulate price via large trades |
| `governance_attack` | Borrow to gain voting power |
| `collateral_theft` | Exploit collateral calculations |
| `arbitrage` | Risk-free arbitrage extraction |
| `liquidation` | Trigger unfair liquidations |

---

## Examples

### Reentrancy Vulnerability

```json
{
  "type": "vulnerability",
  "title": "Reentrancy in withdraw function",
  "severity": "critical",
  "rule_id": "SWC-107",
  "file_path": "contracts/Vault.sol",
  "start_line": 45,
  "message": "External call to msg.sender before state update allows reentrancy",
  "web3": {
    "vulnerability_class": "reentrancy",
    "swc_id": "SWC-107",
    "contract_address": "0x1234567890abcdef1234567890abcdef12345678",
    "chain_id": 1,
    "chain": "ethereum",
    "function_signature": "withdraw(uint256)",
    "function_selector": "0x2e1a7d4d",
    "exploitable_on_mainnet": true,
    "estimated_impact_usd": 5000000,
    "affected_value_usd": 15000000,
    "detection_tool": "slither",
    "detection_confidence": "high",
    "reentrancy": {
      "type": "single_function",
      "external_call": "msg.sender.call{value: amount}(\"\")",
      "state_modified_after_call": "balances[msg.sender]",
      "entry_point": "withdraw",
      "max_depth": 10
    },
    "poc": {
      "type": "foundry_test",
      "code": "function testReentrancy() public {\n  AttackContract attacker = new AttackContract(vault);\n  attacker.attack{value: 1 ether}();\n  assertGt(address(attacker).balance, 1 ether);\n}",
      "expected_outcome": "Drain contract balance",
      "tested_on": "mainnet_fork",
      "fork_block_number": 18500000
    }
  }
}
```

### Oracle Manipulation Vulnerability

```json
{
  "type": "vulnerability",
  "title": "Missing oracle staleness check",
  "severity": "high",
  "rule_id": "oracle-staleness",
  "file_path": "contracts/LendingPool.sol",
  "start_line": 123,
  "message": "Chainlink oracle price can be stale, enabling price manipulation",
  "web3": {
    "vulnerability_class": "oracle_manipulation",
    "contract_address": "0xabcdef1234567890abcdef1234567890abcdef12",
    "chain_id": 1,
    "chain": "ethereum",
    "function_signature": "liquidate(address,uint256)",
    "exploitable_on_mainnet": true,
    "estimated_impact_usd": 2000000,
    "detection_tool": "slither",
    "detection_confidence": "medium",
    "oracle_manipulation": {
      "oracle_type": "chainlink",
      "oracle_address": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
      "manipulation_method": "time_manipulation",
      "missing_checks": [
        "staleness_check",
        "sequencer_check"
      ]
    },
    "attack_vector": "Wait for oracle to become stale during network congestion, then liquidate positions at incorrect prices"
  }
}
```

### Flash Loan Attack Vulnerability

```json
{
  "type": "vulnerability",
  "title": "Flash loan governance attack",
  "severity": "critical",
  "rule_id": "flash-loan-governance",
  "file_path": "contracts/Governance.sol",
  "start_line": 89,
  "message": "Governance voting uses instantaneous token balance, vulnerable to flash loan attack",
  "web3": {
    "vulnerability_class": "flash_loan_attack",
    "contract_address": "0xdef1234567890abcdef1234567890abcdef1234",
    "chain_id": 1,
    "chain": "ethereum",
    "function_signature": "castVote(uint256,bool)",
    "exploitable_on_mainnet": true,
    "estimated_impact_usd": 50000000,
    "detection_tool": "mythril",
    "detection_confidence": "high",
    "flash_loan": {
      "provider": "aave",
      "attack_type": "governance_attack",
      "required_capital_usd": 0,
      "potential_profit_usd": 10000000,
      "attack_steps": [
        "1. Flash loan 1M governance tokens from Aave",
        "2. Create malicious proposal or vote on existing one",
        "3. castVote() reads balanceOf() which includes flash loaned tokens",
        "4. Proposal passes with inflated voting power",
        "5. Repay flash loan in same transaction",
        "6. Execute malicious proposal after timelock"
      ]
    },
    "poc": {
      "type": "foundry_test",
      "tested_on": "mainnet_fork"
    }
  }
}
```

### Access Control Vulnerability

```json
{
  "type": "vulnerability",
  "title": "Missing access control on setFee",
  "severity": "high",
  "rule_id": "SWC-115",
  "file_path": "contracts/Pool.sol",
  "start_line": 67,
  "message": "setFee function can be called by anyone",
  "web3": {
    "vulnerability_class": "access_control",
    "swc_id": "SWC-115",
    "contract_address": "0x567890abcdef1234567890abcdef1234567890ab",
    "chain_id": 137,
    "chain": "polygon",
    "function_signature": "setFee(uint256)",
    "function_selector": "0x69fe0e2d",
    "exploitable_on_mainnet": true,
    "detection_tool": "slither",
    "detection_confidence": "high",
    "access_control": {
      "missing_modifier": "onlyOwner",
      "unprotected_function": "setFee",
      "callable_by": "anyone",
      "escalation_path": "Set fee to 100% and drain user funds"
    }
  }
}
```

### Gas Optimization Finding

```json
{
  "type": "vulnerability",
  "title": "Inefficient storage read in loop",
  "severity": "low",
  "rule_id": "gas-storage-loop",
  "file_path": "contracts/Token.sol",
  "start_line": 112,
  "message": "Storage variable read inside loop can be cached",
  "web3": {
    "vulnerability_class": "dos_gas_limit",
    "contract_address": "0x890abcdef1234567890abcdef1234567890abcde",
    "chain_id": 1,
    "chain": "ethereum",
    "function_signature": "batchTransfer(address[],uint256[])",
    "detection_tool": "4naly3er",
    "detection_confidence": "high",
    "gas_issue": {
      "current_gas": 150000,
      "optimized_gas": 85000,
      "savings_percent": 43.3,
      "suggestion": "Cache `balances[msg.sender]` before the loop to avoid repeated SLOAD operations"
    }
  }
}
```

---

## SWC Registry Reference

Common SWC IDs for smart contract vulnerabilities:

| SWC ID | Name | Severity |
|--------|------|----------|
| SWC-100 | Function Default Visibility | Medium |
| SWC-101 | Integer Overflow/Underflow | High |
| SWC-104 | Unchecked Call Return Value | Medium |
| SWC-105 | Unprotected Ether Withdrawal | Critical |
| SWC-106 | Unprotected SELFDESTRUCT | Critical |
| SWC-107 | Reentrancy | Critical |
| SWC-109 | Uninitialized Storage Pointer | High |
| SWC-110 | Assert Violation | Medium |
| SWC-112 | Delegatecall to Untrusted | Critical |
| SWC-113 | DoS with Failed Call | Medium |
| SWC-115 | Authorization through tx.origin | High |
| SWC-116 | Block values as proxy for time | Low |
| SWC-117 | Signature Malleability | Medium |
| SWC-120 | Weak Sources of Randomness | High |
| SWC-121 | Missing Protection against Replay | High |
| SWC-123 | Requirement Violation | Medium |
| SWC-124 | Write to Arbitrary Storage | Critical |
| SWC-128 | DoS With Block Gas Limit | Medium |
| SWC-131 | Presence of Unused Variables | Info |
| SWC-134 | Message call with hardcoded gas | Low |
| SWC-136 | Unencrypted Private Data | High |

---

## Related Documentation

- [Finding Schema](ctis-finding.md) - Base finding schema with `web3` field
- [Web3 Asset Schema](ctis-web3-asset.md) - Smart contract assets
- [SWC Registry](https://swcregistry.io/) - Smart Contract Weakness Classification
