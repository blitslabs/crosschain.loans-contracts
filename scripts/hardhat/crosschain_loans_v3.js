async function main() {
    const CrosschainLoans = await ethers.getContractFactory('CrosschainLoansV3');
    const crosschainLoans = await CrosschainLoans.deploy();
    console.log("CrosschainLoansMoneyMarket deployed to: ", crosschainLoans.address);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });