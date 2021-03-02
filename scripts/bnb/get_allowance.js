require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const ERC20_ABI = (require('../../build/contracts/DAI.json')).abi

const getAllowance = async (owner, spender, tokenAddress) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(ERC20_ABI, tokenAddress, { from: ETH_PUBLIC_KEY })
    return await contract.methods.allowance(owner,spender).call()
}

const start = async () => {   
    const owner = '0x26E6e9A3758573a67631633E94cAd7fAe6eC325e'
    const spender = '0x08e0a5575de71037ae36abfafb516595fe68e5e4'
    const tokenAddress = '0x8301f2213c0eed49a7e28ae4c3e91722919b8b47'
    const response = await getAllowance(owner, spender, tokenAddress)
    console.log(response)
}

start()