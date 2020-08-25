pragma solidity ^0.6.0;
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';

contract DAI is ERC20 {
   
    uint public INITIAL_SUPPLY = 10000000000000000000000000;

    constructor() ERC20("DaiToken", "DAI") public {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    
}