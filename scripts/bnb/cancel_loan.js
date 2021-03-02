require('dotenv').config()
const Web3 = require('web3')
const { sign } = require('@warren-bank/ethereumjs-tx-sign')
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoansMoneyMarket.json')).abi
const ERC20_ABI = (require('../../build/contracts/DAI.json')).abi
const { pad } = require('../utils/utils')
const BigNumber = require('bignumber.js')

const cancelLoan = async (
    loanId,
        secretB1,
        gasPrice,
        gasLimit
) => {

    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })

    // Encode Gas
    gasLimit = web3.utils.toHex(gasLimit)
    gasPrice = web3.utils.toHex((new BigNumber(gasPrice).multipliedBy(1000000000)).toString())
    
    // Get Tx Nonce
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    // Encode Tx Data
    txData = await contract.methods.cancelLoanBeforePrincipalWithdraw(
        loanId, secretB1    
    ).encodeABI()

    const rawData = {
        from: ETH_PRIVATE_KEY,
        nonce: '0x' + nonce.toString(16),
        gasPrice,
        gasLimit,
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
    const loanId = '2'
    const secretB1 = '0xcdbeb5a1450d875832f17af228736974883e6cbdb66ac766dc086b2189b8a58f'
    const gasPrice = '10'
    const gasLimit = '3000000'

    const response = await cancelLoan(
        loanId,
        secretB1,
        gasPrice,
        gasLimit
    )

    console.log(response)
}

start()