type BuyerPanelProps = {
  seller: string
  energyKwh: string
  pricePerKwhWei: string
  durationMins: string
  disabled: boolean
  createdTradeAddress: string | null
  depositInProgress: boolean
  onSellerChange: (value: string) => void
  onEnergyChange: (value: string) => void
  onPriceChange: (value: string) => void
  onDurationChange: (value: string) => void
  onCreateTrade: () => Promise<void>
  onDepositEscrow: () => Promise<void>
  tradeDetails?: {
    energyAmountKwh: string
    pricePerKwhWei: string
    totalCostWei: string
    seller: string
    state: string
  } | null
}

export function BuyerPanel({
  seller,
  energyKwh,
  pricePerKwhWei,
  durationMins,
  disabled,
  createdTradeAddress,
  depositInProgress,
  onSellerChange,
  onEnergyChange,
  onPriceChange,
  onDurationChange,
  onCreateTrade,
  onDepositEscrow,
  tradeDetails,
}: BuyerPanelProps) {
  const totalCost = (() => {
    const energy = Number(energyKwh) || 0
    const price = Number(pricePerKwhWei) || 0
    return (energy * price).toLocaleString()
  })()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    console.log('Create Trade button clicked! Form values:', { seller, energyKwh, pricePerKwhWei, durationMins })
    void onCreateTrade()
  }

  return (
    <section className="panel buyer-panel">
      <h2>🛒 Buyer - Create Energy Trade</h2>
      <p className="muted">Specify a seller, the energy you need, and how long to complete the trade.</p>

      <form className="form-grid" onSubmit={handleSubmit} style={{ opacity: createdTradeAddress && tradeDetails?.state === 'Created' ? 0.5 : 1, pointerEvents: createdTradeAddress && tradeDetails?.state === 'Created' ? 'none' : 'auto' }}>
        <label>
          Seller Wallet Address
          <input value={seller} onChange={(event) => onSellerChange(event.target.value)} required placeholder="Enter seller's public key" disabled={!!(createdTradeAddress && tradeDetails?.state === 'Created')} />
        </label>

        <label>
          Energy Amount (kWh)
          <input
            value={energyKwh}
            onChange={(event) => onEnergyChange(event.target.value)}
            type="number"
            min="0.1"
            step="0.1"
            required
          />
        </label>

        <label>
          Price per kWh (wei)
          <input value={pricePerKwhWei} onChange={(event) => onPriceChange(event.target.value)} type="number" min="1" required />
        </label>

        <label>
          Duration (minutes)
          <input
            value={durationMins}
            onChange={(event) => onDurationChange(event.target.value)}
            type="number"
            min="1"
            required
          />
        </label>

        <div className="cost-summary">
          <p>
            <strong>Total Cost:</strong> <span className="highlight">{totalCost} wei</span>
          </p>
        </div>

        <button type="submit" disabled={disabled}>
          Create Trade
        </button>
      </form>

      {createdTradeAddress && (
        <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#0b2415', borderRadius: '8px', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#22c55e', fontSize: '1.2rem' }}>✅ Trade Successfully Created!</h3>
          
          <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #22c55e' }}>
            <p style={{ margin: '0.5rem 0', fontSize: '0.9rem' }}>
              <strong>Trade Address:</strong> <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', color: '#22c55e' }}>{createdTradeAddress}</span>
            </p>
          </div>

          {tradeDetails && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong>Energy Amount:</strong> {tradeDetails.energyAmountKwh} kWh
              </p>
              <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong>Price per kWh:</strong> {tradeDetails.pricePerKwhWei} wei
              </p>
              <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong>Total Cost:</strong> <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{tradeDetails.totalCostWei} wei</span>
              </p>
              <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong>Seller:</strong> <span style={{ fontFamily: 'monospace' }}>{tradeDetails.seller.slice(0, 8)}...</span>
              </p>
              <p style={{ margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong>Status:</strong> <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{tradeDetails.state}</span>
              </p>
            </div>
          )}

          <p style={{ margin: '0.5rem 0 1rem 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
            ⚠️ Next step: Click "Deposit Escrow" below to lock in the funds and let the seller start fulfilling the trade.
          </p>
          
          <button
            onClick={() => void onDepositEscrow()}
            disabled={disabled || depositInProgress}
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', background: '#22c55e', color: '#0b1020', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
          >
            {depositInProgress ? '⏳ Depositing Escrow...' : '💰 Deposit Escrow'}
          </button>
        </div>
      )}
    </section>
  )
}
