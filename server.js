require('dotenv').config();
const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const blockchain = require('./blockchain');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/contract', (req, res) => {
  try {
    const artifactPath = path.join(__dirname, 'build/contracts/TescoExpiryTracker.json');
    if (!fs.existsSync(artifactPath)) return res.status(404).json({ error: 'Contract not deployed yet.' });
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const networkId = Object.keys(artifact.networks).pop();
    res.json({ address: artifact.networks[networkId]?.address, abi: artifact.abi, networkId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products', async (req, res) => {
  try { res.json(await blockchain.getAllProducts()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/expiring', async (req, res) => {
  try { res.json(await blockchain.getExpiringSoon(parseInt(req.query.days) || 3)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/expired', async (req, res) => {
  try { res.json(await blockchain.getExpired()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/alerts', async (req, res) => {
  try { res.json(await blockchain.getAllAlerts()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products/:id/recall', async (req, res) => {
  try { res.json(await blockchain.recallProduct(parseInt(req.params.id), req.body.reason)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', async (req, res) => {
  try { res.json(await blockchain.addProduct(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/contract/balance', async (req, res) => {
  try { res.json(await blockchain.getContractBalance()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/',         (req, res) => res.render('index',    { page: 'dashboard' }));
app.get('/add',      (req, res) => res.render('add',      { page: 'add' }));
app.get('/ledger',   (req, res) => res.render('ledger',   { page: 'ledger' }));
app.get('/alerts',   (req, res) => res.render('alerts',   { page: 'alerts' }));
app.get('/payments', (req, res) => res.render('payments', { page: 'payments' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong: ' + err.message);
});

app.listen(PORT, async () => {
  console.log(`\n🛒 Tesco Vegetable Expiry Tracker`);
  console.log(`🌐 Running at: http://localhost:${PORT}\n`);
  console.log('>> Auto-funding contract for supplier payments…');
  await blockchain.fundContractIfNeeded();
});

module.exports = app;
