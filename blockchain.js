require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const artifactPath = path.join(__dirname, 'build/contracts/TescoExpiryTracker.json');

function loadArtifact() {
  if (!fs.existsSync(artifactPath)) throw new Error('Contract not deployed yet. Run: truffle migrate');
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

function getProvider() {
  return new ethers.providers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:9545');
}

function getReadContract() {
  const artifact = loadArtifact();
  const networkId = Object.keys(artifact.networks).pop();
  const address = artifact.networks[networkId]?.address;
  if (!address) throw new Error('Contract address not found');
  return new ethers.Contract(address, artifact.abi, getProvider());
}

function getSignerContract() {
  if (!process.env.MNEMONIC) throw new Error('MNEMONIC not set in .env');
  const artifact = loadArtifact();
  const networkId = Object.keys(artifact.networks).pop();
  const address = artifact.networks[networkId]?.address;
  if (!address) throw new Error('Contract address not found');
  const wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC).connect(getProvider());
  return new ethers.Contract(address, artifact.abi, wallet);
}

function getOwnerWallet() {
  return ethers.Wallet.fromMnemonic(process.env.MNEMONIC).connect(getProvider());
}

function formatProduct(p) {
  return {
    id: p.id.toNumber(),
    name: p.productName,
    sku: p.sku,
    batchNumber: p.batchNumber,
    category: p.category,
    supplier: p.supplier,
    supplierWallet: p.supplierWallet,
    harvestDate: p.harvestDate.toNumber(),
    packagingDate: p.packagingDate.toNumber(),
    expiryDate: p.expiryDate.toNumber(),
    addedAt: p.addedAt.toNumber(),
    addedBy: p.addedBy,
    isRecalled: p.isRecalled,
    recallReason: p.recallReason,
    paymentSent: ethers.utils.formatEther(p.paymentSent),
  };
}

function formatAlert(a) {
  return {
    productId: a.productId.toNumber(),
    alertType: a.alertType,
    message: a.message,
    raisedAt: a.raisedAt.toNumber(),
    raisedBy: a.raisedBy,
  };
}

async function getAllProducts() {
  const contract = getReadContract();
  const total = (await contract.totalProducts()).toNumber();
  if (total === 0) return [];
  const raw = await contract.getProducts(0, total);
  return raw.map(formatProduct);
}

async function getExpiringSoon(withinDays = 3) {
  const contract = getReadContract();
  const raw = await contract.getProductsExpiringSoon(withinDays * 86400);
  return raw.map(formatProduct);
}

async function getExpired() {
  const contract = getReadContract();
  const raw = await contract.getExpiredProducts();
  return raw.map(formatProduct);
}

async function getAllAlerts() {
  const contract = getReadContract();
  const total = (await contract.totalAlerts()).toNumber();
  const alerts = [];
  for (let i = 0; i < total; i++) alerts.push(formatAlert(await contract.getAlert(i)));
  return alerts;
}

async function recallProduct(id, reason) {
  const contract = getSignerContract();
  const tx = await contract.recallProduct(id, reason);
  const receipt = await tx.wait();
  return { txHash: receipt.transactionHash };
}

async function addProduct(productData) {
  const contract = getSignerContract();
  const { name, sku, batchNumber, category, supplier, supplierWallet, harvestDate, packagingDate, expiryDate } = productData;
  const wallet = supplierWallet && supplierWallet.startsWith('0x') ? supplierWallet : ethers.constants.AddressZero;
  const tx = await contract.addProduct(name, sku, batchNumber, category, supplier, wallet, harvestDate, packagingDate, expiryDate);
  const receipt = await tx.wait();
  const event = receipt.events?.find(e => e.event === 'ProductAdded');
  const paid = receipt.events?.find(e => e.event === 'SupplierPaid');
  return {
    txHash: receipt.transactionHash,
    productId: event?.args?.id?.toNumber(),
    paymentSent: paid ? ethers.utils.formatEther(paid.args.amount) : '0',
  };
}

async function getContractBalance() {
  const contract = getReadContract();
  const balance = await getProvider().getBalance(contract.address);
  const totalPaid = await contract.totalPaidToSuppliers();
  const perBatch = await contract.paymentPerBatch();
  return {
    balance: ethers.utils.formatEther(balance),
    totalPaid: ethers.utils.formatEther(totalPaid),
    paymentPerBatch: ethers.utils.formatEther(perBatch),
    address: contract.address,
  };
}

async function fundContractIfNeeded() {
  try {
    const contract = getReadContract();
    const balance = await getProvider().getBalance(contract.address);
    if (balance.lt(ethers.utils.parseEther('1'))) {
      const signerContract = getSignerContract();
      const tx = await signerContract.fundContract({ value: ethers.utils.parseEther('5') });
      await tx.wait();
      console.log('   Contract funded with 5 ETH for supplier payments');
    } else {
      console.log('   Contract balance OK:', ethers.utils.formatEther(balance), 'ETH');
    }
  } catch (err) {
    console.warn('   Contract funding skipped:', err.message);
  }
}

module.exports = { getAllProducts, getExpiringSoon, getExpired, getAllAlerts, addProduct, recallProduct, getContractBalance, fundContractIfNeeded };
