let allProducts = [];
let currentFilter = 'all';
let recallTargetId = null;

function getStatus(p) {
    if (p.isRecalled) return 'recalled';
    const now = Math.floor(Date.now() / 1000);
    if (p.expiryDate < now) return 'expired';
    if (p.expiryDate < now + 3 * 86400) return 'warning';
    return 'fresh';
}

function timeLeft(expiryDate) {
    const secs = expiryDate - Math.floor(Date.now() / 1000);
    if (secs <= 0) return 'Expired';
    const days = Math.floor(secs / 86400);
    if (days > 0) return `${days}d`;
    const hrs = Math.floor(secs / 3600);
    return `${hrs}h`;
}

function shortAddr(addr) {
    return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '—';
}

function renderTable(products) {
    const tbody = document.getElementById('ledgerBody');
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">No products found.</td></tr>';
        document.getElementById('ledgerCount').textContent = '';
        return;
    }
    tbody.innerHTML = products.map(p => {
        const status = getStatus(p);
        const statusLabel = { fresh: 'Fresh', warning: 'Expiring', expired: 'Expired', recalled: 'Recalled' }[status];
        return `<tr data-status="${status}">
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.sku}</td>
            <td>${p.category}</td>
            <td>${new Date(p.harvestDate * 1000).toLocaleDateString()}</td>
            <td>${new Date(p.expiryDate * 1000).toLocaleDateString()}</td>
            <td>${timeLeft(p.expiryDate)}</td>
            <td><span class="status-tag status-${status}">${statusLabel}</span></td>
            <td title="${p.addedBy}">${shortAddr(p.addedBy)}</td>
            <td>${p.isRecalled ? '—' : `<button class="btn-recall" onclick="openRecallModal(${p.id},'${p.name.replace(/'/g,"\\'")}')">Recall</button>`}</td>
        </tr>`;
    }).join('');
    document.getElementById('ledgerCount').textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
}

async function loadLedger() {
    const tbody = document.getElementById('ledgerBody');
    tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">Loading from blockchain…</td></tr>';
    try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error(await res.text());
        allProducts = await res.json();
        applyFilter(document.querySelector('.filter-btn.active'), currentFilter);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="10" class="loading-cell">Error: ${err.message}</td></tr>`;
    }
}

function applyFilter(btn, filter) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    currentFilter = filter;
    const filtered = filter === 'all' ? allProducts : allProducts.filter(p => getStatus(p) === filter);
    renderTable(filtered);
}

function openRecallModal(id, name) {
    recallTargetId = id;
    document.getElementById('recallProductName').textContent = name;
    document.getElementById('recallReason').value = '';
    document.getElementById('recallModal').classList.remove('hidden');
}

function closeRecallModal() {
    recallTargetId = null;
    document.getElementById('recallModal').classList.add('hidden');
}

async function confirmRecall() {
    const reason = document.getElementById('recallReason').value.trim();
    if (!reason) { alert('Please enter a recall reason.'); return; }

    const confirmBtn = document.querySelector('#recallModal .btn-danger');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Processing…'; }

    try {
        let txHash, via;

        // Try MetaMask first
        try {
            const contract = await getMetaMaskContract();
            if (contract) {
                const tx = await contract.recallProduct(recallTargetId, reason);
                const receipt = await tx.wait();
                txHash = receipt.transactionHash;
                via = 'MetaMask';
            }
        } catch (mmErr) {
            console.warn('MetaMask recall failed, falling back to server wallet:', mmErr.message);
        }

        // Fallback: server wallet
        if (!txHash) {
            const res = await fetch(`/api/products/${recallTargetId}/recall`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Recall failed');
            txHash = data.txHash;
            via = 'Server wallet';
        }

        closeRecallModal();
        alert(`Product recalled successfully!\nSigned by: ${via}\nTx: ${txHash}`);
        loadLedger();
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Recall'; }
    }
}

document.addEventListener('DOMContentLoaded', loadLedger);
