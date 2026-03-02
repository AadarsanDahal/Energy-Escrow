import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EnergyEscrow } from "../target/types/energy_escrow";

/**
 * Deployment Script for Energy Escrow MVP
 * 
 * This script deploys the energy escrow smart contract to Solana devnet
 * and initializes the first trade with predefined parameters.
 * 
 * Usage:
 * ANCHOR_PROVIDER_URL=https://api.devnet.solana.com anchor run deploy
 */

async function deploy() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.EnergyEscrow as Program<EnergyEscrow>;

  console.log("🚀 Deploying Energy Escrow MVP...");
  console.log(`Program ID: ${program.programId.toBase58()}`);
  console.log(`Provider: ${provider.connection.rpcEndpoint}`);

  // Generate keypairs for the demo trade
  const administrator = provider.wallet as any;
  const buyerKeypair = anchor.web3.Keypair.generate();
  const sellerKeypair = anchor.web3.Keypair.generate();
  const tradeKeypair = anchor.web3.Keypair.generate();

  console.log("\n👥 Generated Keypairs:");
  console.log(`   Admin: ${administrator.publicKey.toBase58()}`);
  console.log(`   Buyer: ${buyerKeypair.publicKey.toBase58()}`);
  console.log(`   Seller: ${sellerKeypair.publicKey.toBase58()}`);
  console.log(`   Trade: ${tradeKeypair.publicKey.toBase58()}`);

  // Airdrop SOL to buyer and seller if on devnet
  const airdrop_amount = 10 * anchor.web3.LAMPORTS_PER_SOL;
  console.log("\n💰 Requesting airdrops...");

  try {
    const buyerAirdrop = await provider.connection.requestAirdrop(
      buyerKeypair.publicKey,
      airdrop_amount
    );
    const sellerAirdrop = await provider.connection.requestAirdrop(
      sellerKeypair.publicKey,
      airdrop_amount
    );

    await provider.connection.confirmTransaction(buyerAirdrop);
    await provider.connection.confirmTransaction(sellerAirdrop);

    console.log(`   ✅ Buyer airdropped: ${airdrop_amount / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    console.log(`   ✅ Seller airdropped: ${airdrop_amount / anchor.web3.LAMPORTS_PER_SOL} SOL`);
  } catch (err) {
    console.log("   ℹ️  Airdrop skipped (may not be available on this network)");
  }

  // Define trade parameters (MVP-only single trade)
  const energyAmountKwh = new anchor.BN(2); // 2 kWh
  const pricePerKwhWei = new anchor.BN(120000000); // 0.12 SOL/kWh
  const now = Math.floor(Date.now() / 1000);
  const startTime = new anchor.BN(now + 60); // Start in 1 minute
  const endTime = new anchor.BN(now + 960); // End in 16 minutes

  console.log("\n📋 Trade Parameters:");
  console.log(`   Energy Amount: ${energyAmountKwh.toString()} kWh`);
  console.log(`   Price per kWh: ${pricePerKwhWei.toString()} wei (0.12 SOL)`);
  console.log(`   Start Time: ${startTime.toString()} (unix timestamp)`);
  console.log(`   End Time: ${endTime.toString()} (unix timestamp)`);
  console.log(`   Total Cost: ${energyAmountKwh.mul(pricePerKwhWei).toString()} wei`);

  // Create the trade
  try {
    console.log("\n⚙️  Creating trade...");

    const createTradeTx = await program.methods
      .createTrade(
        buyerKeypair.publicKey,
        sellerKeypair.publicKey,
        energyAmountKwh,
        pricePerKwhWei,
        startTime,
        endTime
      )
      .accounts({
        trade: tradeKeypair.publicKey,
        creator: administrator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tradeKeypair])
      .rpc();

    console.log(`   ✅ Trade created: ${createTradeTx}`);

    // Fetch and display trade state
    const tradeAccount = await program.account.trade.fetch(
      tradeKeypair.publicKey
    );

    console.log("\n📊 Trade State:");
    console.log(`   Buyer: ${tradeAccount.buyer.toBase58()}`);
    console.log(`   Seller: ${tradeAccount.seller.toBase58()}`);
    console.log(`   State: Created`);
    console.log(`   Escrow Amount: ${tradeAccount.escrowAmountWei.toString()} wei`);

    console.log("\n✨ Deployment successful!");
    console.log(`\n📝 Save these addresses for your frontend:`);
    console.log(`   PROGRAM_ID=${program.programId.toBase58()}`);
    console.log(`   TRADE_ADDRESS=${tradeKeypair.publicKey.toBase58()}`);
    console.log(`   BUYER_ADDRESS=${buyerKeypair.publicKey.toBase58()}`);
    console.log(`   SELLER_ADDRESS=${sellerKeypair.publicKey.toBase58()}`);

  } catch (err) {
    console.error("❌ Deployment failed:", err);
    throw err;
  }
}

deploy()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
