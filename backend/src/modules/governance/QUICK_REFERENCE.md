# Governance System Quick Reference

## Entity Relationships

```typescript
GovernanceProposal (1) ←→ (N) Vote
```

## Creating a Proposal

```typescript
const proposal = proposalRepo.create({
  onChainId: 1,
  title: 'Increase Treasury Allocation',
  description: 'This proposal aims to increase...',
  category: ProposalCategory.TREASURY,
  status: ProposalStatus.ACTIVE,
  proposer: '0x1234...',
  startBlock: 1000000,
  endBlock: 1100000,
});
await proposalRepo.save(proposal);
```

## Casting a Vote

```typescript
const vote = voteRepo.create({
  walletAddress: '0xabcd...',
  direction: VoteDirection.FOR, // or VoteDirection.AGAINST
  weight: 150.5,
  proposal: proposal,
  proposalId: proposal.id,
});
await voteRepo.save(vote);
```

## Event Mapping

### ProposalCreated Event

```solidity
event ProposalCreated(
  uint256 indexed proposalId,    // → onChainId
  address indexed proposer,       // → proposer
  string description,             // → description (+ extract title)
  uint256 startBlock,             // → startBlock
  uint256 endBlock                // → endBlock
)
```

### VoteCast Event

```solidity
event VoteCast(
  address indexed voter,          // → walletAddress
  uint256 indexed proposalId,     // → lookup proposal by onChainId
  uint8 support,                  // → direction (1=FOR, 0=AGAINST)
  uint256 weight                  // → weight
)
```

## Vote Direction Mapping

| On-Chain Value | Database Enum           | Description   |
| -------------- | ----------------------- | ------------- |
| `support = 1`  | `VoteDirection.FOR`     | Vote in favor |
| `support = 0`  | `VoteDirection.AGAINST` | Vote against  |

## Proposal Status Flow

```
ACTIVE → PASSED   (when FOR votes > 50%)
       → FAILED   (when FOR votes < 50%)
       → CANCELLED (manual cancellation)
```

## Querying Examples

### Get Proposal with Votes

```typescript
const proposal = await proposalRepo.findOne({
  where: { onChainId: 1 },
  relations: ['votes'],
});
```

### Get User's Votes

```typescript
const userVotes = await voteRepo.find({
  where: { walletAddress: '0x1234...' },
  relations: ['proposal'],
});
```

### Calculate Vote Tallies

```typescript
const proposal = await proposalRepo.findOne({
  where: { id: proposalId },
  relations: ['votes'],
});

let forVotes = 0;
let againstVotes = 0;

proposal.votes.forEach((vote) => {
  if (vote.direction === VoteDirection.FOR) {
    forVotes += Number(vote.weight);
  } else {
    againstVotes += Number(vote.weight);
  }
});

const totalVotes = forVotes + againstVotes;
const forPercentage = (forVotes / totalVotes) * 100;
```

## Environment Variables

```env
# Required for indexer to start
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
DAO_CONTRACT_ADDRESS=0x1234567890abcdef...
```

## Common Operations

### Update Proposal Status

```typescript
await governanceIndexerService.updateProposalStatus(proposalId);
```

### Check if Wallet Voted

```typescript
const existingVote = await voteRepo.findOne({
  where: {
    walletAddress: '0x1234...',
    proposalId: proposalId,
  },
});
```

### Get Active Proposals

```typescript
const activeProposals = await proposalRepo.find({
  where: { status: ProposalStatus.ACTIVE },
  relations: ['votes'],
});
```

## Database Constraints

- `onChainId` must be unique across all proposals
- One vote per `(walletAddress, proposalId)` combination
- Votes cascade delete when proposal is deleted
- Vote weight must be non-negative decimal

## Testing

Run entity tests:

```bash
npm test governance-proposal.entity.spec
npm test vote.entity.spec
```

Run service tests:

```bash
npm test governance-indexer.service.spec
```

## Troubleshooting

### Indexer Not Starting

- Check `RPC_URL` and `DAO_CONTRACT_ADDRESS` are set
- Verify RPC endpoint is accessible
- Check logs for initialization warnings

### Duplicate Vote Error

- Unique constraint violation: wallet already voted on this proposal
- Use upsert logic to update existing vote instead

### Proposal Not Found

- Ensure `ProposalCreated` event was indexed first
- Check `onChainId` matches between event and database

## API Endpoints

See `GovernanceController` and `GovernanceProposalsController` for available REST endpoints.
