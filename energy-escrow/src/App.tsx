import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { AdminPanel } from './components/AdminPanel'
import { BuyerPanel } from './components/BuyerPanel'
import { RoleSelector } from './components/RoleSelector'
import { WalletSection } from './components/WalletSection'
import {
  connectWallet,
  createTrade,
  depositEscrow,
  disconnectWallet,
  fetchTrade,
  settleTrade,
  type TradeView,
} from './lib/anchorClient'
import type { PhantomProvider } from './types/phantom'

type StoredTrade = TradeView & {
  tradeAddress: string
  vaultAddress?: string
  createdAt: number
  createdByWallet: string
}

function App() {
  const [walletProvider, setWalletProvider] = useState<PhantomProvider | null>(null)
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'seller' | 'admin' | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [status, setStatus] = useState('Ready')

  // Buyer panel state
  const [seller, setSeller] = useState('')
  const [energyKwh, setEnergyKwh] = useState('2')
  const [pricePerKwhWei, setPricePerKwhWei] = useState('120000000')
  const [durationMins, setDurationMins] = useState('15')
  const [createdTradeAddress, setCreatedTradeAddress] = useState<string | null>(null)
  const [buyerDepositInProgress, setBuyerDepositInProgress] = useState(false)

  // Admin panel state
  const [storedTrades, setStoredTrades] = useState<StoredTrade[]>([])
  const [selectedAdminTrade, setSelectedAdminTrade] = useState<string | null>(null)
  const [adminDeliveredKwh, setAdminDeliveredKwh] = useState('')

  // Load stored trades from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('energy_escrow_trades')
    if (stored) {
      try {
        setStoredTrades(JSON.parse(stored))
      } catch {}
    }
  }, [])

  // Sync stored trades to localStorage
  useEffect(() => {
    localStorage.setItem('energy_escrow_trades', JSON.stringify(storedTrades))
  }, [storedTrades])

  const walletPublicKey = useMemo(() => walletProvider?.publicKey?.toBase58() ?? null, [walletProvider])

  const ensureWallet = (): PhantomProvider => {
    if (!walletProvider) {
      throw new Error('Connect Phantom first.')
    }
    return walletProvider
  }

  const activeTrades = useMemo(
    () => storedTrades.filter((t) => t.state !== 'Settled'),
    [storedTrades]
  )

  const withUiState = async (action: () => Promise<void>) => {
    try {
      setIsBusy(true)
      await action()
    } catch (error) {
      console.error('Transaction error:', error)
      const message = error instanceof Error ? error.message : 'Transaction failed'
      setStatus(`Error: ${message}`)
    } finally {
      setIsBusy(false)
    }
  }

  const handleConnect = async () => {
    await withUiState(async () => {
      const provider = await connectWallet()
      setWalletProvider(provider)
      setStatus(`Wallet connected: ${provider.publicKey?.toBase58()}`)
    })
  }

  const handleDisconnect = async () => {
    await withUiState(async () => {
      await disconnectWallet(walletProvider)
      setWalletProvider(null)
      setSelectedRole(null)
      setStatus('Wallet disconnected')
    })
  }

  const handleCreateTrade = async () => {
    await withUiState(async () => {
      console.log('handleCreateTrade called with:', { seller, energyKwh, pricePerKwhWei, durationMins })
      
      const provider = ensureWallet()
      if (!provider.publicKey) {
        throw new Error('Wallet public key missing')
      }

      // Validate seller address
      const sellerAddress = seller.trim()
      if (!sellerAddress || sellerAddress.length < 32) {
        throw new Error('Invalid seller address. Please enter a valid Solana wallet address.')
      }

      const buyer = provider.publicKey.toBase58()
      const now = Math.floor(Date.now() / 1000)
      const durationSeconds = Number(durationMins) * 60
      const startTime = now + 10 // Start in 10 seconds
      const endTime = startTime + durationSeconds

      setStatus('Creating trade on-chain...')

      const { tradeAddress: createdTrade, txSignature } = await createTrade(provider, {
        buyer,
        seller: sellerAddress,
        energyAmountKwh: energyKwh,
        pricePerKwhWei,
        startTime: String(startTime),
        endTime: String(endTime),
      })

      console.log('Trade created successfully:', {
        tradeAddress: createdTrade,
        txSignature,
        explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
      })

      setStatus('Trade confirmed! Now deposit escrow to lock funds...')

      // Store trade for admin to see
      const newTrade: StoredTrade = {
        buyer,
        seller: sellerAddress,
        energyAmountKwh: energyKwh,
        pricePerKwhWei,
        startTime: String(startTime),
        endTime: String(endTime),
        escrowAmountWei: '0',
        deliveredKwh: '0',
        totalCostWei: String(Number(energyKwh) * Number(pricePerKwhWei)),
        state: 'Created',
        tradeAddress: createdTrade,
        createdAt: Date.now(),
        createdByWallet: buyer,
      }

      setStoredTrades((prev) => [newTrade, ...prev])
      setCreatedTradeAddress(createdTrade)
      setStatus(`✅ Trade created: ${createdTrade.slice(0, 8)}... | Click "Deposit Escrow" below | tx: ${txSignature}`)
    })
  }

  // Kept for future seller interaction features
  // const handleRefreshTrade = async () => {}

  const handleRefreshAdminTrades = useCallback(async () => {
    if (!walletProvider || !selectedAdminTrade) {
      return
    }

    await withUiState(async () => {
      const provider = ensureWallet()
      
      try {
        const trade = await fetchTrade(provider, selectedAdminTrade)
        setStoredTrades((prev) =>
          prev.map((t) =>
            t.tradeAddress === selectedAdminTrade
              ? { ...t, ...trade, tradeAddress: selectedAdminTrade }
              : t
          )
        )
        setStatus('Trade refreshed from blockchain')
      } catch (error) {
        console.error('Failed to fetch trade from blockchain:', error)
        setStatus(`Warning: Could not fetch trade ${selectedAdminTrade.slice(0, 8)}... from blockchain. It may not exist yet or the transaction may have failed.`)
      }
    })
  }, [walletProvider, selectedAdminTrade])

  // Kept for future seller deposit features
  // const handleDeposit = async () => {}

  // Kept for future seller settlement features
  // const handleSettle = async () => {}

  const handleBuyerDeposit = async () => {
    await withUiState(async () => {
      const provider = ensureWallet()
      if (!createdTradeAddress) {
        throw new Error('No trade created yet')
      }

      setBuyerDepositInProgress(true)

      // First, fetch the trade from on-chain to verify it exists and get actual total cost
      let onChainTrade: TradeView
      try {
        console.log(`Fetching trade account: ${createdTradeAddress}`)
        onChainTrade = await fetchTrade(provider, createdTradeAddress)
        console.log(`Trade fetched successfully! State: ${onChainTrade.state}`)
        setStatus(`Trade verified on-chain. State: ${onChainTrade.state}. Depositing escrow...`)
      } catch (error) {
        setBuyerDepositInProgress(false)
        console.error('fetchTrade error:', error)
        throw error // Preserve the original error from fetchTrade instead of replacing it
      }

      if (onChainTrade.state !== 'Created') {
        setBuyerDepositInProgress(false)
        throw new Error(`Trade is in state: ${onChainTrade.state}. Expected: Created`)
      }

      const { txSignature, vaultAddress } = await depositEscrow(provider, {
        tradeAddress: createdTradeAddress,
        escrowAmountWei: onChainTrade.totalCostWei,
      })

      // Update stored trade with vault address and escrowed amount
      setStoredTrades((prev) =>
        prev.map((t) =>
          t.tradeAddress === createdTradeAddress
            ? {
                ...t,
                vaultAddress,
                escrowAmountWei: onChainTrade.totalCostWei,
                state: 'Funded',
              }
            : t
        )
      )

      setBuyerDepositInProgress(false)
      setStatus(`Escrow deposited! Vault: ${vaultAddress.slice(0, 8)}... | tx: ${txSignature}`)
    })
  }

  const handleAdminSettle = async () => {
    await withUiState(async () => {
      const provider = ensureWallet()
      if (!selectedAdminTrade) {
        throw new Error('Select a trade first')
      }

      const trade = storedTrades.find((t) => t.tradeAddress === selectedAdminTrade)
      if (!trade) {
        throw new Error('Trade not found')
      }

      if (!trade.escrowAmountWei || trade.escrowAmountWei === '0') {
        throw new Error('Escrow not yet deposited for this trade')
      }

      if (trade.state !== 'Funded') {
        throw new Error(`Cannot settle trade in state: ${trade.state}. Must be Funded.`)
      }

      const txSignature = await settleTrade(provider, {
        tradeAddress: selectedAdminTrade,
        tradeVault: selectedAdminTrade,
        sellerAccount: trade.seller,
        buyerAccount: trade.buyer,
        deliveredKwh: adminDeliveredKwh,
      })

      // Fetch updated trade state after settlement
      let refreshed: TradeView
      try {
        refreshed = await fetchTrade(provider, selectedAdminTrade)
      } catch (error) {
        throw new Error(`Failed to fetch updated trade state: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      setStoredTrades((prev) =>
        prev.map((t) =>
          t.tradeAddress === selectedAdminTrade
            ? { ...t, ...refreshed, tradeAddress: selectedAdminTrade, vaultAddress: selectedAdminTrade }
            : t
        )
      )

      setStatus(`Trade settled with ${adminDeliveredKwh} kWh delivered. tx: ${txSignature}`)
      setAdminDeliveredKwh('')
    })
  }

  const handleRoleSelect = (role: 'buyer' | 'seller' | 'admin') => {
    setSelectedRole(role)
    
    // Clear role-specific state when switching
    if (role !== 'admin') {
      setSelectedAdminTrade(null)
      setAdminDeliveredKwh('')
    }
    
    if (role !== 'buyer') {
      setCreatedTradeAddress(null)
      setBuyerDepositInProgress(false)
    }
    
    setStatus(`Switched to ${role} mode`)
  }

  return (
    <main className="container">
      <header>
        <h1>⚡ Energy Escrow dApp</h1>
        <p className="muted">P2P energy trading with Solana smart contracts. Trustless, fast, and fair.</p>
      </header>

      <WalletSection
        publicKey={walletPublicKey}
        isBusy={isBusy}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {walletPublicKey && (
        <>
          <RoleSelector
            selectedRole={selectedRole}
            disabled={isBusy}
            onSelectRole={handleRoleSelect}
          />

          {selectedRole === 'buyer' && (
            <BuyerPanel
              seller={seller}
              energyKwh={energyKwh}
              pricePerKwhWei={pricePerKwhWei}
              durationMins={durationMins}
              disabled={isBusy}
              createdTradeAddress={createdTradeAddress}
              depositInProgress={buyerDepositInProgress}
              onSellerChange={setSeller}
              onEnergyChange={setEnergyKwh}
              onPriceChange={setPricePerKwhWei}
              onDurationChange={setDurationMins}
              onCreateTrade={handleCreateTrade}
              onDepositEscrow={handleBuyerDeposit}
            />
          )}

          {selectedRole === 'seller' && (
            <section className="panel">
              <h2>⚡ Seller - Awaiting Trades</h2>
              <p className="muted">Buyers will initiate trades with you. Check your wallet for trade notifications.</p>
              <p>Your Wallet: <span className="mono highlight">{walletPublicKey}</span></p>
              <p>Share this address with energy buyers who want to trade with you.</p>
            </section>
          )}

          {selectedRole === 'admin' && (
            <AdminPanel
              trades={activeTrades}
              selectedTrade={selectedAdminTrade}
              deliveredKwh={adminDeliveredKwh}
              disabled={isBusy}
              onSelectTrade={setSelectedAdminTrade}
              onDeliveredKwhChange={setAdminDeliveredKwh}
              onRefreshTrades={handleRefreshAdminTrades}
              onSettle={handleAdminSettle}
            />
          )}
        </>
      )}

      <p className="status">{status}</p>
    </main>
  )
}

export default App
