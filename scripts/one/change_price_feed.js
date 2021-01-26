require('dotenv').config()
const Web3 = require('web3')
const { Harmony } = require('@harmony-js/core')
const { ChainID, ChainType } = require('@harmony-js/utils')
const COLLATERAL_LOCK_ABI = (require('../../build/contracts/CollateralLockV2.json')).abi
const BigNumber = require('bignumber.js')
const {
    ONE_NETWORK, ONE_HTTP_PROVIDER, ONE_PRIVATE_KEY,
    ONE_COLLATERAL_LOCK_CONTRACT, ONE_PUBLIC_KEY
} = process.env

const modifyPriceFeed = async (params, data) => {
    // Connect HTTP Provider
    let hmy
    try {
        hmy = new Harmony(ONE_HTTP_PROVIDER, { chainType: ChainType.Harmony, chainId: ONE_NETWORK === 'mainnet' ? ChainID.HmyMainnet : ChainID.HmyTestnet })
    } catch (e) {
        console.log(e)
        return { status: 'ERROR', message: 'Error connecting to Harmony HTTP Provider' }
    }

    // Instantiate Collateral Lock contract
    let contract
    try {
        contract = hmy.contracts.createContract(COLLATERAL_LOCK_ABI, ONE_COLLATERAL_LOCK_CONTRACT)
    } catch (e) {
        console.log(e)
        return { status: 'ERROR', message: 'Error intantiating contract' }
    }

    // Add Private Key
    try {
        contract.wallet.addByPrivateKey(ONE_PRIVATE_KEY)
    } catch (e) {
        return { status: 'ERROR', message: 'Error improting private key' }
    }
    
    const options = {
        gasPrice: 1000000000,
        gasLimit: 6721900,
    }

    const web3 = new Web3()
    params = web3.utils.fromAscii(params)

    try {
        const response = await contract.methods.modifyLoanParameters(
            params, data
        ).send(options)
        return response
    } catch (e) {
        console.log(e)
        return { status: 'ERROR', message: 'message' in e ? e.message : 'Error sending transaction' }
    }
}

start = async () => {
    const params = 'priceFeed'
    const data = '0x1bd58a5eCe4a00dB76395Fc11377ECFa8e4B0082'
    const response = await modifyPriceFeed(params, data)
    console.log(response)
}

start()