import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from strategies import V20Strategy
from engine import BacktestEngine

def run_test():
    # 1. Create synthetic data representing the scenario:
    # Day 0: Doji (no sequence)
    # Day 1-4: Continuous green candles with a > 20% move from lowest low to highest high
    # Day 5: Red candle (locks sequence)
    # Day 6: Red candle (not filled)
    # Day 7: Price drops to touch low (filled)
    # Day 8: Consolidation
    # Day 9: Price rallies to touch high (exited)
    
    dates = [datetime(2026, 1, 1) + timedelta(days=i) for i in range(10)]
    
    data = {
        'Open':  [100, 100, 104, 111, 120, 124, 122, 115, 99,  108],
        'High':  [100, 105, 112, 121, 125, 125, 123, 116, 110, 126],
        'Low':   [100, 99,  98,  105, 115, 121, 110, 97,  98,  107],
        'Close': [100, 104, 111, 120, 124, 122, 115, 99,  108, 125],
        'Volume':[1000] * 10
    }
    
    df = pd.DataFrame(data, index=dates)
    
    print("Synthetic Price Data:")
    for date, row in df.iterrows():
        is_green = row['Close'] > row['Open']
        print(f"Date: {date.strftime('%Y-%m-%d')} | O: {row['Open']:<4} | H: {row['High']:<4} | L: {row['Low']:<4} | C: {row['Close']:<4} | Green: {is_green}")
        
    # 2. Instantiate strategy and engine
    strategy = V20Strategy(min_pct_move=20.0)
    engine = BacktestEngine(initial_capital=100000.0, commission=0.0)
    
    print("\nGenerating Setups...")
    setups = strategy.generate_setups(df)
    
    print(f"Total Setups Found: {len(setups)}")
    for i, s in enumerate(setups):
        print(f"Setup {i+1}:")
        print(f"  Setup Start Date: {s['setup_date'].strftime('%Y-%m-%d')}")
        print(f"  Trigger/Lock Date: {s['trigger_date'].strftime('%Y-%m-%d')}")
        print(f"  Entry Limit Price: {s['entry_price']:.2f}")
        print(f"  Target Limit Price: {s['target_price']:.2f}")
        print(f"  Initial Move: {s['initial_move_pct']:.2f}%")
        
    # 3. Run backtest analysis
    print("\nRunning Backtest Analysis...")
    results = engine.run_individual_analysis({"TEST_STOCK": df}, strategy)
    
    trades = results["trades"]
    print(f"Total Simulated Trades: {len(trades)}")
    
    for i, t in enumerate(trades):
        print(f"Trade {i+1} details:")
        print(f"  Ticker: {t.ticker}")
        print(f"  Status: {t.status}")
        print(f"  Fill Date: {t.fill_date.strftime('%Y-%m-%d') if t.fill_date else 'N/A'}")
        print(f"  Exit Date: {t.exit_date.strftime('%Y-%m-%d') if t.exit_date else 'N/A'}")
        print(f"  Entry Price: {t.entry_price:.2f}")
        exit_price_str = f"{t.exit_price:.2f}" if t.exit_price is not None else "N/A"
        print(f"  Exit Price: {exit_price_str} (Valued at last Close if open)")
        print(f"  PnL %: {t.pnl_pct:.2f}%")
        print(f"  Holding Days: {t.holding_days}")
        print(f"  Max Drawdown during trade: {t.max_drawdown_pct:.2f}%")
        
    # Assertions to verify correctness
    assert len(setups) == 2, "Should identify exactly 2 setups"
    assert setups[0]['entry_price'] == 98.0, "Entry price should be lowest low of sequence (98.0)"
    assert setups[0]['target_price'] == 125.0, "Target price should be highest high of sequence (125.0)"
    
    assert len(trades) == 2, "Should generate exactly 2 trade records"
    assert trades[0].status == "COMPLETED", "First trade should be completed"
    assert trades[0].fill_date == datetime(2026, 1, 8), "First trade should be filled on 2026-01-08 (Day 7)"
    assert trades[0].exit_date == datetime(2026, 1, 10), "First trade should be exited on 2026-01-10 (Day 9)"
    assert trades[0].entry_price == 98.0, "First trade entry price should be 98.0"
    assert trades[0].exit_price == 125.0, "First trade exit price should be 125.0"
    assert trades[0].pnl_pct == ((125.0 - 98.0) / 98.0) * 100, "PnL % should be correctly computed"
    
    assert trades[1].status == "PENDING", "Second trade should be pending"
    
    print("\nSUCCESS: All strategy assertions passed perfectly!")

if __name__ == "__main__":
    run_test()
