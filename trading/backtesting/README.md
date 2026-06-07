# 📈 V20 Strategy Backtester

A standalone Python backtesting system for the **V20 Volatility Strategy** on NSE-listed Indian stocks. Generates self-contained HTML dashboards with interactive charts, per-stock trade breakdowns, and performance analytics — no web server required.

---

## 🗂️ Project Structure

```
backtesting/
├── scripts/                   # All Python source files
│   ├── config.py              # Central configuration (dates, paths, strategy params)
│   ├── run.py                 # Entry point — CLI argument parsing & orchestration
│   ├── data_loader.py         # yfinance data download with caching
│   ├── strategies.py          # Strategy logic (V20Strategy + stubs for future)
│   ├── engine.py              # Core backtesting simulation engine
│   └── report_generator.py   # Standalone HTML dashboard generator
├── stocks/
│   ├── v40.txt                # Ticker list for V40 portfolio (top 40 quality stocks)
│   └── v40-next.txt           # Ticker list for V40 Next (next 40 quality stocks)
├── results/
│   ├── backtest_report_v40.html       # ← Generated report for V40
│   └── backtest_report_v40-next.html  # ← Generated report for V40 Next
└── .cache/                    # Local price data cache (auto-managed)
```

---

## ⚙️ Strategy — V20 (Volatility 20%)

The V20 strategy identifies high-momentum setups triggered by a large consecutive green-candle run:

1. **Detect a green sequence** — consecutive candles where `Close > Open`
2. **Measure the move** — `(sequence_high − sequence_low) / sequence_low × 100`
3. **Trigger a setup** — if the move is ≥ 20% (configurable)
4. **Lock it in** — on the first red/doji candle that ends the sequence
5. **Entry** — limit buy at the sequence low
6. **Exit** — limit sell at the sequence high

> The idea: after a large volatile move, the stock retraces to the base (sequence low) and recovers to the prior high.

---

## 🚀 Running the Backtester

Run all commands from the **`backtesting/`** root folder.

### V40 Stocks (Individual Stats Mode)
```bash
python scripts/run.py --file stocks/v40.txt --mode individual
```

### V40 Next Stocks
```bash
python scripts/run.py --file stocks/v40-next.txt --mode individual
```

### Portfolio Simulation Mode (compounding 3% risk per trade)
```bash
python scripts/run.py --file stocks/v40.txt --mode portfolio --capital 1000000
```

### Portfolio with custom risk per trade
```bash
python scripts/run.py --file stocks/v40.txt --mode portfolio --capital 1000000 --risk-pct 5 --max-trades 15
```

### Custom Tickers (inline)
```bash
python scripts/run.py --tickers RELIANCE.NS,TCS.NS,INFY.NS --mode individual
```

---

## 🔧 CLI Arguments

| Argument | Default | Description |
|---|---|---|
| `--file` | `tickers.txt` | Path to ticker list file |
| `--tickers` | — | Comma-separated tickers (overrides `--file`) |
| `--start` | `2010-01-05` | Backtest start date (`YYYY-MM-DD`) |
| `--end` | `2026-06-01` | Backtest end date (`YYYY-MM-DD`) |
| `--mode` | `individual` | `individual` (raw stats) or `portfolio` (capital simulation) |
| `--capital` | `100000` | Starting capital for portfolio mode |
| `--max-trades` | unlimited | Optional hard cap on concurrent open positions (portfolio mode) |
| `--risk-pct` | `3.0` | % of current equity to allocate per trade — compounding (portfolio mode) |
| `--min-move` | `20.0` | Minimum % move to qualify as a V20 setup |
| `--commission` | `0.0` | Transaction fee as fraction of trade value |
| `--force-download` | `false` | Bypass local cache and re-download all data |

---

## 📊 HTML Dashboard

Each run overwrites one of two persistent HTML files in `results/`. Open them directly in any browser — no server needed.

### Tabs

| Tab | What's Inside |
|---|---|
| 📊 **Summary Dashboard** | KPI cards, equity curve (portfolio), returns distribution, V20 performance table (All Time vs 1 Year) |
| 📈 **Interactive Charts** | Candlestick chart per stock with V20 entry/exit overlays; zoom controls (All / 2Y / 1Y / 6M) |
| 💼 **Detailed Trade Log** | Sortable, filterable full trade table across all stocks |
| 🗃️ **Stock Performance** | Per-stock summary with **expandable rows** — click any stock to see all its individual trades inline |

### V20 Performance Table
Shows side-by-side comparison of:
- **All Time** — entire backtest period
- **1 Year Ago** — last 12 months only

Metrics: Total Trades, Successful Trades, Success Rate, Avg Return, Best Return, Avg Recovery (days), Max Exposure, Total Profit (₹)

---

## 📁 Ticker List Format

`stocks/v40.txt` and `stocks/v40-next.txt` contain one NSE ticker per line (Yahoo Finance format with `.NS` suffix). Lines starting with `#` are treated as comments.

```
# V40 Quality Stocks
RELIANCE.NS
TCS.NS
HDFCBANK.NS
...
```

---

## ⚙️ Configuration (`scripts/config.py`)

```python
DEFAULT_START_DATE        = "2010-01-05"   # Data history start
DEFAULT_END_DATE          = "2026-06-01"   # Data history end
DEFAULT_INITIAL_CAPITAL   = 100000.0       # Starting capital (portfolio mode)
DEFAULT_COMMISSION        = 0.0            # Brokerage fee (fraction of trade value)
DEFAULT_V20_MIN_PCT_MOVE  = 20.0           # Min % move to qualify as V20 setup
```

To extend history, just change `DEFAULT_START_DATE` — the cache auto-refreshes on the next run.

---

## 📦 Dependencies

```bash
pip install yfinance pandas numpy requests
```

| Package | Purpose |
|---|---|
| `yfinance` | Historical OHLCV data from Yahoo Finance |
| `pandas` | Data manipulation and time-series analysis |
| `numpy` | Numerical calculations |
| `requests` | HTTP session with custom User-Agent for data download |

> The HTML reports use **Plotly.js** and **TailwindCSS** loaded from CDN — no local install needed, but an internet connection is required to view charts.

---

## 🏎️ Caching

Downloaded price data is cached in `backtesting/.cache/` as JSON files (one per ticker). On subsequent runs, only stale or missing tickers are re-fetched. Use `--force-download` to refresh everything.

---

## 🧩 Adding New Strategies

Extend `BaseStrategy` in [`scripts/strategies.py`](scripts/strategies.py):

```python
class MyStrategy(BaseStrategy):
    def __init__(self):
        super().__init__(name="MyStrategy")

    def generate_setups(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        # Return list of setup dicts with keys:
        # setup_date, trigger_date, entry_price, target_price, strategy_name, initial_move_pct
        return []
```

Then swap `V20Strategy()` for `MyStrategy()` in [`scripts/run.py`](scripts/run.py).
