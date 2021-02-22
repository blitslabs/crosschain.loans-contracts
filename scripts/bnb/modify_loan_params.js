require('dotenv').config()
const Web3 = require('web3')
const { sign } = require('@warren-bank/ethereumjs-tx-sign')
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoans.json')).abi

const modifyAssetTypeLoanParameters = async (    
    parameter,
    data,
    gasPrice,
        gasLimit
) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    const txData = await contract.methods.modifyLoanParameters(        
        web3.utils.fromAscii(parameter),
        data
    ).encodeABI()

    const tx_data = {
        from: ETH_PUBLIC_KEY,
        nonce: '0x' + nonce.toString(16),
        gasPrice: '0x003B9ACA00',
        gasLimit: '0x170D62',
        to: ETH_LOANS_CONTRACT,
        value: '0x0',
        chainId: web3.utils.toHex(ETH_CHAIN_ID),
        data: txData,
        gasPrice: web3.utils.toHex(gasPrice),
        gasLimit: web3.utils.toHex(gasLimit),
    }

    // Build Tx
    const { rawTx } = sign(tx_data, ETH_PRIVATE_KEY.replace('0x', ''))

    try {
        const response = await web3.eth.sendSignedTransaction('0x' + rawTx.toString('hex'))
        return { status: 'OK', payload: response, message: 'Transaction sent' }
    } catch (e) {
        return { status: 'ERROR', message: e }
    }
}

const start = async () => {
    const contractAddress = '0x8ddb301A516f5CEd0167e18092B7b85bA96B1283'
    const parameter = 'loanExpirationPeriod'
    const data = '2592000'
    const gasPrice = '150000000000'
    const gasLimit = '200000'

    const response = await modifyAssetTypeLoanParameters(        
        parameter,
        data,
        gasPrice,
        gasLimit
    )

    console.log(response)
}

start()