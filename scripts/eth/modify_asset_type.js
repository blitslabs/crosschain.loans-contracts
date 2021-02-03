require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoans.json')).abi

const modifyAssetTypeLoanParameters = async (
    contractAddress,
    parameter,
    data
) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    const txData = await contract.methods.modifyAssetTypeLoanParameters(
        contractAddress,
        web3.utils.fromAscii(parameter),
        data
    ).encodeABI()

    const rawTx = {
        from: ETH_PUBLIC_KEY,
        nonce: '0x' + nonce.toString(16),
        gasPrice: '0x003B9ACA00',
        gasLimit: '0x170D62',
        to: ETH_LOANS_CONTRACT,
        value: '0x0',
        chainId: ETH_CHAIN_ID,
        data: txData
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
    const contractAddress = '0x5565505F5A5A491e0991fafb3926fE4D2593796F'
    const parameter = 'minLoanAmount'
    const data = '1000000000000000000'

    const response = await modifyAssetTypeLoanParameters(
        contractAddress,
        parameter,
        data
    )

    console.log(response)
}

start()