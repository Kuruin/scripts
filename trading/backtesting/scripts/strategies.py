import pandas as pd
import numpy as np
from typing import List, Dict, Any
from abc import ABC, abstractmethod

class BaseStrategy(ABC):
    """Abstract base class for all trading strategies."""
    
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    def generate_setups(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Scans historical data and returns a list of trade setups.
        
        Args:
            df: DataFrame with datetime index and columns ['Open', 'High', 'Low', 'Close', 'Volume']
            
        Returns:
            List of dicts, where each dict represents a trade setup:
            {
                'setup_date': pd.Timestamp,
                'entry_price': float,   # Buy limit price
                'target_price': float,  # Sell limit price
                'trigger_date': pd.Timestamp, # Date the setup was completed/locked
                'strategy_name': str
            }
        """
        pass


class V20Strategy(BaseStrategy):
    """
    V20 Volatility Strategy:
    1. Tracks consecutive green candles (Close > Open).
    2. Measures percentage move from the lowest low of the sequence to the highest high.
    3. If the move is >= 20%, a setup is triggered.
    4. The sequence continues (updating low/high) as long as candles remain green.
    5. Once a red/doji candle (Close <= Open) occurs, the sequence is locked.
    6. Entry is a limit buy at the sequence low.
    7. Exit is a limit sell at the sequence high.
    """
    
    def __init__(self, min_pct_move: float = 20.0):
        super().__init__(name="V20")
        self.min_pct_move = min_pct_move

    def generate_setups(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        if df.empty or len(df) < 2:
            return []
            
        setups = []
        
        # State variables for sequence tracking
        in_sequence = False
        sequence_start_idx = None
        sequence_low = None
        sequence_high = None
        setup_triggered = False
        
        # We need to iterate through the data to identify green sequences
        # index is Timestamp, row has Open, High, Low, Close
        for i in range(len(df)):
            date = df.index[i]
            row = df.iloc[i]
            o, h, l, c = row['Open'], row['High'], row['Low'], row['Close']
            
            is_green = c > o
            
            if is_green:
                if not in_sequence:
                    # Start of a new green sequence
                    in_sequence = True
                    sequence_start_idx = i
                    sequence_low = l
                    sequence_high = h
                    setup_triggered = False
                else:
                    # Continue existing sequence
                    sequence_low = min(sequence_low, l)
                    sequence_high = max(sequence_high, h)
                    
                # Calculate movement percentage from the lowest low to the highest high in this run
                move_percent = ((sequence_high - sequence_low) / sequence_low) * 100
                if move_percent >= self.min_pct_move:
                    setup_triggered = True
                    
            # If not green (red or doji), or we are at the last bar, end the sequence
            if not is_green or i == len(df) - 1:
                if in_sequence:
                    # If the sequence was active and had triggered a 20% move, lock it in
                    if setup_triggered:
                        # Setup is locked on the first non-green candle (or last candle of the data)
                        setups.append({
                            'setup_date': df.index[sequence_start_idx],
                            'trigger_date': date,
                            'entry_price': float(sequence_low),
                            'target_price': float(sequence_high),
                            'strategy_name': self.name,
                            'initial_move_pct': float(((sequence_high - sequence_low) / sequence_low) * 100)
                        })
                    # Reset sequence trackers
                    in_sequence = False
                    sequence_start_idx = None
                    sequence_low = None
                    sequence_high = None
                    setup_triggered = False
                    
        return setups


class SMAAlignmentStrategy(BaseStrategy):
    """
    SMA Alignment Strategy (Stub):
    1. Buy Condition: SMA 200 > SMA 50 > SMA 20 and Close < SMA 20 (pullback in downtrend).
       Enter on next candle Open.
    2. Average down on every 10% drop.
    3. Sell Condition: SMA 20 > SMA 50 > SMA 200 and Close > SMA 20 (pushup in uptrend).
       Exit on next candle Open.
    """
    def __init__(self):
        super().__init__(name="SMA_Alignment")

    def generate_setups(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        # Stub for future implementation
        return []


class EnvelopeStrategy(BaseStrategy):
    """
    Envelope Strategy (Stub):
    Buys at lower envelope band, sells at upper envelope band.
    """
    def __init__(self):
        super().__init__(name="Envelope")

    def generate_setups(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        # Stub for future implementation
        return []
