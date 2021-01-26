require('dotenv').config()
const Web3 = require('web3')
const { Harmony } = require('@harmony-js/core')
const { ChainID, ChainType } = require('@harmony-js/utils')
const AGGREGATOR_TEST_ABI = (require('../../build/contracts/AggregatorTest.json')).abi
const BigNumber = require('bignumber.js')
const {
    ONE_NETWORK, ONE_HTTP_PROVIDER, ONE_PRIVATE_KEY,
    ONE_AGGREGATOR_CONTRACT, ONE_PUBLIC_KEY
} = process.env

const updateAgreggatorPrice = async (price) => {
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
        contract = hmy.contracts.createContract(AGGREGATOR_TEST_ABI, ONE_AGGREGATOR_CONTRACT)
    } catch (e) {
        console.log(e)
        return { status: 'ERROR', message: 'Error intantiating contract' }
    }

    // Add Private Key
    try {
        await contract.wallet.addByPrivateKey(ONE_PRIVATE_KEY)
    } catch (e) {
        console.log(e)
        return { status: 'ERROR', message: 'Error improting private key' }
    }

    const options = {
        gasPrice: 1000000000,
        gasLimit: 6721900,
    }

    try {
        const response = await contract.methods.updateAnswer(
            price
        ).send(options)
        return response
    } catch (e) {
        console.log(e)
        return { status: 'ERROR', message: 'message' in e ? e.message : 'Error sending transaction' }
    }
}

start = async () => {
    const newPrice = '727375'
    const response = await updateAgreggatorPrice(newPrice)
    console.log(response)
}

start()