// MetaMask / wallet utilities — shared across all pages

const GANACHE_CHAIN_ID = '0x539'; // 1337 — Ganache default
const GANACHE_RPC      = 'http://127.0.0.1:9545';

let _account = null;
let _contractMeta = null;

async function _loadMeta() {
  if (!_contractMeta) {
    const r = await fetch('/api/contract');
    _contractMeta = await r.json();
  }
  return _contractMeta;
}

// Returns ethers.Contract signed by the MetaMask account, or null if unavailable
async function getMetaMaskContract() {
  if (!window.ethereum || !_account) return null;
  const meta = await _loadMeta();
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  return new ethers.Contract(meta.address, meta.abi, signer);
}

async function getAccount() {
  if (!window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts[0] || null;
}

async function connectWallet() {
  if (!window.ethereum) {
    alert(
      'MetaMask not detected.\n\n' +
      '1. Install MetaMask from https://metamask.io\n' +
      '2. Add Ganache network: RPC http://127.0.0.1:9545 · Chain ID 1337\n' +
      '3. Import account using the mnemonic in .env'
    );
    return null;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    _account = accounts[0];
    await _switchToGanache();
    _renderWallet(_account);
    return _account;
  } catch (err) {
    console.error('MetaMask connection rejected:', err);
    return null;
  }
}

async function _switchToGanache() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: GANACHE_CHAIN_ID }]
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: GANACHE_CHAIN_ID,
          chainName: 'Ganache LocalNet',
          rpcUrls: [GANACHE_RPC],
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 }
        }]
      });
    }
  }
}

function _short(addr) {
  return addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '—';
}

function _renderWallet(account) {
  const el = document.getElementById('navWallet');
  if (!el) return;
  if (account) {
    el.innerHTML =
      `<span class="chain-badge chain-ok">MetaMask ✓</span>` +
      `<span class="wallet-addr" title="${account}">${_short(account)}</span>`;
  } else {
    el.innerHTML =
      `<button class="btn-connect" onclick="connectWallet()">🦊 Connect MetaMask</button>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.ethereum) {
    _renderWallet(null);
    return;
  }
  _account = await getAccount();
  _renderWallet(_account);

  window.ethereum.on('accountsChanged', (accs) => {
    _account = accs[0] || null;
    _renderWallet(_account);
  });

  window.ethereum.on('chainChanged', () => location.reload());
});
