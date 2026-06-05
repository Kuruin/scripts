import os
import argparse
import pandas as pd
from datetime import datetime
from config import (
    DEFAULT_TICKERS,
    DEFAULT_START_DATE,
    DEFAULT_END_DATE,
    DEFAULT_INITIAL_CAPITAL,
    DEFAULT_COMMISSION,
    DEFAULT_V20_MIN_PCT_MOVE
)
from data_loader import get_stock_data
from strategies import V20Strategy
from engine import BacktestEngine

def load_tickers_from_file(file_path: str) -> list:
    """Reads ticker symbols from a file, one per line."""
    if not os.path.exists(file_path):
        return []
    with open(file_path, 'r') as f:
        tickers = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    return list(set(tickers))

def print_separator(char="=", length=70):
    print(char * length)

def print_header(title: str):
    print_separator()
    print(title.center(70))
    print_separator()

def main():
    parser = argparse.ArgumentParser(description="Python Trading Strategy Backtester")
    
    parser.add_argument("--tickers", type=str, default=None,
                        help="Comma-separated list of ticker symbols (e.g. RELIANCE.NS,TCS.NS)")
    parser.add_argument("--file", type=str, default="tickers.txt",
                        help="Path to file containing tickers (default: tickers.txt)")
    parser.add_argument("--start", type=str, default=DEFAULT_START_DATE,
                        help=f"Start date (YYYY-MM-DD, default: {DEFAULT_START_DATE})")
    parser.add_argument("--end", type=str, default=DEFAULT_END_DATE,
                        help=f"End date (YYYY-MM-DD, default: {DEFAULT_END_DATE})")
    parser.add_argument("--min-move", type=float, default=DEFAULT_V20_MIN_PCT_MOVE,
                        help=f"V20 min percentage move (default: {DEFAULT_V20_MIN_PCT_MOVE})")
    parser.add_argument("--mode", type=str, choices=["individual", "portfolio"], default="individual",
                        help="Simulation mode: individual (raw stats) or portfolio (capital simulation)")
    parser.add_argument("--capital", type=float, default=DEFAULT_INITIAL_CAPITAL,
                        help=f"Initial capital (default: {DEFAULT_INITIAL_CAPITAL})")
    parser.add_argument("--max-trades", type=int, default=10,
                        help="Maximum concurrent trades in portfolio mode (default: 10)")
    parser.add_argument("--commission", type=float, default=DEFAULT_COMMISSION,
                        help=f"Transaction fee per order (fraction of trade value, default: {DEFAULT_COMMISSION})")
    parser.add_argument("--force-download", action="store_true",
                        help="Force downloading data and ignore local cache")
                        
    args = parser.parse_args()
    
    # 1. Determine which tickers to use
    tickers = []
    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    elif os.path.exists(args.file):
        tickers = load_tickers_from_file(args.file)
        print(f"Loaded {len(tickers)} tickers from file: {args.file}")
    
    if not tickers:
        tickers = DEFAULT_TICKERS
        print(f"Using default ticker list ({len(tickers)} tickers).")
        
    # 2. Fetch data
    print_header(f"LOADING STOCK DATA ({args.start} to {args.end})")
    data_dict = {}
    for ticker in tickers:
        df = get_stock_data(ticker, args.start, args.end, force_download=args.force_download)
        if not df.empty:
            data_dict[ticker] = df
            
    if not data_dict:
        print("Error: No data loaded for any stock ticker. Exiting.")
        return
        
    print(f"\nSuccessfully loaded data for {len(data_dict)} / {len(tickers)} stocks.")
    
    # 3. Instantiate Strategy and Engine
    strategy = V20Strategy(min_pct_move=args.min_move)
    engine = BacktestEngine(initial_capital=args.capital, commission=args.commission)
    
    # 4. Run Backtest
    if args.mode == "individual":
        print_header("RUNNING INDIVIDUAL STOCK STATISTICAL BACKTEST (UNLIMITED CAPITAL)")
        results = engine.run_individual_analysis(data_dict, strategy)
        
        trades = results["trades"]
        ticker_summary = results["ticker_summary"]
        overall = results["overall_summary"]
        
        # Print Overall Stats
        print_header("V20 STRATEGY OVERALL PERFORMANCE")
        print(f"{'Metric':<35} | {'Value':<30}")
        print_separator("-")
        print(f"{'Total Registered Signals':<35} | {overall['total_trades']:>10}")
        print(f"{'Filled Trades':<35} | {overall['filled_trades']:>10}")
        print(f"{'Pending (Unfilled) Trades':<35} | {overall['pending_trades']:>10}")
        print(f"{'Completed (Closed) Trades':<35} | {overall['completed_trades']:>10}")
        print(f"{'Open (Active) Trades':<35} | {overall['open_trades']:>10}")
        print(f"{'Win Rate (Completed Trades)':<35} | {overall['win_rate_pct']:>9.2f} %")
        print(f"{'Average PnL % per Filled Trade':<35} | {overall['avg_return_pct']:>9.2f} %")
        print(f"{'Average Holding Days':<35} | {overall['avg_holding_days']:>9.1f} days")
        print(f"{'Profit Factor':<35} | {overall['profit_factor']:>10.2f}")
        print(f"{'Max Adverse Excursion (Max Drawdown)':<35} | {overall['max_mae_pct']:>9.2f} %")
        print_separator()
        
        # Save Trades CSV
        trades_list = []
        for t in trades:
            trades_list.append({
                'Ticker': t.ticker,
                'SetupDate': t.setup_date.strftime("%Y-%m-%d") if t.setup_date else "",
                'TriggerDate': t.trigger_date.strftime("%Y-%m-%d") if t.trigger_date else "",
                'FillDate': t.fill_date.strftime("%Y-%m-%d") if t.fill_date else "N/A",
                'ExitDate': t.exit_date.strftime("%Y-%m-%d") if t.exit_date else "N/A",
                'EntryPrice': t.entry_price,
                'ExitPrice': t.exit_price if t.exit_price else "N/A",
                'PnL_%': round(t.pnl_pct, 2),
                'HoldingDays': t.holding_days,
                'Status': t.status,
                'MaxPaperLoss_%': round(t.max_drawdown_pct, 2),
                'InitialMove_%': round(t.initial_move_pct, 2)
            })
        trades_df = pd.DataFrame(trades_list)
        trades_df.to_csv("results_trades_individual.csv", index=False)
        print("Saved trade list to: results_trades_individual.csv")
        
        # Save Ticker Summary CSV
        summary_list = []
        for tick, s in ticker_summary.items():
            summary_list.append({
                'Ticker': tick,
                'TotalTrades': s['total_trades'],
                'FilledTrades': s['filled_trades'],
                'CompletedTrades': s['completed_trades'],
                'OpenTrades': s['open_trades'],
                'PendingTrades': s['pending_trades'],
                'WinRate_%': round(s['win_rate_pct'], 2),
                'AvgReturn_%': round(s['avg_return_pct'], 2),
                'AvgHoldingDays': round(s['avg_holding_days'], 1),
                'ProfitFactor': round(s['profit_factor'], 2),
                'MaxMAE_%': round(s['max_mae_pct'], 2)
            })
        summary_df = pd.DataFrame(summary_list)
        summary_df.to_csv("results_tickers_individual.csv", index=False)
        print("Saved stock-by-stock summary to: results_tickers_individual.csv")

    elif args.mode == "portfolio":
        print_header(f"RUNNING PORTFOLIO SIMULATION (CAPITAL: {args.capital:,.2f})")
        results = engine.run_portfolio_simulation(data_dict, strategy, max_active_trades=args.max_trades)
        
        trades = results["trades"]
        equity = results["equity_curve"]
        summary = results["summary"]
        
        if not summary:
            print("No trades executed in portfolio backtest.")
            return
            
        trade_stats = summary["trade_stats"]
        
        # Print Portfolio Performance
        print(f"{'Metric':<35} | {'Value':<30}")
        print_separator("-")
        print(f"{'Initial Capital':<35} | {summary['initial_capital']:>13,.2f}")
        print(f"{'Final Portfolio Value':<35} | {summary['final_equity']:>13,.2f}")
        print(f"{'Total Portfolio Return':<35} | {summary['total_return_pct']:>11.2f} %")
        print(f"{'Annualized Return (CAGR)':<35} | {summary['annualized_return_pct']:>11.2f} %")
        print(f"{'Annualized Volatility':<35} | {summary['annualized_volatility_pct']:>11.2f} %")
        print(f"{'Sharpe Ratio':<35} | {summary['sharpe_ratio']:>13.2f}")
        print(f"{'Maximum Portfolio Drawdown':<35} | {summary['max_drawdown_pct']:>11.2f} %")
        print_separator("-")
        print(f"{'Total Portfolio Setup Signals':<35} | {trade_stats['total_trades']:>13}")
        print(f"{'Portfolio Filled Trades':<35} | {trade_stats['filled_trades']:>13}")
        print(f"{'Portfolio Closed Trades':<35} | {trade_stats['completed_trades']:>13}")
        print(f"{'Portfolio Open Trades':<35} | {trade_stats['open_trades']:>13}")
        print(f"{'Portfolio Pending Trades':<35} | {trade_stats['pending_trades']:>13}")
        print(f"{'Trade Win Rate':<35} | {trade_stats['win_rate_pct']:>11.2f} %")
        print(f"{'Average Return per Trade':<35} | {trade_stats['avg_return_pct']:>11.2f} %")
        print(f"{'Average Holding Days':<35} | {trade_stats['avg_holding_days']:>11.1f} days")
        print(f"{'Trade Profit Factor':<35} | {trade_stats['profit_factor']:>13.2f}")
        print_separator()
        
        # Save Trades CSV
        trades_list = []
        for t in trades:
            trades_list.append({
                'Ticker': t.ticker,
                'SetupDate': t.setup_date.strftime("%Y-%m-%d") if t.setup_date else "",
                'TriggerDate': t.trigger_date.strftime("%Y-%m-%d") if t.trigger_date else "",
                'FillDate': t.fill_date.strftime("%Y-%m-%d") if t.fill_date else "N/A",
                'ExitDate': t.exit_date.strftime("%Y-%m-%d") if t.exit_date else "N/A",
                'EntryPrice': t.entry_price,
                'ExitPrice': t.exit_price if t.exit_price else "N/A",
                'PnL_%': round(t.pnl_pct, 2),
                'HoldingDays': t.holding_days,
                'Status': t.status,
                'MaxPaperLoss_%': round(t.max_drawdown_pct, 2)
            })
        trades_df = pd.DataFrame(trades_list)
        trades_df.to_csv("results_trades_portfolio.csv", index=False)
        print("Saved portfolio trade list to: results_trades_portfolio.csv")
        
        # Save Equity Curve CSV
        equity_df = pd.DataFrame(equity).reset_index()
        equity_df.columns = ['Date', 'Equity']
        # Format Date column
        equity_df['Date'] = equity_df['Date'].dt.strftime("%Y-%m-%d")
        equity_df.to_csv("results_equity_curve.csv", index=False)
        print("Saved daily equity curve to: results_equity_curve.csv")

if __name__ == "__main__":
    main()
