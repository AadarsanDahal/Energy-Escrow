type WalletSectionProps = {
  publicKey: string | null
  isBusy: boolean
  onConnect: () => Promise<void>
  onDisconnect: () => Promise<void>
}

export function WalletSection({ publicKey, isBusy, onConnect, onDisconnect }: WalletSectionProps) {
  return (
    <section className="panel">
      <h2>Wallet</h2>
      <p className="muted">Connect Phantom to sign Anchor transactions.</p>
      {publicKey ? (
        <>
          <p className="mono">{publicKey}</p>
          <button disabled={isBusy} onClick={() => void onDisconnect()}>
            Disconnect
          </button>
        </>
      ) : (
        <button disabled={isBusy} onClick={() => void onConnect()}>
          Connect Phantom
        </button>
      )}
    </section>
  )
}
