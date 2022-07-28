var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "good text monkey scrub melt strong robot cloth coin pipe artefact flushnote";

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      // provider: function() {
      //   return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      // },
      network_id: '*',
      gas: 8500000
    }
  },
  compilers: {
    solc: {
      version: "^0.4.25"
    }
  }
};