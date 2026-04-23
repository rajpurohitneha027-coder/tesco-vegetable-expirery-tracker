#!/bin/bash

echo "======================================"
echo "  Tesco Vegetable Expiry Tracker"
echo "======================================"

# Kill anything already running
echo ">> Clearing ports..."
lsof -ti:9545 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 1

# Start Ganache
echo ">> Starting Ganache blockchain..."
ganache --port 9545 --mnemonic "post exhaust walk odor sock push bundle movie very brisk mango moon" > /tmp/ganache.log 2>&1 &
sleep 5

# Check Ganache
curl -s -X POST http://127.0.0.1:9545 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "   Ganache running on port 9545"
else
  echo "   ERROR: Ganache failed to start"
  exit 1
fi

# Deploy contract
echo ">> Deploying smart contract..."
truffle migrate --reset > /tmp/truffle.log 2>&1
if [ $? -eq 0 ]; then
  echo "   Contract deployed successfully"
else
  echo "   ERROR: Contract deployment failed"
  cat /tmp/truffle.log
  exit 1
fi

# Start server
echo ">> Starting web server..."
npm start
