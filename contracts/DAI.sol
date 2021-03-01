pragma solidity ^0.5.16;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract DAI is ERC20 {
    uint256 public INITIAL_SUPPLY = 10000000000000000000000000;
    string public name = "DaiToken";
    string public symbol = "DAI";

    constructor() public {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
