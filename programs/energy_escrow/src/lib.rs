use anchor_lang::prelude::*;
use std::fmt;

declare_id!("DtN36XDqZQKPWV49PEs1cqdgwm2jmN7KoLyf4ME3YBba");

#[program]
pub mod energy_escrow {
    use super::*;

    /// Create a trade with predefined parameters
    /// Only callable once; revert if already created
    pub fn create_trade(
        ctx: Context<CreateTrade>,
        buyer: Pubkey,
        seller: Pubkey,
        energy_amount_kwh: u64,
        price_per_kwh_wei: u64,
        start_time: u64,
        end_time: u64,
    ) -> Result<()> {
        if buyer == Pubkey::default() {
            return Err(CustomError::InvalidAccount.into());
        }
        if seller == Pubkey::default() {
            return Err(CustomError::InvalidAccount.into());
        }
        if end_time <= start_time {
            return Err(CustomError::InvalidTimeRange.into());
        }
        if energy_amount_kwh == 0 {
            return Err(CustomError::InvalidAmount.into());
        }
        if price_per_kwh_wei == 0 {
            return Err(CustomError::InvalidPrice.into());
        }

        let trade = &mut ctx.accounts.trade;
        if trade.state != TradeState::None {
            return Err(CustomError::TradeAlreadyExists.into());
        }

        let total_cost_wei = energy_amount_kwh
            .checked_mul(price_per_kwh_wei)
            .ok_or(CustomError::MathOverflow)?;

        trade.buyer = buyer;
        trade.seller = seller;
        trade.energy_amount_kwh = energy_amount_kwh;
        trade.price_per_kwh_wei = price_per_kwh_wei;
        trade.start_time = start_time;
        trade.end_time = end_time;
        trade.escrow_amount_wei = 0;
        trade.delivered_kwh = 0;
        trade.state = TradeState::Created;
        trade.total_cost_wei = total_cost_wei;

        emit!(TradeCreated {
            buyer,
            seller,
            energy_amount_kwh,
            price_per_kwh_wei,
            start_time,
            end_time,
            total_cost_wei,
        });

        Ok(())
    }

    /// Deposit exact escrow amount (full upfront payment)
    /// Only callable by buyer; requires state = Created
    pub fn deposit_escrow(ctx: Context<DepositEscrow>, escrow_amount: u64) -> Result<()> {
        let trade = &mut ctx.accounts.trade;

        if trade.state != TradeState::Created {
            return Err(CustomError::InvalidTradeState.into());
        }

        if ctx.accounts.buyer.key() != trade.buyer {
            return Err(CustomError::UnauthorizedAccount.into());
        }

        if escrow_amount != trade.total_cost_wei {
            return Err(CustomError::IncorrectEscrowAmount.into());
        }

        // Transfer SOL/USDC from buyer to program account
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.trade_vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, escrow_amount)?;

        trade.escrow_amount_wei = escrow_amount;
        trade.state = TradeState::Funded;

        emit!(EscrowDeposited {
            buyer: trade.buyer,
            amount_wei: escrow_amount,
        });

        Ok(())
    }

    /// Settle trade with delivered kWh
    /// Only callable by admin; only after endTime; requires state = Funded
    pub fn settle(ctx: Context<Settle>, delivered_kwh: u64) -> Result<()> {
        let trade = &mut ctx.accounts.trade;

        if trade.state != TradeState::Funded {
            return Err(CustomError::InvalidTradeState.into());
        }

        let current_time = Clock::get()?.unix_timestamp as u64;
        if current_time < trade.end_time {
            return Err(CustomError::SettlementTooEarly.into());
        }

        // Calculate settlement amounts
        let payable_kwh = std::cmp::min(delivered_kwh, trade.energy_amount_kwh);
        let seller_payment_wei = payable_kwh
            .checked_mul(trade.price_per_kwh_wei)
            .ok_or(CustomError::MathOverflow)?;
        let refund_wei = trade
            .escrow_amount_wei
            .checked_sub(seller_payment_wei)
            .ok_or(CustomError::MathUnderflow)?;

        // Transfer to seller
        **ctx.accounts.trade_vault.try_borrow_mut_lamports()? -= seller_payment_wei;
        **ctx
            .accounts
            .seller_account
            .try_borrow_mut_lamports()? += seller_payment_wei;

        // Transfer refund to buyer
        **ctx.accounts.trade_vault.try_borrow_mut_lamports()? -= refund_wei;
        **ctx
            .accounts
            .buyer_account
            .try_borrow_mut_lamports()? += refund_wei;

        trade.delivered_kwh = delivered_kwh;
        trade.state = TradeState::Settled;

        emit!(TradeSettled {
            delivered_kwh,
            payable_kwh,
            seller_payment_wei,
            refund_wei,
        });

        Ok(())
    }

    /// Read-only function to get trade state
    pub fn get_trade(ctx: Context<GetTrade>) -> Result<TradeSummary> {
        let trade = &ctx.accounts.trade;
        Ok(TradeSummary {
            buyer: trade.buyer,
            seller: trade.seller,
            energy_amount_kwh: trade.energy_amount_kwh,
            price_per_kwh_wei: trade.price_per_kwh_wei,
            start_time: trade.start_time,
            end_time: trade.end_time,
            escrow_amount_wei: trade.escrow_amount_wei,
            delivered_kwh: trade.delivered_kwh,
            state: trade.state,
            total_cost_wei: trade.total_cost_wei,
        })
    }
}

// ============ ACCOUNTS ============

#[account]
pub struct Trade {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub energy_amount_kwh: u64,
    pub price_per_kwh_wei: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub escrow_amount_wei: u64,
    pub delivered_kwh: u64,
    pub total_cost_wei: u64,
    pub state: TradeState,
}

#[derive(Accounts)]
pub struct CreateTrade<'info> {
    #[account(init, payer = creator, space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1)]
    pub trade: Account<'info, Trade>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositEscrow<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub trade_vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub trade: Account<'info, Trade>,
    pub admin: Signer<'info>,
    #[account(mut)]
    pub trade_vault: AccountInfo<'info>,
    /// CHECK: Seller account receives funds
    #[account(mut)]
    pub seller_account: AccountInfo<'info>,
    /// CHECK: Buyer account receives refund
    #[account(mut)]
    pub buyer_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetTrade<'info> {
    pub trade: Account<'info, Trade>,
}

// ============ STATE ENUM ============

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TradeState {
    None = 0,
    Created = 1,
    Funded = 2,
    Settled = 3,
}

impl fmt::Display for TradeState {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            TradeState::None => write!(f, "None"),
            TradeState::Created => write!(f, "Created"),
            TradeState::Funded => write!(f, "Funded"),
            TradeState::Settled => write!(f, "Settled"),
        }
    }
}

impl Default for TradeState {
    fn default() -> Self {
        TradeState::None
    }
}

// ============ EVENTS ============

#[event]
pub struct TradeCreated {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub energy_amount_kwh: u64,
    pub price_per_kwh_wei: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub total_cost_wei: u64,
}

#[event]
pub struct EscrowDeposited {
    pub buyer: Pubkey,
    pub amount_wei: u64,
}

#[event]
pub struct TradeSettled {
    pub delivered_kwh: u64,
    pub payable_kwh: u64,
    pub seller_payment_wei: u64,
    pub refund_wei: u64,
}

// ============ ERRORS ============

#[error_code]
pub enum CustomError {
    #[msg("Invalid account provided")]
    InvalidAccount = 6000,
    #[msg("Invalid time range")]
    InvalidTimeRange = 6001,
    #[msg("Invalid amount")]
    InvalidAmount = 6002,
    #[msg("Invalid price")]
    InvalidPrice = 6003,
    #[msg("Trade already exists")]
    TradeAlreadyExists = 6004,
    #[msg("Invalid trade state")]
    InvalidTradeState = 6005,
    #[msg("Unauthorized account")]
    UnauthorizedAccount = 6006,
    #[msg("Incorrect escrow amount")]
    IncorrectEscrowAmount = 6007,
    #[msg("Settlement too early")]
    SettlementTooEarly = 6008,
    #[msg("Math overflow")]
    MathOverflow = 6009,
    #[msg("Math underflow")]
    MathUnderflow = 6010,
}

// ============ TYPES ============

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TradeSummary {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub energy_amount_kwh: u64,
    pub price_per_kwh_wei: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub escrow_amount_wei: u64,
    pub delivered_kwh: u64,
    pub state: TradeState,
    pub total_cost_wei: u64,
}
