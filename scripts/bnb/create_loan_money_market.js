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

const createLoanMoneyMarket = async (
    secretHashB1,
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
        secretHashB1,
        principal,
        tokenContractAddress,
        aCoinLenderAddress,       
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
    const secretHashB1 = '0x2d44efc45da1e6be2b7529830a977854d1ab012037246cec12baf376d1022c24'
    const secretB1 = '0xcdbeb5a1450d875832f17af228736974883e6cbdb66ac766dc086b2189b8a58f'
    const principal = '100'
    const tokenContractAddress = '0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47'
    const aCoinLenderAddress = '0x80a355E4E0dA302c2850d6f6fBe1F8c66363a286'
    const gasPrice = '10'
    const gasLimit = '3000000'

    const response = await createLoanMoneyMarket(
        secretHashB1,
        principal,
        tokenContractAddress,
        aCoinLenderAddress,
        gasPrice,
        gasLimit
    )

    console.log(response)
}

start()