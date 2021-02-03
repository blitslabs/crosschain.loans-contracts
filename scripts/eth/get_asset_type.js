require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoans.json')).abi

const getAssetType = async (contractAddress) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    return await contract.methods.getAssetType(contractAddress).call()
}

const start = async () => {
    const contractAddress = '0x5565505F5A5A491e0991fafb3926fE4D2593796F'
    const response = await getAssetType(contractAddress)
    console.log(response)
}

start()