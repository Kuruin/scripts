import os
import pandas as pd
import yfinance as yf
import requests
from datetime import datetime, timedelta
from config import CACHE_DIR

# Create a session with browser-like user agent to avoid rate limits
_session = requests.Session()
_session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

def is_cache_stale(ticker: str, start_date: str, end_date: str) -> bool:
    """Helper to check if the cached file for a ticker exists and is fresh."""
    cache_path = os.path.join(CACHE_DIR, f"{ticker}.csv")
    if not os.path.exists(cache_path):
        return True
        
    try:
        df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
        if df.empty:
            return True
            
        cache_min_date = df.index.min()
        cache_max_date = df.index.max()
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)
        today = datetime.now()
        
        if end_dt > today:
            end_dt = today
            
        # Check if cache covers the required range
        is_recent_enough = True
        if end_dt >= today - timedelta(days=1):
            mtime = datetime.fromtimestamp(os.path.getmtime(cache_path))
            is_recent_enough = (today - mtime) < timedelta(hours=12)
            
        return not (cache_min_date <= start_dt and cache_max_date >= end_dt - timedelta(days=4) and is_recent_enough)
    except:
        return True

def download_batch_data(tickers: list, start_date: str, end_date: str, force_download: bool = False):
    """
    Downloads historical data for all listed tickers in a single batch request to avoid rate limits.
    Caches each stock's data as a separate CSV file in .cache/.
    """
    if not tickers:
        return
        
    # Filter tickers that actually need downloading
    to_download = []
    for ticker in tickers:
        if force_download or is_cache_stale(ticker, start_date, end_date):
            to_download.append(ticker)
            
    if not to_download:
        print("All stock cache files are up-to-date. Skipping download.")
        return
        
    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)
    download_start = min(pd.to_datetime("2010-01-01"), start_dt)
    download_start_str = download_start.strftime("%Y-%m-%d")
    
    today = datetime.now()
    if end_dt > today:
        end_dt = today
    download_end_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    
    print(f"\n--- Batch downloading {len(to_download)} / {len(tickers)} stocks in a single request ---")
    print(f"Tickers to download: {', '.join(to_download)}")
    
    try:
        # Fetch all tickers in a single yfinance request (highly optimized, rate-limit safe)
        df_all = yf.download(
            tickers=to_download, 
            start=download_start_str, 
            end=download_end_str, 
            group_by='ticker', 
            progress=False,
            session=_session
        )
        
        if df_all.empty:
            print("Warning: Batch download returned empty dataset.")
            return
            
        for ticker in to_download:
            try:
                # Extract ticker dataframe from multi-ticker format
                if isinstance(df_all.columns, pd.MultiIndex):
                    # Check if ticker is at the top level
                    if ticker in df_all.columns.levels[0]:
                        df_ticker = df_all[ticker].copy()
                    else:
                        # Fallback if yfinance formats columns differently (e.g. cross-section)
                        df_ticker = df_all.xs(ticker, axis=1, level=1).copy()
                else:
                    # Single ticker returned standard DataFrame
                    df_ticker = df_all.copy()
                    
                # Clean up columns
                if isinstance(df_ticker.columns, pd.MultiIndex):
                    df_ticker.columns = df_ticker.columns.get_level_values(0)
                
                # Check if we got data
                df_ticker.dropna(subset=['Close'], inplace=True)
                if df_ticker.empty:
                    print(f"Warning: No valid records returned for {ticker}.")
                    continue
                    
                # Select only core OHLCV columns
                valid_cols = [c for c in ['Open', 'High', 'Low', 'Close', 'Volume'] if c in df_ticker.columns]
                df_ticker = df_ticker[valid_cols].copy()
                
                # Save to cache
                cache_path = os.path.join(CACHE_DIR, f"{ticker}.csv")
                df_ticker.to_csv(cache_path)
                
            except Exception as ex:
                print(f"Error processing batch data for {ticker}: {ex}")
                
        print("Batch download completed and cache updated.\n")
        
    except Exception as e:
        print(f"Critical error during batch download: {e}")

def get_stock_data(ticker: str, start_date: str, end_date: str, force_download: bool = False) -> pd.DataFrame:
    """
    Retrieves daily stock data for a given ticker.
    Loads from local cache (which is populated by download_batch_data beforehand).
    """
    cache_path = os.path.join(CACHE_DIR, f"{ticker}.csv")
    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)
    
    today = datetime.now()
    if end_dt > today:
        end_dt = today
        
    if os.path.exists(cache_path):
        try:
            df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
            if not df.empty:
                # Filter and return cached data
                df_filtered = df.loc[start_dt:end_dt].copy()
                if not df_filtered.empty:
                    return df_filtered
        except Exception as e:
            print(f"Warning: Error reading cache for {ticker}: {e}")
            
    # Fallback to single download if cache is missing (though batch download should have run)
    print(f"Cache missing/stale for {ticker}. Running individual fallback download...")
    try:
        download_start = min(pd.to_datetime("2010-01-01"), start_dt)
        download_start_str = download_start.strftime("%Y-%m-%d")
        download_end_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        
        df_new = yf.download(ticker, start=download_start_str, end=download_end_str, progress=False, session=_session)
        if not df_new.empty:
            if isinstance(df_new.columns, pd.MultiIndex):
                df_new.columns = df_new.columns.get_level_values(0)
            df_new = df_new[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
            df_new.dropna(subset=['Close'], inplace=True)
            df_new.to_csv(cache_path)
            return df_new.loc[start_dt:end_dt].copy()
    except Exception as e:
        print(f"Individual fallback download failed for {ticker}: {e}")
        
    return pd.DataFrame()
