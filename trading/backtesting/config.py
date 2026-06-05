import os

# Project Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(BASE_DIR, ".cache")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

# Create directories if they don't exist
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Default Backtest Parameters
DEFAULT_START_DATE = "2021-01-01"
DEFAULT_END_DATE = "2026-06-01"
DEFAULT_INITIAL_CAPITAL = 100000.0
DEFAULT_COMMISSION = 0.0  # Fees/slippage per trade (fraction of trade value)

# V20 Strategy Parameters
DEFAULT_V20_MIN_PCT_MOVE = 20.0  # Minimum 20% move

# Default lists of stocks to test
# These are major liquid stocks representing different sectors of the Indian market
DEFAULT_TICKERS = [
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "INFY.NS",
    "ICICIBANK.NS",
    "SBIN.NS",
    "BHARTIARTL.NS",
    "ITC.NS",
    "L&T.NS",  # Note: L&T is represented as LT.NS in yfinance usually, but let's double check or use LT.NS
    "LT.NS",
    "TATASTEEL.NS",
    "M&M.NS",
    "AXISBANK.NS",
    "ADANIENT.NS"
]

# Tickers to exclude duplicates or issues
DEFAULT_TICKERS = list(set([t for t in DEFAULT_TICKERS if t != "L&T.NS"]))  # use LT.NS
