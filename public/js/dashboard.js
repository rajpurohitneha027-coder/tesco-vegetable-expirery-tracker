function getStatus(p) {
    if (p.isRecalled) return { cls: 'recalled', label: 'Recalled' };
    const diff = (p.expiryDate * 1000 - Date.now()) / 86400000;
    if (diff < 0)  return { cls: 'expired',  label: 'Expired' };
    if (diff <= 4) return { cls: 'warning',  label: 'Expiring' };
    return { cls: 'fresh', label: 'Fresh' };
}

function formatDate(ts) {
    return new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeRemaining(ts) {
    const secs = ts - Math.floor(Date.now() / 1000);
    if (secs <= 0) return 'Expired';
    const days = Math.floor(secs / 86400);
    if (days > 0) return `${days}d left`;
    return `${Math.floor(secs / 3600)}h left`;
}

function countUp(el, target, duration = 600) {
    if (!el) return;
    const start = Date.now();
    const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1);
        el.textContent = Math.round(p * target);
        if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function startClock() {
    const el = document.getElementById('heroClock');
    if (!el) return;
    const tick = () => {
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            + '  ·  ' + now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    };
    tick();
    setInterval(tick, 1000);
}

const CAT_EMOJI = {
    Leafy:'🥬', Root:'🥕', Brassica:'🥦', Fruiting:'🍅',
    Allium:'🧅', Legume:'🫘', Squash:'🎃', Herb:'🌿', Other:'🥗'
};

async function loadPaymentStats() {
    try {
        const res = await fetch('/api/contract/balance');
        if (!res.ok) return;
        const d = await res.json();
        const el = document.getElementById('paymentPanel');
        if (!el) return;
        el.innerHTML = `
          <div class="pp-item">
            <div class="pp-val">${parseFloat(d.balance).toFixed(3)} ETH</div>
            <div class="pp-lbl">Contract Balance</div>
          </div>
          <div class="pp-divider"></div>
          <div class="pp-item">
            <div class="pp-val pp-paid">${parseFloat(d.totalPaid).toFixed(3)} ETH</div>
            <div class="pp-lbl">Total Paid to Suppliers</div>
          </div>
          <div class="pp-divider"></div>
          <div class="pp-item">
            <div class="pp-val">${parseFloat(d.paymentPerBatch).toFixed(3)} ETH</div>
            <div class="pp-lbl">Per Batch Payment</div>
          </div>`;
    } catch {}
}

async function loadDashboard() {
    try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error(await res.text());
        const products = await res.json();

        let fresh = 0, expiring = 0, expired = 0, recalled = 0;
        products.forEach(p => {
            const s = getStatus(p).cls;
            if (s === 'fresh')    fresh++;
            else if (s === 'warning') expiring++;
            else if (s === 'expired') expired++;
            else if (s === 'recalled') recalled++;
        });
        const total = products.length;
        const issues = expiring + expired + recalled;

        // Hero mini-stats
        const hmTotal = document.getElementById('hmTotal');
        const hmAlerts = document.getElementById('hmAlerts');
        countUp(hmTotal,  total);
        countUp(hmAlerts, issues);

        // Stat cards
        countUp(document.getElementById('statTotal'),    total);
        countUp(document.getElementById('statFresh'),    fresh);
        countUp(document.getElementById('statExpiring'), expiring);
        countUp(document.getElementById('statExpired'),  expired);
        countUp(document.getElementById('statRecalled'), recalled);

        // Health bar
        const pct = v => total > 0 ? ((v / total) * 100).toFixed(1) : 0;
        document.getElementById('segFresh').style.width    = pct(fresh) + '%';
        document.getElementById('segExpiring').style.width = pct(expiring) + '%';
        document.getElementById('segExpired').style.width  = pct(expired) + '%';
        document.getElementById('segRecalled').style.width = pct(recalled) + '%';

        const score = total > 0 ? Math.round((fresh / total) * 100) : 100;
        const scoreEl = document.getElementById('healthScore');
        if (scoreEl) {
            scoreEl.textContent = score + '% Healthy';
            scoreEl.className = 'health-score ' + (score >= 75 ? 'score-good' : score >= 40 ? 'score-warn' : 'score-bad');
        }

        // Alert banner
        const banner = document.getElementById('alertBanner');
        if (expiring > 0 || expired > 0) {
            banner.innerHTML = `⚠️ <strong>Action needed:</strong> ${expiring} product${expiring!==1?'s':''} expiring soon · ${expired} expired`;
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }

        // Product cards
        const recentGrid = document.getElementById('recentGrid');
        if (products.length === 0) {
            recentGrid.innerHTML = '<div class="empty-state">No products yet. <a href="/add">Add the first one →</a></div>';
        } else {
            recentGrid.innerHTML = products.slice(-6).reverse().map(p => {
                const st = getStatus(p);
                const daysLeft = ((p.expiryDate * 1000 - Date.now()) / 86400000).toFixed(0);
                return `<div class="product-card" data-status="${st.cls}">
                    <div class="pc-top">
                        <span class="status-tag status-${st.cls}">${st.label}</span>
                        <span class="pc-id">#${p.id}</span>
                    </div>
                    <div class="pc-name">${p.name}</div>
                    <div class="pc-sku">${p.sku}</div>
                    <div class="pc-divider"></div>
                    <div class="pc-row"><span class="pc-lbl">Category</span><span class="pc-val">${p.category}</span></div>
                    <div class="pc-row"><span class="pc-lbl">Supplier</span><span class="pc-val">${p.supplier || '—'}</span></div>
                    <div class="pc-row"><span class="pc-lbl">Expires</span><span class="pc-val">${formatDate(p.expiryDate)}</span></div>
                    <div class="pc-countdown ${st.cls}">${timeRemaining(p.expiryDate)}</div>
                </div>`;
            }).join('');
        }

        // Category grid
        const cats = {};
        products.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
        document.getElementById('categoryGrid').innerHTML = Object.entries(cats)
            .sort((a,b) => b[1]-a[1])
            .map(([c, n]) => {
                const emoji = CAT_EMOJI[c] || '🥗';
                const pctCat = total > 0 ? Math.round((n/total)*100) : 0;
                return `<div class="cat-card">
                    <div class="cat-emoji">${emoji}</div>
                    <div class="cat-name">${c}</div>
                    <div class="cat-count">${n}</div>
                    <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pctCat}%"></div></div>
                    <div class="cat-pct">${pctCat}% of stock</div>
                </div>`;
            }).join('');

    } catch (err) {
        document.getElementById('recentGrid').innerHTML = `<div class="loading-state">Error: ${err.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    startClock();
    loadDashboard();
    loadPaymentStats();
    setInterval(loadDashboard, 30000);
    setInterval(loadPaymentStats, 15000);
});
