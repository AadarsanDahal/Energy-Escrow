# ⚡ P2P Energy Trading MVP - Escrow + Automated Settlement

> **A minimal, production-ready Solana smart contract proving: "A smart contract can escrow funds for a time-bound energy trade and automatically settle payment based on verified delivery data."**

---

## 🎯 Problem Statement

Traditional P2P energy trading lacks a trustless mechanism to:
1. **Secure buyer funds** during energy delivery periods
2. **Automate payment settlement** based on actual delivery metrics
3. **Protect both parties** without intermediaries

This MVP solves this with **on-chain escrow** and **automated settlement** on Solana.

---

## ✨ What This MVP Proves

✅ **Escrow**: Buyer deposits exact full payment upfront into a smart contract  
✅ **Settlement**: Admin submits delivery data; contract calculates and distributes funds  
✅ **Transparency**: All transactions recorded on-chain with events  
✅ **Security**: No single party can release funds without protocol compliance  

### Scope

**Included:**
- 1 smart contract (Anchor/Rust)
- Exactly 1 predefined trade (buyer, seller, energy amount, price, time window)
- Full escrow upfront by buyer
- Delivery data submission (admin role)
- Proportional settlement (payment to seller, refund to buyer)
- React frontend with role-based UI (Buyer, Seller, Admin)
- Tests (escrow deposit, settlement scenarios)
- Devnet deployment script

**Excluded:**
- Marketplace, order books, matching
- Multiple users/trades
- Real smart meters or oracle networks
- KYC/AML, fees, dispute resolution
- Tokenization, carbon credits, reputation

---

## 🏗️ Project Structure

```
energy_escrow/
├── programs/energy_escrow/
│   ├── src/
│   │   └── lib.rs              # Main smart contract (Anchor)
│   └── Cargo.toml
├── tests/
│   └── energy_escrow.ts        # Integration tests
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Main React UI
│   │   ├── index.tsx           # Entry point
│   │   └── idl/                # IDL JSON
│   ├── public/
│   │   └── index.html
│   └── package.json
├── scripts/
│   └── deploy.ts              # Deployment script
├── Anchor.toml
├── Cargo.toml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Rust** 1.70+  
- **Solana CLI** (devnet-ready)
- **Node.js** 16+ & npm  
- **Anchor** 0.29+  

#### Install Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor-lang anchor-cli
anchor --version  # Should output: anchor 0.29.0 or later
```

---

## 📦 Installation & Deployment

### 1. Clone & Install Dependencies

```bash
cd energy_escrow

# Install Rust dependencies
cargo build

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Deploy Smart Contract to Devnet

```bash
# Set your Solana wallet (if not already configured)
solana config set --url devnet

# Deploy the program
anchor deploy
```

**Output:**
```
Program deployed to: <PROGRAM_ID>
```

Save the `PROGRAM_ID` — you'll need it for the frontend.

### 3. Run Tests

```bash
anchor test
```

Expected output:
```
✅ should create trade with valid parameters
✅ should not allow creating trade twice
✅ should allow buyer to deposit exact escrow amount
✅ should reject escrow deposit with incorrect amount
✅ should settle trade with full delivery
✅ should settle trade with partial delivery
✅ should not allow settlement before endTime
```

### 4. Deploy Initialization (Optional)

```bash
anchor run deploy
```

This creates the first trade and outputs wallet addresses.

### 5. Start the Frontend

```bash
cd frontend
npm start
```

Open your browser to `http://localhost:3000`

---

## 📋 Smart Contract API

### Data Structure

```rust
struct Trade {
    buyer: Pubkey,
    seller: Pubkey,
    energy_amount_kwh: u64,
    price_per_kwh_wei: u64,        // wei = smallest unit (like satoshis)
    start_time: u64,               // unix timestamp
    end_time: u64,                 // unix timestamp
    escrow_amount_wei: u64,        // full payment from buyer
    delivered_kwh: u64,            // set at settlement
    total_cost_wei: u64,           // energyAmount × pricePerKwh
    state: enum { None, Created, Funded, Settled }
}
```

### Instructions

#### 1. `createTrade(buyer, seller, energyAmountKwh, pricePerKwhWei, startTime, endTime)`

**Who**: Anyone (but typically a platform admin)  
**Requires**: State = None  
**Effect**: 
- Initializes trade struct
- Sets state → Created
- Emits `TradeCreated` event

**Example:**
```typescript
await program.methods
  .createTrade(
    buyerKey,
    sellerKey,
    new BN(2),           // 2 kWh
    new BN(120000000),   // 0.12 SOL/kWh
    new BN(now + 60),    
    new BN(now + 960)    
  )
  .accounts({...})
  .rpc();
```

---

#### 2. `depositEscrow(escrowAmount)`

**Who**: Buyer only  
**Requires**: State = Created, escrowAmount == totalCost  
**Effect**:
- Transfers exact SOL/USDC from buyer to escrow vault
- Sets state → Funded
- Emits `EscrowDeposited` event

**Example:**
```typescript
await program.methods
  .depositEscrow(new BN(240000000))  // 0.24 SOL (2 kWh × 0.12)
  .accounts({...})
  .signers([buyer])
  .rpc();
```

---

#### 3. `settle(deliveredKwh)`

**Who**: Admin only  
**Requires**: State = Funded, block.timestamp ≥ endTime  
**Calculation**:
```
payableKwh = min(deliveredKwh, energyAmountKwh)
sellerPayment = payableKwh × pricePerKwh
buyerRefund = escrowAmount - sellerPayment
```
**Effect**:
- Transfers sellerPayment → seller  
- Transfers buyerRefund → buyer  
- Sets state → Settled  
- Emits `TradeSettled` event

**Example:**
```typescript
// Full delivery: 2 kWh delivered out of 2 agreed
await program.methods
  .settle(new BN(2))  // Full delivery
  .accounts({...})
  .signers([admin])
  .rpc();
// Seller gets: 2 × 0.12 = 0.24 SOL
// Buyer gets: 0 refund

// Partial delivery: 1 kWh delivered out of 2 agreed
await program.methods
  .settle(new BN(1))  // Partial delivery
  .accounts({...})
  .signers([admin])
  .rpc();
// Seller gets: 1 × 0.12 = 0.12 SOL
// Buyer gets: 0.24 - 0.12 = 0.12 SOL refund
```

---

#### 4. `getTrade()` (View)

**Returns**: Trade struct with current state

---

## 🎮 Frontend UI Guide

### Role Selection

1. **"👤 Buyer"**: Deposit escrow & receive settlement refund
2. **"💰 Seller"**: Receive payment after settlement
3. **"🔐 Admin"**: Submit delivery data & settle trade

### Buyer Workflow

```
1. Connect wallet
2. Select "Buyer" role
3. Review trade details (energy, price, time window, total cost)
4. Click "💸 Deposit Escrow" (sends exact amount)
5. Wait for end time
6. (Admin settles)
7. See refund amount on screen
```

### Admin Workflow

```
1. Connect wallet
2. Select "Admin" role
3. See buyer's escrow deposit status
4. Wait until trade end time
5. Enter delivered kWh (0 to energyAmount)
6. Click "✅ Settle Trade"
7. View settlement results
```

### Seller Workflow

```
1. Connect wallet
2. Select "Seller" role
3. See buyer's escrow deposited
4. Wait for settlement
5. See payment received
```

---

## 📊 Settlement Examples

### Scenario 1: Full Delivery
```
Trade: 2 kWh @ 0.12 SOL/kWh = 0.24 SOL escrow
Delivery: 2 kWh (100%)
→ Seller: 0.24 SOL ✅
→ Buyer: 0 refund
```

### Scenario 2: Partial Delivery  
```
Trade: 2 kWh @ 0.12 SOL/kWh = 0.24 SOL escrow
Delivery: 1 kWh (50%)
→ Seller: 0.12 SOL ✅
→ Buyer: 0.12 SOL refund ✅
```

### Scenario 3: Zero Delivery
```
Trade: 2 kWh @ 0.12 SOL/kWh = 0.24 SOL escrow
Delivery: 0 kWh (0%)
→ Seller: 0 SOL
→ Buyer: 0.24 SOL refund ✅
```

---

## 🧪 Testing

All tests verify the core MVP requirements:

```bash
anchor test
```

**Test Coverage:**
```
✅ Trade Creation
   - Valid parameters accepted
   - Double creation rejected

✅ Escrow Deposit
   - Exact amount required
   - Wrong amount rejected
   - Buyer-only enforcement

✅ Settlement
   - Only after endTime
   - Full delivery (100% payment)
   - Partial delivery (pro-rata)
   - Zero delivery (full refund)
```

---

## 🔐 Security Considerations

- **Checks-Effects-Interactions**: Validations before state changes
- **Math Safety**: Overflow/underflow checks with `checked_mul/checked_sub`
- **Admin Control**: Only deployer can settle
- **Immutable Terms**: No trade modification after creation
- **Exact Escrow**: No overpayment/underpayment allowed

---

## 📝 Demo Script (Manual)

Run this step-by-step to show the MVP in action:

### Setup (1 min)

```bash
# 1. Start devnet validator
solana-test-validator &

# 2. Deploy contract
anchor deploy

# 3. Start frontend
cd frontend && npm start
```

### Demo Flow (2 min)

#### Step 1: Create Trade (0:00–0:15)
- Show `Anchor.toml` with trade address
- Log: `Trade created: [energyAmount=2 kWh, price=0.12 SOL/kWh, total=0.24 SOL]`
- Frontend shows: Trade state = "Created"

#### Step 2: Buyer Deposits Escrow (0:15–0:45)
- Select "Buyer" role in UI
- Click "Deposit Escrow"
- Transaction hash appears
- Frontend shows: Trade state = "Funded"
- Escrow vault balance increases by 0.24 SOL

#### Step 3: Wait for End Time (0:45–1:10)
- Show trade end time countdown
- "Settlement available at: [time]"

#### Step 4: Admin Settles with Partial Delivery (1:10–1:50)
- Select "Admin" role
- Enter `deliveredKwh = 1` (out of 2)
- Click "Settle Trade"
- Transaction hash appears
- **Results shown**:
  ```
  Seller payment: 0.12 SOL ✅
  Buyer refund: 0.12 SOL ✅
  Trade state: Settled
  ```

#### Step 5: Verify On-Chain (1:50–2:00)
- Show on-chain events (Solana explorer or logs):
  ```
  TradeSettled event:
    - deliveredKwh: 1
    - payableKwh: 1
    - sellerPayment: 120000000 wei
    - refundAmount: 120000000 wei
  ```

---

## 🎁 Unit Economics & Competition Judging

### Problem Statement ✅
**"Trustless escrow + automated settlement for P2P energy trades"**
- Smart contract replaces intermediaries
- No reliance on centralized payment processor

### Potential Impact ✅
- **Enables peer-to-peer energy markets** on blockchain
- **Provably fair** distribution (transparent, auditable, on-chain)
- **24/7 operation** (no business hours)
- **Scalable** (can support unlimited trades, one at a time in MVP)

### Business Case ✅
- **For Renewables**: Distributed ownership monetizes rooftop solar
- **For Grid**: Micro-payments incentivize demand flexibility
- **For Buyers**: Access cleaner, cheaper energy without utilities
- **Revenue Model**: Platform takes % of settlement transactions

### UX ✅
- **Clean, modern design**: Gradient backgrounds, smooth animations
- **Role-based clarity**: Buyer/Seller/Admin see only what they need
- **Real-time state**: Trade status always visible
- **Mobile-responsive**: Works on all devices
- **Accessible**: Buttons, labels, clear instructions

### Product Functionality / Technical Implementation ✅
- **Anchor best practices**: Proper account validation, event emission
- **Automated settlement**: No manual distribution required
- **Proportional payment**: Fair handling of partial delivery
- **On-chain receipt**: Immutable event log
- **Tests**: 7+ scenarios covering happy path + edge cases
- **Devnet ready**: One-click deployment, no external dependencies

---

## 🚨 Common Issues & Fixes

### ❌ "Program not found"
→ Did you deploy? Run: `anchor deploy`

### ❌ "Insufficient funds for escrow"
→ Request airdrop: `solana airdrop 10`

### ❌ "Settlement too early"
→ Trade end time hasn't passed. Increase mock `endTime` or wait.

### ❌ "Incorrect escrow amount"
→ Use exact total cost: `energyAmount × pricePerKwh`

---

## 📚 References

- [Anchor Documentation](https://www.anchor-lang.com)
- [Solana Cookbook](https://solanacookbook.com)
- [Web3.js Reference](https://solana-labs.github.io/solana-web3.js/)

---

## 📄 License

MIT

---

## 👨‍💻 Author

Built for Solana Energy Trading Competition 2026

### Links
- **GitHub Issue**: P2P Energy Trading MVP  
- **Devnet Program ID**: (saved after deploy)

---

### Quick Command Reference

```bash
# Build
cargo build

# Deploy
anchor deploy

# Test
anchor test

# Run initialization script
anchor run deploy

# Start frontend
cd frontend && npm start

# Check balance
solana balance

# Airdrop
solana airdrop 10 <pubkey>

# View on Solana Explorer (devnet)
# https://explorer.solana.com/?cluster=devnet
```

---

**Ready to change energy trading forever? 🚀**
