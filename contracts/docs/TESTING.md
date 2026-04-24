# Testing Nestera Smart Contracts

## 1. Unit Testing Approach

Uses **soroban_sdk::testutils** for local Soroban environment simulation – no real Stellar network needed.

**Key Benefits:**
- Fast (~ms per test).
- Deterministic ledger timestamps.
- Mock authorization (`mock_all_auths`).
- Direct storage inspection.

**Run All Tests:**
```bash
cd contracts
cargo test
```

**Specific Test/File/Verbose:**
```bash
cargo test anti_farming -- --nocapture  # Show prints
cargo test admin_tests --test-threads=1
RUST_LOG=debug cargo test  # Logs
```

## 2. Mocking Users & Accounts

Generate addresses & mock auths:

```rust
// Common pattern (anti_farming_test.rs)
fn create_test_env() -> (Env, Client, Admin, User) {
    let env = Env::default();
    env.mock_all_auths();  // Simulates auth for all calls

    let contract_id = env.register(NesteraContract, ());    
    let client = NesteraContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let admin_pk = BytesN::from_array(&env, &[0u8; 32]);
    client.initialize(&admin, &admin_pk);

    let user = Address::generate(&env);  // Mock user account
    client.init_user(&user);

    (env, client, admin, user)
}
```

- `Address::generate(&env)`: Fresh mock address.
- `env.mock_all_auths()`: Bypasses real sigs (testing only).
- Client proxies calls to registered contract.

## 3. Running Tests

From `contracts/`:

| Command | Purpose |
|---------|---------|
| `cargo test` | All unit/integration |
| `cargo test -- --nocapture` | Show assert messages/prints |
| `cargo test <name>` | Filter (e.g., `ranking_test`) |
| `cargo test --features testutils` | If utils gated |

**Example Output:**
```
running 42 tests
test tests::anti_farming_test::test_micro_deposit_spam_no_rewards ... ok
test src::rates_test::test_lock_rate_lookup ... ok

test result: ok. 42 passed; 0 failed
```

## 4. Edge Case Testing Strategies

**Authorization Failures:**
```rust
// Expect Err
match client.try_pause(&non_admin) {
    Err(Ok(e)) => assert_eq!(e, SavingsError::Unauthorized),
    _ => panic!("Expected Unauthorized"),
}
```

**Boundary Values:**
- Amounts: 0, 1, i128::MAX, negative→Err(InvalidAmount).
- Durations: 0→Err(InvalidDuration), extreme→overflow.

**Paused State:**
```rust
client.pause(&admin);
assert!(client.try_deposit_flexi(&user, &100).is_err());
```

**Overflow/Underflow:**
- Large deposits → checked_add fails.
- Fees: 10000bps (100%) edge.

**Reward Anti-Farming:**
- Micro-deposits < min → no points.
- Daily caps, cooldowns.

**Common Patterns:**
- `setup()` helpers for consistent state.
- Assert post-conditions: balances, TTL, events.
- `env.ledger().timestamp()` advance for maturity/streaks.

**Test Modules:**
- `*_tests.rs`: Inline unit tests.
- `tests/`: Integration/anti-abuse.

**Fuzzing:** Add `cargo fuzz` for amounts/durations (future).

Developers: Always test unauth/paused/zero/overflow + happy path!

Links: [SECURITY.md](SECURITY.md), [STORAGE.md](SOROBAN_STORAGE.md).

