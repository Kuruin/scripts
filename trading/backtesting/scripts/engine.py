import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
from datetime import datetime

@dataclass
class Trade:
    ticker: str
    setup_date: datetime
    trigger_date: datetime
    fill_date: datetime
    exit_date: datetime
    entry_price: float
    exit_price: float
    pnl_pct: float
    holding_days: int
    status: str  # "COMPLETED", "OPEN", "PENDING"
    max_drawdown_pct: float  # Maximum paper loss during the trade (MAE)
    initial_move_pct: float
    shares: float = 0.0
    pnl_cash: float = 0.0

class BacktestEngine:
    """Runs trading simulations and calculates performance metrics."""
    
    def __init__(self, initial_capital: float = 100000.0, commission: float = 0.0):
        self.initial_capital = initial_capital
        self.commission = commission

    def run_individual_analysis(
        self, 
        data_dict: Dict[str, pd.DataFrame], 
        strategy
    ) -> Dict[str, Any]:
        """
        Runs backtest on each stock independently.
        Assumes unlimited capital to generate raw stats for all setups.
        """
        all_trades: List[Trade] = []
        summary_by_ticker = {}
        
        for ticker, df in data_dict.items():
            if df.empty:
                continue
                
            setups = strategy.generate_setups(df)
            ticker_trades = []
            
            for setup in setups:
                setup_date = setup['setup_date']
                trigger_date = setup['trigger_date']
                entry_limit = setup['entry_price']
                target_limit = setup['target_price']
                initial_move = setup['initial_move_pct']
                
                # Find the fill date: first bar after trigger_date where Low <= entry_limit
                post_trigger_df = df.loc[trigger_date:]
                if len(post_trigger_df) <= 1:
                    # Not enough days after trigger to fill
                    all_trades.append(Trade(
                        ticker=ticker, setup_date=setup_date, trigger_date=trigger_date,
                        fill_date=None, exit_date=None, entry_price=entry_limit, exit_price=None,
                        pnl_pct=0.0, holding_days=0, status="PENDING", max_drawdown_pct=0.0,
                        initial_move_pct=initial_move
                    ))
                    continue
                
                # Exclude the trigger day itself for the entry (since signal is confirmed on close)
                trade_search_df = post_trigger_df.iloc[1:]
                
                fill_mask = trade_search_df['Low'] <= entry_limit
                if not fill_mask.any():
                    # Limit order never touched, setup remained pending
                    all_trades.append(Trade(
                        ticker=ticker, setup_date=setup_date, trigger_date=trigger_date,
                        fill_date=None, exit_date=None, entry_price=entry_limit, exit_price=None,
                        pnl_pct=0.0, holding_days=0, status="PENDING", max_drawdown_pct=0.0,
                        initial_move_pct=initial_move
                    ))
                    continue
                    
                fill_date = trade_search_df[fill_mask].index[0]
                fill_idx = df.index.get_loc(fill_date)
                
                # Actual entry price (takes into account gap downs below our limit price)
                fill_bar = df.loc[fill_date]
                entry_price = min(entry_limit, fill_bar['Open'])
                
                # Calculate entry commission
                entry_price_with_fee = entry_price * (1 + self.commission)
                
                # Find exit date: first bar after fill_date where High >= target_limit
                post_fill_df = df.iloc[fill_idx + 1:]
                if post_fill_df.empty:
                    # Filled on the last available day, so it remains open
                    last_close = df.iloc[-1]['Close']
                    pnl_pct = ((last_close - entry_price_with_fee) / entry_price_with_fee) * 100
                    nominal_size = 100000.0
                    all_trades.append(Trade(
                        ticker=ticker, setup_date=setup_date, trigger_date=trigger_date,
                        fill_date=fill_date, exit_date=None, entry_price=entry_price, exit_price=last_close,
                        pnl_pct=pnl_pct, holding_days=0, status="OPEN", max_drawdown_pct=0.0,
                        initial_move_pct=initial_move,
                        shares=nominal_size / entry_price,
                        pnl_cash=nominal_size * (pnl_pct / 100.0)
                    ))
                    continue
                    
                exit_mask = post_fill_df['High'] >= target_limit
                
                if exit_mask.any():
                    exit_date = post_fill_df[exit_mask].index[0]
                    exit_bar = df.loc[exit_date]
                    exit_price = max(target_limit, exit_bar['Open'])
                    
                    # Deduct exit commission
                    exit_price_net = exit_price * (1 - self.commission)
                    pnl_pct = ((exit_price_net - entry_price_with_fee) / entry_price_with_fee) * 100
                    holding_days = (exit_date - fill_date).days
                    status = "COMPLETED"
                    
                    # Calculate Maximum Adverse Excursion (MAE) / trade drawdown
                    trade_period_df = df.loc[fill_date:exit_date]
                    lowest_low_during_trade = trade_period_df['Low'].min()
                    max_drawdown_pct = ((lowest_low_during_trade - entry_price) / entry_price) * 100
                else:
                    exit_date = None
                    exit_price = df.iloc[-1]['Close']
                    pnl_pct = ((exit_price - entry_price_with_fee) / entry_price_with_fee) * 100
                    holding_days = (df.index[-1] - fill_date).days
                    status = "OPEN"
                    
                    # Calculate MAE up to current day
                    trade_period_df = df.loc[fill_date:]
                    lowest_low_during_trade = trade_period_df['Low'].min()
                    max_drawdown_pct = ((lowest_low_during_trade - entry_price) / entry_price) * 100
                    
                nominal_size = 100000.0
                trade_obj = Trade(
                    ticker=ticker, setup_date=setup_date, trigger_date=trigger_date,
                    fill_date=fill_date, exit_date=exit_date, entry_price=entry_price, exit_price=exit_price,
                    pnl_pct=pnl_pct, holding_days=holding_days, status=status,
                    max_drawdown_pct=max_drawdown_pct, initial_move_pct=initial_move,
                    shares=nominal_size / entry_price,
                    pnl_cash=nominal_size * (pnl_pct / 100.0)
                )
                
                all_trades.append(trade_obj)
                ticker_trades.append(trade_obj)
                
            # Aggregate stats for this ticker
            summary_by_ticker[ticker] = self._calculate_aggregate_stats(ticker_trades)
            
        overall_stats = self._calculate_aggregate_stats(all_trades)
        
        return {
            "trades": all_trades,
            "ticker_summary": summary_by_ticker,
            "overall_summary": overall_stats
        }

    def run_portfolio_simulation(
        self,
        data_dict: Dict[str, pd.DataFrame],
        strategy,
        max_active_trades: int = 10
    ) -> Dict[str, Any]:
        """
        Simulates realistic portfolio trading day-by-day.
        Allocates equal weight (1 / max_active_trades) of capital per trade.
        """
        # Step 1: Align all data on a common calendar timeline
        # Get all unique trading dates across all stock datasets
        all_dates_set = set()
        for df in data_dict.values():
            if not df.empty:
                all_dates_set.update(df.index)
        all_dates = sorted(list(all_dates_set))
        
        if not all_dates:
            return {"trades": [], "equity_curve": pd.Series(), "summary": {}}
            
        # Generate setups for all tickers ahead of time
        # Key: trigger_date, Value: list of setups
        setups_by_trigger_date: Dict[datetime, List[Dict[str, Any]]] = {}
        for ticker, df in data_dict.items():
            if df.empty:
                continue
            setups = strategy.generate_setups(df)
            for setup in setups:
                setup['ticker'] = ticker
                t_date = setup['trigger_date']
                if t_date not in setups_by_trigger_date:
                    setups_by_trigger_date[t_date] = []
                setups_by_trigger_date[t_date].append(setup)
                
        # State variables for day-by-day simulation
        cash = self.initial_capital
        active_positions: List[Dict[str, Any]] = []  # List of dicts representing open positions
        pending_orders: List[Dict[str, Any]] = []     # List of active limit orders
        completed_trades: List[Trade] = []
        equity_curve: List[Tuple[datetime, float]] = []
        
        # Max allocation budget per trade
        fixed_allocation = self.initial_capital / max_active_trades
        
        for date in all_dates:
            # 1. Process exits for active positions first
            still_active = []
            for pos in active_positions:
                ticker = pos['ticker']
                df = data_dict[ticker]
                
                # Check if this date has a trading bar for this stock
                if date in df.index:
                    row = df.loc[date]
                    # If high reaches or exceeds target price, close position
                    if row['High'] >= pos['target_price']:
                        exit_price = max(pos['target_price'], row['Open'])
                        exit_val = pos['shares'] * exit_price * (1 - self.commission)
                        cash += exit_val
                        
                        # Calculate final holding days & MAE
                        holding_days = (date - pos['fill_date']).days
                        trade_period_df = df.loc[pos['fill_date']:date]
                        lowest_low = trade_period_df['Low'].min()
                        max_drawdown = ((lowest_low - pos['entry_price']) / pos['entry_price']) * 100
                        
                        trade_obj = Trade(
                            ticker=ticker, setup_date=pos['setup_date'], trigger_date=pos['trigger_date'],
                            fill_date=pos['fill_date'], exit_date=date, entry_price=pos['entry_price'],
                            exit_price=exit_price, pnl_pct=((exit_price * (1 - self.commission) - pos['entry_price'] * (1 + self.commission)) / (pos['entry_price'] * (1 + self.commission))) * 100,
                            holding_days=holding_days, status="COMPLETED", max_drawdown_pct=max_drawdown,
                            initial_move_pct=pos['initial_move_pct'],
                            shares=pos['shares'],
                            pnl_cash=exit_val - (pos['shares'] * pos['entry_price'] * (1 + self.commission))
                        )
                        completed_trades.append(trade_obj)
                    else:
                        still_active.append(pos)
                else:
                    still_active.append(pos)
            active_positions = still_active
            
            # 2. Add new setups triggered on this date to pending limit orders
            if date in setups_by_trigger_date:
                for setup in setups_by_trigger_date[date]:
                    pending_orders.append({
                        'ticker': setup['ticker'],
                        'setup_date': setup['setup_date'],
                        'trigger_date': setup['trigger_date'],
                        'entry_limit': setup['entry_price'],
                        'target_price': setup['target_price'],
                        'initial_move_pct': setup['initial_move_pct']
                    })
                    
            # 3. Process entries for pending limit orders
            still_pending = []
            for order in pending_orders:
                ticker = order['ticker']
                df = data_dict[ticker]
                
                # Limit orders can only be filled on dates *after* the trigger date
                if date in df.index and date > order['trigger_date']:
                    row = df.loc[date]
                    # Check if limit price touched and we have a slot available in portfolio
                    if row['Low'] <= order['entry_limit'] and len(active_positions) < max_active_trades:
                        entry_price = min(order['entry_limit'], row['Open'])
                        entry_cost = entry_price * (1 + self.commission)
                        
                        # Allocation size is capped by available cash or the standard slot size
                        trade_cash_allocated = min(fixed_allocation, cash)
                        
                        if trade_cash_allocated >= 100.0:  # Avoid dust orders
                            shares = trade_cash_allocated / entry_cost
                            cash -= (shares * entry_cost)
                            
                            active_positions.append({
                                'ticker': ticker,
                                'setup_date': order['setup_date'],
                                'trigger_date': order['trigger_date'],
                                'fill_date': date,
                                'entry_price': entry_price,
                                'target_price': order['target_price'],
                                'shares': shares,
                                'initial_move_pct': order['initial_move_pct']
                            })
                        else:
                            # Not enough cash to execute the order, keep it pending
                            still_pending.append(order)
                    else:
                        # Order not filled or portfolio is full, keep it pending
                        still_pending.append(order)
                else:
                    # Order trigger was today or stock not traded today, keep it pending
                    still_pending.append(order)
            pending_orders = still_pending
            
            # 4. Calculate total portfolio equity at the end of today
            current_equity = cash
            for pos in active_positions:
                ticker = pos['ticker']
                df = data_dict[ticker]
                # Value at today's close if available, else last known close
                if date in df.index:
                    close_price = df.loc[date, 'Close']
                else:
                    # Find last close prior to this date
                    prior_df = df.loc[:date]
                    close_price = prior_df.iloc[-1]['Close'] if not prior_df.empty else pos['entry_price']
                current_equity += pos['shares'] * close_price
                
            equity_curve.append((date, current_equity))
            
        # 5. Handle open positions and pending orders at the end of the simulation
        last_date = all_dates[-1]
        for pos in active_positions:
            ticker = pos['ticker']
            df = data_dict[ticker]
            last_close = df.iloc[-1]['Close']
            holding_days = (last_date - pos['fill_date']).days
            
            # Calculate final MAE
            trade_period_df = df.loc[pos['fill_date']:]
            lowest_low = trade_period_df['Low'].min()
            max_drawdown = ((lowest_low - pos['entry_price']) / pos['entry_price']) * 100
            
            entry_val = pos['shares'] * pos['entry_price'] * (1 + self.commission)
            current_val = pos['shares'] * last_close
            trade_obj = Trade(
                ticker=ticker, setup_date=pos['setup_date'], trigger_date=pos['trigger_date'],
                fill_date=pos['fill_date'], exit_date=None, entry_price=pos['entry_price'],
                exit_price=last_close, pnl_pct=((last_close - pos['entry_price'] * (1 + self.commission)) / (pos['entry_price'] * (1 + self.commission))) * 100,
                holding_days=holding_days, status="OPEN", max_drawdown_pct=max_drawdown,
                initial_move_pct=pos['initial_move_pct'],
                shares=pos['shares'],
                pnl_cash=current_val - entry_val
            )
            completed_trades.append(trade_obj)
            
        for order in pending_orders:
            trade_obj = Trade(
                ticker=order['ticker'], setup_date=order['setup_date'], trigger_date=order['trigger_date'],
                fill_date=None, exit_date=None, entry_price=order['entry_limit'], exit_price=None,
                pnl_pct=0.0, holding_days=0, status="PENDING", max_drawdown_pct=0.0,
                initial_move_pct=order['initial_move_pct'],
                shares=0.0,
                pnl_cash=0.0
            )
            completed_trades.append(trade_obj)
            
        # Convert equity curve to pandas series
        equity_series = pd.DataFrame(equity_curve, columns=['Date', 'Equity']).set_index('Date')['Equity']
        
        # Calculate portfolio metrics
        summary = self._calculate_portfolio_metrics(equity_series, completed_trades)
        
        return {
            "trades": completed_trades,
            "equity_curve": equity_series,
            "summary": summary
        }

    def _calculate_aggregate_stats(self, trades: List[Trade]) -> Dict[str, Any]:
        """Calculates statistical summary metrics for a list of trades."""
        filled_trades = [t for t in trades if t.status != "PENDING"]
        completed_trades = [t for t in trades if t.status == "COMPLETED"]
        open_trades = [t for t in trades if t.status == "OPEN"]
        pending_trades = [t for t in trades if t.status == "PENDING"]
        
        total_trades = len(trades)
        filled_count = len(filled_trades)
        completed_count = len(completed_trades)
        open_count = len(open_trades)
        pending_count = len(pending_trades)
        
        if filled_count == 0:
            return {
                "total_trades": total_trades,
                "filled_trades": 0,
                "completed_trades": 0,
                "open_trades": 0,
                "pending_trades": pending_count,
                "win_rate_pct": 0.0,
                "avg_return_pct": 0.0,
                "avg_holding_days": 0.0,
                "profit_factor": 0.0,
                "max_mae_pct": 0.0
            }
            
        # Win rate is based on completed trades
        wins = [t for t in completed_trades if t.pnl_pct > 0]
        losses = [t for t in completed_trades if t.pnl_pct <= 0]
        win_rate = (len(wins) / completed_count * 100) if completed_count > 0 else 0.0
        
        # Profit factor
        gross_profits = sum([t.pnl_pct for t in wins])
        gross_losses = abs(sum([t.pnl_pct for t in losses]))
        profit_factor = (gross_profits / gross_losses) if gross_losses > 0 else np.inf if gross_profits > 0 else 1.0
        
        avg_return = sum([t.pnl_pct for t in filled_trades]) / filled_count
        avg_holding = sum([t.holding_days for t in filled_trades]) / filled_count
        
        # Max adverse excursion across all filled trades
        max_mae = min([t.max_drawdown_pct for t in filled_trades]) if filled_trades else 0.0
        
        return {
            "total_trades": total_trades,
            "filled_trades": filled_count,
            "completed_trades": completed_count,
            "open_trades": open_count,
            "pending_trades": pending_count,
            "win_rate_pct": win_rate,
            "avg_return_pct": avg_return,
            "avg_holding_days": avg_holding,
            "profit_factor": profit_factor,
            "max_mae_pct": max_mae
        }

    def _calculate_portfolio_metrics(self, equity: pd.Series, trades: List[Trade]) -> Dict[str, Any]:
        """Calculates performance metrics for the portfolio equity curve."""
        if equity.empty:
            return {}
            
        total_return = (equity.iloc[-1] / self.initial_capital - 1) * 100
        
        # Daily returns
        daily_returns = equity.pct_change().dropna()
        
        # Annualized return (assuming 252 trading days per year)
        n_days = len(equity)
        years = n_days / 252.0
        annualized_return = ((equity.iloc[-1] / self.initial_capital) ** (1 / years) - 1) * 100 if years > 0 else 0.0
        
        # Annualized volatility
        ann_vol = daily_returns.std() * np.sqrt(252) * 100
        
        # Sharpe ratio (assuming 0 risk free rate for simplicity)
        sharpe = (annualized_return / ann_vol) if ann_vol > 0 else 0.0
        
        # Drawdowns
        rolling_max = equity.cummax()
        drawdowns = (equity - rolling_max) / rolling_max * 100
        max_drawdown = drawdowns.min()
        
        # Trade statistics
        trade_stats = self._calculate_aggregate_stats(trades)
        
        return {
            "initial_capital": self.initial_capital,
            "final_equity": equity.iloc[-1],
            "total_return_pct": total_return,
            "annualized_return_pct": annualized_return,
            "annualized_volatility_pct": ann_vol,
            "sharpe_ratio": sharpe,
            "max_drawdown_pct": max_drawdown,
            "trade_stats": trade_stats
        }
