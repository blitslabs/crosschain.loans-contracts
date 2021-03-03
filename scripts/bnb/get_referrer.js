require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoansMoneyMarket.json')).abi

const getReferrer = async (account) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    return await contract.methods.getReferrer(account).call()
}

const start = async () => {
    const account = '0x8b9Ca4553612F7038434A322d7B169E7309A88f2'
    const response = await getReferrer(account)
    console.log(response)
}

start()