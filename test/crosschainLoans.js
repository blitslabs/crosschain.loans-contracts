const { time, shouldFail, balance } = require('openzeppelin-test-helpers')
const truffleAssert = require('truffle-assertions')
const { soliditySha3 } = require("web3-utils")
const Web3 = require('web3')
const { assert } = require('chai')

const DAI = artifacts.require('./DAI.sol')
const CrosschainLoans = artifacts.require('./CrosschainLoans.sol')

let token, crosschainLoans, token_2

contract('CrosschainLoans', async (accounts) => {
    const owner = accounts[0]
    const owner_2 = accounts[4]
    const lender = accounts[1]
    const lenderAuto = accounts[2]
    const borrower = accounts[3]

    // Balances
    const lenderInitialBalance = '1000000000000000000000'

    // AssetType Settings
    const minLoanAmount = '100000000000000000000'
    const maxLoanAmount = '1000000000000000000000'
    const baseRatePerYear = '55000000000000000' // 0.05
    const multiplierPerYear = '1000000000000000000' // 1.2


    beforeEach(async () => {

        // Deploy Token
        token = await DAI.new({ from: owner })

        // Deploy Second Token
        token_2 = await DAI.new({ from: owner })

        // Deploy Loans Contract
        crosschainLoans = await CrosschainLoans.new({ from: owner })

        // Add Asset Type
        // await loans.addAssetType(
        //     token.address,
        //     maxLoanAmount,
        //     minLoanAmount,
        //     baseRatePerYear,
        //     multiplierPerYear
        // )

        // // Transfer 1000 DAI to the Lender        
        // await token.transfer(lender, lenderInitialBalance, { from})

    })

    // describe('Deployment', () => {
    //     it('contract should be enabled', async () => {
    //         const contractEnabled = await crosschainLoans.contractEnabled()
    //         assert.equal(contractEnabled, 1, 'Contract is not enabled')
    //     })

    //     it('owner should be authorized', async () => {
    //         const isAuthorized = await crosschainLoans.authorizedAccounts(owner)
    //         assert.equal(isAuthorized, 1, 'Owner is not authorized')
    //     })

    //     it('should emit AddAuthorization event', async () => {
    //         const events = await crosschainLoans.getPastEvents('AddAuthorization', {
    //             fromBlock: 0, toBlock: 'latest'
    //         })
    //         assert.equal(events[0].returnValues.account, owner, 'AddAuthorization event not emitted')
    //     })
    // })

    // describe('Administration', () => {
    //     it('should add authorization', async () => {
    //         await crosschainLoans.addAuthorization(owner_2)
    //         const owner2IsAuthorized = await crosschainLoans.authorizedAccounts(owner_2)
    //         const events = await crosschainLoans.getPastEvents('AddAuthorization', {
    //             fromBlock: 0, toBlock: 'latest'
    //         })
    //         assert.equal(owner2IsAuthorized, 1, 'Owner2 is not authorized')
    //         assert.equal(events[1].returnValues.account, owner_2, 'AddAuthorization event not emitted')
    //     })

    //     it('should fail to add authorization if not authorized', async () => {
    //         await truffleAssert.reverts(
    //             crosschainLoans.addAuthorization(owner_2, { from: owner_2 }),
    //             'CrosschainLoans/account-not-authorized',
    //             'User should\'t be able to authorize another account if it\'s not authorized'
    //         )            
    //     })

    //     it('should fail to add authorization if contract is not enabled', async () => {
    //         await crosschainLoans.disableContract()
    //         await truffleAssert.reverts(
    //             crosschainLoans.addAuthorization(owner_2, { from: owner }),
    //             'CrosschainLoans/contract-not-enabled',
    //             'Sender should\'t be able to authorize another account if the contract is not enabled'
    //         )
    //     })

    //     it('should disable contract', async () => {
    //         await crosschainLoans.disableContract({ from: owner })
    //         const contractEnabled = await crosschainLoans.contractEnabled()
    //         const events = await crosschainLoans.getPastEvents('DisableContract', {
    //             fromBlock: 0, toBlock: 'latest'
    //         })
    //         assert.equal(contractEnabled, 0, 'Contract is not disabled')
    //         assert.equal(events[0].event, 'DisableContract', 'DisableContract event not emitted')
    //     })

    //     it('should fail to disable contract if sender is not authorized', async () => {
    //         await truffleAssert.reverts(
    //             crosschainLoans.disableContract({ from: owner_2 }),
    //             'CrosschainLoans/account-not-authorized',
    //             'Sender should\'t be able to disable contract if not authorized'
    //         )
    //     })

    //     it('should enable contract', async () => {
    //         await crosschainLoans.disableContract({ from: owner })
    //         await crosschainLoans.enableContract({ from: owner })
    //         const contractEnabled = await crosschainLoans.contractEnabled()
    //         const events = await crosschainLoans.getPastEvents('EnableContract', {
    //             fromBlock: 0, toBlock: 'latest'
    //         })
    //         assert.equal(contractEnabled, 1, 'Contract not enabled')
    //         assert.equal(events[0].event, 'EnableContract', 'EnableContract event not emitted')
    //     })

    //     it('should fail to enable contract if sender is not authorized', async () => {
    //         await crosschainLoans.disableContract({ from: owner })
    //         await truffleAssert.reverts(
    //             crosschainLoans.enableContract({ from: owner_2 }),
    //             'CrosschainLoans/account-not-authorized',
    //             'Sender should\'t be able to enable contract if not authorized'
    //         )
    //     })
    // })

    describe('AssetType', () => {
        it('should add AssetType', async () => {
            await crosschainLoans.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear
            )

            await crosschainLoans.addAssetType(
                token_2.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear
            )

            const assetType = await crosschainLoans.getAssetType(token.address)
            const events = await crosschainLoans.getPastEvents('AddAssetType', {
                fromBlock: 0, toBlock: 'latest'
            })
            const assetType_2 = await crosschainLoans.getAssetType(token_2.address)

            assert.equal(assetType.contractAddress, token.address, 'Invalid token address')
            assert.equal(assetType.maxLoanAmount, maxLoanAmount, 'Invalid maxLoanAmount')
            assert.equal(assetType.minLoanAmount, minLoanAmount, 'Invalid minLoanAmount')
            assert.equal(events[0].event, 'AddAssetType', 'AddAssetType event not emitted')

            assert.equal(assetType_2.contractAddress, token_2.address, 'Invalid token address')
            assert.equal(assetType_2.maxLoanAmount, maxLoanAmount, 'Invalid maxLoanAmount')
            assert.equal(assetType_2.minLoanAmount, minLoanAmount, 'Invalid minLoanAmount')
            assert.equal(events[1].event, 'AddAssetType', 'AddAssetType event not emitted')
        })

        it('should fail to add AssetType if contract is disabled', async () => {
            await crosschainLoans.disableContract({ from: owner })
            await truffleAssert.reverts(
                crosschainLoans.addAssetType(
                    token.address,
                    maxLoanAmount,
                    minLoanAmount,
                    baseRatePerYear,
                    multiplierPerYear
                ),
                'CrosschainLoans/contract-not-enabled',
                'Shouldn\'t be able to add AssetType if contract is disabled'
            )
        })

        it('should fail to add AssetType if sender is not authorized', async () => {
            await truffleAssert.reverts(
                crosschainLoans.addAssetType(
                    token.address,
                    maxLoanAmount,
                    minLoanAmount,
                    baseRatePerYear,
                    multiplierPerYear,
                    { from: owner_2 }
                ),
                'CrosschainLoans/account-not-authorized',
                'Shouldn\'t be able to add AssetType if contract is sender is not authorized'
            )
        })

        it('should disable AssetType', async () => {
            await crosschainLoans.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear
            )
            await crosschainLoans.disableAssetType(token.address)
            const assetType = await crosschainLoans.getAssetType(token.address)
            const events = await crosschainLoans.getPastEvents('DisableAssetType', {
                fromBlock: 0, toBlock: 'latest'
            })
            assert.equal(assetType.enabled, 0, 'AssetType shouldn\'t be enabled')
            assert.equal(events[0].event, 'DisableAssetType', 'DisableAssetType event not emitted')
        })

        it('should fail to disable AssetType when sender is not authorized', async () => {
            await crosschainLoans.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear
            )
            await truffleAssert.reverts(
                crosschainLoans.disableAssetType(token.address, { from: owner_2 }),
                'CrosschainLoans/account-not-authorized',
                'Shouldn\'t be able to disable AssetType if contract is sender is not authorized'
            )
        })

        it('should fail to disable AssetType when contract is disabled', async () => {
            await crosschainLoans.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear
            )
            await crosschainLoans.disableContract({ from: owner })
            await truffleAssert.reverts(
                crosschainLoans.disableAssetType(token.address),
                'CrosschainLoans/contract-not-enabled',
                'Shouldn\'t be able to disable AssetType if contract is disabled'
            )
        })

        it('should enable AssetType', async () => {
            await crosschainLoans.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear
            )
            await crosschainLoans.disableAssetType(token.address)
            await crosschainLoans.enableAssetType(token.address)
            const assetType = await crosschainLoans.getAssetType(token.address)
            assert.equal(assetType.enabled, 1, 'AssetType should be enabled')
        })

        it('should fail to enable AssetType when sender is not authorized', async () => {
            await crosschainLoans.addAssetType(
                token.address,
                maxLoanAmount,
                minLoanAmount,
                baseRatePerYear,
                multiplierPerYear
            )
            await crosschainLoans.disableAssetType(token.address)
            await truffleAssert.reverts(
                crosschainLoans.enableAssetType(token.address, { from: owner_2 }),
                'CrosschainLoans/account-not-authorized',
                'Shouldn\'t be able to enable AssetType if contract is sender is not authorized'
            )
        })
    })

})