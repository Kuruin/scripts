import os

# Project Directories
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(SCRIPTS_DIR)   # backtesting/ root
CACHE_DIR = os.path.join(BASE_DIR, ".cache")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

# Create directories if they don't exist
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Default Backtest Parameters
DEFAULT_START_DATE = "2010-01-05"
DEFAULT_END_DATE = "2026-06-01"
DEFAULT_INITIAL_CAPITAL = 100000.0
DEFAULT_COMMISSION = 0.0  # Fees/slippage per trade (fraction of trade value)

# V20 Strategy Parameters
DEFAULT_V20_MIN_PCT_MOVE = 20.0  # Minimum 20% move

