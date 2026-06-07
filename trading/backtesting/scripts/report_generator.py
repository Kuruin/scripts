import os
import json
import pandas as pd
import numpy as np
from datetime import datetime

class HTMLReportGenerator:
    """Generates a standalone, self-contained HTML/JS dashboard for backtesting results."""
    
    @staticmethod
    def _convert_numpy(obj):
        """Helper to convert numpy types for JSON serialization."""
        if isinstance(obj, (np.int64, np.int32, np.integer)):
            return int(obj)
        elif isinstance(obj, (np.float64, np.float32, np.floating)):
            return float(obj)
        elif isinstance(obj, (datetime, pd.Timestamp)):
            return obj.strftime("%Y-%m-%d")
        elif isinstance(obj, pd.Series):
            return obj.tolist()
        elif isinstance(obj, pd.DataFrame):
            return obj.to_dict(orient='records')
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    @classmethod
    def generate(
        cls, 
        backtest_results: dict, 
        data_dict: dict, 
        mode: str, 
        min_move: float,
        output_filename: str = "backtest_report.html"
    ):
        """
        Generates the standalone HTML report.
        
        Args:
            backtest_results: The dictionary returned by the backtesting engine.
            data_dict: Dictionary of stock ticker -> pd.DataFrame containing OHLCV.
            mode: "individual" or "portfolio"
            min_move: V20 min percent move configuration
            output_filename: Output path of the HTML file.
        """
        # 1. Format Trades for JSON
        trades = backtest_results.get("trades", [])
        trades_json_list = []
        for t in trades:
            trades_json_list.append({
                'ticker': t.ticker,
                'setup_date': t.setup_date.strftime("%Y-%m-%d") if t.setup_date else "",
                'trigger_date': t.trigger_date.strftime("%Y-%m-%d") if t.trigger_date else "",
                'fill_date': t.fill_date.strftime("%Y-%m-%d") if t.fill_date else None,
                'exit_date': t.exit_date.strftime("%Y-%m-%d") if t.exit_date else None,
                'entry_price': float(t.entry_price),
                'exit_price': float(t.exit_price) if t.exit_price is not None else None,
                'pnl_pct': float(t.pnl_pct),
                'holding_days': int(t.holding_days),
                'status': t.status,
                'max_drawdown_pct': float(t.max_drawdown_pct),
                'initial_move_pct': float(t.initial_move_pct),
                'shares': float(getattr(t, 'shares', 0.0)),
                'pnl_cash': float(getattr(t, 'pnl_cash', 0.0))
            })
            
        # 2. Format Daily Price Data for Candlesticks
        # Convert daily dataframes to compact JSON format
        prices_json_dict = {}
        for ticker, df in data_dict.items():
            if df.empty:
                continue
            records = []
            for date, row in df.iterrows():
                records.append({
                    'date': date.strftime("%Y-%m-%d"),
                    'o': float(row['Open']),
                    'h': float(row['High']),
                    'l': float(row['Low']),
                    'c': float(row['Close'])
                })
            prices_json_dict[ticker] = records
            
        # 3. Format Summary Stats
        if mode == "portfolio":
            summary = backtest_results["summary"]
            equity_curve = backtest_results["equity_curve"]
            equity_json_list = [{"date": idx.strftime("%Y-%m-%d"), "val": float(val)} for idx, val in equity_curve.items()]
            ledger = backtest_results.get("ledger", [])
            
            # Drawdowns
            rolling_max = equity_curve.cummax()
            drawdown_curve = ((equity_curve - rolling_max) / rolling_max) * 100
            dd_json_list = [{"date": idx.strftime("%Y-%m-%d"), "val": float(val)} for idx, val in drawdown_curve.items()]
            
            portfolio_summary = {
                'initial_capital': float(summary['initial_capital']),
                'final_equity': float(summary['final_equity']),
                'total_return_pct': float(summary['total_return_pct']),
                'annualized_return_pct': float(summary['annualized_return_pct']),
                'annualized_volatility_pct': float(summary['annualized_volatility_pct']),
                'sharpe_ratio': float(summary['sharpe_ratio']),
                'max_drawdown_pct': float(summary['max_drawdown_pct']),
                'total_trades': int(summary['trade_stats']['total_trades']),
                'filled_trades': int(summary['trade_stats']['filled_trades']),
                'completed_trades': int(summary['trade_stats']['completed_trades']),
                'open_trades': int(summary['trade_stats']['open_trades']),
                'pending_trades': int(summary['trade_stats']['pending_trades']),
                'win_rate_pct': float(summary['trade_stats']['win_rate_pct']),
                'avg_return_pct': float(summary['trade_stats']['avg_return_pct']),
                'avg_holding_days': float(summary['trade_stats']['avg_holding_days']),
                'profit_factor': float(summary['trade_stats']['profit_factor']) if summary['trade_stats']['profit_factor'] != np.inf else "Infinity"
            }
            tickers_summary = {}
        else:
            portfolio_summary = {}
            equity_json_list = []
            dd_json_list = []
            ledger = []
            
            # Stock by stock aggregations
            tickers_summary = {}
            for ticker, s in backtest_results["ticker_summary"].items():
                tickers_summary[ticker] = {
                    'total_trades': int(s['total_trades']),
                    'filled_trades': int(s['filled_trades']),
                    'completed_trades': int(s['completed_trades']),
                    'open_trades': int(s['open_trades']),
                    'pending_trades': int(s['pending_trades']),
                    'win_rate_pct': float(s['win_rate_pct']),
                    'avg_return_pct': float(s['avg_return_pct']),
                    'avg_holding_days': float(s['avg_holding_days']),
                    'max_mae_pct': float(s['max_mae_pct']),
                    'profit_factor': float(s['profit_factor']) if s['profit_factor'] != np.inf else "Infinity"
                }

        # 4. Serialize Everything
        data = {
            'mode': mode,
            'min_move': min_move,
            'trades': trades_json_list,
            'prices': prices_json_dict,
            'portfolio_summary': portfolio_summary,
            'tickers_summary': tickers_summary,
            'equity_curve': equity_json_list,
            'drawdown_curve': dd_json_list,
            'ledger': ledger,
            'tickers_list': list(data_dict.keys()),
            'generation_time': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        json_data_str = json.dumps(data, default=cls._convert_numpy)
        
        # 5. Build HTML content
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>V20 Backtest Report - Standalone Dashboard</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- TradingView Lightweight Charts -->
    <script src="https://unpkg.com/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"></script>
    <!-- Plotly.js (for equity/drawdown/distribution charts) -->
    <script src="https://cdn.plot.ly/plotly-2.26.0.min.js"></script>
    <style>
        body {{
            background-color: #0b0f19;
            color: #f1f5f9;
        }}
        .card {{
            background-color: #111827;
            border: 1px solid #1f2937;
        }}
        .nav-tab.active {{
            border-bottom: 2px solid #3b82f6;
            color: #3b82f6;
        }}
        /* Customize scrollbars */
        ::-webkit-scrollbar {{
            width: 8px;
            height: 8px;
        }}
        ::-webkit-scrollbar-track {{
            background: #0b0f19;
        }}
        ::-webkit-scrollbar-thumb {{
            background: #1f2937;
            border-radius: 4px;
        }}
        ::-webkit-scrollbar-thumb:hover {{
            background: #374151;
        }}
        /* TradingView chart container */
        #tv-chart-container {{
            position: relative;
            width: 100%;
            height: 520px;
            border-radius: 8px;
            overflow: hidden;
        }}
        /* Zoom button active state */
        .zoom-btn.active {{
            background-color: #1d4ed8;
            color: #fff;
        }}
    </style>
</head>
<body class="min-h-screen flex flex-col font-sans">
    <!-- Navbar -->
    <header class="card border-b border-gray-800 px-6 py-4 flex items-center justify-between shadow-lg">
        <div>
            <h1 class="text-xl font-bold flex items-center gap-2 text-white">
                📈 V20 Strategy Backtest Dashboard
            </h1>
            <p class="text-xs text-gray-400 mt-1">Generated: <span id="gen-time"></span> | Strategy: V20 (Volatility 20%)</p>
        </div>
        <div class="flex items-center gap-4">
            <span class="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-900/30 text-blue-400 border border-blue-800/40">
                Mode: <span id="run-mode" class="capitalize"></span>
            </span>
            <span class="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-900/30 text-green-400 border border-green-800/40">
                Min Move: <span id="param-move"></span>%
            </span>
        </div>
    </header>

    <!-- Main Content Container -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        <!-- Tabs bar -->
        <nav class="flex border-b border-gray-800 gap-6 text-sm font-medium">
            <button id="tab-btn-dashboard" class="nav-tab py-2 px-1 text-gray-400 hover:text-white transition active" onclick="switchTab('dashboard')">📊 Summary Dashboard</button>
            <button id="tab-btn-charts" class="nav-tab py-2 px-1 text-gray-400 hover:text-white transition" onclick="switchTab('charts')">📈 Interactive Charts</button>
            <button id="tab-btn-trades" class="nav-tab py-2 px-1 text-gray-400 hover:text-white transition" onclick="switchTab('trades')">💼 Detailed Trade Log</button>
            <button id="tab-btn-tickers" class="nav-tab py-2 px-1 text-gray-400 hover:text-white transition" onclick="switchTab('tickers')">🗃️ Stock Performance</button>
            <button id="tab-btn-journey" class="nav-tab py-2 px-1 text-gray-400 hover:text-white transition hidden" onclick="switchTab('journey')">💰 Capital Journey</button>
        </nav>

        <!-- ============================================== -->
        <!-- TAB 1: SUMMARY DASHBOARD -->
        <!-- ============================================== -->
        <div id="tab-dashboard" class="tab-content flex flex-col gap-6">
            <!-- Row 1: KPI Stats Cards -->
            <div id="portfolio-kpi-row" class="grid grid-cols-2 md:grid-cols-5 gap-4 hidden">
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Final Value</span>
                    <span id="kpi-final" class="text-xl font-bold mt-2 text-white">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Total Return</span>
                    <span id="kpi-return" class="text-xl font-bold mt-2 text-green-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">CAGR (Annualized)</span>
                    <span id="kpi-cagr" class="text-xl font-bold mt-2 text-blue-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Sharpe Ratio</span>
                    <span id="kpi-sharpe" class="text-xl font-bold mt-2 text-purple-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Max Drawdown</span>
                    <span id="kpi-drawdown" class="text-xl font-bold mt-2 text-red-400">-</span>
                </div>
            </div>

            <div id="individual-kpi-row" class="grid grid-cols-2 md:grid-cols-5 gap-4 hidden">
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Signals Triggered</span>
                    <span id="kpi-signals" class="text-xl font-bold mt-2 text-white">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Filled Trades</span>
                    <span id="kpi-filled" class="text-xl font-bold mt-2 text-blue-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Win Rate</span>
                    <span id="kpi-winrate" class="text-xl font-bold mt-2 text-green-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Avg Return / Trade</span>
                    <span id="kpi-avgret" class="text-xl font-bold mt-2 text-blue-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Max Trade Drawdown</span>
                    <span id="kpi-maxmae" class="text-xl font-bold mt-2 text-red-400">-</span>
                </div>
            </div>

            <!-- Row 2: Portfolio Charts -->
            <div id="portfolio-charts-container" class="flex flex-col gap-6 hidden">
                <div class="card p-4 rounded-xl shadow-lg">
                    <div id="plotly-equity" class="w-full" style="height: 400px;"></div>
                </div>
                <div class="card p-4 rounded-xl shadow-lg">
                    <div id="plotly-drawdown" class="w-full" style="height: 250px;"></div>
                </div>
            </div>

            <!-- Stats & Performance Summary Row -->
            <div id="stats-performance-container" class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <!-- Card 1: V20 Performance Summary Table -->
                <div class="card p-5 rounded-xl shadow-lg flex flex-col justify-between">
                    <h3 class="text-sm font-bold text-gray-400 mb-4 uppercase">V20 Strategy Performance</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr class="border-b border-gray-800 text-xs uppercase text-gray-400 font-semibold">
                                    <th class="py-2 pr-4 font-bold text-gray-400 text-left">V20 Performance</th>
                                    <th class="py-2 px-4 font-bold text-right text-gray-300">All Time</th>
                                    <th class="py-2 pl-4 font-bold text-right text-blue-400">1 Year Ago</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-800 font-medium">
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Total Trades</td>
                                    <td id="perf-all-total" class="py-2.5 px-4 text-right text-white font-bold">-</td>
                                    <td id="perf-1y-total" class="py-2.5 pl-4 text-right text-white font-bold">-</td>
                                </tr>
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Successful Trades</td>
                                    <td id="perf-all-success" class="py-2.5 px-4 text-right text-green-400 font-bold">-</td>
                                    <td id="perf-1y-success" class="py-2.5 pl-4 text-right text-green-400 font-bold">-</td>
                                </tr>
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Success Rate</td>
                                    <td id="perf-all-rate" class="py-2.5 px-4 text-right text-green-400 font-bold">-</td>
                                    <td id="perf-1y-rate" class="py-2.5 pl-4 text-right text-green-400 font-bold">-</td>
                                </tr>
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Avg Return</td>
                                    <td id="perf-all-avg" class="py-2.5 px-4 text-right text-yellow-400 font-bold">-</td>
                                    <td id="perf-1y-avg" class="py-2.5 pl-4 text-right text-yellow-400 font-bold">-</td>
                                </tr>
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Best Return</td>
                                    <td id="perf-all-best" class="py-2.5 px-4 text-right text-green-400 font-bold">-</td>
                                    <td id="perf-1y-best" class="py-2.5 pl-4 text-right text-green-400 font-bold">-</td>
                                </tr>
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Avg Recovery</td>
                                    <td id="perf-all-recovery" class="py-2.5 px-4 text-right text-yellow-400 font-bold">-</td>
                                    <td id="perf-1y-recovery" class="py-2.5 pl-4 text-right text-yellow-400 font-bold">-</td>
                                </tr>
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Max Exposure</td>
                                    <td id="perf-all-exposure" class="py-2.5 px-4 text-right text-red-400 font-bold">-</td>
                                    <td id="perf-1y-exposure" class="py-2.5 pl-4 text-right text-red-400 font-bold">-</td>
                                </tr>
                                <tr class="hover:bg-gray-800/30">
                                    <td class="py-2.5 pr-4 text-gray-400">Total Profit</td>
                                    <td id="perf-all-profit" class="py-2.5 px-4 text-right text-green-400 font-bold">-</td>
                                    <td id="perf-1y-profit" class="py-2.5 pl-4 text-right text-green-400 font-bold">-</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Card 2: Right Card showing returns distribution or stats summary -->
                <div class="card p-5 rounded-xl shadow-lg flex flex-col justify-between">
                    <div id="right-card-distribution-content" class="w-full h-full flex flex-col justify-between">
                        <h3 class="text-sm font-bold text-gray-400 mb-2 uppercase">Trade Returns Distribution</h3>
                        <div id="plotly-distribution" class="w-full" style="height: 280px;"></div>
                    </div>
                    <div id="right-card-stats-content" class="w-full h-full flex flex-col justify-between hidden">
                        <h3 class="text-sm font-bold text-gray-400 mb-4 uppercase">Portfolio Key Stats Summary</h3>
                        <div class="space-y-4 text-sm">
                            <div class="flex justify-between border-b border-gray-800 pb-2">
                                <span class="text-gray-400">Total Stocks Loaded</span>
                                <span id="stat-stocks" class="font-bold text-white">-</span>
                            </div>
                            <div class="flex justify-between border-b border-gray-800 pb-2">
                                <span class="text-gray-400">Completed (Closed) Trades</span>
                                <span id="stat-completed" class="font-bold text-white">-</span>
                            </div>
                            <div class="flex justify-between border-b border-gray-800 pb-2">
                                <span class="text-gray-400">Active (Open) Positions</span>
                                <span id="stat-active" class="font-bold text-white">-</span>
                            </div>
                            <div class="flex justify-between border-b border-gray-800 pb-2">
                                <span class="text-gray-400">Average Holding Period</span>
                                <span id="stat-holding" class="font-bold text-white">-</span>
                            </div>
                            <div class="flex justify-between pb-2">
                                <span class="text-gray-400">Strategy Profit Factor</span>
                                <span id="stat-pf" class="font-bold text-green-400">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 2: INTERACTIVE CHARTS -->
        <!-- ============================================== -->
        <div id="tab-charts" class="tab-content flex flex-col gap-4 hidden">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="flex items-center gap-2">
                    <label for="stock-select" class="text-sm font-medium text-gray-400">Select Stock:</label>
                    <select id="stock-select" class="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="renderCandlestick(this.value)">
                        <!-- Populated by JS -->
                    </select>
                </div>
                <div id="zoom-controls" class="flex rounded-lg border border-gray-800 overflow-hidden text-xs">
                    <button class="px-3 py-2 bg-gray-900 text-gray-400 hover:text-white" onclick="changeZoom('all')">All History</button>
                    <button class="px-3 py-2 bg-gray-900 border-l border-gray-800 text-gray-400 hover:text-white" onclick="changeZoom('2y')">Last 2 Years</button>
                    <button class="px-3 py-2 bg-gray-900 border-l border-gray-800 text-gray-400 hover:text-white" onclick="changeZoom('1y')">Last 1 Year</button>
                    <button class="px-3 py-2 bg-gray-900 border-l border-gray-800 text-gray-400 hover:text-white" onclick="changeZoom('6m')">Last 6 Months</button>
                </div>
            </div>
            
            <div class="card p-4 rounded-xl shadow-lg">
                <div id="tv-chart-title" class="text-sm font-semibold text-gray-200 mb-2 flex items-center gap-2">
                    <span id="tv-ticker-label" class="text-blue-400 font-bold text-base"></span>
                    <span class="text-gray-500 text-xs">Candlestick &amp; V20 Trade Overlays</span>
                </div>
                <div id="tv-chart-container"></div>
                <!-- Legend -->
                <div class="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-400">
                    <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-emerald-400"></span> Buy Executed</span>
                    <span class="flex items-center gap-1"><span class="inline-block w-3 h-3 rounded-full bg-red-400"></span> Sell Executed</span>
                    <span class="flex items-center gap-1"><span class="inline-block w-2 h-0.5 bg-emerald-500 border-t border-dashed border-emerald-500"></span> Limit Buy Level</span>
                    <span class="flex items-center gap-1"><span class="inline-block w-2 h-0.5 bg-red-500 border-t border-dashed border-red-500"></span> Sell Target Level</span>
                </div>
            </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 3: DETAILED TRADE LOG (GROUPED BY TICKER) -->
        <!-- ============================================== -->
        <div id="tab-trades" class="tab-content flex flex-col gap-4 hidden">
            <!-- Filter Bar -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex flex-wrap items-center gap-3">
                    <input type="text" id="trade-search" placeholder="Search by Stock..." class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500" oninput="filterTrades()">
                    <select id="status-filter" class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="filterTrades()">
                        <option value="ALL">All Statuses</option>
                        <option value="COMPLETED">Completed Only</option>
                        <option value="OPEN">Open Only</option>
                        <option value="PENDING">Pending Only</option>
                    </select>
                    <select id="trade-stock-filter" class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" onchange="filterTrades()">
                        <option value="ALL">All Stocks</option>
                    </select>
                </div>
                <div class="text-xs text-gray-400">
                    Showing <span id="trades-showing-count">0</span> / <span id="trades-total-count">0</span> trades &nbsp;&bull;&nbsp; <span id="trades-group-count">0</span> stocks
                </div>
            </div>

            <!-- Table -->
            <div class="card rounded-xl overflow-hidden shadow-lg border border-gray-800">
                <div class="overflow-x-auto max-h-[600px]">
                    <table class="min-w-full text-left border-collapse text-sm">
                        <thead class="bg-gray-900 sticky top-0 border-b border-gray-800 text-xs uppercase text-gray-400 font-semibold z-10">
                            <tr>
                                <th class="px-4 py-3 w-6"></th>
                                <th class="px-4 py-3">Ticker</th>
                                <th class="px-4 py-3">Signals</th>
                                <th class="px-4 py-3">Filled</th>
                                <th class="px-4 py-3">Win Rate</th>
                                <th class="px-4 py-3">Total P&amp;L (&#8377;)</th>
                                <th class="px-4 py-3">Avg Return</th>
                                <th class="px-4 py-3">Active</th>
                                <th class="px-4 py-3" colspan="2"></th>
                            </tr>
                        </thead>
                        <tbody id="trades-table-body" class="divide-y divide-gray-800">
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ============================================== -->
        <!-- TAB 4: TICKERS PERFORMANCE -->
        <!-- ============================================== -->
        <div id="tab-tickers" class="tab-content flex flex-col gap-4 hidden">
            <p class="text-xs text-gray-500">Click any stock row to expand its individual trades.</p>
            <div class="card rounded-xl overflow-hidden shadow-lg border border-gray-800">
                <div class="overflow-x-auto">
                    <table class="min-w-full text-left border-collapse text-sm">
                        <thead class="bg-gray-900 sticky top-0 border-b border-gray-800 text-xs uppercase text-gray-400 font-semibold">
                            <tr>
                                <th class="px-4 py-3 w-6"></th>
                                <th class="px-4 py-3">Ticker</th>
                                <th class="px-4 py-3">Signals</th>
                                <th class="px-4 py-3">Filled</th>
                                <th class="px-4 py-3">Closed</th>
                                <th class="px-4 py-3">Active</th>
                                <th class="px-4 py-3">Win Rate</th>
                                <th class="px-4 py-3">Avg Return</th>
                                <th class="px-4 py-3">Avg Hold</th>
                                <th class="px-4 py-3">Profit Factor</th>
                                <th class="px-4 py-3">Max Drawdown</th>
                            </tr>
                        </thead>
                        <tbody id="tickers-table-body" class="divide-y divide-gray-800">
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <!-- ============================================== -->
        <!-- TAB 5: CAPITAL JOURNEY (PORTFOLIO MODE ONLY)  -->
        <!-- ============================================== -->
        <div id="tab-journey" class="tab-content flex flex-col gap-6 hidden">
            <!-- Summary Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Initial Capital</span>
                    <span id="jrn-initial" class="text-xl font-bold mt-2 text-white">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Final Portfolio Value</span>
                    <span id="jrn-final" class="text-xl font-bold mt-2 text-green-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Total Capital Deployed</span>
                    <span id="jrn-deployed" class="text-xl font-bold mt-2 text-blue-400">-</span>
                </div>
                <div class="card p-4 rounded-xl shadow-md flex flex-col justify-between">
                    <span class="text-xs text-gray-400 font-medium uppercase">Total Profit / Loss</span>
                    <span id="jrn-profit" class="text-xl font-bold mt-2 text-yellow-400">-</span>
                </div>
            </div>
            <!-- Trade Timeline Table -->
            <div class="card rounded-xl overflow-hidden shadow-lg border border-gray-800">
                <div class="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                    <h3 class="text-sm font-bold text-gray-300 uppercase tracking-wide">Trade-by-Trade Capital Journey</h3>
                    <span class="text-xs text-gray-500">Sorted by fill date &uarr; &bull; Portfolio value shown at trade entry date</span>
                </div>
                <div class="overflow-x-auto max-h-[600px]">
                    <table class="min-w-full text-left border-collapse text-sm">
                        <thead class="bg-gray-900 sticky top-0 border-b border-gray-800 text-xs uppercase text-gray-400 font-semibold z-10">
                            <tr>
                                <th class="px-4 py-3">#</th>
                                <th class="px-4 py-3">Fill Date</th>
                                <th class="px-4 py-3">Ticker</th>
                                <th class="px-4 py-3">Amount Invested</th>
                                <th class="px-4 py-3">Entry Price</th>
                                <th class="px-4 py-3">Exit Date</th>
                                <th class="px-4 py-3">Exit Price</th>
                                <th class="px-4 py-3">Return %</th>
                                <th class="px-4 py-3">P&amp;L (&#8377;)</th>
                                <th class="px-4 py-3">Portfolio at Entry</th>
                                <th class="px-4 py-3">Cumulative P&amp;L</th>
                                <th class="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody id="journey-table-body" class="divide-y divide-gray-800">
                        </tbody>
                    </table>
                </div>
            </div>
            <!-- Transaction Ledger Table -->
            <div class="card rounded-xl overflow-hidden shadow-lg border border-gray-800">
                <div class="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                    <h3 class="text-sm font-bold text-gray-300 uppercase tracking-wide">Chronological Transaction Ledger (Buy/Sell Cash Flows)</h3>
                    <span class="text-xs text-gray-500">Sequential order of transactions &bull; Portfolio value reflects compounding effect</span>
                </div>
                <div class="overflow-x-auto max-h-[600px]">
                    <table class="min-w-full text-left border-collapse text-sm">
                        <thead class="bg-gray-900 sticky top-0 border-b border-gray-800 text-xs uppercase text-gray-400 font-semibold z-10">
                            <tr>
                                <th class="px-4 py-3">#</th>
                                <th class="px-4 py-3">Date</th>
                                <th class="px-4 py-3">Type</th>
                                <th class="px-4 py-3">Ticker</th>
                                <th class="px-4 py-3">Shares</th>
                                <th class="px-4 py-3">Price</th>
                                <th class="px-4 py-3">Amount (&#8377;)</th>
                                <th class="px-4 py-3">Realized P&amp;L (&#8377;)</th>
                                <th class="px-4 py-3">Cash Balance</th>
                                <th class="px-4 py-3">Total Equity</th>
                            </tr>
                        </thead>
                        <tbody id="ledger-table-body" class="divide-y divide-gray-800">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </main>

    <footer class="card border-t border-gray-800 py-4 text-center text-xs text-gray-500 shadow-md">
        Designed for Premium Stock Trading Backtests | Fully Standalone Web Dashboard
    </footer>

    <!-- JSON DATA INJECTION -->
    <script id="backtest-data" type="application/json">
        {json_data_str}
    </script>

    <!-- Client-side Javascript Logic -->
    <script>
        // Load data from script block
        const reportData = JSON.parse(document.getElementById('backtest-data').textContent);
        
        // Populate Header info
        document.getElementById('gen-time').innerText = reportData.generation_time;
        document.getElementById('run-mode').innerText = reportData.mode === 'portfolio' ? 'Portfolio Simulation' : 'Individual Stats';
        document.getElementById('param-move').innerText = reportData.min_move;

        // Current UI state variables
        let currentZoom = 'all';
        let sortedColumn = 'trigger_date';
        let sortDirection = 'desc';
        let currentTrades = [...reportData.trades];

        // ----------------------------------------------------
        // INITIALIZATION
        // ----------------------------------------------------
        window.onload = function() {{
            // Populate stock dropdown selector
            const selector = document.getElementById('stock-select');
            reportData.tickers_list.forEach(ticker => {{
                let opt = document.createElement('option');
                opt.value = ticker;
                opt.innerHTML = ticker;
                selector.appendChild(opt);
            }});

            // Populate stock dropdown selector in Detailed Trade Log
            const tradeStockSelector = document.getElementById('trade-stock-filter');
            const uniqueTickers = [...new Set(reportData.trades.map(t => t.ticker))].sort();
            uniqueTickers.forEach(ticker => {{
                let opt = document.createElement('option');
                opt.value = ticker;
                opt.innerHTML = ticker;
                tradeStockSelector.appendChild(opt);
            }});

            // Common stats calculations (used in portfolio stats panel)
            const ovr = reportData.trades;
            const filled = ovr.filter(t => t.status !== 'PENDING');
            const completed = ovr.filter(t => t.status === 'COMPLETED');
            
            document.getElementById('stat-stocks').innerText = reportData.tickers_list.length;
            document.getElementById('stat-completed').innerText = completed.length;
            document.getElementById('stat-active').innerText = ovr.filter(t => t.status === 'OPEN').length;
            
            let totalHold = 0;
            filled.forEach(t => totalHold += t.holding_days);
            const avgHold = filled.length > 0 ? (totalHold / filled.length) : 0;
            document.getElementById('stat-holding').innerText = avgHold.toFixed(1) + ' Days';
            
            let profits = 0;
            let losses = 0;
            completed.forEach(t => {{
                if (t.pnl_pct > 0) profits += t.pnl_pct;
                else losses += Math.abs(t.pnl_pct);
            }});
            const pf = losses === 0 ? (profits > 0 ? 'Infinity' : '1.00') : (profits / losses).toFixed(2);
            document.getElementById('stat-pf').innerText = pf;

            // Conditional layout setup based on mode
            if (reportData.mode === 'portfolio') {{
                document.getElementById('portfolio-kpi-row').classList.remove('hidden');
                document.getElementById('portfolio-charts-container').classList.remove('hidden');
                
                // Show right stats panel and hide returns distribution histogram
                document.getElementById('right-card-stats-content').classList.remove('hidden');
                document.getElementById('right-card-distribution-content').classList.add('hidden');
                
                // Set Portfolio KPIs
                const sum = reportData.portfolio_summary;
                document.getElementById('kpi-final').innerText = sum.final_equity.toLocaleString('en-US', {{minimumFractionDigits: 2, maximumFractionDigits: 2}});
                
                const retSpan = document.getElementById('kpi-return');
                retSpan.innerText = sum.total_return_pct.toFixed(2) + '%';
                if (sum.total_return_pct < 0) retSpan.className = 'text-xl font-bold mt-2 text-red-400';
                
                document.getElementById('kpi-cagr').innerText = sum.annualized_return_pct.toFixed(2) + '%';
                document.getElementById('kpi-sharpe').innerText = sum.sharpe_ratio.toFixed(2);
                document.getElementById('kpi-drawdown').innerText = sum.max_drawdown_pct.toFixed(2) + '%';

                // Plot Portfolio Charts
                plotPortfolioEquity();
                plotPortfolioDrawdown();
            }} else {{
                document.getElementById('individual-kpi-row').classList.remove('hidden');
                
                // Show returns distribution histogram and hide right stats panel
                document.getElementById('right-card-distribution-content').classList.remove('hidden');
                document.getElementById('right-card-stats-content').classList.add('hidden');
                
                // Set Individual KPIs
                const winrate = completed.length > 0 ? (completed.filter(t => t.pnl_pct > 0).length / completed.length * 100) : 0;
                
                // Overall calc
                let totalPnL = 0;
                filled.forEach(t => totalPnL += t.pnl_pct);
                const avgPnL = filled.length > 0 ? (totalPnL / filled.length) : 0;
                
                let minMAE = 0;
                filled.forEach(t => {{ if (t.max_drawdown_pct < minMAE) minMAE = t.max_drawdown_pct; }});

                document.getElementById('kpi-signals').innerText = ovr.length;
                document.getElementById('kpi-filled').innerText = filled.length;
                document.getElementById('kpi-winrate').innerText = winrate.toFixed(1) + '%';
                document.getElementById('kpi-avgret').innerText = avgPnL.toFixed(2) + '%';
                document.getElementById('kpi-maxmae').innerText = minMAE.toFixed(2) + '%';

                // Plot returns distribution histogram
                plotReturnsDistribution();
            }}

            // Populate V20 Strategy Performance Table
            populateV20PerformanceTable();

            // Render tables & default stock chart
            renderTickersTable();
            renderGroupedTradesTable();
            if (reportData.mode === 'portfolio') {{
                document.getElementById('tab-btn-journey').classList.remove('hidden');
                renderCapitalJourney();
            }}
            if (reportData.tickers_list.length > 0) {{
                renderCandlestick(reportData.tickers_list[0]);
            }}
        }};

        // ----------------------------------------------------
        // V20 PERFORMANCE TABLE CALCULATION
        // ----------------------------------------------------
        function populateV20PerformanceTable() {{
            const trades = reportData.trades;
            const filled = trades.filter(t => t.status !== 'PENDING');
            
            // Define 1 year ago boundary
            let maxDate = new Date();
            const fillDates = filled.map(t => new Date(t.fill_date)).filter(d => !isNaN(d));
            if (fillDates.length > 0) {{
                maxDate = new Date(Math.max(...fillDates));
            }}
            const oneYearAgoDate = new Date(maxDate);
            oneYearAgoDate.setFullYear(oneYearAgoDate.getFullYear() - 1);
            
            const filled1y = filled.filter(t => new Date(t.fill_date) >= oneYearAgoDate);
            
            // Helper to compute stats
            const calcStats = (list) => {{
                const total = list.length;
                const completed = list.filter(t => t.status === 'COMPLETED');
                const success = completed.filter(t => t.pnl_pct > 0).length;
                const rate = completed.length > 0 ? (success / completed.length * 100) : 0;
                
                let sumRet = 0;
                let bestRet = 0;
                let sumHold = 0;
                list.forEach(t => {{
                    sumRet += t.pnl_pct;
                    if (t.pnl_pct > bestRet) bestRet = t.pnl_pct;
                }});
                completed.forEach(t => {{
                    sumHold += t.holding_days;
                }});
                
                const avgRet = total > 0 ? (sumRet / total) : 0;
                const avgRecovery = completed.length > 0 ? (sumHold / completed.length) : 0;
                
                // exposure and cash profit
                let maxExposure = 0;
                let totalProfit = 0;
                
                if (reportData.mode === 'portfolio') {{
                    // Portfolio mode: sum of pnl_cash
                    list.forEach(t => {{
                        totalProfit += t.pnl_cash || 0;
                    }});
                    
                    // Daily exposure calculation
                    const dailyExposures = reportData.equity_curve.map(e => {{
                        const dStr = e.date;
                        let exp = 0;
                        list.forEach(t => {{
                            if (t.fill_date && t.fill_date <= dStr) {{
                                if (!t.exit_date || dStr < t.exit_date) {{
                                    exp += (t.shares || 0) * t.entry_price;
                                }}
                            }}
                        }});
                        return exp;
                    }});
                    if (dailyExposures.length > 0) {{
                        maxExposure = Math.max(...dailyExposures);
                    }}
                }} else {{
                    // Individual mode: nominal ₹100,000 per trade
                    list.forEach(t => {{
                        totalProfit += t.pnl_cash || 0;
                    }});
                    
                    // Max exposure in individual mode: max concurrent active positions * 100,000
                    const dates = [];
                    list.forEach(t => {{
                        if (t.fill_date) {{
                            dates.push({{date: t.fill_date, type: 1}});
                        }}
                        if (t.exit_date) {{
                            dates.push({{date: t.exit_date, type: -1}});
                        }}
                    }});
                    dates.sort((a,b) => a.date.localeCompare(b.date));
                    let current = 0;
                    let maxConcurrent = 0;
                    dates.forEach(item => {{
                        current += item.type;
                        if (current > maxConcurrent) maxConcurrent = current;
                    }});
                    maxExposure = maxConcurrent * 100000.0;
                }}
                
                return {{ total, success, rate, avgRet, bestRet, avgRecovery, maxExposure, totalProfit }};
            }};
            
            const statsAll = calcStats(filled);
            const stats1y = calcStats(filled1y);
            
            // Update Table elements
            document.getElementById('perf-all-total').innerText = statsAll.total;
            document.getElementById('perf-1y-total').innerText = stats1y.total;
            
            document.getElementById('perf-all-success').innerText = statsAll.success;
            document.getElementById('perf-1y-success').innerText = stats1y.success;
            
            document.getElementById('perf-all-rate').innerText = statsAll.rate.toFixed(1) + '%';
            document.getElementById('perf-1y-rate').innerText = stats1y.rate.toFixed(1) + '%';
            
            document.getElementById('perf-all-avg').innerText = statsAll.avgRet.toFixed(2) + '%';
            document.getElementById('perf-1y-avg').innerText = stats1y.avgRet.toFixed(2) + '%';
            
            document.getElementById('perf-all-best').innerText = statsAll.bestRet.toFixed(2) + '%';
            document.getElementById('perf-1y-best').innerText = stats1y.bestRet.toFixed(2) + '%';
            
            document.getElementById('perf-all-recovery').innerText = Math.round(statsAll.avgRecovery) + ' Days';
            document.getElementById('perf-1y-recovery').innerText = Math.round(stats1y.avgRecovery) + ' Days';
            
            document.getElementById('perf-all-exposure').innerText = '₹' + Math.round(statsAll.maxExposure).toLocaleString('en-IN');
            document.getElementById('perf-1y-exposure').innerText = '₹' + Math.round(stats1y.maxExposure).toLocaleString('en-IN');
            
            const pAll = document.getElementById('perf-all-profit');
            const p1y = document.getElementById('perf-1y-profit');
            pAll.innerText = '₹' + Math.round(statsAll.totalProfit).toLocaleString('en-IN');
            p1y.innerText = '₹' + Math.round(stats1y.totalProfit).toLocaleString('en-IN');
            
            if (statsAll.totalProfit < 0) pAll.className = 'py-2.5 px-4 text-right text-red-400 font-bold';
            else pAll.className = 'py-2.5 px-4 text-right text-green-400 font-bold';
            
            if (stats1y.totalProfit < 0) p1y.className = 'py-2.5 pl-4 text-right text-red-400 font-bold';
            else p1y.className = 'py-2.5 pl-4 text-right text-green-400 font-bold';
        }}

        // ----------------------------------------------------
        // TABS SWITCHING
        // ----------------------------------------------------
        function switchTab(tabId) {{
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
            
            document.getElementById('tab-' + tabId).classList.remove('hidden');
            document.getElementById('tab-btn-' + tabId).classList.add('active');

            // Force plotly resize in active tab
            if (tabId === 'dashboard') {{
                if (reportData.mode === 'portfolio') {{
                    Plotly.Plots.resize(document.getElementById('plotly-equity'));
                    Plotly.Plots.resize(document.getElementById('plotly-drawdown'));
                }} else {{
                    Plotly.Plots.resize(document.getElementById('plotly-distribution'));
                }}
            }} else if (tabId === 'charts') {{
                if (tvChart) {{
                    tvChart.applyOptions({{ width: document.getElementById('tv-chart-container').clientWidth }});
                }}
            }}
        }}

        // ----------------------------------------------------
        // PORTFOLIO PLOTLY CHARTS
        // ----------------------------------------------------
        function plotPortfolioEquity() {{
            const dates = reportData.equity_curve.map(d => d.date);
            const vals = reportData.equity_curve.map(d => d.val);

            const trace = {{
                x: dates,
                y: vals,
                type: 'scatter',
                mode: 'lines',
                line: {{ color: '#10b981', width: 2.5 }},
                name: 'Portfolio Equity'
            }};

            const layout = {{
                title: {{ text: 'Portfolio Growth Over Time', font: {{ color: '#ffffff', size: 16 }} }},
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: '#111827',
                margin: {{ l: 50, r: 20, t: 50, b: 40 }},
                font: {{ color: '#cbd5e1' }},
                xaxis: {{ gridcolor: '#1f2937', linecolor: '#374151' }},
                yaxis: {{ gridcolor: '#1f2937', linecolor: '#374151', tickformat: '$,.0f' }}
            }};

            Plotly.newPlot('plotly-equity', [trace], layout, {{responsive: true}});
        }}

        function plotPortfolioDrawdown() {{
            const dates = reportData.drawdown_curve.map(d => d.date);
            const vals = reportData.drawdown_curve.map(d => d.val);

            const trace = {{
                x: dates,
                y: vals,
                fill: 'tozeroy',
                fillcolor: 'rgba(239, 68, 68, 0.15)',
                type: 'scatter',
                mode: 'lines',
                line: {{ color: '#ef4444', width: 1.5 }},
                name: 'Drawdown'
            }};

            const layout = {{
                title: {{ text: 'Portfolio Peak-to-Trough Drawdown (%)', font: {{ color: '#ffffff', size: 14 }} }},
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: '#111827',
                margin: {{ l: 50, r: 20, t: 40, b: 30 }},
                font: {{ color: '#cbd5e1' }},
                xaxis: {{ gridcolor: '#1f2937', linecolor: '#374151' }},
                yaxis: {{ gridcolor: '#1f2937', linecolor: '#374151', ticksuffix: '%' }}
            }};

            Plotly.newPlot('plotly-drawdown', [trace], layout, {{responsive: true}});
        }}

        function plotReturnsDistribution() {{
            const completed = reportData.trades.filter(t => t.status === 'COMPLETED');
            const pnls = completed.map(t => t.pnl_pct);

            const trace = {{
                x: pnls,
                type: 'histogram',
                xbins: {{ size: 2.0 }},
                marker: {{ color: '#3b82f6', line: {{ color: '#111827', width: 1 }} }},
                name: 'Returns'
            }};

            const layout = {{
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: '#111827',
                margin: {{ l: 40, r: 20, t: 20, b: 40 }},
                font: {{ color: '#cbd5e1' }},
                xaxis: {{ gridcolor: '#1f2937', title: 'PnL %' }},
                yaxis: {{ gridcolor: '#1f2937', title: 'Trades Count' }}
            }};

            Plotly.newPlot('plotly-distribution', [trace], layout, {{responsive: true}});
        }}

        // ----------------------------------------------------
        // TRADINGVIEW LIGHTWEIGHT CHARTS — CANDLESTICK
        // ----------------------------------------------------
        let tvChart = null;       // LWC chart instance
        let tvCandleSeries = null; // candlestick series

        function dateToTimestamp(dateStr) {{
            // Convert "YYYY-MM-DD" to UTC unix seconds (LWC time format)
            return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000);
        }}

        function renderCandlestick(ticker) {{
            const priceData = reportData.prices[ticker] || [];
            if (priceData.length === 0) return;

            // Update title label
            document.getElementById('tv-ticker-label').innerText = ticker;

            // Date filtering based on zoom
            let filteredPrice = [...priceData];
            const lastDateObj = new Date(priceData[priceData.length - 1].date);

            if (currentZoom === '2y') {{
                const cutoff = new Date(lastDateObj);
                cutoff.setFullYear(cutoff.getFullYear() - 2);
                filteredPrice = priceData.filter(p => new Date(p.date) >= cutoff);
            }} else if (currentZoom === '1y') {{
                const cutoff = new Date(lastDateObj);
                cutoff.setFullYear(cutoff.getFullYear() - 1);
                filteredPrice = priceData.filter(p => new Date(p.date) >= cutoff);
            }} else if (currentZoom === '6m') {{
                const cutoff = new Date(lastDateObj);
                cutoff.setMonth(cutoff.getMonth() - 6);
                filteredPrice = priceData.filter(p => new Date(p.date) >= cutoff);
            }}

            const cutoffDateStr = filteredPrice.length > 0 ? filteredPrice[0].date : '';

            // ---- Build or Recreate LWC Chart ----
            const container = document.getElementById('tv-chart-container');

            if (tvChart) {{
                tvChart.remove();
                tvChart = null;
                tvCandleSeries = null;
            }}

            tvChart = LightweightCharts.createChart(container, {{
                width: container.clientWidth,
                height: 520,
                layout: {{
                    background: {{ type: 'solid', color: '#111827' }},
                    textColor: '#94a3b8',
                    fontSize: 12,
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                }},
                grid: {{
                    vertLines: {{ color: '#1f2937', style: 1 }},
                    horzLines: {{ color: '#1f2937', style: 1 }},
                }},
                crosshair: {{
                    mode: LightweightCharts.CrosshairMode.Normal,
                    vertLine: {{ color: '#475569', width: 1, style: 2 }},
                    horzLine: {{ color: '#475569', width: 1, style: 2 }},
                }},
                rightPriceScale: {{
                    borderColor: '#1f2937',
                    textColor: '#94a3b8',
                }},
                timeScale: {{
                    borderColor: '#1f2937',
                    timeVisible: true,
                    secondsVisible: false,
                    barSpacing: 6,
                }},
                handleScroll: true,
                handleScale: true,
            }});

            // Make chart responsive on window resize
            const resizeObserver = new ResizeObserver(entries => {{
                if (tvChart) {{
                    tvChart.applyOptions({{ width: container.clientWidth }});
                }}
            }});
            resizeObserver.observe(container);

            // ---- Candlestick Series ----
            tvCandleSeries = tvChart.addCandlestickSeries({{
                upColor: '#10b981',
                downColor: '#ef4444',
                borderUpColor: '#10b981',
                borderDownColor: '#ef4444',
                wickUpColor: '#10b981',
                wickDownColor: '#ef4444',
            }});

            const candleData = filteredPrice.map(d => ({{
                time: dateToTimestamp(d.date),
                open: d.o,
                high: d.h,
                low: d.l,
                close: d.c,
            }}));
            tvCandleSeries.setData(candleData);

            // ---- Trade Markers (Buy / Sell) ----
            const tickerTrades = reportData.trades.filter(t => t.ticker === ticker);
            const markers = [];

            tickerTrades.forEach(trade => {{
                // Buy executed marker
                if (trade.fill_date && trade.fill_date >= cutoffDateStr) {{
                    markers.push({{
                        time: dateToTimestamp(trade.fill_date),
                        position: 'belowBar',
                        color: '#10b981',
                        shape: 'arrowUp',
                        text: 'BUY @' + trade.entry_price.toFixed(2),
                        size: 1,
                    }});
                }}

                // Sell executed marker
                if (trade.exit_date && trade.exit_date >= cutoffDateStr) {{
                    const pnlSign = trade.pnl_pct >= 0 ? '+' : '';
                    markers.push({{
                        time: dateToTimestamp(trade.exit_date),
                        position: 'aboveBar',
                        color: '#ef4444',
                        shape: 'arrowDown',
                        text: 'SELL @' + trade.exit_price.toFixed(2) + ' (' + pnlSign + trade.pnl_pct.toFixed(1) + '%)',
                        size: 1,
                    }});
                }}
            }});

            // Sort markers by time (required by LWC)
            markers.sort((a, b) => a.time - b.time);
            tvCandleSeries.setMarkers(markers);

            // ---- Price Lines for Entry/Exit Levels ----
            tickerTrades.forEach(trade => {{
                if (trade.trigger_date < cutoffDateStr) return;

                // Green dashed: Limit Buy level
                tvCandleSeries.createPriceLine({{
                    price: trade.entry_price,
                    color: '#10b981',
                    lineWidth: 1,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: 'Buy Limit',
                }});

                // Red dashed: Sell Target level
                const targetPrice = trade.status === 'COMPLETED'
                    ? trade.exit_price
                    : (trade.entry_price * (1 + reportData.min_move / 100));
                tvCandleSeries.createPriceLine({{
                    price: targetPrice,
                    color: '#ef4444',
                    lineWidth: 1,
                    lineStyle: LightweightCharts.LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: 'Sell Target',
                }});
            }});

            // Fit to visible range
            tvChart.timeScale().fitContent();
        }}

        function changeZoom(zoom) {{
            currentZoom = zoom;
            const selectVal = document.getElementById('stock-select').value;
            renderCandlestick(selectVal);
        }}

        // ----------------------------------------------------
        // TABLES DRAW & SORT LOGIC
        // ----------------------------------------------------
        function renderTickersTable() {{
            const tbody = document.getElementById('tickers-table-body');
            tbody.innerHTML = '';

            if (reportData.mode === 'portfolio') {{
                document.getElementById('tab-btn-tickers').classList.add('hidden');
                return;
            }}

            // Group trades by ticker for inline expansion
            const tradesByTicker = {{}};
            reportData.trades.forEach(t =>
                (tradesByTicker[t.ticker] = tradesByTicker[t.ticker] || []).push(t)
            );

            for (const [ticker, s] of Object.entries(reportData.tickers_summary)) {{
                const rowId = 'expand-' + ticker.split('.').join('_');

                // Summary row
                const tr = document.createElement('tr');
                tr.className = 'cursor-pointer hover:bg-gray-800/50 transition duration-150 select-none';
                tr.onclick = () => toggleTickerTrades(rowId);

                tr.innerHTML = `
                    <td class="px-4 py-3 text-gray-500 text-xs" id="arrow-${{rowId}}">▶</td>
                    <td class="px-4 py-3 font-semibold text-white">${{ticker}}</td>
                    <td class="px-4 py-3 text-gray-300">${{s.total_trades}}</td>
                    <td class="px-4 py-3 text-blue-400">${{s.filled_trades}}</td>
                    <td class="px-4 py-3 text-green-400">${{s.completed_trades}}</td>
                    <td class="px-4 py-3 text-gray-300">${{s.open_trades}}</td>
                    <td class="px-4 py-3">${{s.win_rate_pct.toFixed(1)}}%</td>
                    <td class="px-4 py-3 font-semibold ${{s.avg_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}}">${{s.avg_return_pct >= 0 ? '+' : ''}}${{s.avg_return_pct.toFixed(2)}}%</td>
                    <td class="px-4 py-3">${{s.avg_holding_days.toFixed(1)}}d</td>
                    <td class="px-4 py-3">${{s.profit_factor === 'Infinity' ? '∞' : s.profit_factor.toFixed(2)}}</td>
                    <td class="px-4 py-3 text-red-400">${{s.max_mae_pct.toFixed(2)}}%</td>
                `;
                tbody.appendChild(tr);

                // Expanded trades sub-table row (hidden by default)
                const expRow = document.createElement('tr');
                expRow.id = rowId;
                expRow.classList.add('hidden');

                const tickerTrades = tradesByTicker[ticker] || [];
                const tradeRows = tickerTrades.map(t => {{
                    let pnlClass = 'text-gray-400';
                    let pnlText = '—';
                    if (t.status !== 'PENDING') {{
                        pnlClass = t.pnl_pct >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold';
                        pnlText = (t.pnl_pct >= 0 ? '+' : '') + t.pnl_pct.toFixed(2) + '%';
                    }}
                    let badge = '';
                    if (t.status === 'COMPLETED')  badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/40">DONE</span>';
                    else if (t.status === 'OPEN')   badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/30 text-blue-400 border border-blue-800/40">OPEN</span>';
                    else                            badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">WAIT</span>';

                    return `<tr class="border-t border-gray-800/60 hover:bg-gray-800/20">
                        <td class="pl-10 pr-3 py-2 text-gray-500 text-xs">#</td>
                        <td class="px-3 py-2 text-gray-400 text-xs">${{t.trigger_date}}</td>
                        <td class="px-3 py-2 text-gray-300 text-xs">${{t.fill_date || '—'}}</td>
                        <td class="px-3 py-2 text-gray-300 text-xs">${{t.exit_date || (t.status === 'OPEN' ? 'Active' : '—')}}</td>
                        <td class="px-3 py-2 text-xs">₹${{t.entry_price.toFixed(2)}}</td>
                        <td class="px-3 py-2 text-xs">${{t.exit_price ? '₹' + t.exit_price.toFixed(2) : '—'}}</td>
                        <td class="px-3 py-2 text-xs ${{pnlClass}}">${{pnlText}}</td>
                        <td class="px-3 py-2 text-xs text-gray-400">${{t.status !== 'PENDING' ? t.holding_days + 'd' : '—'}}</td>
                        <td class="px-3 py-2 text-xs">${{badge}}</td>
                        <td class="px-3 py-2 text-xs text-red-400">${{t.status !== 'PENDING' ? t.max_drawdown_pct.toFixed(2) + '%' : '—'}}</td>
                        <td></td>
                    </tr>`;
                }}).join('');

                expRow.innerHTML = `
                    <td colspan="11" class="p-0">
                        <div class="bg-gray-900/60 border-y border-gray-700/50">
                            <table class="min-w-full border-collapse text-xs">
                                <thead>
                                    <tr class="text-gray-500 text-xs uppercase">
                                        <th class="pl-10 pr-3 py-2 text-left w-6"></th>
                                        <th class="px-3 py-2 text-left">Trigger</th>
                                        <th class="px-3 py-2 text-left">Fill Date</th>
                                        <th class="px-3 py-2 text-left">Exit Date</th>
                                        <th class="px-3 py-2 text-left">Entry</th>
                                        <th class="px-3 py-2 text-left">Exit</th>
                                        <th class="px-3 py-2 text-left">PnL %</th>
                                        <th class="px-3 py-2 text-left">Duration</th>
                                        <th class="px-3 py-2 text-left">Status</th>
                                        <th class="px-3 py-2 text-left">Max DD</th>
                                        <th class="px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>${{tradeRows || '<tr><td colspan="11" class="px-10 py-3 text-gray-600">No trades</td></tr>'}}</tbody>
                            </table>
                        </div>
                    </td>`;
                tbody.appendChild(expRow);
            }}
        }}

        function toggleTickerTrades(rowId) {{
            const row = document.getElementById(rowId);
            const arrow = document.getElementById('arrow-' + rowId);
            if (!row) return;
            const isHidden = row.classList.contains('hidden');
            row.classList.toggle('hidden', !isHidden);
            if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
        }}

        // ----------------------------------------------------
        // GROUPED TRADE LOG (PER-TICKER ACCORDION)
        // ----------------------------------------------------
        function renderGroupedTradesTable() {{
            const tbody = document.getElementById('trades-table-body');
            tbody.innerHTML = '';
            const search  = document.getElementById('trade-search').value.toUpperCase();
            const status  = document.getElementById('status-filter').value;
            const stockFilter = document.getElementById('trade-stock-filter').value;
            const filtered = reportData.trades.filter(t =>
                t.ticker.toUpperCase().includes(search) &&
                (status === 'ALL' || t.status === status) &&
                (stockFilter === 'ALL' || t.ticker === stockFilter)
            );
            document.getElementById('trades-total-count').innerText   = reportData.trades.length;
            document.getElementById('trades-showing-count').innerText = filtered.length;
            const groups = {{}};
            filtered.forEach(t => {{ if (!groups[t.ticker]) groups[t.ticker] = []; groups[t.ticker].push(t); }});
            document.getElementById('trades-group-count').innerText = Object.keys(groups).length;

            Object.keys(groups).sort().forEach(ticker => {{
                const trades    = groups[ticker];
                const filled    = trades.filter(t => t.status !== 'PENDING');
                const completed = trades.filter(t => t.status === 'COMPLETED');
                const open      = trades.filter(t => t.status === 'OPEN');
                const wins      = completed.filter(t => t.pnl_pct > 0);
                const winRate   = completed.length > 0 ? (wins.length / completed.length * 100) : 0;
                const totalPnlCash = filled.reduce((s, t) => s + (t.pnl_cash || 0), 0);
                const avgReturn = filled.length > 0 ? filled.reduce((s, t) => s + t.pnl_pct, 0) / filled.length : 0;
                const gid = 'tgrp-' + ticker.replace(/[^a-zA-Z0-9]/g, '_');

                const hdr = document.createElement('tr');
                hdr.className = 'cursor-pointer bg-gray-900/60 hover:bg-gray-800/60 transition select-none border-b border-gray-700/60';
                hdr.onclick = () => toggleTradeGroup(gid);
                const pnlColor = totalPnlCash >= 0 ? 'text-green-400' : 'text-red-400';
                const retColor = avgReturn    >= 0 ? 'text-green-400' : 'text-red-400';
                const pnlSign  = totalPnlCash >= 0 ? '+' : '';
                const retSign  = (filled.length > 0 && avgReturn >= 0) ? '+' : '';
                hdr.innerHTML = `
                    <td class="px-4 py-3 text-gray-500 text-xs" id="arrow-${{gid}}">&#9658;</td>
                    <td class="px-4 py-3 font-bold text-white">${{ticker}}</td>
                    <td class="px-4 py-3 text-gray-400 text-xs">${{trades.length}}</td>
                    <td class="px-4 py-3 text-blue-400 text-xs">${{filled.length}}</td>
                    <td class="px-4 py-3 text-xs">${{completed.length > 0 ? winRate.toFixed(0) + '%' : '&mdash;'}}</td>
                    <td class="px-4 py-3 text-xs font-semibold ${{pnlColor}}">${{pnlSign}}&#8377;${{Math.round(Math.abs(totalPnlCash)).toLocaleString('en-IN')}}</td>
                    <td class="px-4 py-3 text-xs ${{retColor}}">${{filled.length > 0 ? retSign + avgReturn.toFixed(2) + '%' : '&mdash;'}}</td>
                    <td class="px-4 py-3 text-xs text-blue-300">${{open.length > 0 ? open.length + ' active' : ''}}</td>
                    <td class="px-4 py-3" colspan="2"></td>
                `;
                tbody.appendChild(hdr);

                const expRow = document.createElement('tr');
                expRow.id = gid;
                expRow.classList.add('hidden');
                const sortedTrades = [...trades].sort((a, b) =>
                    (a.fill_date || a.trigger_date || '').localeCompare(b.fill_date || b.trigger_date || '')
                );
                const tradeRows = sortedTrades.map(t => {{
                    const pnlCls  = t.status !== 'PENDING' ? (t.pnl_pct >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold') : 'text-gray-400';
                    const pnlSgn  = (t.status !== 'PENDING' && t.pnl_pct >= 0) ? '+' : '';
                    const pnlCash = t.pnl_cash || 0;
                    const cashCls = pnlCash >= 0 ? 'text-green-400' : 'text-red-400';
                    const inv     = (t.status !== 'PENDING' && t.shares) ? '&#8377;' + Math.round(t.shares * t.entry_price).toLocaleString('en-IN') : '&mdash;';
                    let bdg = '';
                    if (t.status === 'COMPLETED') bdg = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/40">DONE</span>';
                    else if (t.status === 'OPEN')  bdg = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/30 text-blue-400 border border-blue-800/40">OPEN</span>';
                    else                           bdg = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">WAIT</span>';
                    return `<tr class="border-t border-gray-800/50 hover:bg-gray-800/20">
                        <td class="pl-8 pr-3 py-2.5"></td>
                        <td class="px-3 py-2.5 text-gray-300 text-xs">${{t.fill_date || '&mdash;'}}</td>
                        <td class="px-3 py-2.5 text-gray-300 text-xs">${{t.exit_date || (t.status === 'OPEN' ? 'Active' : '&mdash;')}}</td>
                        <td class="px-3 py-2.5 text-xs text-blue-300 font-mono">${{inv}}</td>
                        <td class="px-3 py-2.5 text-xs">&#8377;${{t.entry_price.toFixed(2)}}</td>
                        <td class="px-3 py-2.5 text-xs">${{t.exit_price ? '&#8377;' + t.exit_price.toFixed(2) : '&mdash;'}}</td>
                        <td class="px-3 py-2.5 text-xs ${{pnlCls}}">${{t.status !== 'PENDING' ? pnlSgn + t.pnl_pct.toFixed(2) + '%' : '0.00%'}}</td>
                        <td class="px-3 py-2.5 text-xs ${{cashCls}}">${{t.status !== 'PENDING' ? (pnlCash >= 0 ? '+' : '') + '&#8377;' + Math.round(Math.abs(pnlCash)).toLocaleString('en-IN') : '&mdash;'}}</td>
                        <td class="px-3 py-2.5 text-xs">${{bdg}}</td>
                        <td class="px-3 py-2.5 text-xs text-red-400">${{t.status !== 'PENDING' ? t.max_drawdown_pct.toFixed(2) + '%' : '&mdash;'}}</td>
                    </tr>`;
                }}).join('');

                expRow.innerHTML = `<td colspan="10" class="p-0"><div class="bg-gray-950/60 border-b border-gray-700/50">
                    <table class="min-w-full border-collapse"><thead><tr class="text-gray-500 text-xs uppercase border-b border-gray-800/80">
                        <th class="pl-8 pr-3 py-2 text-left w-6"></th>
                        <th class="px-3 py-2 text-left">Fill Date</th><th class="px-3 py-2 text-left">Exit Date</th>
                        <th class="px-3 py-2 text-left">Invested</th><th class="px-3 py-2 text-left">Entry</th>
                        <th class="px-3 py-2 text-left">Exit</th><th class="px-3 py-2 text-left">Return %</th>
                        <th class="px-3 py-2 text-left">P&amp;L (&#8377;)</th><th class="px-3 py-2 text-left">Status</th>
                        <th class="px-3 py-2 text-left">Max DD</th></tr></thead>
                    <tbody>${{tradeRows || '<tr><td colspan="10" class="px-8 py-3 text-gray-600">No trades</td></tr>'}}</tbody></table>
                </div></td>`;
                tbody.appendChild(expRow);
            }});
        }}

        function toggleTradeGroup(gid) {{
            const row   = document.getElementById(gid);
            const arrow = document.getElementById('arrow-' + gid);
            if (!row) return;
            const isHidden = row.classList.contains('hidden');
            row.classList.toggle('hidden', !isHidden);
            if (arrow) arrow.innerHTML = isHidden ? '&#9660;' : '&#9658;';
        }}

        function filterTrades() {{
            renderGroupedTradesTable();
        }}

        // ----------------------------------------------------
        // CAPITAL JOURNEY (PORTFOLIO MODE ONLY)
        // ----------------------------------------------------
        function renderCapitalJourney() {{
            if (reportData.mode !== 'portfolio') return;
            const sum = reportData.portfolio_summary;
            document.getElementById('jrn-initial').innerText = '₹' + Math.round(sum.initial_capital).toLocaleString('en-IN');
            document.getElementById('jrn-final').innerText   = '₹' + Math.round(sum.final_equity).toLocaleString('en-IN');
            const equityByDate = {{}};
            reportData.equity_curve.forEach(e => {{ equityByDate[e.date] = e.val; }});
            const filledTrades = reportData.trades
                .filter(t => t.status !== 'PENDING' && t.fill_date)
                .sort((a, b) => a.fill_date.localeCompare(b.fill_date));
            let totalDeployed = 0, totalProfit = 0;
            filledTrades.forEach(t => {{
                totalDeployed += (t.shares || 0) * t.entry_price;
                totalProfit   += (t.pnl_cash || 0);
            }});
            document.getElementById('jrn-deployed').innerText = '₹' + Math.round(totalDeployed).toLocaleString('en-IN');
            const profitEl = document.getElementById('jrn-profit');
            profitEl.innerText = (totalProfit >= 0 ? '+' : '') + '₹' + Math.round(Math.abs(totalProfit)).toLocaleString('en-IN');
            profitEl.className = 'text-xl font-bold mt-2 ' + (totalProfit >= 0 ? 'text-green-400' : 'text-red-400');
            
            // Render Trade Timeline Table
            const tbody = document.getElementById('journey-table-body');
            tbody.innerHTML = '';
            let cumPnl = 0;
            filledTrades.forEach((t, idx) => {{
                const invested = (t.shares || 0) * t.entry_price;
                const pnlCash  = t.pnl_cash || 0;
                cumPnl += pnlCash;
                const portVal  = equityByDate[t.fill_date];
                const pnlCls   = t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400';
                const cumCls   = cumPnl >= 0 ? 'text-green-400' : 'text-red-400';
                let bdg = '';
                if (t.status === 'COMPLETED') bdg = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/40">DONE</span>';
                else bdg = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/30 text-blue-400 border border-blue-800/40">OPEN</span>';
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-800/40 transition duration-150';
                tr.innerHTML = `
                    <td class="px-4 py-3 text-gray-500 text-xs font-mono">${{idx + 1}}</td>
                    <td class="px-4 py-3 text-gray-300 text-xs">${{t.fill_date}}</td>
                    <td class="px-4 py-3 font-bold text-white">${{t.ticker}}</td>
                    <td class="px-4 py-3 text-blue-300 text-xs font-mono">&#8377;${{Math.round(invested).toLocaleString('en-IN')}}</td>
                    <td class="px-4 py-3 text-gray-300 text-xs">&#8377;${{t.entry_price.toFixed(2)}}</td>
                    <td class="px-4 py-3 text-gray-300 text-xs">${{t.exit_date || (t.status === 'OPEN' ? 'Active' : '&mdash;')}}</td>
                    <td class="px-4 py-3 text-gray-300 text-xs">${{t.exit_price ? '&#8377;' + t.exit_price.toFixed(2) : '&mdash;'}}</td>
                    <td class="px-4 py-3 text-xs font-semibold ${{pnlCls}}">${{t.pnl_pct >= 0 ? '+' : ''}}${{t.pnl_pct.toFixed(2)}}%</td>
                    <td class="px-4 py-3 text-xs font-semibold ${{pnlCls}}">${{pnlCash >= 0 ? '+' : ''}}&#8377;${{Math.round(Math.abs(pnlCash)).toLocaleString('en-IN')}}</td>
                    <td class="px-4 py-3 text-xs text-gray-400 font-mono">${{portVal ? '&#8377;' + Math.round(portVal).toLocaleString('en-IN') : '&mdash;'}}</td>
                    <td class="px-4 py-3 text-xs font-semibold ${{cumCls}}">${{cumPnl >= 0 ? '+' : ''}}&#8377;${{Math.round(Math.abs(cumPnl)).toLocaleString('en-IN')}}</td>
                    <td class="px-4 py-3">${{bdg}}</td>
                `;
                tbody.appendChild(tr);
            }});

            // Render Transaction Ledger Table
            const tbodyLedger = document.getElementById('ledger-table-body');
            tbodyLedger.innerHTML = '';
            const ledger = reportData.ledger || [];
            ledger.forEach((tx, idx) => {{
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-800/40 transition duration-150 border-t border-gray-800/60';
                
                const typeBdg = tx.type === 'BUY' 
                    ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/40">BUY</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/30 text-red-400 border border-red-800/40">SELL</span>';
                    
                const amountVal = tx.amount;
                const pnlCash = tx.pnl_cash || 0;
                const pnlPct = tx.pnl_pct || 0;
                const pnlCls = pnlCash >= 0 ? 'text-green-400' : 'text-red-400';
                const pnlStr = tx.type === 'SELL'
                    ? `${{pnlCash >= 0 ? '+' : ''}}&#8377;${{Math.round(Math.abs(pnlCash)).toLocaleString('en-IN')}} (${{pnlPct >= 0 ? '+' : ''}}${{pnlPct.toFixed(2)}}%)`
                    : '&mdash;';
                
                tr.innerHTML = `
                    <td class="px-4 py-2.5 text-gray-500 text-xs font-mono">${{idx + 1}}</td>
                    <td class="px-4 py-2.5 text-gray-300 text-xs">${{tx.date}}</td>
                    <td class="px-4 py-2.5 text-xs">${{typeBdg}}</td>
                    <td class="px-4 py-2.5 font-bold text-white">${{tx.ticker}}</td>
                    <td class="px-4 py-2.5 text-gray-400 text-xs font-mono">${{tx.shares.toFixed(1)}}</td>
                    <td class="px-4 py-2.5 text-gray-300 text-xs">&#8377;${{tx.price.toFixed(2)}}</td>
                    <td class="px-4 py-2.5 text-blue-300 text-xs font-mono">&#8377;${{Math.round(amountVal).toLocaleString('en-IN')}}</td>
                    <td class="px-4 py-2.5 text-xs font-semibold ${{pnlCls}}">${{pnlStr}}</td>
                    <td class="px-4 py-2.5 text-gray-400 text-xs font-mono">&#8377;${{Math.round(tx.cash).toLocaleString('en-IN')}}</td>
                    <td class="px-4 py-2.5 text-emerald-400 text-xs font-semibold font-mono">&#8377;${{Math.round(tx.equity).toLocaleString('en-IN')}}</td>
                `;
                tbodyLedger.appendChild(tr);
            }});
        }}
    </script>
</body>
</html>
"""
        
        # 6. Write file
        with open(output_filename, 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"Standalone HTML dashboard successfully saved to: {output_filename}")
