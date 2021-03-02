require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_ABI = (require('../../build/contracts/CrosschainLoansMoneyMarket.json')).abi

const getAssetType = async (tokenAddress) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    return await contract.methods.assetTypes(tokenAddress).call()
}

const start = async () => {   
    const tokenAddress = '0x8ddb301a516f5ced0167e18092b7b85ba96b1283'
    const response = await getAssetType(tokenAddress)
    console.log(response)
}

start()