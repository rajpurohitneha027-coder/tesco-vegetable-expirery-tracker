require('dotenv').config();
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  contracts_build_directory: './build/contracts',
  networks: {
    development: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*"
    }
  },
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        viaIR: true,
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  }
};
