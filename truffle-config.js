require('dotenv').config()
const { TruffleProvider } = require('@harmony-js/core')
const HDWalletProvider = require("@truffle/hdwallet-provider")
const eth_provider = process.env.ETH_HTTP_PROVIDER
const eth_private_key = process.env.ETH_PRIVATE_KEY

const harmony_provider = process.env.ONE_HTTP_PROVIDER
const harmony_private_key = process.env.ONE_PRIVATE_KEY
const harmony_mnemonic = process.env.ONE_MNEMONIC

const binance_provider = process.env.BINANCE_HTTP_PROVIDER

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
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    development: {
      networkCheckTimeout: 10000,
      host: "127.0.0.1",     // Localhost (default: none)
      port: 7545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },
    eth_mainnet: {
      network_id: 1,
      // gas: 7897368,
      gasLimit: 350000,
      gasPrice: 80000000000,
      provider: new HDWalletProvider(eth_private_key, eth_provider)
    },
    ropsten: {
      network_id: 3,
      gas: 6500000,
      gasPrice: 109000000000,
      confirmations: 0,
      timeoutBlocks: 200,
      skipDryRun: false,
      provider: new HDWalletProvider(eth_private_key, eth_provider)
    },
    rinkeby: {
      network_id: 4,
      gas: 7897368,
      provider: new HDWalletProvider(eth_private_key, eth_provider)
    },
    binance: {
      network_id: 56,
      provider: new HDWalletProvider(eth_private_key, binance_provider)
    },
    binance_test: {
      network_id: 97,
      provider: new HDWalletProvider(eth_private_key, binance_provider)
    },
    one: {
      network_id: "1",
      timeoutBlocks: 50000,
      provider: () => {
        const truffleProvider = new TruffleProvider(
          harmony_provider,
          { memonic: harmony_mnemonic },
          { shardID: 0, chainId: 1 },
          // { gasLimit: oneGasLimit, gasPrice: oneGasPrice},
        );
        const newAcc = truffleProvider.addByPrivateKey(harmony_private_key);
        truffleProvider.setSigner(newAcc);
        return truffleProvider;
      },
    },
    one_test: {
      network_id: "2",
      timeoutBlocks: 50000,
      provider: () => {
        const truffleProvider = new TruffleProvider(
          harmony_provider,
          { memonic: harmony_mnemonic },
          { shardID: 0, chainId: 2 },
          // { gasLimit: oneGasLimit, gasPrice: oneGasPrice},
        );
        const newAcc = truffleProvider.addByPrivateKey(harmony_private_key);
        truffleProvider.setSigner(newAcc);
        return truffleProvider;
      },
    }
    // Another network with more advanced options...
    // advanced: {
    // port: 8777,             // Custom port
    // network_id: 1342,       // Custom network
    // gas: 8500000,           // Gas sent with each transaction (default: ~6700000)
    // gasPrice: 20000000000,  // 20 gwei (in wei) (default: 100 gwei)
    // from: <address>,        // Account to send txs from (default: accounts[0])
    // websockets: true        // Enable EventEmitter interface for web3 (default: false)
    // },
    // Useful for deploying to a public network.
    // NB: It's important to wrap the provider as a function.
    // ropsten: {
    // provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/YOUR-PROJECT-ID`),
    // network_id: 3,       // Ropsten's id
    // gas: 5500000,        // Ropsten has a lower block limit than mainnet
    // confirmations: 2,    // # of confs to wait between deployments. (default: 0)
    // timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
    // skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    // },
    // Useful for private networks
    // private: {
    // provider: () => new HDWalletProvider(mnemonic, `https://network.io`),
    // network_id: 2111,   // This network is yours, in the cloud.
    // production: true    // Treats this network as if it was a public net. (default: false)
    // }
  },

  plugins: ["truffle-contract-size"],

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.16",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
        //  evmVersion: "byzantium"
      }
    },
  },
};
