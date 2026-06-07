import os
import argparse
from config import (
    DEFAULT_START_DATE,
    DEFAULT_END_DATE,
    DEFAULT_INITIAL_CAPITAL,
    DEFAULT_COMMISSION,
    DEFAULT_V20_MIN_PCT_MOVE,
    RESULTS_DIR
)
from data_loader import get_stock_data, download_batch_data
from strategies import V20Strategy
from engine import BacktestEngine
from report_generator import HTMLReportGenerator

def load_tickers_from_file(file_path: str) -> list:
    """Reads ticker symbols from a file, one per line."""
    if not os.path.exists(file_path):
        return []
    tickers = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            val = line.strip()
            if val and not val.startswith("#"):
                if val not in tickers:
                    tickers.append(val)
    return tickers

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
    parser.add_argument("--max-trades", type=int, default=9999,
                        help="Hard cap on concurrent open positions — default is unlimited (portfolio mode)")
    parser.add_argument("--risk-pct", type=float, default=3.0,
                        help="Percentage of current equity to allocate per trade in portfolio mode (default: 3.0)")
    parser.add_argument("--commission", type=float, default=DEFAULT_COMMISSION,
                        help=f"Transaction fee per order (fraction of trade value, default: {DEFAULT_COMMISSION})")
    parser.add_argument("--force-download", action="store_true",
                        help="Force downloading data and ignore local cache")
                        
    args = parser.parse_args()
    
    # 1. Determine which tickers to use
    raw_tickers = []
    file_suffix = "custom"
    if args.tickers:
        raw_tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    elif os.path.exists(args.file):
        raw_tickers = load_tickers_from_file(args.file)
        print(f"Loaded {len(raw_tickers)} tickers from file: {args.file}")
        file_suffix = os.path.splitext(os.path.basename(args.file))[0].lower()

    if not raw_tickers:
        print("Error: No tickers provided. Use --file stocks/v40.txt or --tickers TICKER1,TICKER2")
        return
        
    # Resolve ticker suffixes (append .NS if missing)
    tickers = []
    for t in raw_tickers:
        t_clean = t.strip().upper()
        if t_clean:
            if "." not in t_clean:
                t_clean = t_clean + ".NS"
            tickers.append(t_clean)
            
    # 2. Fetch data
    print_header(f"LOADING STOCK DATA ({args.start} to {args.end})")
    try:
        download_batch_data(tickers, args.start, args.end, force_download=args.force_download)
    except Exception as e:
        print(f"Warning: Batch download failed: {e}. Falling back to individual downloads.")
        
    data_dict = {}
    for ticker in tickers:
        df = get_stock_data(ticker, args.start, args.end)
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
        


    elif args.mode == "portfolio":
        print_header(f"RUNNING PORTFOLIO SIMULATION (CAPITAL: {args.capital:,.2f} | RISK/TRADE: {args.risk_pct}%)")
        results = engine.run_portfolio_simulation(
            data_dict, strategy,
            max_active_trades=args.max_trades,
            risk_pct=args.risk_pct
        )
        
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
        


    # 5. Generate Standalone HTML Report
    print_header("GENERATING HTML VISUAL DASHBOARD")
    report_file = os.path.join(RESULTS_DIR, f"backtest_report_{file_suffix}.html")
    try:
        HTMLReportGenerator.generate(
            backtest_results=results,
            data_dict=data_dict,
            mode=args.mode,
            min_move=args.min_move,
            output_filename=report_file
        )
    except Exception as e:
        print(f"Error generating HTML report: {e}")

if __name__ == "__main__":
    main()
