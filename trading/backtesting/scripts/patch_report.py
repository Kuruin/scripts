import sys
from pathlib import Path

src = Path(__file__).parent / "report_generator.py"
text = src.read_text(encoding="utf-8")
original_len = len(text)

# ------------------------------------------------------------------
# PATCH 1: Replace Tab-3 flat table with grouped-by-ticker accordion
# ------------------------------------------------------------------
OLD_TAB3_MARKER = '<!-- TAB 3: DETAILED TRADE LOG -->'
NEW_TAB3_MARKER = '<!-- TAB 3: DETAILED TRADE LOG (GROUPED BY TICKER) -->'

OLD_TAB3_THEAD = (
    '                        <thead class="bg-gray-900 sticky top-0 border-b border-gray-800 text-xs uppercase text-gray-400 font-semibold">\n'
    '                            <tr>\n'
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('ticker')\">Ticker \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('trigger_date')\">Trigger Date \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('fill_date')\">Fill Date \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('exit_date')\">Exit Date \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('entry_price')\">Entry Price \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('exit_price')\">Exit Price \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('pnl_pct')\">PnL % \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('holding_days')\">Duration \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('status')\">Status \u21c5</th>\n"
    "                                <th class=\"px-6 py-3 cursor-pointer select-none hover:bg-gray-800/80\" onclick=\"sortTrades('max_drawdown_pct')\">Max Drawdown \u21c5</th>\n"
    '                            </tr>\n'
    '                        </thead>'
)
NEW_TAB3_THEAD = (
    '                        <thead class="bg-gray-900 sticky top-0 border-b border-gray-800 text-xs uppercase text-gray-400 font-semibold z-10">\n'
    '                            <tr>\n'
    '                                <th class="px-4 py-3 w-6"></th>\n'
    '                                <th class="px-4 py-3">Ticker</th>\n'
    '                                <th class="px-4 py-3">Signals</th>\n'
    '                                <th class="px-4 py-3">Filled</th>\n'
    '                                <th class="px-4 py-3">Win Rate</th>\n'
    '                                <th class="px-4 py-3">Total P&amp;L (&#8377;)</th>\n'
    '                                <th class="px-4 py-3">Avg Return</th>\n'
    '                                <th class="px-4 py-3">Active</th>\n'
    '                                <th class="px-4 py-3" colspan="2"></th>\n'
    '                            </tr>\n'
    '                        </thead>'
)

OLD_COUNT = 'Showing <span id="trades-showing-count">0</span> / <span id="trades-total-count">0</span> trades'
NEW_COUNT = 'Showing <span id="trades-showing-count">0</span> / <span id="trades-total-count">0</span> trades &nbsp;&bull;&nbsp; <span id="trades-group-count">0</span> stocks'

OLD_FILTER_CALL = 'oninput="filterTrades()"'
NEW_FILTER_CALL = 'oninput="filterTrades()"'  # no change needed here

OLD_TABLE_DIV = '<div class="overflow-x-auto max-h-[500px]">'
NEW_TABLE_DIV = '<div class="overflow-x-auto max-h-[600px]">'

# Apply patches
assert OLD_TAB3_MARKER in text, "P1a anchor not found"
text = text.replace(OLD_TAB3_MARKER, NEW_TAB3_MARKER, 1)

assert OLD_COUNT in text, "P1b anchor not found"
text = text.replace(OLD_COUNT, NEW_COUNT, 1)

assert OLD_TAB3_THEAD in text, "P1c thead anchor not found"
text = text.replace(OLD_TAB3_THEAD, NEW_TAB3_THEAD, 1)

assert OLD_TABLE_DIV in text, "P1d maxh anchor not found"
text = text.replace(OLD_TABLE_DIV, NEW_TABLE_DIV, 1)

print("PATCH 1 applied: Tab-3 grouped headers")

# ------------------------------------------------------------------
# PATCH 2: Insert Tab-5 (Capital Journey) HTML before </main>
# ------------------------------------------------------------------
JOURNEY_HTML = '''
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
        </div>'''

# Insert before </main>
MAIN_CLOSE = '\n    </main>'
assert text.count(MAIN_CLOSE) == 1, f"Expected 1 </main>, found {text.count(MAIN_CLOSE)}"
text = text.replace(MAIN_CLOSE, JOURNEY_HTML + MAIN_CLOSE, 1)
print("PATCH 2 applied: Capital Journey HTML tab inserted")

# ------------------------------------------------------------------
# PATCH 3: window.onload – call renderGroupedTradesTable + journey
# ------------------------------------------------------------------
OLD_ONLOAD_LINES = (
    '            // Render tables & default stock chart\n'
    '            renderTickersTable();\n'
    '            renderTradesTable();\n'
    '            if (reportData.tickers_list.length > 0) {{\n'
    '                renderCandlestick(reportData.tickers_list[0]);\n'
    '            }}\n'
    '        }};'
)
NEW_ONLOAD_LINES = (
    '            // Render tables & default stock chart\n'
    '            renderTickersTable();\n'
    '            renderGroupedTradesTable();\n'
    "            if (reportData.mode === 'portfolio') {{\n"
    "                document.getElementById('tab-btn-journey').classList.remove('hidden');\n"
    '                renderCapitalJourney();\n'
    '            }}\n'
    '            if (reportData.tickers_list.length > 0) {{\n'
    '                renderCandlestick(reportData.tickers_list[0]);\n'
    '            }}\n'
    '        }};'
)
assert OLD_ONLOAD_LINES in text, "PATCH 3 anchor not found"
text = text.replace(OLD_ONLOAD_LINES, NEW_ONLOAD_LINES, 1)
print("PATCH 3 applied: window.onload updated")

# ------------------------------------------------------------------
# PATCH 4: Replace old JS functions with new grouped versions
# ------------------------------------------------------------------
JS_START_MARKER = '        function renderTradesTable() {{'
JS_END_MARKER   = '        }}\n    </script>'

si = text.find(JS_START_MARKER)
ei = text.find(JS_END_MARKER, si)
assert si != -1, "PATCH 4: renderTradesTable start not found"
assert ei != -1, "PATCH 4: </script> end not found"

# We replace from JS_START_MARKER up to (and including) the final `}}`
OLD_JS_BLOCK = text[si : ei + len('        }}')]

NEW_JS_BLOCK = (
    '        // ----------------------------------------------------\n'
    '        // GROUPED TRADE LOG (PER-TICKER ACCORDION)\n'
    '        // ----------------------------------------------------\n'
    '        function renderGroupedTradesTable() {{\n'
    "            const tbody = document.getElementById('trades-table-body');\n"
    "            tbody.innerHTML = '';\n"
    "            const search  = document.getElementById('trade-search').value.toUpperCase();\n"
    "            const status  = document.getElementById('status-filter').value;\n"
    "            const filtered = reportData.trades.filter(t =>\n"
    "                t.ticker.toUpperCase().includes(search) && (status === 'ALL' || t.status === status)\n"
    "            );\n"
    "            document.getElementById('trades-total-count').innerText   = reportData.trades.length;\n"
    "            document.getElementById('trades-showing-count').innerText = filtered.length;\n"
    "            const groups = {{}};\n"
    "            filtered.forEach(t => {{ if (!groups[t.ticker]) groups[t.ticker] = []; groups[t.ticker].push(t); }});\n"
    "            document.getElementById('trades-group-count').innerText = Object.keys(groups).length;\n"
    "\n"
    "            Object.keys(groups).sort().forEach(ticker => {{\n"
    "                const trades    = groups[ticker];\n"
    "                const filled    = trades.filter(t => t.status !== 'PENDING');\n"
    "                const completed = trades.filter(t => t.status === 'COMPLETED');\n"
    "                const open      = trades.filter(t => t.status === 'OPEN');\n"
    "                const wins      = completed.filter(t => t.pnl_pct > 0);\n"
    "                const winRate   = completed.length > 0 ? (wins.length / completed.length * 100) : 0;\n"
    "                const totalPnlCash = filled.reduce((s, t) => s + (t.pnl_cash || 0), 0);\n"
    "                const avgReturn = filled.length > 0 ? filled.reduce((s, t) => s + t.pnl_pct, 0) / filled.length : 0;\n"
    "                const gid = 'tgrp-' + ticker.replace(/[^a-zA-Z0-9]/g, '_');\n"
    "\n"
    "                const hdr = document.createElement('tr');\n"
    "                hdr.className = 'cursor-pointer bg-gray-900/60 hover:bg-gray-800/60 transition select-none border-b border-gray-700/60';\n"
    "                hdr.onclick = () => toggleTradeGroup(gid);\n"
    "                const pnlColor = totalPnlCash >= 0 ? 'text-green-400' : 'text-red-400';\n"
    "                const retColor = avgReturn    >= 0 ? 'text-green-400' : 'text-red-400';\n"
    "                const pnlSign  = totalPnlCash >= 0 ? '+' : '';\n"
    "                const retSign  = (filled.length > 0 && avgReturn >= 0) ? '+' : '';\n"
    "                hdr.innerHTML = `\n"
    "                    <td class=\"px-4 py-3 text-gray-500 text-xs\" id=\"arrow-${{gid}}\">&#9658;</td>\n"
    "                    <td class=\"px-4 py-3 font-bold text-white\">${{ticker}}</td>\n"
    "                    <td class=\"px-4 py-3 text-gray-400 text-xs\">${{trades.length}}</td>\n"
    "                    <td class=\"px-4 py-3 text-blue-400 text-xs\">${{filled.length}}</td>\n"
    "                    <td class=\"px-4 py-3 text-xs\">${{completed.length > 0 ? winRate.toFixed(0) + '%' : '&mdash;'}}</td>\n"
    "                    <td class=\"px-4 py-3 text-xs font-semibold ${{pnlColor}}\">${{pnlSign}}&#8377;${{Math.round(Math.abs(totalPnlCash)).toLocaleString('en-IN')}}</td>\n"
    "                    <td class=\"px-4 py-3 text-xs ${{retColor}}\">${{filled.length > 0 ? retSign + avgReturn.toFixed(2) + '%' : '&mdash;'}}</td>\n"
    "                    <td class=\"px-4 py-3 text-xs text-blue-300\">${{open.length > 0 ? open.length + ' active' : ''}}</td>\n"
    "                    <td class=\"px-4 py-3\" colspan=\"2\"></td>\n"
    "                `;\n"
    "                tbody.appendChild(hdr);\n"
    "\n"
    "                const expRow = document.createElement('tr');\n"
    "                expRow.id = gid;\n"
    "                expRow.classList.add('hidden');\n"
    "                const sortedTrades = [...trades].sort((a, b) =>\n"
    "                    (a.fill_date || a.trigger_date || '').localeCompare(b.fill_date || b.trigger_date || '')\n"
    "                );\n"
    "                const tradeRows = sortedTrades.map(t => {{\n"
    "                    const pnlCls  = t.status !== 'PENDING' ? (t.pnl_pct >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold') : 'text-gray-400';\n"
    "                    const pnlSgn  = (t.status !== 'PENDING' && t.pnl_pct >= 0) ? '+' : '';\n"
    "                    const pnlCash = t.pnl_cash || 0;\n"
    "                    const cashCls = pnlCash >= 0 ? 'text-green-400' : 'text-red-400';\n"
    "                    const inv     = (t.status !== 'PENDING' && t.shares) ? '&#8377;' + Math.round(t.shares * t.entry_price).toLocaleString('en-IN') : '&mdash;';\n"
    "                    let bdg = '';\n"
    "                    if (t.status === 'COMPLETED') bdg = '<span class=\"px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/40\">DONE</span>';\n"
    "                    else if (t.status === 'OPEN')  bdg = '<span class=\"px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/30 text-blue-400 border border-blue-800/40\">OPEN</span>';\n"
    "                    else                           bdg = '<span class=\"px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-900/30 text-yellow-400 border border-yellow-800/40\">WAIT</span>';\n"
    "                    return `<tr class=\"border-t border-gray-800/50 hover:bg-gray-800/20\">\n"
    "                        <td class=\"pl-8 pr-3 py-2.5\"></td>\n"
    "                        <td class=\"px-3 py-2.5 text-gray-300 text-xs\">${{t.fill_date || '&mdash;'}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-gray-300 text-xs\">${{t.exit_date || (t.status === 'OPEN' ? 'Active' : '&mdash;')}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-xs text-blue-300 font-mono\">${{inv}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-xs\">&#8377;${{t.entry_price.toFixed(2)}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-xs\">${{t.exit_price ? '&#8377;' + t.exit_price.toFixed(2) : '&mdash;'}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-xs ${{pnlCls}}\">${{t.status !== 'PENDING' ? pnlSgn + t.pnl_pct.toFixed(2) + '%' : '0.00%'}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-xs ${{cashCls}}\">${{t.status !== 'PENDING' ? (pnlCash >= 0 ? '+' : '') + '&#8377;' + Math.round(Math.abs(pnlCash)).toLocaleString('en-IN') : '&mdash;'}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-xs\">${{bdg}}</td>\n"
    "                        <td class=\"px-3 py-2.5 text-xs text-red-400\">${{t.status !== 'PENDING' ? t.max_drawdown_pct.toFixed(2) + '%' : '&mdash;'}}</td>\n"
    "                    </tr>`;\n"
    "                }}).join('');\n"
    "\n"
    "                expRow.innerHTML = `<td colspan=\"10\" class=\"p-0\"><div class=\"bg-gray-950/60 border-b border-gray-700/50\">\n"
    "                    <table class=\"min-w-full border-collapse\"><thead><tr class=\"text-gray-500 text-xs uppercase border-b border-gray-800/80\">\n"
    "                        <th class=\"pl-8 pr-3 py-2 text-left w-6\"></th>\n"
    "                        <th class=\"px-3 py-2 text-left\">Fill Date</th><th class=\"px-3 py-2 text-left\">Exit Date</th>\n"
    "                        <th class=\"px-3 py-2 text-left\">Invested</th><th class=\"px-3 py-2 text-left\">Entry</th>\n"
    "                        <th class=\"px-3 py-2 text-left\">Exit</th><th class=\"px-3 py-2 text-left\">Return %</th>\n"
    "                        <th class=\"px-3 py-2 text-left\">P&amp;L (&#8377;)</th><th class=\"px-3 py-2 text-left\">Status</th>\n"
    "                        <th class=\"px-3 py-2 text-left\">Max DD</th></tr></thead>\n"
    "                    <tbody>${{tradeRows || '<tr><td colspan=\"10\" class=\"px-8 py-3 text-gray-600\">No trades</td></tr>'}}</tbody></table>\n"
    "                </div></td>`;\n"
    "                tbody.appendChild(expRow);\n"
    "            }});\n"
    "        }}\n"
    "\n"
    "        function toggleTradeGroup(gid) {{\n"
    "            const row   = document.getElementById(gid);\n"
    "            const arrow = document.getElementById('arrow-' + gid);\n"
    "            if (!row) return;\n"
    "            const isHidden = row.classList.contains('hidden');\n"
    "            row.classList.toggle('hidden', !isHidden);\n"
    "            if (arrow) arrow.innerHTML = isHidden ? '&#9660;' : '&#9658;';\n"
    "        }}\n"
    "\n"
    "        function filterTrades() {{\n"
    "            renderGroupedTradesTable();\n"
    "        }}\n"
    "\n"
    "        // ----------------------------------------------------\n"
    "        // CAPITAL JOURNEY (PORTFOLIO MODE ONLY)\n"
    "        // ----------------------------------------------------\n"
    "        function renderCapitalJourney() {{\n"
    "            if (reportData.mode !== 'portfolio') return;\n"
    "            const sum = reportData.portfolio_summary;\n"
    "            document.getElementById('jrn-initial').innerText = '&#8377;' + Math.round(sum.initial_capital).toLocaleString('en-IN');\n"
    "            document.getElementById('jrn-final').innerText   = '&#8377;' + Math.round(sum.final_equity).toLocaleString('en-IN');\n"
    "            const equityByDate = {{}};\n"
    "            reportData.equity_curve.forEach(e => {{ equityByDate[e.date] = e.val; }});\n"
    "            const filledTrades = reportData.trades\n"
    "                .filter(t => t.status !== 'PENDING' && t.fill_date)\n"
    "                .sort((a, b) => a.fill_date.localeCompare(b.fill_date));\n"
    "            let totalDeployed = 0, totalProfit = 0;\n"
    "            filledTrades.forEach(t => {{\n"
    "                totalDeployed += (t.shares || 0) * t.entry_price;\n"
    "                totalProfit   += (t.pnl_cash || 0);\n"
    "            }});\n"
    "            document.getElementById('jrn-deployed').innerText = '&#8377;' + Math.round(totalDeployed).toLocaleString('en-IN');\n"
    "            const profitEl = document.getElementById('jrn-profit');\n"
    "            profitEl.innerText = (totalProfit >= 0 ? '+' : '') + '&#8377;' + Math.round(Math.abs(totalProfit)).toLocaleString('en-IN');\n"
    "            profitEl.className = 'text-xl font-bold mt-2 ' + (totalProfit >= 0 ? 'text-green-400' : 'text-red-400');\n"
    "            const tbody = document.getElementById('journey-table-body');\n"
    "            tbody.innerHTML = '';\n"
    "            let cumPnl = 0;\n"
    "            filledTrades.forEach((t, idx) => {{\n"
    "                const invested = (t.shares || 0) * t.entry_price;\n"
    "                const pnlCash  = t.pnl_cash || 0;\n"
    "                cumPnl += pnlCash;\n"
    "                const portVal  = equityByDate[t.fill_date];\n"
    "                const pnlCls   = t.pnl_pct >= 0 ? 'text-green-400' : 'text-red-400';\n"
    "                const cumCls   = cumPnl >= 0 ? 'text-green-400' : 'text-red-400';\n"
    "                let bdg = '';\n"
    "                if (t.status === 'COMPLETED') bdg = '<span class=\"px-2 py-0.5 rounded-full text-xs font-semibold bg-green-900/30 text-green-400 border border-green-800/40\">DONE</span>';\n"
    "                else bdg = '<span class=\"px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-900/30 text-blue-400 border border-blue-800/40\">OPEN</span>';\n"
    "                const tr = document.createElement('tr');\n"
    "                tr.className = 'hover:bg-gray-800/40 transition duration-150';\n"
    "                tr.innerHTML = `\n"
    "                    <td class=\"px-4 py-3 text-gray-500 text-xs font-mono\">${{idx + 1}}</td>\n"
    "                    <td class=\"px-4 py-3 text-gray-300 text-xs\">${{t.fill_date}}</td>\n"
    "                    <td class=\"px-4 py-3 font-bold text-white\">${{t.ticker}}</td>\n"
    "                    <td class=\"px-4 py-3 text-blue-300 text-xs font-mono\">&#8377;${{Math.round(invested).toLocaleString('en-IN')}}</td>\n"
    "                    <td class=\"px-4 py-3 text-gray-300 text-xs\">&#8377;${{t.entry_price.toFixed(2)}}</td>\n"
    "                    <td class=\"px-4 py-3 text-gray-300 text-xs\">${{t.exit_date || (t.status === 'OPEN' ? 'Active' : '&mdash;')}}</td>\n"
    "                    <td class=\"px-4 py-3 text-gray-300 text-xs\">${{t.exit_price ? '&#8377;' + t.exit_price.toFixed(2) : '&mdash;'}}</td>\n"
    "                    <td class=\"px-4 py-3 text-xs font-semibold ${{pnlCls}}\">${{t.pnl_pct >= 0 ? '+' : ''}}${{t.pnl_pct.toFixed(2)}}%</td>\n"
    "                    <td class=\"px-4 py-3 text-xs font-semibold ${{pnlCls}}\">${{pnlCash >= 0 ? '+' : ''}}&#8377;${{Math.round(Math.abs(pnlCash)).toLocaleString('en-IN')}}</td>\n"
    "                    <td class=\"px-4 py-3 text-xs text-gray-400 font-mono\">${{portVal ? '&#8377;' + Math.round(portVal).toLocaleString('en-IN') : '&mdash;'}}</td>\n"
    "                    <td class=\"px-4 py-3 text-xs font-semibold ${{cumCls}}\">${{cumPnl >= 0 ? '+' : ''}}&#8377;${{Math.round(Math.abs(cumPnl)).toLocaleString('en-IN')}}</td>\n"
    "                    <td class=\"px-4 py-3\">${{bdg}}</td>\n"
    "                `;\n"
    "                tbody.appendChild(tr);\n"
    "            }});\n"
    "        }}"
)

assert OLD_JS_BLOCK in text, "PATCH 4: JS block not found"
text = text.replace(OLD_JS_BLOCK, NEW_JS_BLOCK, 1)
print("PATCH 4 applied: JS functions replaced")

src.write_text(text, encoding="utf-8")
print(f"Done — report_generator.py patched ({original_len} -> {len(text)} chars)")
