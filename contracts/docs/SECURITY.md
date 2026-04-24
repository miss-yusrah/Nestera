# Nestera Contract Security

## 1. Authorization Mechanisms

### User Authorization (`require_auth`)
All user fund mutations require caller authentication:

```rust
// lib.rs & modules
pub fn deposit_flexi(env: Env, user: Address, amount: i128) -> Result<(), SavingsError> {
    ensure_not_paused(&env)?;
    user.require_auth();  // Caller MUST be 'user'
    // ...
}
```

- **Usage:** Before any balance change (deposit/withdraw/create plan).
- **Enforcement:** Soroban SDK – panics if unauthenticated.

### Admin Authorization
Config changes (fees, pause) verify stored admin:

```rust
// config.rs
fn require_admin(env: &Env, caller: &Address) -> Result<(), SavingsError> {
    let stored_admin = env.storage().instance().get(&DataKey::Admin)
        .ok_or(SavingsError::Unauthorized)?;
    if stored_admin != *caller {
        return Err(SavingsError::Unauthorized);
    }
    caller.require_auth();
    Ok(())
}
```

### Signature Verification (Mint)
Admin signs off-chain `MintPayload`; on-chain verify:

```rust
// lib.rs
pub fn verify_signature(env: Env, payload: MintPayload, signature: BytesN<64>) -> bool {
    // Timestamp expiry check
    // Ed25519 verify against stored AdminPublicKey
    env.crypto().ed25519_verify(admin_pk, payload_xdr, signature)
}
```

## 2. Access Control Logic

| Role | Permissions | Enforcement |
|------|-------------|-------------|
| **User** | Own plans (deposit/withdraw/break) | `user.require_auth()` + owner==caller check |
| **Admin** | Config (fees/rates/pause) | `require_admin` + instance Admin |
| **Governance** | Pause/execute proposals | `validate_admin_or_governance` (lifetime deposits voting power) |
| **Paused** | Blocks all writes | `ensure_not_paused()?` at entrypoints |

- **Plan Ownership:** `if plan.owner != user { Err(Unauthorized) }`
- **Global Pause:** Persistent `Paused` flag; extends TTL.

## 3. Risks & Mitigations

| Risk | Impact | Mitigation | Code Reference |
|------|--------|------------|----------------|
| **Reentrancy** | Fund theft | Check-Effects-Interact pattern | lib.rs all functions |
| **Arithmetic Overflow** | Invalid balances | `checked_add/sub/mul`; invariants | `calculate_fee`, deposits |
| **Admin Abuse** | Fee manipulation | Governance voting; pause reversible | governance.rs, config.rs |
| **Signature Replay/Expiry** | Unauthorized mint | Timestamp + expiry_duration check | verify_signature |
| **Front-running** | MEV on rates | Transparent deterministic logic | rates.rs |
| **Storage DoS** | Data loss | Proactive TTL extension (180d) | ttl.rs |
| **Uninit Access** | Panic/DoS | `has()` checks; defaults | lib.rs init_user/get_user |

**Emergency Controls:**
- **Pause:** Blocks writes (admin/governance); read-only continues.
- **Upgrade:** WASM upgrade (admin auth).

## 4. Security Assumptions

1. **Admin Trust:** Admin manages signatures/config; mitigate via governance.
2. **Stellar Properties:** Finality, no reorgs, atomic tx.
3. **Soroban Guarantees:** Auth isolation, storage atomicity.
4. **Client Integrity:** Freighter/other wallets secure private keys.

**Audits:** Planned post-MVP. Events for off-chain monitoring.

**Testing:** 100%+ coverage; fuzzing invariants; pause/unauth tests.

---

See [CONTRIBUTING.md](../CONTRIBUTING.md) for dev standards.

