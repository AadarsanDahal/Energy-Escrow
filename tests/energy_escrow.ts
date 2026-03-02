import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EnergyEscrow } from "../target/types/energy_escrow";
import * as assert from "assert";

describe("Energy Escrow MVP", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.EnergyEscrow as Program<EnergyEscrow>;

  let trade: anchor.web3.Keypair;
  let buyer: anchor.web3.Keypair;
  let seller: anchor.web3.Keypair;
  let admin: anchor.web3.Keypair;
  let tradeVault: anchor.web3.Keypair;

  const ENERGY_AMOUNT_KWH = new anchor.BN(2); // 2 kWh
  const PRICE_PER_KWH_WEI = new anchor.BN(120000000); // 0.12 USD in wei
  const TOTAL_COST = ENERGY_AMOUNT_KWH.mul(PRICE_PER_KWH_WEI); // 240000000 wei

  before(async () => {
    // Create keypairs
    trade = anchor.web3.Keypair.generate();
    buyer = anchor.web3.Keypair.generate();
    seller = anchor.web3.Keypair.generate();
    admin = anchor.web3.Keypair.generate();
    tradeVault = anchor.web3.Keypair.generate();

    // Airdrop SOL to all parties
    const signature1 = await provider.connection.requestAirdrop(
      buyer.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    const signature2 = await provider.connection.requestAirdrop(
      seller.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    const signature3 = await provider.connection.requestAirdrop(
      admin.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    const signature4 = await provider.connection.requestAirdrop(
      tradeVault.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );

    // Wait for airdrop confirmations
    await provider.connection.confirmTransaction(signature1);
    await provider.connection.confirmTransaction(signature2);
    await provider.connection.confirmTransaction(signature3);
    await provider.connection.confirmTransaction(signature4);
  });

  it("should create trade with valid parameters", async () => {
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 900; // 15 minutes later

    const tx = await program.methods
      .createTrade(
        buyer.publicKey,
        seller.publicKey,
        ENERGY_AMOUNT_KWH,
        PRICE_PER_KWH_WEI,
        new anchor.BN(startTime),
        new anchor.BN(endTime)
      )
      .accounts({
        trade: trade.publicKey,
        creator: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([trade])
      .rpc();

    console.log("Trade created: ", tx);

    // Verify trade state
    const tradeData = await program.account.trade.fetch(trade.publicKey);
    assert.equal(tradeData.buyer.toBase58(), buyer.publicKey.toBase58());
    assert.equal(tradeData.seller.toBase58(), seller.publicKey.toBase58());
    assert.ok(tradeData.energyAmountKwh.eq(ENERGY_AMOUNT_KWH));
    assert.ok(tradeData.pricePerKwhWei.eq(PRICE_PER_KWH_WEI));
    assert.equal(tradeData.state.created, true); // Check state = Created
  });

  it("should not allow creating trade twice", async () => {
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 900;

    try {
      await program.methods
        .createTrade(
          buyer.publicKey,
          seller.publicKey,
          ENERGY_AMOUNT_KWH,
          PRICE_PER_KWH_WEI,
          new anchor.BN(startTime),
          new anchor.BN(endTime)
        )
        .accounts({
          trade: trade.publicKey,
          creator: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([trade])
        .rpc();

      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert.ok(err.message.includes("Trade already exists"));
    }
  });

  it("should allow buyer to deposit exact escrow amount", async () => {
    const tx = await program.methods
      .depositEscrow(TOTAL_COST)
      .accounts({
        trade: trade.publicKey,
        buyer: buyer.publicKey,
        tradeVault: tradeVault.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    console.log("Escrow deposited: ", tx);

    const tradeData = await program.account.trade.fetch(trade.publicKey);
    assert.ok(tradeData.escrowAmountWei.eq(TOTAL_COST));
    assert.equal(tradeData.state.funded, true); // Check state = Funded
  });

  it("should reject escrow deposit with incorrect amount", async () => {
    // Create new trade for this test
    const trade2 = anchor.web3.Keypair.generate();
    const startTime = Math.floor(Date.now() / 1000) + 1800;
    const endTime = startTime + 900;

    await program.methods
      .createTrade(
        buyer.publicKey,
        seller.publicKey,
        ENERGY_AMOUNT_KWH,
        PRICE_PER_KWH_WEI,
        new anchor.BN(startTime),
        new anchor.BN(endTime)
      )
      .accounts({
        trade: trade2.publicKey,
        creator: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([trade2])
      .rpc();

    try {
      const wrongAmount = TOTAL_COST.sub(new anchor.BN(100));
      await program.methods
        .depositEscrow(wrongAmount)
        .accounts({
          trade: trade2.publicKey,
          buyer: buyer.publicKey,
          tradeVault: tradeVault.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert.ok(err.message.includes("Incorrect escrow amount"));
    }
  });

  it("should settle trade with full delivery", async () => {
    // Wait for trade end time
    const tradeData = await program.account.trade.fetch(trade.publicKey);
    const now = Math.floor(Date.now() / 1000);
    const waitTime = tradeData.endTime.toNumber() - now + 1;

    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
    }

    const tx = await program.methods
      .settle(ENERGY_AMOUNT_KWH)
      .accounts({
        trade: trade.publicKey,
        admin: admin.publicKey,
        tradeVault: tradeVault.publicKey,
        sellerAccount: seller.publicKey,
        buyerAccount: buyer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    console.log("Trade settled: ", tx);

    const settledTrade = await program.account.trade.fetch(trade.publicKey);
    assert.ok(settledTrade.deliveredKwh.eq(ENERGY_AMOUNT_KWH));
    assert.equal(settledTrade.state.settled, true); // Check state = Settled
  });

  it("should settle trade with partial delivery", async () => {
    // Create new trade for partial delivery test
    const trade3 = anchor.web3.Keypair.generate();
    const tradeVault3 = anchor.web3.Keypair.generate();
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 1; // Very short window

    await program.methods
      .createTrade(
        buyer.publicKey,
        seller.publicKey,
        ENERGY_AMOUNT_KWH,
        PRICE_PER_KWH_WEI,
        new anchor.BN(startTime),
        new anchor.BN(endTime)
      )
      .accounts({
        trade: trade3.publicKey,
        creator: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([trade3])
      .rpc();

    // Deposit escrow
    await program.methods
      .depositEscrow(TOTAL_COST)
      .accounts({
        trade: trade3.publicKey,
        buyer: buyer.publicKey,
        tradeVault: tradeVault3.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Wait for end time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Settle with partial delivery (1 kWh out of 2)
    const partialDelivery = new anchor.BN(1);

    const tx = await program.methods
      .settle(partialDelivery)
      .accounts({
        trade: trade3.publicKey,
        admin: admin.publicKey,
        tradeVault: tradeVault3.publicKey,
        sellerAccount: seller.publicKey,
        buyerAccount: buyer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    console.log("Trade settled with partial delivery: ", tx);

    const settledTrade = await program.account.trade.fetch(trade3.publicKey);
    assert.ok(settledTrade.deliveredKwh.eq(partialDelivery));

    // Verify payment calculations
    const expectedSellerPayment = partialDelivery.mul(PRICE_PER_KWH_WEI);
    const expectedRefund = TOTAL_COST.sub(expectedSellerPayment);
    console.log("Expected seller payment:", expectedSellerPayment.toString());
    console.log("Expected buyer refund:", expectedRefund.toString());
  });

  it("should not allow settlement before endTime", async () => {
    const trade4 = anchor.web3.Keypair.generate();
    const startTime = Math.floor(Date.now() / 1000);
    const endTime = startTime + 3600; // 1 hour later

    await program.methods
      .createTrade(
        buyer.publicKey,
        seller.publicKey,
        ENERGY_AMOUNT_KWH,
        PRICE_PER_KWH_WEI,
        new anchor.BN(startTime),
        new anchor.BN(endTime)
      )
      .accounts({
        trade: trade4.publicKey,
        creator: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([trade4])
      .rpc();

    // Deposit escrow
    const tradeVault4 = anchor.web3.Keypair.generate();
    await program.methods
      .depositEscrow(TOTAL_COST)
      .accounts({
        trade: trade4.publicKey,
        buyer: buyer.publicKey,
        tradeVault: tradeVault4.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Try to settle before endTime
    try {
      await program.methods
        .settle(ENERGY_AMOUNT_KWH)
        .accounts({
          trade: trade4.publicKey,
          admin: admin.publicKey,
          tradeVault: tradeVault4.publicKey,
          sellerAccount: seller.publicKey,
          buyerAccount: buyer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      assert.fail("Should have thrown error");
    } catch (err: any) {
      assert.ok(err.message.includes("Settlement too early"));
    }
  });
});
