require('dotenv').config()
const Web3 = require('web3')
const { sign } = require('@warren-bank/ethereumjs-tx-sign')
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_ABI = (require('../../build/contracts/CrosschainLoansMoneyMarket.json')).abi
const BigNumber = require('bignumber.js')
const { pad } = require('../utils/utils')

const toggleMoneyMarket = async (
    tokenContractAddress,
    status,
    gasLimit,
    gasPrice
) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
  
    // Get Tx Nonce
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    // Encode TxData
    txData = await contract.methods.toggleMoneyMarket(tokenContractAddress, status).encodeABI()

    //  Encode Gas
    // gasLimit = web3.utils.toHex(gasLimit)
    // gasPrice = web3.utils.toHex((new BigNumber(gasPrice).multipliedBy(1000000000)).toString())

    // Prepare TxData
    rawData = {
        from: ETH_PUBLIC_KEY,
        nonce: '0x' + nonce.toString(16),
        gasPrice: web3.utils.toHex(gasPrice),
        gasLimit: web3.utils.toHex(gasLimit),
        to: ETH_LOANS_CONTRACT,
        value: '0x0',
        chainId: web3.utils.toHex(ETH_CHAIN_ID),
        data: txData
    }

    const { rawTx } = sign(rawData, ETH_PRIVATE_KEY.replace('0x', ''))

    try {
        const response = await web3.eth.sendSignedTransaction('0x' + rawTx.toString('hex'))
        return { status: 'OK', payload: response, message: 'Transaction sent' }
    } catch (e) {
        return { status: 'ERROR', message: e }
    }
}

const start = async () => {

    const tokenContractAddress = '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47'
    const status = true
    const gasPrice = '150000000000'
    const gasLimit = '200000'

    const response = await toggleMoneyMarket(
        tokenContractAddress,
        status,
        gasLimit,
        gasPrice
    )

    console.log(response)
}

start()