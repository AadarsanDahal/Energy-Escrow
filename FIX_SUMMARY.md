# Fix for "Account not found: trade" Error

## Root Cause
The admin was trying to settle trades using an incorrect vault address (trade account address instead of the actual vault/escrow account address). Additionally, there was no escrow deposit step before settlement.

## Changes Made

### 1. **StoredTrade Type** - Added vault tracking
```tsx
type StoredTrade = TradeView & {
  tradeAddress: string
  vaultAddress?: string  // Now tracks the vault account
  createdAt: number
  createdByWallet: string
}
```

### 2. **Buyer Flow** - Two-step process
**Step 1:** Create Trade (unchanged)
- Buyer specifies seller, energy (kWh), price, duration (mins)
- Trade account created on-chain

**Step 2:** Deposit Escrow (NEW)
- After trade creation, buyer must deposit escrow
- Creates vault account and stores vault address in localStorage
- Marks trade state as "Funded"

### 3. **API Updates**
- Added `depositEscrow` import to App.tsx
- New handler: `handleBuyerDeposit()`
- Updated `handleAdminSettle()` with proper validation

### 4. **Admin Settlement - Enhanced Validation**
Before attempting settlement, admin now verifies:
- ✅ Trade exists
- ✅ Vault address exists (buyer must have deposited)
- ✅ Escrow amount > 0
- ✅ Trade state is "Funded"
- ✅ Uses correct vault address for settlement

### 5. **BuyerPanel Component** - Added deposit UI
After trade creation, buyers see:
- Trade address confirmation
- "💰 Deposit Escrow" button
- Progress indicator during deposit

## User Flow (Fixed)

```
BUYER:
1. Connect wallet, select Buyer role
2. Enter seller address, energy (2 kWh), price (120000000 wei/kWh), duration (15 mins)
3. Click "Create Trade" → Get trade address
4. Click "Deposit Escrow" → Vault created, funds locked
5. Trade marked as "Funded" in admin's view

ADMIN:
1. Connect wallet, select Admin role
2. See list of "Funded" trades
3. Click trade → Enter delivered kWh
4. Click "Confirm Settlement" → Settlement executed with correct vault
5. Funds distributed: seller paid, buyer refunded
```

## Error Prevention
- No more "Account not found" because vault address is now properly tracked
- Invalid settlement attempts blocked with clear error messages
- Escrow deposit requirement enforced before settlement

## Files Updated
- `src/App.tsx` - Added deposit handler, improved settlement validation
- `src/components/BuyerPanel.tsx` - Added deposit UI component
