import { AnchorProvider, BN, Program, web3 } from '@coral-xyz/anchor'
import { clusterApiUrl, Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import { energyEscrowIdl } from './energyEscrowIdl'
import type { PhantomProvider } from '../types/phantom'

const PROGRAM_ID = new PublicKey(import.meta.env.VITE_PROGRAM_ID ?? 'DtN36XDqZQKPWV49PEs1cqdgwm2jmN7KoLyf4ME3YBba')
const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL ?? clusterApiUrl('devnet')
const CONNECTION = new Connection(RPC_URL, 'confirmed')

type ProgramAccountTrade = {
  buyer: PublicKey
  seller: PublicKey
  energyAmountKwh: BN
  pricePerKwhWei: BN
  startTime: BN
  endTime: BN
  escrowAmountWei: BN
  deliveredKwh: BN
  totalCostWei: BN
  state: Record<string, unknown>
}

export type TradeView = {
  buyer: string
  seller: string
  energyAmountKwh: string
  pricePerKwhWei: string
  startTime: string
  endTime: string
  escrowAmountWei: string
  deliveredKwh: string
  totalCostWei: string
  state: string
}

const mapTradeState = (state: Record<string, unknown> | null | undefined): string => {
  if (!state) {
    return 'Unknown'
  }

  const keys = Object.keys(state)
  if (!keys.length) {
    return 'Unknown'
  }

  const key = keys[0]
  return key.charAt(0).toUpperCase() + key.slice(1)
}

const toAnchorWallet = (provider: PhantomProvider) => {
  if (!provider.publicKey || !provider.signTransaction) {
    throw new Error('Wallet is not connected.')
  }

  const signTransaction = async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
    return provider.signTransaction(transaction)
  }

  const signAllTransactions = async <T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> => {
    if (provider.signAllTransactions) {
      return provider.signAllTransactions(transactions)
    }

    return Promise.all(transactions.map((transaction) => signTransaction(transaction)))
  }

  return {
    publicKey: provider.publicKey,
    signTransaction,
    signAllTransactions,
  }
}

const getProvider = (walletProvider: PhantomProvider): AnchorProvider => {
  const wallet = toAnchorWallet(walletProvider)
  return new AnchorProvider(CONNECTION, wallet as any, { commitment: 'confirmed' })
}

const getProgram = (walletProvider: PhantomProvider): Program => {
  const idl = { ...energyEscrowIdl, address: PROGRAM_ID.toBase58() }
  return new Program(idl as any, getProvider(walletProvider))
}

export const connectWallet = async (): Promise<PhantomProvider> => {
  const walletProvider = window.solana

  if (!walletProvider?.isPhantom) {
    throw new Error('Phantom wallet not found. Install Phantom and refresh.')
  }

  await walletProvider.connect()
  return walletProvider
}

export const disconnectWallet = async (walletProvider: PhantomProvider | null): Promise<void> => {
  if (!walletProvider) {
    return
  }

  await walletProvider.disconnect()
}

export const createTrade = async (
  walletProvider: PhantomProvider,
  params: {
    buyer: string
    seller: string
    energyAmountKwh: string
    pricePerKwhWei: string
    startTime: string
    endTime: string
  },
): Promise<{ tradeAddress: string; txSignature: string }> => {
  console.log('anchorClient.createTrade called with params:', params)

  const buyerPubkey = new PublicKey(params.buyer.trim())
  const sellerPubkey = new PublicKey(params.seller.trim())

  const provider = getProvider(walletProvider)
  const program = getProgram(walletProvider)
  const tradeKeypair = web3.Keypair.generate()

  console.log('Generated trade keypair:', tradeKeypair.publicKey.toBase58())
  console.log('Sending transaction to blockchain...')

  const txSignature = await program.methods
    .createTrade(
      buyerPubkey,
      sellerPubkey,
      new BN(params.energyAmountKwh),
      new BN(params.pricePerKwhWei),
      new BN(params.startTime),
      new BN(params.endTime),
    )
    .accounts({
      trade: tradeKeypair.publicKey,
      creator: provider.wallet.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([tradeKeypair])
    .rpc()

  console.log('Transaction sent! Signature:', txSignature)
  console.log('Waiting for confirmation...')

  const latestBlockhash = await provider.connection.getLatestBlockhash('confirmed')
  const confirmation = await provider.connection.confirmTransaction(
    {
      signature: txSignature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'confirmed',
  )

  if (confirmation.value.err) {
    throw new Error(`Create trade transaction failed: ${JSON.stringify(confirmation.value.err)}`)
  }

  const tradeAddress = tradeKeypair.publicKey.toBase58()
  let accountExists = false

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const accountInfo = await provider.connection.getAccountInfo(tradeKeypair.publicKey, 'confirmed')
    if (accountInfo) {
      accountExists = true
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 600))
  }

  if (!accountExists) {
    throw new Error(`Trade account was not found on-chain after confirmation. Trade: ${tradeAddress}`)
  }

  console.log('Transaction confirmed and trade account is available on-chain!')

  return {
    tradeAddress,
    txSignature,
  }
}

export const fetchTrade = async (walletProvider: PhantomProvider, tradeAddress: string): Promise<TradeView> => {
  const program = getProgram(walletProvider)
  const tradePublicKey = new PublicKey(tradeAddress)
  
  // Retry fetching the account to handle RPC propagation delays
  let account: ProgramAccountTrade | null = null
  const maxRetries = 15
  const retryDelay = 1000 // 1 second
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      account = (await (program.account as any).trade.fetch(tradePublicKey)) as ProgramAccountTrade
      break // Account found, exit retry loop
    } catch (error) {
      if (i === maxRetries - 1) {
        // Last attempt failed, throw error with original error details
        console.error('Final fetch error:', error)
        throw new Error(`Failed to fetch trade account after ${maxRetries} attempts. Address: ${tradeAddress}. Last error: ${error}`)
      }
      // Wait before next retry
      console.log(`Fetch attempt ${i + 1} failed:`, error)
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }

  if (!account) {
    throw new Error(`Trade account not found: ${tradeAddress}`)
  }

  return {
    buyer: account.buyer.toBase58(),
    seller: account.seller.toBase58(),
    energyAmountKwh: account.energyAmountKwh.toString(),
    pricePerKwhWei: account.pricePerKwhWei.toString(),
    startTime: account.startTime.toString(),
    endTime: account.endTime.toString(),
    escrowAmountWei: account.escrowAmountWei.toString(),
    deliveredKwh: account.deliveredKwh.toString(),
    totalCostWei: account.totalCostWei.toString(),
    state: mapTradeState(account.state),
  }
}

export const depositEscrow = async (
  walletProvider: PhantomProvider,
  params: {
    tradeAddress: string
    escrowAmountWei: string
    vaultAddress?: string
  },
): Promise<{ txSignature: string; vaultAddress: string }> => {
  const program = getProgram(walletProvider)
  const provider = getProvider(walletProvider)

  // Use the trade account itself as the escrow vault so settlement can move lamports
  // (the program owns the trade account, but does not own arbitrary system accounts).
  const vaultAddress = params.tradeAddress

  const txSignature = await program.methods
    .depositEscrow(new BN(params.escrowAmountWei))
    .accounts({
      trade: new PublicKey(params.tradeAddress),
      buyer: provider.wallet.publicKey,
      tradeVault: new PublicKey(vaultAddress),
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc()

  return { txSignature, vaultAddress }
}

export const settleTrade = async (
  walletProvider: PhantomProvider,
  params: {
    tradeAddress: string
    tradeVault: string
    sellerAccount: string
    buyerAccount: string
    deliveredKwh: string
  },
): Promise<string> => {
  const program = getProgram(walletProvider)
  const provider = getProvider(walletProvider)

  return program.methods
    .settle(new BN(params.deliveredKwh))
    .accounts({
      trade: new PublicKey(params.tradeAddress),
      admin: provider.wallet.publicKey,
      tradeVault: new PublicKey(params.tradeAddress),
      sellerAccount: new PublicKey(params.sellerAccount),
      buyerAccount: new PublicKey(params.buyerAccount),
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc()
}
