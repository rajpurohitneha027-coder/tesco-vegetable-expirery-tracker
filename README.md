# Tesco Vegetable Expiry Tracker

A blockchain-enabled DApp for tracking vegetable expiry, supplier payments, and stock alerts on a local Ganache network.

## What this project does
- Records vegetable products with harvest, packaging, and expiry dates
- Saves product history on a smart contract deployed to Ganache LocalNet
- Displays fresh, expiring, expired, and recalled stock in the dashboard
- Includes supplier payment tracking via the smart contract

## How to run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Ganache locally on port `9545`:
   ```bash
   npx ganache --host 127.0.0.1 --port 9545 --wallet.mnemonic "post exhaust walk odor sock push bundle movie very brisk mango moon"
   ```
3. Deploy the contracts to the local network:
   ```bash
   npx truffle migrate --reset --network development
   ```
4. Start the application server:
   ```bash
   npm start
   ```
5. Open the app in your browser:
   ```
   http://localhost:3000
   ```

## Repository link
This repo is hosted at:

https://github.com/rajpurohitneha027-coder/tesco-vegetable-expirery-tracker

## Notes
- Backend blockchain RPC is configured at `http://127.0.0.1:9545`
- MetaMask or another wallet should connect to Ganache LocalNet
- Contract artifacts are loaded from `build/contracts/TescoExpiryTracker.json`

## Key files
- `server.js` — Express server and HTTP API
- `blockchain.js` — Blockchain provider, contract helpers, and contract interactions
- `truffle-config.js` — Truffle network and compiler configuration
- `views/` — EJS frontend templates
- `public/js/` — Frontend JavaScript code
- `contracts/` — Solidity smart contracts
- `migrations/` — Truffle deployment scripts

## About
This project is a local DApp demo for tracking vegetable expiry and supplier payments using a blockchain-powered backend.