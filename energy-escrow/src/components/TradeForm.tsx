import type { FormEvent } from 'react'

type TradeFormProps = {
  seller: string
  energyAmountKwh: string
  pricePerKwhWei: string
  startTime: string
  endTime: string
  disabled: boolean
  onFieldChange: (field: 'seller' | 'energyAmountKwh' | 'pricePerKwhWei' | 'startTime' | 'endTime', value: string) => void
  onCreateTrade: () => Promise<void>
}

export function TradeForm({
  seller,
  energyAmountKwh,
  pricePerKwhWei,
  startTime,
  endTime,
  disabled,
  onFieldChange,
  onCreateTrade,
}: TradeFormProps) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onCreateTrade()
  }

  return (
    <section className="panel">
      <h2>Create Trade</h2>
      <form className="form-grid" onSubmit={onSubmit}>
        <label>
          Seller Wallet
          <input value={seller} onChange={(event) => onFieldChange('seller', event.target.value)} required />
        </label>

        <label>
          Energy (kWh)
          <input
            value={energyAmountKwh}
            onChange={(event) => onFieldChange('energyAmountKwh', event.target.value)}
            type="number"
            min="1"
            required
          />
        </label>

        <label>
          Price per kWh (wei)
          <input
            value={pricePerKwhWei}
            onChange={(event) => onFieldChange('pricePerKwhWei', event.target.value)}
            type="number"
            min="1"
            required
          />
        </label>

        <label>
          Start Time (unix)
          <input value={startTime} onChange={(event) => onFieldChange('startTime', event.target.value)} type="number" required />
        </label>

        <label>
          End Time (unix)
          <input value={endTime} onChange={(event) => onFieldChange('endTime', event.target.value)} type="number" required />
        </label>

        <button type="submit" disabled={disabled}>
          Create Trade
        </button>
      </form>
    </section>
  )
}
