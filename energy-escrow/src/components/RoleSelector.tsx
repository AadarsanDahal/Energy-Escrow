type RoleSelectorProps = {
  selectedRole: 'buyer' | 'seller' | 'admin' | null
  disabled: boolean
  onSelectRole: (role: 'buyer' | 'seller' | 'admin') => void
}

export function RoleSelector({ selectedRole, disabled, onSelectRole }: RoleSelectorProps) {
  return (
    <section className="panel">
      <h2>Select Your Role</h2>
      <p className="muted">Choose how you'll interact with the energy escrow platform.</p>
      <div className="role-buttons">
        <button
          disabled={disabled}
          className={`role-btn ${selectedRole === 'buyer' ? 'active' : ''}`}
          onClick={() => onSelectRole('buyer')}
        >
          🛒 Buyer
        </button>
        <button
          disabled={disabled}
          className={`role-btn ${selectedRole === 'seller' ? 'active' : ''}`}
          onClick={() => onSelectRole('seller')}
        >
          ⚡ Seller
        </button>
        <button
          disabled={disabled}
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
