# Protocol Governance System

## Overview

The Protocol Governance System provides a lightweight metadata layer for tracking DAO proposals and votes. It syncs with on-chain governance contracts to maintain human-readable titles, descriptions, and voting records.

## Architecture

### Entities

#### GovernanceProposal Entity

Tracks decentralized proposals with metadata enrichment.

**Fields:**

- `id` (UUID): Primary key
- `onChainId` (int, unique): On-chain proposal ID from DAO contract
- `title` (varchar 500): Human-readable proposal title
- `description` (text): Detailed proposal description
- `category` (enum): Governance, Treasury, Technical, or Community
- `status` (enum): Active, Passed, Failed, or Cancelled
- `proposer` (string): Wallet address of proposer
- `startBlock` (bigint): Voting start block
- `endBlock` (bigint): Voting end block
- `votes` (relation): One-to-many relationship with Vote entities
- `createdAt`, `updatedAt`: Timestamps

#### Vote Entity

Tracks individual votes on proposals.

**Fields:**

- `id` (UUID): Primary key
- `walletAddress` (string): Voter's wallet address
- `direction` (enum): FOR or AGAINST
- `weight` (decimal 18,8): Voting power/weight
- `proposal` (relation): Many-to-one relationship with GovernanceProposal
- `proposalId` (string): Foreign key to proposal
- `createdAt`: Timestamp

**Constraints:**

- Unique index on `(walletAddress, proposal)` - one vote per wallet per proposal

### Event Syncing

The `GovernanceIndexerService` listens to on-chain events and syncs them to the database.

#### ProposalCreated Event

```solidity
event ProposalCreated(
  uint256 indexed proposalId,
  address indexed proposer,
  string description,
  uint256 startBlock,
  uint256 endBlock
)
```

**Handler Behavior:**

1. Parses on-chain proposal ID
2. Checks if proposal already exists (by `onChainId`)
3. Extracts title from description (first line or first 100 chars)
4. Creates skeletal `GovernanceProposal` row with status=Active
5. Logs successful indexing

#### VoteCast Event

```solidity
event VoteCast(
  address indexed voter,
  uint256 indexed proposalId,
  uint8 support,
  uint256 weight
)
```

**Handler Behavior:**

1. Maps support value: `1 = FOR`, `0 = AGAINST`
2. Finds corresponding `GovernanceProposal` by `onChainId`
3. Upserts `Vote` record (updates if wallet already voted)
4. Links vote to wallet address and proposal
5. Stores voting weight as decimal
6. Logs vote indexing

### Status Updates

The indexer includes a helper method `updateProposalStatus()` that:

- Calculates vote tallies (FOR vs AGAINST)
- Updates proposal status from Active → Passed/Failed
- Uses simple majority logic (>50% FOR = Passed)
- Can be called periodically or after significant vote events

## Configuration

Set these environment variables:

```env
RPC_URL=https://your-rpc-endpoint.com
DAO_CONTRACT_ADDRESS=0x...
```

If not set, the indexer will log a warning and not start.

## Usage

### Starting the Indexer

The indexer starts automatically on module initialization when environment variables are configured.

### Manual Status Updates

```typescript
await governanceIndexerService.updateProposalStatus(proposalId);
```

## Database Schema

```sql
-- Proposals table
CREATE TABLE governance_proposals (
  id UUID PRIMARY KEY,
  on_chain_id INTEGER UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  proposer VARCHAR(255),
  start_block BIGINT,
  end_block BIGINT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY,
  wallet_address VARCHAR(255) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  weight DECIMAL(18,8) NOT NULL,
  proposal_id UUID NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(wallet_address, proposal_id)
);

CREATE INDEX idx_votes_wallet ON votes(wallet_address);
CREATE INDEX idx_votes_proposal ON votes(proposal_id);
```

## API Endpoints

The governance module exposes REST endpoints through:

- `GovernanceController`: General governance operations
- `GovernanceProposalsController`: Proposal-specific operations

See controller files for detailed endpoint documentation.

## Future Enhancements

- Support for abstain votes (support=2)
- Quorum threshold checking
- Time-based voting period validation
- Proposal execution tracking
- Delegation tracking
- Vote weight calculation from token balances
- Historical vote snapshots
