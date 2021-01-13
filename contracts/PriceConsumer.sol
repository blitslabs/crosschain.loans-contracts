pragma solidity ^0.6.2;

import "@chainlink/contracts/src/v0.4/interfaces/AggregatorInterface.sol";

contract PriceConsumer {
    AggregatorInterface internal priceFeed;

    /**
     * Network: Kovan
     * Aggregator: ETH/USD
     * Address: 0x9326BFA02ADD2366b30bacB125260Af641031331
     */
    constructor() public {
        priceFeed = AggregatorInterface(
            0x05d511aAfc16c7c12E60a2Ec4DbaF267eA72D420
        );
    }

    /**
     * Returns the latest price
     */
    function getLatestPrice() public view returns (int256) {
        int256 latestPrice = priceFeed.latestAnswer();
        return latestPrice;
    }
}
