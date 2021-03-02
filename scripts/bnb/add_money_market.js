require('dotenv').config()
const Web3 = require('web3')
const { sign } = require('@warren-bank/ethereumjs-tx-sign')

const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoansMoneyMarket.json')).abi

const addMoneyMarket = async (
    tokenAddress,
    marketAddress,
    gasPrice,
    gasLimit
) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    const data = await contract.methods.addMoneyMarket(
        tokenAddress,
        marketAddress
    ).encodeABI()

    const txData = {
        from: ETH_PUBLIC_KEY,
        nonce: '0x' + nonce.toString(16),
        gasPrice: web3.utils.toHex(gasPrice),
        gasLimit: web3.utils.toHex(gasLimit),
        to: ETH_LOANS_CONTRACT,
        value: '0x0',
        chainId: web3.utils.toHex(ETH_CHAIN_ID),
        data: data
    }

    // Build Tx
    const { rawTx } = sign(txData, ETH_PRIVATE_KEY.replace('0x', ''))

    try {
        const response = await web3.eth.sendSignedTransaction('0x' + rawTx.toString('hex'))
        return { status: 'OK', payload: response, message: 'Transaction sent' }
    } catch (e) {
        return { status: 'ERROR', message: e }
    }
}

const start = async () => {
    const tokenAddress = '0x8301f2213c0eed49a7e28ae4c3e91722919b8b47'
    const marketAddress = '0x08e0a5575de71037ae36abfafb516595fe68e5e4'
    const gasPrice = '150000000000'
    const gasLimit = '200000'

    const response = await addMoneyMarket(
        tokenAddress,
        marketAddress,
        gasPrice,
        gasLimit,
    )

    console.log(response)
}

start()