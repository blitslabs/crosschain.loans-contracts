async function main() {
    const CrosschainLoansMoneyMarket = await ethers.getContractFactory('CrosschainLoansMoneyMarket');
    const crosschainLoans = await CrosschainLoansMoneyMarket.deploy();
    console.log("CrosschainLoansMoneyMarket deployed to: ", crosschainLoans.address);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });