require('dotenv').config()
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-web3");
const HDWalletProvider = require("@truffle/hdwallet-provider")
// require("hardhat-gas-reporter");

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  // gasReporter: {
  //   currency: 'USD',
  //   gasPrice: 21
  // },
  networks: {
    binance_main: {
      url: 'https://dataseed1.binance.org/',
      chainId: 56,
      accounts: [`0x${process.env.ETH_PRIVATE_KEY}`]
    },  
    binance_test: {
      url: 'https://data-seed-prebsc-1-s2.binance.org:8545/',
      chainId: 97,
      accounts: [`0x${process.env.ETH_PRIVATE_KEY}`]
    },    
    harmony_main: {
      url: 'https://api.s0.t.hmny.io',
      chainId: 1666600000,
      accounts: [`0x${process.env.ETH_PRIVATE_KEY}`]
    },
    harmony_test: {
      url: 'https://api.s0.b.hmny.io',
      chainId: 1666700000,
      accounts: [`0x${process.env.ETH_PRIVATE_KEY}`]
    },
  },
  solidity: {
    version: "0.5.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};