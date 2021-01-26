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

const lockCollateral = async (
    lender,
    secretHashA1,
    secretHashB1,
    bCoinBorrowerAddress,
    bCoinLoanId,
    loansContractAddress,
    amount
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
        value: BigNumber(amount).multipliedBy('1000000000000000000').toString()
     }

    try {
        const response = await contract.methods.lockCollateral(
            lender,
            secretHashA1,
            secretHashB1,
            bCoinBorrowerAddress,
            bCoinLoanId,
            loansContractAddress
        ).send(options)
        return response
    } catch (e) {
        return { status: 'ERROR', message: e.message }
    }
}

start = async () => {

    const lender = '0x80a355E4E0dA302c2850d6f6fBe1F8c66363a286'
    const secretHashA1 = '0x096c003de78e924c665c1a476a0bcf102d74605a7892216e37a84ccf05dd30e4'
    const secretHashB1 = '0x096c003de78e924c665c1a476a0bcf102d74605a7892216e37a84ccf05dd30e4'
    const bCoinBorrowerAddress = '0x80a355E4E0dA302c2850d6f6fBe1F8c66363a286'
    const bCoinLoanId = '1'
    const loansContractAddress = '0xA92314Dc02992F1f658BB5694656DeD4F07db4Bb'
    const amount = '10'

    const response = await lockCollateral(
        lender,
        secretHashA1,
        secretHashB1,
        bCoinBorrowerAddress,
        bCoinLoanId,
        loansContractAddress,
        amount
    )
    console.log(response)
}

start()