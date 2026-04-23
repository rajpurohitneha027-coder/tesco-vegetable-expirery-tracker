function formatTs(ts) {
    return new Date(ts * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function shortAddr(addr) {
    return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '—';
}

async function loadAlerts() {
    const list = document.getElementById('alertsList');
    list.innerHTML = '<div class="loading-state">Loading alerts from blockchain…</div>';
    try {
        const res = await fetch('/api/alerts');
        if (!res.ok) throw new Error(await res.text());
        const alerts = await res.json();

        if (alerts.length === 0) {
            list.innerHTML = '<div class="loading-state">No alerts on chain.</div>';
            return;
        }

        list.innerHTML = alerts.slice().reverse().map(a => {
            const isRecall = a.alertType === 'RECALLED';
            return `<div class="alert-card ${isRecall ? 'alert-recall' : 'alert-expiry'}">
                <div class="alert-type">${isRecall ? '🚨' : '⚠️'} ${a.alertType.replace('_', ' ')}</div>
                <div class="alert-message">${a.message}</div>
                <div class="alert-meta">
                    Product #${a.productId} &nbsp;·&nbsp;
                    ${formatTs(a.raisedAt)} &nbsp;·&nbsp;
                    <span title="${a.raisedBy}">${shortAddr(a.raisedBy)}</span>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        list.innerHTML = `<div class="loading-state">Error: ${err.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', loadAlerts);
