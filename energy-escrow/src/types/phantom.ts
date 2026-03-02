import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'

export type PhantomProvider = {
  isPhantom?: boolean
  publicKey?: PublicKey
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>
  disconnect: () => Promise<void>
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(transactions: T[]) => Promise<T[]>
  signAndSendTransaction?: (transaction: Transaction | VersionedTransaction) => Promise<{ signature: string }>
}

declare global {
  interface Window {
    solana?: PhantomProvider
  }
}

export {}
