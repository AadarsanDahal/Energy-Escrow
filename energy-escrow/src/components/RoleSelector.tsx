type RoleSelectorProps = {
  selectedRole: 'buyer' | 'seller' | 'admin' | null
  disabled: boolean
  onSelectRole: (role: 'buyer' | 'seller' | 'admin') => void
  hasPendingTrade?: boolean
  pendingTradeMessage?: string
}

export function RoleSelector({ selectedRole, disabled, onSelectRole, hasPendingTrade, pendingTradeMessage }: RoleSelectorProps) {
  return (
    <section className="panel">
      <h2>Select Your Role</h2>
      <p className="muted">Choose how you'll interact with the energy escrow platform.</p>
      
      {hasPendingTrade && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#b91c1c', borderRadius: '6px', color: '#fee2e2', fontSize: '0.9rem', border: '1px solid #fecaca' }}>
          <strong>⚠️ Pending Trade</strong>
          <p style={{ margin: '0.5rem 0 0 0' }}>{pendingTradeMessage || 'You must deposit escrow before switching roles.'}</p>
        </div>
      )}

      <div className="role-buttons">
        <button
          disabled={disabled}
          className={`role-btn ${selectedRole === 'buyer' ? 'active' : ''}`}
          onClick={() => onSelectRole('buyer')}
        >
          🛒 Buyer
        </button>
        <button
          disabled={disabled || hasPendingTrade}
          className={`role-btn ${selectedRole === 'seller' ? 'active' : ''}`}
          onClick={() => onSelectRole('seller')}
          title={hasPendingTrade ? 'Complete or cancel your pending trade first' : ''}
        >
          ⚡ Seller
        </button>
        <button
          disabled={disabled || hasPendingTrade}
          className={`role-btn ${selectedRole === 'admin' ? 'active' : ''}`}
          onClick={() => onSelectRole('admin')}
        >
          🔐 Admin (Settle)
        </button>
      </div>
      {selectedRole && <p className="role-badge">Role: {selectedRole.toUpperCase()}</p>}
    </section>
  )
}
