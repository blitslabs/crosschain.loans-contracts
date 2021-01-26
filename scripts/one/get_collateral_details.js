require('dotenv').config()
const { Harmony } = require('@harmony-js/core')
const { ChainID, ChainType, hexToNumber } = require('@harmony-js/utils')
const COLLATERAL_LOCK_ABI = (require('../../build/contracts/CollateralLockV2.json')).abi
const { pad } = require('../utils/utils')
const BigNumber = require('bignumber.js')
const Web = require('web3')
const {
    ONE_NETWORK, ONE_HTTP_PROVIDER, ONE_PRIVATE_KEY,
    ONE_COLLATERAL_LOCK_CONTRACT,
} = process.env

const getCollateralDetails = async (
    loanId
) => {

    // Connect to HTTP Provider
    let hmy
    try {
        hmy = new Harmony(ONE_HTTP_PROVIDER, { chainType: ChainType.Harmony, chainId: ONE_NETWORK === 'mainnet' ? ChainID.HmyMainnet : ChainID.HmyTestnet })
    } catch (e) {
        console.log(e)
        sendJSONresponse(res, 422, { status: 'ERROR', message: 'Error connecting to Harmony HTTP Provider' })
        return
    }

    // Instantiate Collateral Lock contract
    let contract
    try {
        contract = hmy.contracts.createContract(COLLATERAL_LOCK_ABI, ONE_COLLATERAL_LOCK_CONTRACT)
    } catch (e) {
        console.log(e)
        sendJSONresponse(res, 422, { status: 'ERROR', message: 'An error occurred, please try again' })
        return
    }

    // Add Private Key
    try {
        contract.wallet.addByPrivateKey(ONE_PRIVATE_KEY)
    } catch (e) {
        return { status: 'ERROR', message: 'Error importing private key' }
    }

    const options = { 
        gasPrice: 1000000000, 
        gasLimit: 6721900, 
     }

    try {
        const response = await contract.methods.fetchLoan(loanId).call()
        return response
    } catch (e) {
        return { status: 'ERROR', message: e.message }
    }
}

start = async () => {
    const loanId = '1'
    const response = await getCollateralDetails(loanId)
    console.log(response)
}

start()