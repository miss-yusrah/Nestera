# Soroban Storage Design in Nestera Contracts

## 1. Overview of Storage Architecture

Nestera uses **Soroban's three storage types** strategically:

| Storage Type | Purpose | Examples | TTL Management |
|--------------|---------|----------|----------------|
| **Instance** | Contract-global configuration (immutable or admin-only) | Admin address, fees (ProtocolFeeBps), rates (FlexiRate), pause flag | Extended via `extend_instance_ttl()` to 180 days |
| **Persistent** | User-specific data & plans (mutable) | User balances, SavingsPlan/LockSave/GoalSave/GroupSave, reward ledgers | **Active TTL extension** on every read/write (180 days active plans, 30 days archived) |
| **Temporary** | **Not used** – All data designed for persistence | N/A | N/A |

**Design Rationale:**
- **Instance**: Low-cost for rarely-changing config (~permanent).
- **Persistent + TTL**: Balances cost/longevity for active savings data. TTL extended proactively to prevent data loss.
- No temporary: Ensures auditability/immutability for financial data.

## 2. Persistent vs Instance Storage (Temporary Absence)

### Instance Storage (Global Config)
```rust
// lib.rs: Initialization
env.storage().instance().set(&DataKey::Admin, &admin);
env.storage().instance().set(&DataKey::Initialized, &true);
env.storage().instance().set(&DataKey::PlatformFee, &bps);

// TTL extension
ttl::extend_instance_ttl(&env);  // ~180 days
```

**Keys** (DataKey enum):
- `Admin`, `FeeRecipient`, `EarlyBreakFeeBps`, `ProtocolFeeBps`
- Rates: `FlexiRate`, `GoalRate`, `LockRate(duration)`

### Persistent Storage (User Data)
All user-facing data stored here with **TTL automation** in `ttl.rs`:
```rust
// storage_types.rs: DataKey examples
User(Address)                    // User {total_balance, savings_count}
SavingsPlan(Address, u64)        // Generic plan wrapper
GroupSave(u64), LockSave(u64)    // Specific plan types
UserLockSaves(Address)           // Vec of user's plan IDs
NextLockId                       // Auto-increment counter
```

**No Temporary Storage**: All operations persist changes immediately. Temporary would be for short-lived computations (e.g., transaction-local maps), but Nestera prioritizes state durability.

## 3. Key Data Structures

### User Savings (Core)
```rust
// storage_types.rs
pub struct User {
    total_balance: i128,     // Aggregated across all plans
    savings_count: u32,      // Number of active plans
}

pub struct SavingsPlan {     // Wrapper for all plans
    plan_id: u64,
    plan_type: PlanType,     // Enum: Flexi | Lock(duration) | Goal | Group
    balance: i128,
    start_time: u64,
    interest_rate: u32,      // e.g., 500 = 5%
    is_completed: bool,
    is_withdrawn: bool,
}
```

**Plan Types**:
| Type | Structure | Use Case |
|------|-----------|----------|
| Flexi | `SavingsPlan` | Anytime deposit/withdraw |
| Lock | `LockSave {maturity_time}` | Fixed-term, higher yield |
| Goal | `GoalSave {target_amount}` | Target-based (e.g., vacation) |
| Group/Pools | `GroupSave {target_amount, member_count, GroupMembers}` | Collective savings pools |
| AutoSave | `AutoSave {interval_seconds, next_execution}` | Recurring deposits |

### Pools (Group Saves)
```rust
pub struct GroupSave {
    target_amount: i128,     // Collective goal
    current_amount: i128,
    member_count: u32,
    GroupMembers(group_id): Vec<Address>
    GroupMemberContribution(group_id, user): i128
}
```
- **Pools** = GroupSave: Multi-user collective savings towards shared target.

### Rewards System
Separate namespace (`RewardsDataKey`):
```rust
// rewards/storage_types.rs
pub struct UserRewards {
    total_points: u128,          // Rankable/spendable
    lifetime_deposited: i128,    // Voting power base
    current_streak: u32,         // Daily consistency bonus
}

pub struct RewardsConfig {      // Instance-like config
    points_per_token: u32,
    enabled: bool,
    // Anti-farming: min_deposit, cooldowns
}
```

## 4. How State Changes Over Time

**Atomic Update Pattern** (lib.rs: create_savings_plan):
```rust
// 1. CHECKS: paused? valid amount?
ensure_not_paused(&env)?;

// 2. EFFECTS: Read -> Mutate -> Write
let mut user_data = get_user(...)?.unwrap_or(User::default());
user_data.total_balance += initial_deposit;  // checked_add
env.storage().persistent().set(&DataKey::User(user), &user_data);

let new_plan = SavingsPlan { ... };
env.storage().persistent().set(&DataKey::SavingsPlan(user, plan_id), &new_plan);

// 3. TTL Extension
ttl::extend_user_ttl(&env, &user);
ttl::extend_plan_ttl(&env, &plan_key);

// 4. INTERACTIONS: Events
env.events().publish((symbol_short!("create_plan"),), amount);
```

**Lifecycle Examples**:
- **Deposit**: `balance += amount`, `last_deposit = now`, extend TTL.
- **Withdraw**: `balance -= amount` (fees applied), `is_withdrawn=true` (archived TTL).
- **Complete Goal/Pool**: `is_completed=true`, shorter TTL (30d).
- **Rewards**: `total_points += calc()` on deposit, `streak++` daily.

**TTL Automation** (ttl.rs):
- **Active plans**: Extend to 180 days on every access.
- **Archived**: 30 days (completed/withdrawn).
- **Config**: 180 days fixed.

**Garbage Collection**: Expired TTL data auto-deleted by Soroban, preventing bloat.

## 5. Best Practices & Design Decisions

✅ **Proactive TTL**: Prevents unexpected data loss.
✅ **Separate Namespaces**: User data isolated per-address.
✅ **Check-Effects-Interact**: Reentrancy-safe.
✅ **Invariant Checks**: `invariants::assert_non_negative`, fee bounds.
✅ **Gas Optimization**: TTL batch-extended, read-once patterns.

**For New Contributors**:
1. Always call `ensure_not_paused()` first.
2. Use `checked_add/sub` for i128 math.
3. Extend TTL after every storage write.
4. Emit events for all mutations.

**Monitoring**: Watch `LOW_THRESHOLD` (~30d) – triggers extensions before expiry.

---

*Last Updated: From code analysis of storage_types.rs, lib.rs, ttl.rs (2024)*

