import type { FormEvent } from 'react'

type TradeActionsProps = {
  tradeAddress: string
  vaultAddress: string | null
  deliveredKwh: string
  disabled: boolean
  onTradeAddressChange: (value: string) => void
  onDeliveredKwhChange: (value: string) => void
  onRefresh: () => Promise<void>
  onDeposit: () => Promise<void>
  onSettle: () => Promise<void>
}

export function TradeActions({
  tradeAddress,
  vaultAddress,
  deliveredKwh,
  disabled,
  onTradeAddressChange,
  onDeliveredKwhChange,
  onRefresh,
  onDeposit,
  onSettle,
}: TradeActionsProps) {
  const onRefreshSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onRefresh()
  }

  return (
    <section className="panel">
      <h2>Trade Actions</h2>

      <form className="form-grid" onSubmit={onRefreshSubmit}>
        <label>
          Trade Account
          <input value={tradeAddress} onChange={(event) => onTradeAddressChange(event.target.value)} required />
        </label>
        <button type="submit" disabled={disabled || !tradeAddress.trim()}>
          Load Trade
        </button>
      </form>

      <p className="muted">Vault: {vaultAddress ?? 'Will be created automatically on first deposit'}</p>

      <div className="actions-row">
        <button disabled={disabled || !tradeAddress.trim()} onClick={() => void onDeposit()}>
          Deposit Escrow
        </button>

        <input
          value={deliveredKwh}
          onChange={(event) => onDeliveredKwhChange(event.target.value)}
          type="number"
          min="0"
          placeholder="Delivered kWh"
        />

        <button disabled={disabled || !tradeAddress.trim()} onClick={() => void onSettle()}>
          Settle
        </button>
      </div>
    </section>
  )
}
