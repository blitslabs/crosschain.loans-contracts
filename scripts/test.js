const ethers = require('ethers')
const mnemonic = 'nest gallery bubble wedding then earth spring health shallow prefer whale isolate'
const ownerWallet = ethers.Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0")
console.log(ownerWallet.address)
// console.log(ethers.Wallet.createRandom().mnemonic)