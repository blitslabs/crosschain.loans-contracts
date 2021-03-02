require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_ABI = (require('../../build/contracts/CrosschainLoansMoneyMarket.json')).abi

const getMoneyMarketDetails = async (tokenAddress) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    return await contract.methods.moneyMarkets(tokenAddress).call()
}

const start = async () => {
    const loanId = '6'
    const tokenAddress = '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47'
    const response = await getMoneyMarketDetails(tokenAddress)
    console.log(response)
}

start()