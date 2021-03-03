async function main() {
    const CollateralLock = await ethers.getContractFactory('CollateralLockV2');
    const collateralLock = await CollateralLock.deploy();
    console.log("CollateralLock deployed to: ", collateralLock.address);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });