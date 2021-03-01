pragma solidity ^0.5.16;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Administration {
    // --- Data ---
    uint256 public contractEnabled = 0;

    // --- Auth ---
    mapping(address => uint256) public authorizedAccounts;

    /**
     * @notice Add auth to an account
     * @param account Account to add auth to
     */
    function addAuthorization(address account)
        external
        isAuthorized
        contractIsEnabled
    {
        authorizedAccounts[account] = 1;
        emit AddAuthorization(account);
    }

    /**
     * @notice Remove auth from an account
     * @param account Account to add auth to
     */
    function removeAuthorization(address account)
        external
        isAuthorized
        contractIsEnabled
    {
        authorizedAccounts[account] = 0;
        emit RemoveAuthorization(account);
    }

    /**
     * @notice Checks whether msg.sender can call an authed function
     */
    modifier isAuthorized {
        require(
            authorizedAccounts[msg.sender] == 1,
            "CollateralLock/account-not-authorized"
        );
        _;
    }

    /**
     * @notice Checks whether the contract is enabled
     */
    modifier contractIsEnabled {
        require(contractEnabled == 1, "CollateralLock/contract-not-enabled");
        _;
    }

    // --- Administration ---

    function enableContract() external isAuthorized {
        contractEnabled = 1;
        emit EnableContract();
    }

    /**
     * @notice Disable this contract
     */
    function disableContract() external isAuthorized {
        contractEnabled = 0;
        emit DisableContract();
    }

    // --- Events ---
    event AddAuthorization(address account);
    event RemoveAuthorization(address account);
    event EnableContract();
    event DisableContract();
}

interface AggregatorInterface {
    function latestAnswer() external view returns (int256);

    function latestTimestamp() external view returns (uint256);

    function latestRound() external view returns (uint256);

    function getAnswer(uint256 roundId) external view returns (int256);

    function getTimestamp(uint256 roundId) external view returns (uint256);

    event AnswerUpdated(
        int256 indexed current,
        uint256 indexed roundId,
        uint256 timestamp
    );
    event NewRound(
        uint256 indexed roundId,
        address indexed startedBy,
        uint256 startedAt
    );
}

contract CollateralLockV1 is Administration {
    using SafeMath for uint256;

    // --- Data ---
    uint256 public loanExpirationPeriod = 2851200; //  33 days
    uint256 public seizureExpirationPeriod = 3110400; // 36 days
    uint256 public collateralizationRatio = 150e18; // 150%

    // Oracle
    AggregatorInterface internal priceFeed =
        AggregatorInterface(0x05d511aAfc16c7c12E60a2Ec4DbaF267eA72D420);

    // --- Loans Data ---
    mapping(uint256 => Loan) loans;
    uint256 public loanIdCounter;
    mapping(address => uint256[]) public userLoans;
    mapping(address => uint256) public userLoansCount;

    enum State {Locked, Seized, Refunded, Closed}

    struct Loan {
        // Actors
        address payable borrower;
        address payable lender;
        // Borrower's bCoin address
        address bCoinBorrowerAddress;
        // Hashes
        bytes32 secretHashA1;
        bytes32 secretHashB1;
        // Secrets
        bytes32 secretA1;
        bytes32 secretB1;
        // Expirations
        uint256 loanExpiration;
        uint256 seizureExpiration;
        uint256 createdAt;
        // Loan Details
        uint256 collateral;
        uint256 lockPrice;
        uint256 liquidationPrice;
        uint256 collateralValue;
        // Loan State
        State state;
    }

    // --- Init ---
    constructor() public {
        contractEnabled = 1;
        authorizedAccounts[msg.sender] = 1;
        emit AddAuthorization(msg.sender);
    }

    /**
     * @notice Lock loan's collateral
     * @param _lender Lender's address on the collateral's blockchain
     * @param _secretHashA1 secretA1's hash
     * @param _secretHashB1 secretB1's hash
     */
    function lockCollateral(
        address payable _lender,
        bytes32 _secretHashA1,
        bytes32 _secretHashB1,
        address _bCoinBorrowerAddress
    ) public payable {
        require(msg.value > 0, "CollateralLock/invalid-collateral-amount");
        int256 latestAnswer = priceFeed.latestAnswer();
        require(latestAnswer > 0, "CollateralLock/invalid-oracle-price");

        loanIdCounter = loanIdCounter + 1;

        // Add loanId to users
        userLoans[msg.sender].push(loanIdCounter);
        userLoans[_lender].push(loanIdCounter);

        uint256 baseCollateral =
            msg.value.mul(100e18).div(collateralizationRatio);
        uint256 latestPrice = uint256(latestAnswer).mul(1e10);
        uint256 collateralValue = baseCollateral.mul(latestPrice);

        loans[loanIdCounter] = Loan({
            borrower: msg.sender,
            lender: _lender,
            bCoinBorrowerAddress: _bCoinBorrowerAddress,
            secretHashA1: _secretHashA1,
            secretHashB1: _secretHashB1,
            secretA1: "",
            secretB1: "",
            loanExpiration: now.add(loanExpirationPeriod),
            seizureExpiration: now.add(seizureExpirationPeriod),
            createdAt: now,
            collateral: msg.value,
            lockPrice: latestPrice,
            liquidationPrice: latestPrice,
            collateralValue: collateralValue,
            state: State.Locked
        });

        // Add LoanId to user
        userLoans[msg.sender].push(loanIdCounter);

        // Increase userLoansCount
        userLoansCount[msg.sender] = userLoansCount[msg.sender] + 1;

        emit LockCollateral(
            loanIdCounter,
            msg.sender,
            _lender,
            msg.value,
            collateralValue
        );
    }

    /**
     * @notice Used when the Lender accepts repayment or cancels the loan
     * @param _loanId The ID of the loan
     * @param _secretB1 Lender's secretB1
     */
    function unlockCollateralAndCloseLoan(uint256 _loanId, bytes32 _secretB1)
        public
    {
        require(
            loans[_loanId].state == State.Locked,
            "CollateralLock/collateral-not-locked"
        );
        require(
            now <= loans[_loanId].loanExpiration,
            "CollateralLock/loan-period-expired"
        );
        require(
            sha256(abi.encodePacked(_secretB1)) == loans[_loanId].secretHashB1,
            "CollateralLock/invalid-secretB1"
        );
        require(
            loans[_loanId].collateral > 0,
            "CollateralLock/invalid-collateral-amount"
        );

        // Change loan's state
        loans[_loanId].state = State.Closed;

        // Update collateral amount
        uint256 collateral = loans[_loanId].collateral;
        loans[_loanId].collateral = 0;

        // Refund total collateral to borrower
        loans[_loanId].borrower.transfer(collateral);

        emit UnlockAndClose(_loanId, loans[_loanId].borrower, collateral);
    }

    /**
     * @notice Can only be used by the lender to seize part of the collaeral if he has secretA1
     * @param _loanId The ID of the loan
     * @param _secretA1 Borrower's secretA1
     */
    function seizeCollateral(uint256 _loanId, bytes32 _secretA1) public {
        require(
            sha256(abi.encodePacked(_secretA1)) == loans[_loanId].secretHashA1,
            "CollateralLock/invalid-secret-A1"
        );
        require(
            now > loans[_loanId].loanExpiration,
            "CollateralLock/loan-period-active"
        );
        require(
            now <= loans[_loanId].seizureExpiration,
            "CollateralLock/seizure-period-expired"
        );
        require(
            loans[_loanId].state == State.Locked,
            "CollateralLock/collateral-not-locked"
        );
        require(
            loans[_loanId].collateral > 0,
            "CollateralLock/invalid-collateral-amount"
        );

        // Get latestPrice
        uint256 latestPrice = uint256(priceFeed.latestAnswer()).mul(1e10);
        uint256 seizableCollateral =
            loans[_loanId].collateralValue.div(latestPrice);

        // Update liquidation price
        loans[_loanId].liquidationPrice = latestPrice;

        if (seizableCollateral > loans[_loanId].collateral) {
            seizableCollateral = loans[_loanId].collateral;
        }

        // Substract seizable collateral
        loans[_loanId].collateral = loans[_loanId].collateral.sub(
            seizableCollateral
        );

        // Update loan
        loans[_loanId].state = State.Seized;

        // Refund seized collateral to lender
        loans[_loanId].lender.transfer(seizableCollateral);

        // Emit event
        emit SeizeCollateral(
            _loanId,
            loans[_loanId].lender,
            seizableCollateral
        );
    }

    /**
     * @notice Unclock refundable collateral after seizure period
     * @param _loanId The ID of the loan
     */
    function unlockRefundableCollateral(uint256 _loanId) public {
        require(
            now > loans[_loanId].seizureExpiration,
            "CollateralLock/seizure-period-not-expired"
        );
        require(
            loans[_loanId].state == State.Locked || loans[_loanId].state == State.Seized,
            "CollateralLock/collateral-not-locked"
        );
        require(
            loans[_loanId].collateral > 0,
            "CollateralLock/invalid-collateral-amount"
        );

        uint256 collateral = loans[_loanId].collateral;

        // Zero collateral amount
        loans[_loanId].collateral = 0;

        // Update loan state
        loans[_loanId].state = State.Refunded;

        // Refund collateral to borrower
        loans[_loanId].borrower.transfer(collateral);

        emit UnlockRefundableCollateral(
            _loanId,
            loans[_loanId].borrower,
            collateral
        );
    }

    /**
     * @notice Get information about a loan
     * @param _loanId The ID of the loan
     */
    function fetchLoan(uint256 _loanId)
        public
        view
        returns (
            address payable[2] memory actors,
            bytes32[2] memory secretHashes,
            bytes32[2] memory secrets,
            uint256[3] memory expirations,
            uint256[4] memory details,
            State state
        )
    {
        actors = [
            loans[_loanId].borrower,
            loans[_loanId].lender
        ];
        secretHashes = [
            loans[_loanId].secretHashA1,
            loans[_loanId].secretHashB1
        ];
        secrets = [loans[_loanId].secretA1, loans[_loanId].secretB1];
        expirations = [
            loans[_loanId].loanExpiration,
            loans[_loanId].seizureExpiration,
            loans[_loanId].createdAt
        ];
        details = [
            loans[_loanId].collateral,
            loans[_loanId].collateralValue,
            loans[_loanId].lockPrice,
            loans[_loanId].liquidationPrice
        ];
        state = loans[_loanId].state;
    }

    /**
     * @notice Get Account loans
     * @param _account User account
     */
    function getAccountLoans(address _account)
        public
        view
        returns (uint256[] memory)
    {
        return userLoans[_account];
    }

    /**
     * @notice Modify Loan parameters
     * @param _parameter The name of the parameter modified
     * @param _data The new value for the parameter
     */
    function modifyLoanParameters(bytes32 _parameter, uint256 _data)
        external
        isAuthorized
        contractIsEnabled
    {
        require(_data > 0, "CollateralLock/null-data");
        if (_parameter == "loanExpirationPeriod") loanExpirationPeriod = _data;
        else if (_parameter == "seizureExpirationPeriod")
            seizureExpirationPeriod = _data;
        else if (_parameter == "collateralizationRatio")
            collateralizationRatio = _data;
        else if (_parameter == "priceFeed")
            priceFeed = AggregatorInterface(_data);
        else revert("CollateralLock/modify-unrecognized-param");
        emit ModifyLoanParameters(_parameter, _data);
    }

    // --- Events ---
    event LockCollateral(
        uint256 loanId,
        address borrower,
        address lender,
        uint256 collateral,
        uint256 collateralValue
    );
    event UnlockAndClose(uint256 loanId, address borrower, uint256 collateral);
    event SeizeCollateral(uint256 loanId, address lender, uint256 amount);
    event UnlockRefundableCollateral(
        uint256 loanId,
        address borrower,
        uint256 amount
    );
    event ModifyLoanParameters(bytes32 parameter, uint256 data);
}