document.addEventListener('DOMContentLoaded', () => {
    const btnSubmit = document.getElementById('btnSubmit');
    const form = document.getElementById('addProductForm');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnSubmit.innerText = 'Processing…';
        btnSubmit.disabled = true;

        try {
            const name          = document.getElementById('productName').value
                                || document.getElementById('productSelect').value.split('|')[0];
            const sku           = document.getElementById('sku').value;
            const category      = document.getElementById('category').value;
            const supplier      = document.getElementById('supplier').value;
            const supplierWallet = document.getElementById('supplierWallet').value.trim();
            const batchNumber   = document.getElementById('batchNumber').value || 'BATCH-N/A';
            const harvestDate   = Math.floor(new Date(document.getElementById('harvestDate').value).getTime()   / 1000);
            const packagingDate = Math.floor(new Date(document.getElementById('packagingDate').value).getTime() / 1000);
            const expiryDate    = Math.floor(new Date(document.getElementById('expiryDate').value).getTime()    / 1000);

            const ZERO = '0x0000000000000000000000000000000000000000';
            const walletAddr = (supplierWallet && supplierWallet.startsWith('0x') && supplierWallet.length === 42)
                ? supplierWallet : ZERO;

            let result;

            // Try MetaMask first
            try {
                const contract = await getMetaMaskContract();
                if (contract) {
                    const tx = await contract.addProduct(
                        name, sku, batchNumber, category, supplier,
                        walletAddr, harvestDate, packagingDate, expiryDate
                    );
                    const receipt = await tx.wait();
                    const ev = receipt.events?.find(e => e.event === 'ProductAdded');
                    const paid = receipt.events?.find(e => e.event === 'SupplierPaid');
                    result = {
                        txHash: receipt.transactionHash,
                        productId: ev?.args?.id?.toNumber(),
                        paymentSent: paid ? parseFloat(ethers.utils.formatEther(paid.args.amount)).toFixed(4) : '0',
                        via: 'MetaMask'
                    };
                }
            } catch (mmErr) {
                console.warn('MetaMask failed, falling back to server wallet:', mmErr.message);
            }

            // Fallback: server wallet
            if (!result) {
                const res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, sku, batchNumber, category, supplier, supplierWallet: walletAddr, harvestDate, packagingDate, expiryDate })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to add product');
                result = { ...data, via: 'Server wallet' };
            }

            const paymentMsg = parseFloat(result.paymentSent) > 0
                ? `\n💰 Supplier paid: ${result.paymentSent} ETH`
                : '\n💰 No supplier wallet — payment skipped';

            alert(
                `✅ Product #${result.productId} recorded on blockchain!\n` +
                `Signed by: ${result.via}\n` +
                `Tx: ${result.txHash}` +
                paymentMsg
            );
            window.location.href = '/';

        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
            btnSubmit.disabled = false;
            btnSubmit.innerText = '🔗 Add Product to Blockchain';
        }
    });
});

function onProductSelect(select) {
    const customGroup = document.getElementById('customNameGroup');
    if (select.value === 'custom||') {
        customGroup.classList.remove('hidden');
    } else if (select.value !== '') {
        customGroup.classList.add('hidden');
        const [name, sku, cat] = select.value.split('|');
        document.getElementById('sku').value = sku;
        document.getElementById('category').value = cat;
        document.getElementById('productName').value = name;
    }
}
