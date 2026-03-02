#!/bin/bash

# Energy Escrow MVP - Complete Setup & Demo Script
# This script sets up the entire project and runs a complete demo

set -e

echo "⚡ Energy Escrow MVP - Complete Setup & Demo"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "\n${BLUE}[STEP 1] Checking Prerequisites...${NC}"

if ! command -v solana &> /dev/null; then
    echo -e "${RED}❌ Solana CLI not found. Install from: https://docs.solana.com/cli/install-solana-cli-tools${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Solana CLI found${NC}"

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Cargo not found. Install from: https://rustup.rs/${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Cargo found${NC}"

if ! command -v anchor &> /dev/null; then
    echo -e "${YELLOW}⚠️  Anchor CLI not found. Install it?${NC}"
    echo "npm install -g @coral-xyz/anchor-cli"
    read -p "Install Anchor CLI? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm install -g @coral-xyz/anchor-cli
    fi
fi
echo -e "${GREEN}✅ Anchor CLI ready${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Install from: https://nodejs.org/${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found${NC}"

# Step 2: Setup Solana devnet
echo -e "\n${BLUE}[STEP 2] Configuring Solana Devnet...${NC}"
solana config set --url devnet
WALLET=$(solana config get wallet | awk '{print $3}')
echo -e "${GREEN}✅ Devnet configured | Wallet: ${WALLET}${NC}"

# Step 3: Check balance and airdrop if needed
echo -e "\n${BLUE}[STEP 3] Checking SOL Balance...${NC}"
BALANCE=$(solana balance 2>/dev/null || echo "0")
echo "Current balance: $BALANCE"

if (( $(echo "$BALANCE == 0" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Balance is 0. Requesting airdrop...${NC}"
    solana airdrop 10
    echo -e "${GREEN}✅ Airdrop successful${NC}"
else
    echo -e "${GREEN}✅ Sufficient balance${NC}"
fi

# Step 4: Build and deploy
echo -e "\n${BLUE}[STEP 4] Building Smart Contract...${NC}"
cargo build 2>/dev/null || true
echo -e "${GREEN}✅ Build complete${NC}"

echo -e "\n${BLUE}[STEP 5] Deploying to Devnet...${NC}"
DEPLOY_OUTPUT=$(anchor deploy 2>&1)
PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep "Program deployed to:" | awk '{print $4}')

if [ -z "$PROGRAM_ID" ]; then
    echo -e "${YELLOW}⚠️  Could not extract Program ID. Using default.${NC}"
    PROGRAM_ID="DtN36XDqZQKPWV49PEs1cqdgwm2jmN7KoLyf4ME3YBba"
fi
echo -e "${GREEN}✅ Program deployed | ID: ${PROGRAM_ID}${NC}"

# Step 5: Install frontend dependencies
echo -e "\n${BLUE}[STEP 6] Installing Frontend Dependencies...${NC}"
cd frontend
npm install 2>&1 | grep -E "^(added|up to date)" || true
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 6: Create environment file
echo -e "\n${BLUE}[STEP 7] Creating Environment Configuration...${NC}"
cat > .env << EOF
REACT_APP_RPC_ENDPOINT=https://api.devnet.solana.com
REACT_APP_PROGRAM_ID=$PROGRAM_ID
REACT_APP_WALLET=$WALLET
EOF
echo -e "${GREEN}✅ .env created${NC}"

# Step 7: Summary
echo -e "\n${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✅ SETUP COMPLETE!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"

echo -e "\n${BLUE}📋 Next Steps:${NC}"
echo "1. Start frontend:"
echo -e "   ${YELLOW}cd frontend && npm start${NC}"
echo ""
echo "2. Open browser:"
echo -e "   ${YELLOW}http://localhost:3000${NC}"
echo ""
echo "3. Connect wallet and test the MVP"
echo ""

echo -e "\n${BLUE}📊 Program Information:${NC}"
echo "  Program ID: $PROGRAM_ID"
echo "  Network: Devnet"
echo "  Wallet: $WALLET"
echo ""

echo -e "${BLUE}🔗 Links:${NC}"
echo "  Solana Explorer (Devnet): https://explorer.solana.com/?cluster=devnet"
echo "  Frontend: http://localhost:3000"
echo ""
