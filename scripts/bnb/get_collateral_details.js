require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const COLLATERAL_LOCK_ABI = (require('../../build/contracts/CollateralLockV2.json')).abi

const fetchCollateralDetails = async (loanId, contractAddress) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(COLLATERAL_LOCK_ABI, contractAddress, { from: ETH_PUBLIC_KEY })
    return await contract.methods.fetchLoan(loanId).call()
}

const start = async () => {
    const loanId = '6'
    const contractAddress = '0x50686b463B72243072c0d0DF3df1a89bcf3880eb'
    const response = await fetchCollateralDetails(loanId, contractAddress)
    console.log(response)
}

start()