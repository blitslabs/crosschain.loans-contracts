require('dotenv').config()
const Web3 = require('web3')
const Tx = require('ethereumjs-tx').Transaction
const {
    ETH_HTTP_PROVIDER, ETH_CHAIN_ID,
    ETH_CHAIN_NAME, ETH_PUBLIC_KEY,
    ETH_PRIVATE_KEY, ETH_LOANS_CONTRACT,
} = process.env
const LOANS_CONTRACT_ABI = (require('../../build/contracts/CrosschainLoans.json')).abi
const ERC20_ABI = (require('../../build/contracts/DAI.json')).abi
const { pad } = require('../utils/utils')
const BigNumber = require('bignumber.js')

const createLoan = async (
    lenderAuto,
    secretHashB1,
    secretHashAutoB1,
    principal,
    tokenContractAddress,
    aCoinLenderAddress,
    gasPrice,
    gasLimit
) => {
   
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(LOANS_CONTRACT_ABI, ETH_LOANS_CONTRACT, { from: ETH_PUBLIC_KEY })
    const token = new web3.eth.Contract(ERC20_ABI, tokenContractAddress, { from: ETH_PUBLIC_KEY })
    
    const decimals = await token.methods.decimals().call()    
    let allowance = await token.methods.allowance(ETH_PUBLIC_KEY, ETH_LOANS_CONTRACT).call()
    allowance = parseFloat(BigNumber(allowance).div(pad(1, decimals)))

    // Encode Gas
    gasLimit = web3.utils.toHex(gasLimit)
    gasPrice = web3.utils.toHex((new BigNumber(gasPrice).multipliedBy(1000000000)).toString())

    if (allowance < parseFloat(principal)) {
        return { status: 'ERROR', message: 'Insufficient allowance', payload: allowance }
    }

    // Format amount
    principal = pad(principal, decimals)

    // Get Tx Nonce
    const nonce = await web3.eth.getTransactionCount(ETH_PUBLIC_KEY)

    // Encode Tx Data
    txData = await contract.methods.createLoan(
        lenderAuto, secretHashB1, secretHashAutoB1,
        principal, tokenContractAddress, aCoinLenderAddress
    ).encodeABI()

    const rawTx = {
        from: ETH_PRIVATE_KEY,
        nonce: '0x' + nonce.toString(16),
        gasLimit: gasLimit,
        gasPrice: gasPrice,
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
    const lenderAuto = '0x80a355E4E0dA302c2850d6f6fBe1F8c66363a286'
    const secretHashB1 = '0xf8232c8d6108b20a2a0e8b0b66dbb70d2fd5203012f17567583a9a6cd3a6c702'
    const secretHashAutoB1 = '0xf8232c8d6108b20a2a0e8b0b66dbb70d2fd5203012f17567583a9a6cd3a6c702'
    const principal = '101'
    const tokenContractAddress = '0x8ffDAb0C1e1264983BedB3692D6eE930B2488A68'
    const aCoinLenderAddress = '0x80a355E4E0dA302c2850d6f6fBe1F8c66363a286'
    const gasPrice = '100'
    const gasLimit = '3000000'

    const response = await createLoan(
        lenderAuto,
        secretHashB1,
        secretHashAutoB1,
        principal,
        tokenContractAddress,
        aCoinLenderAddress,
        gasPrice,
        gasLimit
    )

    console.log(response)
}

start()