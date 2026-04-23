function shortAddr(addr) {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—';
    return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function formatDate(ts) {
    return new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SUPPLIER_NAMES = {
    'Kent Greens Ltd': '🥬',
    'Somerset Farms': '🥕',
    'Yorkshire Veg Co': '🥦',
    'Devon Fresh': '🍅',
    'Tesco UK Farms Ltd': '🛒',
};

function getEmoji(name) {
    for (const [key, emoji] of Object.entries(SUPPLIER_NAMES)) {
        if (name && name.toLowerCase().includes(key.toLowerCase().split(' ')[0].toLowerCase())) return emoji;
    }
    return '🌿';
}

async function loadPayments() {
    try {
        const [productsRes, balanceRes] = await Promise.all([
            fetch('/api/products'),
            fetch('/api/contract/balance')
        ]);
        const products = await productsRes.json();
        const balanceData = await balanceRes.json();

        const paid = products.filter(p => parseFloat(p.paymentSent) > 0);
        const ZERO = '0x0000000000000000000000000000000000000000';

        // Summary stats
        const totalPaid = paid.reduce((sum, p) => sum + parseFloat(p.paymentSent), 0);
        const uniqueSuppliers = new Set(paid.map(p => p.supplierWallet)).size;

        document.getElementById('totalPaidEth').textContent = totalPaid.toFixed(3) + ' ETH';
        document.getElementById('totalSuppliers').textContent = uniqueSuppliers;
        document.getElementById('contractBalance').textContent = parseFloat(balanceData.balance).toFixed(3) + ' ETH';

        // Supplier breakdown
        const bySupplier = {};
        paid.forEach(p => {
            const key = p.supplier || 'Unknown Supplier';
            if (!bySupplier[key]) bySupplier[key] = { name: key, wallet: p.supplierWallet, total: 0, count: 0 };
            bySupplier[key].total += parseFloat(p.paymentSent);
            bySupplier[key].count++;
        });

        const supplierCards = document.getElementById('supplierCards');
        if (Object.keys(bySupplier).length === 0) {
            supplierCards.innerHTML = '<div class="empty-state">No payments yet. Add a product with a supplier wallet to trigger payment.</div>';
        } else {
            supplierCards.innerHTML = Object.values(bySupplier)
                .sort((a, b) => b.total - a.total)
                .map(s => `
                <div class="supplier-card">
                    <div class="sc-emoji">${getEmoji(s.name)}</div>
                    <div class="sc-name">${s.name}</div>
                    <div class="sc-wallet" title="${s.wallet}">${shortAddr(s.wallet)}</div>
                    <div class="sc-amount">${s.total.toFixed(3)} ETH</div>
                    <div class="sc-count">${s.count} payment${s.count !== 1 ? 's' : ''}</div>
                    <div class="sc-badge">✅ Paid</div>
                </div>`).join('');
        }

        // Payment table
        const tbody = document.getElementById('paymentTableBody');
        if (paid.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">No payments yet.</td></tr>';
        } else {
            tbody.innerHTML = paid.slice().reverse().map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><strong>${p.supplier || '—'}</strong></td>
                    <td>
                        <span class="wallet-chip" title="${p.supplierWallet}">${shortAddr(p.supplierWallet)}</span>
                    </td>
                    <td>${p.name}</td>
                    <td><span class="amount-badge">💸 ${parseFloat(p.paymentSent).toFixed(4)} ETH</span></td>
                    <td>${formatDate(p.addedAt)}</td>
                    <td><span class="status-tag status-fresh">Confirmed</span></td>
                </tr>`).join('');
        }

    } catch (err) {
        document.getElementById('paymentTableBody').innerHTML =
            `<tr><td colspan="7" class="loading-cell">Error: ${err.message}</td></tr>`;
    }
}

document.addEventListener('DOMContentLoaded', loadPayments);
