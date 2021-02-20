require('dotenv').config()
const Web3 = require('web3')
const { Harmony } = require('@harmony-js/core')
const { ChainID, ChainType, hexToNumber } = require('@harmony-js/utils')
const AGGREGATOR_TEST_ABI = (require('../../build/contracts/AggregatorTest.json')).abi
const BigNumber = require('bignumber.js')
const {
    ONE_NETWORK, ONE_HTTP_PROVIDER, ONE_PRIVATE_KEY,
    ONE_AGGREGATOR_CONTRACT, ONE_PUBLIC_KEY,
    ETH_HTTP_PROVIDER, ETH_PUBLIC_KEY
} = process.env

const getLatestAnswer = async (contractAddress) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(ETH_HTTP_PROVIDER))
    const contract = new web3.eth.Contract(AGGREGATOR_TEST_ABI, contractAddress, { from: ETH_PUBLIC_KEY })
    return await contract.methods.latestAnswer().call()
}

start = async () => {    
    const contractAddress = '0x1FB01B595092bb7ddF0F1f9b5581b76EdB42f363'
    const response = await getLatestAnswer(contractAddress)
    console.log(response)
}

start()