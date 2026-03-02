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

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Seller Wallet Address
          <input value={seller} onChange={(event) => onSellerChange(event.target.value)} required placeholder="Enter seller's public key" />
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
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#0b2415', borderRadius: '8px', border: '1px solid #22c55e' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#22c55e' }}>✅ Trade Created!</h3>
          <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}>
            <strong>Trade Address:</strong> <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{createdTradeAddress.slice(0, 16)}...</span>
          </p>
          <p style={{ margin: '0.3rem 0', fontSize: '0.9rem', color: '#cbd5e1' }}>
            Now deposit the escrow amount so the seller can fulfill the trade.
          </p>
          <button
            onClick={() => void onDepositEscrow()}
            disabled={disabled || depositInProgress}
            style={{ marginTop: '0.5rem', background: '#22c55e', color: '#0b1020' }}
          >
            {depositInProgress ? '⏳ Depositing...' : '💰 Deposit Escrow'}
          </button>
        </div>
      )}
    </section>
  )
}
