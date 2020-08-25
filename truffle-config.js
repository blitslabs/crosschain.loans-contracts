require('dotenv').config()
// Harmony
const { TruffleProvider } = require('@harmony-js/core')
const PrivateKeyProvider = require("truffle-privatekey-provider");

// Harmony Testnet
const testnet_mnemonic = process.env.TESTNET_MNEMONIC
const testnet_private_key = process.env.TESTNET_PRIVATE_KEY
const testnet_url = process.env.TESTNET_0_URL

const oneGasLimit = process.env.ONE_GAS_LIMIT
const oneGasPrice = process.env.ONE_GAS_PRICE


module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {

    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 7545,            // Standard Ethereum port (default: none)
      network_id: "5777",       // Any network (default: none)
    },
    ropsten: {
      network_id: 3,
      gasPrice: 50000000000,
      provider: new PrivateKeyProvider(process.env.ROPSTEN_ACC_PRIVATE_KEY, process.env.ROPTSTEN_HTTP_PROVIDER)
    }
    // one_test: {
    //   network_id: "2",
    //   provider: () => {
    //     const truffleProvider = new TruffleProvider(
    //       testnet_url,
    //       { memonic: testnet_mnemonic },
    //       { shardID: 0, chainId: 2 },
    //       // { gasLimit: oneGasLimit, gasPrice: oneGasPrice},
    //     );
    //     const newAcc = truffleProvider.addByPrivateKey(testnet_private_key);
    //     truffleProvider.setSigner(newAcc);
    //     return truffleProvider;
    //   },
    // }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.6.2",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      // settings: {          // See the solidity docs for advice about optimization and evmVersion
      //  optimizer: {
      //    enabled: false,
      //    runs: 200
      //  },
      //  evmVersion: "byzantium"
      // }
    },
  },
};
