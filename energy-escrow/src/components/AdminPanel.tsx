import type { TradeView } from '../lib/anchorClient'

type AdminPanelProps = {
  trades: (TradeView & { tradeAddress: string; settleTxSignature?: string })[]
  selectedTrade: string | null
  deliveredKwh: string
  disabled: boolean
  onSelectTrade: (tradeAddress: string) => void
  onDeliveredKwhChange: (value: string) => void
  onSettle: () => Promise<void>
  onRefreshTrades: () => void
}

export function AdminPanel({
  trades,
  selectedTrade,
  deliveredKwh,
  disabled,
  onSelectTrade,
  onDeliveredKwhChange,
  onRefreshTrades,
  onSettle,
}: AdminPanelProps) {
  const currentTrade = trades.find((t) => t.tradeAddress === selectedTrade)

  const formatTime = (unixTimestamp: string): string => {
    const ts = Math.floor(Number(unixTimestamp) * 1000)
    return new Date(ts).toLocaleString()
  }

  const getTimeUntilSettlement = (endTime: string): string => {
    const now = Math.floor(Date.now() / 1000)
    const end = Number(endTime)
    const diff = end - now

    if (diff <= 0) {
      return '✓ Ready to settle'
    }

    const mins = Math.ceil(diff / 60)
    return `${mins} min${mins !== 1 ? 's' : ''} until ready`
  }

  return (
    <section className="panel admin-panel">
      <h2>🔐 Admin Panel - Settle Trades</h2>
      <p className="muted">View buyer-initiated trades and settle with verified energy delivery data.</p>

      <button onClick={onRefreshTrades} disabled={disabled}>
        Refresh Trades
      </button>


//random comment to trigger code change detection
      {trades.length === 0 ? (
        <p className="muted">No pending trades yet.</p>
      ) : (
        <>
          <div className="trade-list">
            {trades.map((trade) => (
              <div
                key={trade.tradeAddress}
                className={`trade-item ${selectedTrade === trade.tradeAddress ? 'selected' : ''}`}
                onClick={() => onSelectTrade(trade.tradeAddress)}
              >
                <div className="trade-item-header">
                  <strong>Trade: {trade.tradeAddress.slice(0, 8)}...</strong>
                  <span className={`state-badge state-${trade.state.toLowerCase()}`}>{trade.state}</span>
                </div>
                <div className="trade-item-details">
                  <p>
                    <strong>Energy:</strong> {trade.energyAmountKwh} kWh @ {trade.pricePerKwhWei} wei/kWh
                  </p>
                  <p>
                    <strong>Total Cost:</strong> {trade.totalCostWei} wei
                  </p>
                  <p>
                    <strong>Ends:</strong> {formatTime(trade.endTime)} ({getTimeUntilSettlement(trade.endTime)})
                  </p>
                </div>
              </div>
            ))}
          </div>

          {currentTrade && (
            <div className="settlement-form">
              <h3>Settlement Details</h3>
              <div className="settlement-info">
                <p>
                  <strong>Buyer:</strong> <span className="mono">{currentTrade.buyer.slice(0, 8)}...</span>
                </p>
                <p>
                  <strong>Seller:</strong> <span className="mono">{currentTrade.seller.slice(0, 8)}...</span>
                </p>
                <p>
                  <strong>Expected Energy:</strong> {currentTrade.energyAmountKwh} kWh
                </p>
                <p>
                  <strong>Escrow Held:</strong> {currentTrade.escrowAmountWei} wei
                </p>
              </div>

              <label>
                Delivered Energy (kWh)
                <input
                  value={deliveredKwh}
                  onChange={(event) => onDeliveredKwhChange(event.target.value)}
                  type="number"
                  min="0"
                  max={currentTrade.energyAmountKwh}
                  step="0.1"
                />
              </label>

              <button disabled={disabled || !currentTrade} onClick={() => void onSettle()}>
                ✅ Confirm Settlement
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
