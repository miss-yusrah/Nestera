-- Governance Proposals Table
-- Stores metadata for DAO proposals with human-readable information

CREATE TABLE IF NOT EXISTS governance_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  on_chain_id INTEGER UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Governance', 'Treasury', 'Technical', 'Community')),
  status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Passed', 'Failed', 'Cancelled')),
  proposer VARCHAR(255),
  start_block BIGINT,
  end_block BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes Table
-- Tracks individual votes on proposals with wallet address and voting power

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(255) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('FOR', 'AGAINST')),
  weight DECIMAL(18,8) NOT NULL CHECK (weight >= 0),
  proposal_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key constraint
  CONSTRAINT fk_vote_proposal 
    FOREIGN KEY (proposal_id) 
    REFERENCES governance_proposals(id) 
    ON DELETE CASCADE,
  
  -- Unique constraint: one vote per wallet per proposal
  CONSTRAINT unique_wallet_proposal 
    UNIQUE (wallet_address, proposal_id)
);

-- Indexes for performance

-- Index on on_chain_id for fast lookups during event syncing
CREATE INDEX IF NOT EXISTS idx_proposals_on_chain_id 
  ON governance_proposals(on_chain_id);

-- Index on proposal status for filtering active/completed proposals
CREATE INDEX IF NOT EXISTS idx_proposals_status 
  ON governance_proposals(status);

-- Index on proposal category for filtering by type
CREATE INDEX IF NOT EXISTS idx_proposals_category 
  ON governance_proposals(category);

-- Index on wallet_address for user vote history
CREATE INDEX IF NOT EXISTS idx_votes_wallet_address 
  ON votes(wallet_address);

-- Index on proposal_id for aggregating votes per proposal
CREATE INDEX IF NOT EXISTS idx_votes_proposal_id 
  ON votes(proposal_id);

-- Composite index for wallet + proposal lookups
CREATE INDEX IF NOT EXISTS idx_votes_wallet_proposal 
  ON votes(wallet_address, proposal_id);

-- Comments for documentation

COMMENT ON TABLE governance_proposals IS 'Stores DAO proposal metadata synced from on-chain events';
COMMENT ON COLUMN governance_proposals.on_chain_id IS 'Unique proposal ID from the DAO smart contract';
COMMENT ON COLUMN governance_proposals.title IS 'Human-readable proposal title extracted from description';
COMMENT ON COLUMN governance_proposals.description IS 'Full proposal description from on-chain data';

COMMENT ON TABLE votes IS 'Individual votes cast on governance proposals';
COMMENT ON COLUMN votes.direction IS 'Vote direction: FOR (support=1) or AGAINST (support=0)';
COMMENT ON COLUMN votes.weight IS 'Voting power/weight from token holdings or delegation';
COMMENT ON COLUMN votes.wallet_address IS 'Ethereum wallet address of the voter';
