require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const ERC20_ABI = (require('../../build/contracts/DAI.json')).abi
const BigNumber = require('bignumber.js')
const { pad } = require('../utils/utils')

const approveAllowance = async (
    tokenContractAddress,
    spender,
    amount,
    gasLimit,
    gasPrice
) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(ERC20_ABI, tokenContractAddress, { from: ETH_PUBLIC_KEY })

    // Format amount
    const decimals = await contract.methods.decimals().call()
    amount = pad(amount, decimals)

    // Get Tx Nonce
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    // Encode TxData
    txData = await contract.methods.approve(spender, amount).encodeABI()

    //  Encode Gas
    gasLimit = web3.utils.toHex(gasLimit)
    gasPrice = web3.utils.toHex((new BigNumber(gasPrice).multipliedBy(1000000000)).toString())

    // Prepare TxData
    rawTx = {
        from: ETH_PUBLIC_KEY,
        nonce: '0x' + nonce.toString(16),
        gasLimit: gasLimit,
        gasPrice: gasPrice,
        to: tokenContractAddress,
        value: '0x0',
        chainId: ETH_CHAIN_ID,
        data: txData
    }

    // Load Private Key
    const privateKey = new Buffer.from(ETH_PRIVATE_KEY.replace('0x', ''), 'hex')

    tx = new Tx(rawTx, { chain: ETH_CHAIN_NAME })
    tx.sign(privateKey)
    serializedTx = tx.serialize()

    try {
        const response = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        return { status: 'OK', payload: response, message: 'Transaction sent' }
    } catch (e) {
        return { status: 'ERROR', message: e }
    }
}

const start = async () => {

    const tokenContractAddress = '0x8ffDAb0C1e1264983BedB3692D6eE930B2488A68'
    const spender = '0xc4525ae68B8F678e31d091a88D84b87cb41e979A'
    const amount = '10000000000'
    const gasLimit = '50000'
    const gasPrice = '80'

    const response = await approveAllowance(
        tokenContractAddress,
        spender,
        amount,
        gasLimit,
        gasPrice
    )

    console.log(response)
}

start()