import os
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from config import CACHE_DIR

def get_stock_data(ticker: str, start_date: str, end_date: str, force_download: bool = False) -> pd.DataFrame:
    """
    Retrieves daily stock data for the given ticker.
    Uses cached CSV data if available and fresh. Otherwise downloads via yfinance and caches it.
    
    Args:
        ticker: The stock symbol (e.g. "RELIANCE.NS").
        start_date: Start date string (YYYY-MM-DD).
        end_date: End date string (YYYY-MM-DD).
        force_download: If True, forces redownloading even if cache is fresh.
        
    Returns:
        pd.DataFrame: Stock data containing Open, High, Low, Close, Volume.
    """
    cache_path = os.path.join(CACHE_DIR, f"{ticker}.csv")
    
    # Target dates
    start_dt = pd.to_datetime(start_date)
    end_dt = pd.to_datetime(end_date)
    
    # Cap end date to today
    today = datetime.now()
    if end_dt > today:
        end_dt = today
        
    use_cache = False
    
    if os.path.exists(cache_path) and not force_download:
        try:
            # Read cache
            df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
            if not df.empty:
                cache_min_date = df.index.min()
                cache_max_date = df.index.max()
                
                # Check if cache covers the required range
                # We also check if the cache is recently updated if the end date is today/recent
                is_recent_enough = True
                if end_dt >= today - timedelta(days=1):
                    # Check file modification time (less than 12 hours old)
                    mtime = datetime.fromtimestamp(os.path.getmtime(cache_path))
                    is_recent_enough = (today - mtime) < timedelta(hours=12)
                
                if cache_min_date <= start_dt and cache_max_date >= end_dt - timedelta(days=4) and is_recent_enough:
                    use_cache = True
        except Exception as e:
            print(f"Warning: Error reading cache for {ticker}: {e}. Will re-download.")
            
    if use_cache:
        # Filter and return cached data
        df_filtered = df.loc[start_dt:end_dt].copy()
        if not df_filtered.empty:
            return df_filtered

    # Download from yfinance
    # To ensure cache is reusable for wider ranges, download from 2010 or start_date (whichever is earlier)
    download_start = min(pd.to_datetime("2010-01-01"), start_dt)
    download_start_str = download_start.strftime("%Y-%m-%d")
    download_end_str = (end_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    
    print(f"Downloading data for {ticker} from {download_start_str} to {download_end_str}...")
    try:
        df_new = yf.download(ticker, start=download_start_str, end=download_end_str, progress=False)
        if df_new.empty:
            # Try to load cache as a fallback if download failed/returned empty
            if os.path.exists(cache_path):
                print(f"Warning: yfinance returned empty data for {ticker}. Falling back to existing cache.")
                df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
                return df.loc[start_dt:end_dt].copy()
            raise ValueError(f"No data returned for ticker {ticker}")
            
        # Clean column names (yfinance can return MultiIndex or standard columns depending on versions)
        if isinstance(df_new.columns, pd.MultiIndex):
            df_new.columns = df_new.columns.get_level_values(0)
            
        # Select required columns
        df_new = df_new[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
        
        # Drop rows with NaN in Close
        df_new.dropna(subset=['Close'], inplace=True)
        
        # Save to cache
        df_new.to_csv(cache_path)
        
        # Filter and return
        return df_new.loc[start_dt:end_dt].copy()
        
    except Exception as e:
        print(f"Error downloading {ticker}: {e}")
        if os.path.exists(cache_path):
            print(f"Falling back to existing cache for {ticker}.")
            df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
            return df.loc[start_dt:end_dt].copy()
        else:
            # Return empty DataFrame
            return pd.DataFrame()
