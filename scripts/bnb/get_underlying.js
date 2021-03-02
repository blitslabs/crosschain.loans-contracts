require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const CERC20_ABI = (require('../../build/contracts/CErc20.json')).abi

const getUnderlyingToken = async (cToken) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(CERC20_ABI, cToken, { from: ETH_PUBLIC_KEY })
    return await contract.methods.underlying().call()
}

const start = async () => {
    const cToken = '0x08e0a5575de71037ae36abfafb516595fe68e5e4'
   
    const response = await getUnderlyingToken(cToken)
    console.log(response)
}

start()