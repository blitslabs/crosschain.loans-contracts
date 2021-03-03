async function main() {
    const AggregatorTest = await ethers.getContractFactory('AggregatorTest');
    const aggregatorTest = await AggregatorTest.deploy();
    console.log("AggregatorTest deployed to: ", aggregatorTest.address);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });