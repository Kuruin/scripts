import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from config import CACHE_DIR

def generate_synthetic_stock(ticker: str, start_price: float, seed: int) -> pd.DataFrame:
    np.random.seed(seed)
    
    start_date = datetime(2021, 1, 1)
    end_date = datetime(2026, 6, 1)
    
    # Generate business days
    dates = pd.date_range(start=start_date, end=end_date, freq='B')
    n_days = len(dates)
    
    # Generate a random walk with daily return standard dev of 1.5% and a tiny positive drift of 0.05%
    daily_returns = np.random.normal(loc=0.0005, scale=0.015, size=n_days)
    
    # Cumulative product to get price path
    price_factor = np.cumprod(1 + daily_returns)
    close_prices = start_price * price_factor
    
    # Let's inject 3 specific V20 runs so we guarantee valid trades occur
    # Run 1: around index 100
    # Run 2: around index 400
    # Run 3: around index 800
    injection_points = [100, 400, 800]
    
    for idx in injection_points:
        if idx + 40 < n_days:
            # 1. 5 days of consecutive green candles to create a V20 move (min 20% move)
            # Day idx to idx+4:
            base_price = close_prices[idx-1]
            close_prices[idx]   = base_price * 1.05
            close_prices[idx+1] = base_price * 1.10
            close_prices[idx+2] = base_price * 1.15
            close_prices[idx+3] = base_price * 1.20
            close_prices[idx+4] = base_price * 1.25 # 25% total move!
            
            # 2. Pullback over the next 10 days to drop below the sequence start low (base_price)
            # Let's drop it down to base_price * 0.95 (5% below entry limit)
            for j in range(5, 15):
                close_prices[idx+j] = base_price * (1.25 - (j - 4) * 0.03) # Gradual drop to ~0.95
                
            # 3. Rally over the next 15 days to exceed the sequence high (base_price * 1.25)
            # Let's rally to base_price * 1.30
            for j in range(15, 30):
                close_prices[idx+j] = base_price * (0.95 + (j - 14) * 0.025)
                
    # Derive Open, High, Low based on Close
    opens = []
    highs = []
    lows = []
    
    for i in range(n_days):
        c = close_prices[i]
        # Prev close
        prev_c = close_prices[i-1] if i > 0 else start_price
        
        # Decide if green or red
        # For our V20 injected runs, we must make sure the candles are green
        is_in_green_run = False
        for idx in injection_points:
            if idx <= i <= idx + 4:
                is_in_green_run = True
                break
                
        if is_in_green_run:
            o = prev_c * (1.0 - np.random.uniform(0.001, 0.005))
            # Close must be > Open
            if c <= o:
                c = o * 1.02 # Force close to be higher
                close_prices[i] = c
        else:
            o = prev_c * (1.0 + np.random.normal(0.0, 0.005))
            
        h = max(o, c) * (1.0 + np.random.uniform(0.002, 0.015))
        l = min(o, c) * (1.0 - np.random.uniform(0.002, 0.015))
        
        # Adjust injection lows/highs for exact V20 setup tracking
        # For Day idx (start of sequence): Low is the sequence start low
        # For Day idx+4 (end of sequence): High is the sequence high
        
        opens.append(o)
        highs.append(h)
        lows.append(l)
        
    df = pd.DataFrame({
        'Open': opens,
        'High': highs,
        'Low': lows,
        'Close': close_prices,
        'Volume': np.random.randint(100000, 1000000, size=n_days)
    }, index=dates)
    
    # Ensure index has name Date
    df.index.name = 'Date'
    
    # Round prices to 2 decimals
    df = df.round(2)
    
    return df

def main():
    print(f"Creating cache directory at: {CACHE_DIR}")
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    stocks = {
        "RELIANCE.NS": (2000.0, 42),
        "TCS.NS": (3000.0, 101),
        "INFY.NS": (1200.0, 2023)
    }
    
    for ticker, (price, seed) in stocks.items():
        print(f"Generating mock history for {ticker}...")
        df = generate_synthetic_stock(ticker, price, seed)
        path = os.path.join(CACHE_DIR, f"{ticker}.csv")
        df.to_csv(path)
        print(f"Saved to cache: {path}")

if __name__ == "__main__":
    main()
