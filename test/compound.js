const truffleAssert = require('truffle-assertions')
const Web3 = require('web3')
const BigNumber = require('bignumber.js')
const { assert } = require('chai')
const DAI = artifacts.require('./DAI.sol')
let CErc20 = artifacts.require('./CErc20.sol')
const CEther = artifacts.require('./CEther.sol')
const Comptroller = artifacts.require('./Comptroller.sol')

let token, cErc20, cEther, comptroller

contract('Venus', async (accounts) => {
    const owner = accounts[0]

    beforeEach(async () => {
        cErc20 = await CErc20.deployed();
        cEther = await CEther.deployed();
        comptroller = await Comptroller.deployed();

    })

    describe('Deployment', () => {
        it('test', async () => {
            const assetsIn = await comptroller.getAssetsIn.call(accounts[0])
            console.log(assetsIn)
        })
    })
})