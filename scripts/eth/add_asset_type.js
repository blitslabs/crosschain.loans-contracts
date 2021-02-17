require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoans.json')).abi

const addAssetType = async (
    contractAddress,
    maxLoanAmount, minLoanAmount,
    baseRatePerYear,
    multiplierPerYear,
    gasPrice,
    gasLimit
) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    const data = await contract.methods.addAssetType(
        contractAddress,
        maxLoanAmount,
        minLoanAmount,
        baseRatePerYear,
        multiplierPerYear,        
    ).encodeABI()

    const rawTx = {
        from: ETH_PUBLIC_KEY,
        nonce: '0x' + nonce.toString(16),
        gasPrice: web3.utils.toHex(gasPrice),
        gasLimit: web3.utils.toHex(gasLimit),
        to: ETH_LOANS_CONTRACT,
        value: '0x0',
        chainId: ETH_CHAIN_ID,
        data: data
    }

    const tx = new Tx(rawTx, { chain: ETH_CHAIN_NAME })
    const privateKey = new Buffer.from(ETH_PRIVATE_KEY, 'hex')
    tx.sign(privateKey)
    const serializedTx = tx.serialize()

    try {
        const response = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        return { status: 'OK', payload: response, message: 'Transaction sent' }
    } catch (e) {
        return { status: 'ERROR', message: e }
    }
}

const start = async () => {
    const contractAddress = '0x6b175474e89094c44da98b954eedeac495271d0f'
    const maxLoanAmount = '20000000000000000000000' // 10000
    const minLoanAmount = '20000000000000000000' // 20
    const baseRatePerYear = '55000000000000000' // 0.055
    const multiplierPerYear = '1000000000000000000' // 1.1
    const gasPrice = '150000000000'
    const gasLimit = '200000'

    const response = await addAssetType(
        contractAddress,
        maxLoanAmount,
        minLoanAmount,
        baseRatePerYear,
        multiplierPerYear,
        gasPrice,
        gasLimit,
    )

    console.log(response)
}

start()