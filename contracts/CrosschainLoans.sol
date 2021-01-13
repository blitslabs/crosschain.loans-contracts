pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Administration {
    // --- Data ---
    uint public contractEnabled = 0;
    
    // --- Auth ---
    mapping(address => uint) public authorizedAccounts;
    
    /**
     * @notice Add auth to an account
     * @param account Account to add auth to
     */
    function addAuthorization(address account) external isAuthorized contractIsEnabled {
        authorizedAccounts[account] = 1;
        emit AddAuthorization(account);
    }
    
    /**
     * @notice Remove auth from an account
     * @param account Account to add auth to
     */
    function removeAuthorization(address account) external isAuthorized contractIsEnabled {
        authorizedAccounts[account] = 0;
        emit RemoveAuthorization(account);
    }
    
    /**
     * @notice Checks whether msg.sender can call an authed function
     */
    modifier isAuthorized {
        require(authorizedAccounts[msg.sender] == 1, "CrosschainLoans/account-not-authorized");
        _;
    }
    
    /**
     * @notice Checks whether the contract is enabled
     */
    modifier contractIsEnabled {
        require(contractEnabled == 1, "CrosschainLoans/contract-not-enabled");
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

contract CrosschainLoans is Administration {
    using SafeMath for uint256;
    
    // --- Data ---
    uint256 public secondsPerYear = 31556952;
    uint256 public loanExpirationPeriod = 2592000; // 30 days
    uint256 public acceptExpirationPeriod = 259200; // 3 days
    
    // --- Loans Data ---
    mapping(uint256 => Loan) loans;
    uint256 public loanIdCounter;
    mapping(address => uint256[]) public userLoans;
    mapping(address => uint256) public userLoansCount;    

    enum State {
        Open,
        Funded,
        Approved,
        Withdrawn,
        Repaid,
        PaybackRefunded,
        Closed,
        Canceled
    }
    
    struct Loan {
        // Actors
        address payable borrower;
        address payable lender;
        address lenderAuto;
        // Lender's aCoin address
        bytes aCoinLenderAddress;
        // Hashes
        bytes32 secretHashA1;
        bytes32 secretHashB1;
        bytes32 secretHashAutoB1;
        // Secrets
        bytes32 secretA1;
        bytes32 secretB1;
        bytes32 secretAutoB1;
        // Expiration Dates
        uint256 loanExpiration;
        uint256 acceptExpiration;
        uint256 createdAt;
        // Loan Details
        uint256 principal;
        uint256 interest;
        // Loan State
        State state;
        // token
        address contractAddress;
        ERC20 token;
    }
    
    struct AssetType {
        uint256 maxLoanAmount;
        uint256 minLoanAmount;
        uint256 supply;
        uint256 demand;
        uint256 baseRatePerPeriod;
        uint256 multiplierPerPeriod;
        uint enabled;
        address contractAddress;
        ERC20 token;
    }
    
    // Data about each asset type
    mapping(address => AssetType) public assetTypes;
    
    
    // -- Init ---
    constructor() public {
        contractEnabled = 1;
        authorizedAccounts[msg.sender] = 1;
        emit AddAuthorization(msg.sender);
    }
    
    /**
     * @notice Calculates the utilization rate for the given asset
     * @param _supply The total supply for the given asset
     * @param _demand The total demand for the given asset
     */
    function utilizationRate(uint256 _supply, uint256 _demand) public pure returns (uint256) {
        if(_demand == 0) {
            return 0;
        }
        return _demand.mul(1e18).div(_supply.add(_demand));
    }
    
    /**
     * @notice Calculates the loan period interest rate
     * @param _contractAddress The contract address of the given asset
     */
    function getAssetInterestRate(address _contractAddress) public view returns(uint256) {
        uint256 ur = utilizationRate(assetTypes[_contractAddress].supply, assetTypes[_contractAddress].demand);
        return ur.mul(assetTypes[_contractAddress].multiplierPerPeriod).div(1e18).add(assetTypes[_contractAddress].baseRatePerPeriod);
    }
    
    /**
     * @notice Create a loan offer
     * @param _lenderAuto Address of auto lender
     * @param _secretHashB1 Hash of the secret B1
     * @param _secretHashAutoB1 Hash fo the secret B1 of auto lender
     * @param _principal Principal of the loan
     * @param _contractAddress The contract address of the ERC20 token
     */
    function createLoan(
        // actors
        address _lenderAuto,
        // secret hashes
        bytes32 _secretHashB1,
        bytes32 _secretHashAutoB1,
        // loan details
        uint256 _principal,
        address _contractAddress,
        bytes memory _aCoinLenderAddress
    ) public contractIsEnabled returns (uint256 loanId) {
        require(_principal > 0, "CrosschainLoans/invalid-principal-amount");
        require(assetTypes[_contractAddress].enabled == 1, "CrosschainLoans/asset-type-disabled");
        require(_principal <= assetTypes[_contractAddress].maxLoanAmount && _principal >= assetTypes[_contractAddress].minLoanAmount, "CrosschainLoans/invalid-principal-range");
        
        // Check allowance
        ERC20 token = ERC20(_contractAddress);
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= _principal, "CrosschainLoans/invalid-token-allowance");
        
        // Transfer Token
        token.transferFrom(
            msg.sender,
            address(this),
            _principal
        );
        
        // Increment loanIdCounter
        loanIdCounter = loanIdCounter + 1;
        
        // Add Loan to mapping
        loans[loanIdCounter] = Loan({
            // Actors
            borrower: address(0),
            lender: msg.sender,
            lenderAuto: _lenderAuto,
            aCoinLenderAddress: _aCoinLenderAddress,
            // Secret Hashes
            secretHashA1: "",
            secretHashB1: _secretHashB1,
            secretHashAutoB1: _secretHashAutoB1,
            secretA1: "",
            secretB1: "",
            secretAutoB1: "",
            // Expiration dates
            loanExpiration: 0,
            acceptExpiration: 0,
            createdAt: now,
            principal: _principal,
            interest: _principal.mul(getAssetInterestRate(_contractAddress)).div(1e18),
            contractAddress: _contractAddress,
            token: token,
            state: State.Funded
        });
        
        // Add LoanId to user
        userLoans[msg.sender].push(loanIdCounter);

        // Increase userLoansCount
        userLoansCount[msg.sender] = userLoansCount[msg.sender] + 1;      
       
        // Increase asset type supply
        assetTypes[_contractAddress].supply = assetTypes[_contractAddress].supply.add(_principal);
        
        emit LoanCreated(loanIdCounter);
        return loanIdCounter;
    }
    
    /**
     * @notice Set borrower and approve loan
     * @param _loanId The ID of the loan
     * @param _borrower Borrower's address
     * @param _secretHashA1 The hash of borrower's secret A1
     */
    function setBorrowerAndApprove(
        uint256 _loanId,
        address payable _borrower,
        bytes32 _secretHashA1
    ) public contractIsEnabled {
        require(loans[_loanId].state == State.Funded, "CrosschainLoans/loan-not-funded");
        require(
            msg.sender == loans[_loanId].lender ||
                msg.sender == loans[_loanId].lenderAuto,
                "CrosschainLoans/account-not-authorized"
        );
        
        // Add LoanId to user
        userLoans[_borrower].push(loanIdCounter);

        // Increase userLoanCount
        userLoansCount[_borrower] = userLoansCount[_borrower] + 1;

        loans[_loanId].state = State.Approved;
        loans[_loanId].borrower = _borrower;
        loans[_loanId].secretHashA1 = _secretHashA1;
        loans[_loanId].loanExpiration = now.add(loanExpirationPeriod);
        loans[_loanId].acceptExpiration = now.add(loanExpirationPeriod).add(acceptExpirationPeriod);
        
        emit LoanAssignedAndApproved(
            _loanId,
            _borrower,
            _secretHashA1,
            loans[_loanId].state
        );
    }

    /**
     * @notice Withdraw the loan's principal
     * @param _loanId The ID of the loan
     * @param _secretA1 Borrower's secret A1
     */
    function withdraw(uint256 _loanId, bytes32 _secretA1) public {
        require(loans[_loanId].state == State.Approved, "CrosschainLoans/loan-not-approved");
        require(
            sha256(abi.encodePacked(_secretA1)) == loans[_loanId].secretHashA1,
            "CrosschainLoans/invalid-secret-A1"
        );
        loans[_loanId].state = State.Withdrawn;
        loans[_loanId].secretA1 = _secretA1;
        
        loans[_loanId].token.transfer(
            loans[_loanId].borrower,
            loans[_loanId].principal
        );
        
        // Increase asset type demand
        address contractAddress = loans[_loanId].contractAddress;
        assetTypes[contractAddress].demand = assetTypes[contractAddress].demand.add(loans[_loanId].principal);
        
        emit LoanPrincipalWithdrawn(
            _loanId,
            loans[_loanId].borrower,
            loans[_loanId].principal,
            _secretA1,
            loans[_loanId].state
        );
    }

    /**
     * @notice Accept borrower's repayment of principal
     * @param _loanId The ID of the loan
     * @param _secretB1 Lender's secret B1
     */
    function acceptRepayment(uint256 _loanId, bytes32 _secretB1) public {
        require(
            sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashB1 ||
                sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashAutoB1,
            "CrosschainLoans/invalid-secret-B1"
        );
        require(
            now <= loans[_loanId].acceptExpiration,
            "CrosschainLoans/accept-period-expired"
        );
        require(
            loans[_loanId].state == State.Repaid,
            "CrosschainLoans/loan-not-repaid"
        );
        
        loans[_loanId].state = State.Closed;
        loans[_loanId].secretB1 = _secretB1;

        uint256 repayment = loans[_loanId].principal.add(
            loans[_loanId].interest
        );
        loans[_loanId].token.transfer(loans[_loanId].lender, repayment);

        emit LoanRepaymentAccepted(_loanId, repayment, loans[_loanId].state);
    }

    /**
     * @notice Cancel loan before the borrower withdraws the loan's principal
     * @param _loanId The ID of the loan
     * @param _secretB1 Lender's secret B1
     */
    function cancelLoanBeforePrincipalWithdraw(
        uint256 _loanId,
        bytes32 _secretB1
    ) public {
        require(
            sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashB1 ||
                sha256(abi.encodePacked(_secretB1)) ==
                loans[_loanId].secretHashAutoB1,
            "CrosschainLoans/invalid-secret-B1"
        );
        // require(now <= loans[_loanId].acceptExpiration,"CrosschainLoans/accept-period-expired");
        require(
            loans[_loanId].state == State.Funded ||
                loans[_loanId].state == State.Approved,
                "CrosschainLoans/principal-withdrawn"
        );
        loans[_loanId].state = State.Canceled;
        uint256 principal = loans[_loanId].principal;
        loans[_loanId].principal = 0;
        loans[_loanId].secretB1 = _secretB1;
        
        // Decrease supply
        address contractAddress = loans[_loanId].contractAddress;
        assetTypes[contractAddress].supply = assetTypes[contractAddress].supply.sub(loans[_loanId].principal);
        
        loans[_loanId].token.transfer(loans[_loanId].lender, principal);
        emit CancelLoan(_loanId, _secretB1, loans[_loanId].state);
    }
    
    /**
     * @notice Payback loan's principal and interest
     * @param _loanId The ID of the loan
     */
    function payback(uint256 _loanId) public {
        require(loans[_loanId].state == State.Withdrawn, "CrosschainLoans/invalid-loan-state");
        require(now <= loans[_loanId].loanExpiration, "CrosschainLoans/loan-expired");
        
        uint256 repayment = loans[_loanId].principal.add(
            loans[_loanId].interest
        );
        loans[_loanId].state = State.Repaid;
        loans[_loanId].token.transferFrom(
            loans[_loanId].borrower,
            address(this),
            repayment
        );
        emit Payback(
            _loanId,
            loans[_loanId].borrower,
            repayment,
            loans[_loanId].state
        );
    }

    /**
     * @notice Refund the payback amount
     * @param _loanId The ID of the loan
     */
    function refundPayback(uint256 _loanId) public {
        require(now > loans[_loanId].acceptExpiration, "CrosschainLoans/accept-period-not-expired");
        require(loans[_loanId].state == State.Repaid, "CrosschainLoans/loan-not-repaid");
        require(msg.sender == loans[_loanId].borrower, "CrosschainLoans/account-not-authorized");
        loans[_loanId].state = State.PaybackRefunded;
        uint256 refund = loans[_loanId].principal.add(loans[_loanId].interest);
        loans[_loanId].principal = 0;
        loans[_loanId].interest = 0;
        loans[_loanId].token.transfer(loans[_loanId].borrower, refund);
        emit RefundPayback(
            _loanId,
            loans[_loanId].borrower,
            refund,
            loans[_loanId].state
        );
    }
    
    /**
     * @notice Get information about an Asset Type
     * @param contractAddress The contract address of the given asset
     */
    function getAssetType(address _contractAddress) public view returns
    (
        uint256 maxLoanAmount,
        uint256 minLoanAmount,
        uint256 supply,
        uint256 demand,
        uint256 baseRatePerPeriod,
        uint256 multiplierPerPeriod,
        uint256 interestRate,
        uint enabled,
        address contractAddress
    ) {
        maxLoanAmount = assetTypes[_contractAddress].maxLoanAmount;
        minLoanAmount = assetTypes[_contractAddress].minLoanAmount;
        supply = assetTypes[_contractAddress].supply;
        demand = assetTypes[_contractAddress].demand;
        baseRatePerPeriod = assetTypes[_contractAddress].baseRatePerPeriod;
        multiplierPerPeriod = assetTypes[_contractAddress].multiplierPerPeriod;
        interestRate = getAssetInterestRate(_contractAddress);
        enabled = assetTypes[_contractAddress].enabled;
        contractAddress = assetTypes[_contractAddress].contractAddress;
    }
    
    /**
     * @notice Get information about a loan
     * @param _loanId The ID of the loan
     */
    function fetchLoan(uint256 _loanId) public view 
    returns(
        address[3] memory actors,
        bytes32[3] memory secretHashes,
        bytes32[3] memory secrets,
        uint256[2] memory expirations,
        uint256[2] memory details,
        bytes memory aCoinLenderAddress,
        State state,
        address contractAddress
    ){
        actors = [
            loans[_loanId].borrower,
            loans[_loanId].lender,
            loans[_loanId].lenderAuto
        ];
        secretHashes = [
            loans[_loanId].secretHashA1,
            loans[_loanId].secretHashB1,
            loans[_loanId].secretHashAutoB1
        ];
        secrets = [
            loans[_loanId].secretA1,
            loans[_loanId].secretB1,
            loans[_loanId].secretAutoB1
        ];
        expirations = [
            loans[_loanId].loanExpiration,
            loans[_loanId].acceptExpiration
        ];
        aCoinLenderAddress = loans[_loanId].aCoinLenderAddress;
        state = loans[_loanId].state;
        details = [loans[_loanId].principal, loans[_loanId].interest];
        contractAddress = loans[_loanId].contractAddress;
    }
    
    /**
     * @notice Get Account loans
     * @param _account The user account
     */
    function getAccountLoans(address _account) public view returns (uint256[] memory){
        return userLoans[_account];
    }
    
    /**
     * @notice Modify Loan expiration periods
     * @param _parameter The name of the parameter modified
     * @param _data The new value for the parameter
     */
    function modifyLoanParameters(bytes32 _parameter, uint256 _data) external isAuthorized contractIsEnabled {
        require(_data > 0, "CrosschainLoans/null-data");
        if(_parameter == "loanExpirationPeriod") loanExpirationPeriod = _data;
        else if (_parameter == "acceptExpirationPeriod") acceptExpirationPeriod = _data;
        else revert("BlitsLoats/modify-unrecognized-param");
        emit ModifyLoanParameters(_parameter, _data);
    }
    
    /**
     * @notice Modify AssetType related parameters
     * @param _contractAddress The contract address of the ERC20 token
     * @param _parameter The name of the parameter modified
     * @param _data The new value for the parameter
     */
    function modifyAssetTypeLoanParameters(address _contractAddress, bytes32 _parameter, uint256 _data) external isAuthorized contractIsEnabled {
        require(_data > 0, "CrosschainLoans/null-data");
        if(_parameter == "maxLoanAmount") assetTypes[_contractAddress].maxLoanAmount = _data;
        else if (_parameter == "minLoanAmount") assetTypes[_contractAddress].minLoanAmount = _data;
        else revert("CrosschainLoans/modify-unrecognized-param");
        emit ModifyAssetTypeLoanParameters(_parameter, _data);
    }
    
    /**
     * @notice Disable AssetType
     * @param _contractAddress The contract address of the ERC20 token
     */
    function disableAssetType(address _contractAddress) external isAuthorized contractIsEnabled {
        require(assetTypes[_contractAddress].contractAddress != address(0), "CrosschainLoans/invalid-assetType");
        assetTypes[_contractAddress].enabled = 0;
        emit DisableAssetType(_contractAddress);
    }
    
    /**
     * @notice Enable AssetType
     */
    function enableAssetType(address _contractAddress) external isAuthorized contractIsEnabled {
        require(assetTypes[_contractAddress].contractAddress != address(0), "CrosschainLoans/invalid-assetType");
        assetTypes[_contractAddress].enabled = 1;
        emit EnableAssetType(_contractAddress);
    }
    
    /**
     * @notice Add AssetType
     * @param _contractAddress The contract address of the ERC20 token
     * @param _maxLoanAmount The maximum principal allowed for the token
     * @param _minLoanAmount The minimum principal allowerd for the token
     * @param _baseRatePerYear The approximate target base APR
     * @param _multiplierPerYear The rate of increase in interest rate 
     */
    function addAssetType(address _contractAddress, uint256 _maxLoanAmount, uint256 _minLoanAmount, uint256 _baseRatePerYear, uint256 _multiplierPerYear) external isAuthorized contractIsEnabled {
        require(_maxLoanAmount > 0, "CrosschainLoans/invalid-maxLoanAmount");
        require(_minLoanAmount > 0, "CrosschainLoans/invalid-minLoanAmount");
        require(assetTypes[_contractAddress].minLoanAmount == 0, "CrosschainLoans/assetType-already-exists");
        
        assetTypes[_contractAddress] = AssetType({
            contractAddress: _contractAddress,
            token: ERC20(_contractAddress),
            maxLoanAmount: _maxLoanAmount,
            minLoanAmount: _minLoanAmount,
            baseRatePerPeriod: _baseRatePerYear.mul(loanExpirationPeriod).div(secondsPerYear),
            multiplierPerPeriod: _multiplierPerYear.mul(loanExpirationPeriod).div(secondsPerYear),
            enabled: 1,
            supply: 0,
            demand: 0
        });
        emit AddAssetType(_contractAddress, _maxLoanAmount, _minLoanAmount);
    }
    
    // --- Events ---
    event LoanCreated(uint256 loanId);
    event LoanFunded(uint256 loanId, uint256 amount, State state);
    event LoanAssignedAndApproved(
        uint256 loanId,
        address borrower,
        bytes32 secretHashA1,
        State state
    );
    event LoanPrincipalWithdrawn(
        uint256 loanId,
        address borrower,
        uint256 amount,
        bytes32 secretA1,
        State state
    );
    event LoanRepaymentAccepted(uint256 loanId, uint256 amount, State state);
    event CancelLoan(uint256 loanId, bytes32 secretB1, State state);
    event Payback(
        uint256 loanId,
        address borrower,
        uint256 amount,
        State state
    );
    event RefundPayback(
        uint256 loanId,
        address borrower,
        uint256 amount,
        State state
    );
    
    event ModifyLoanParameters(bytes32 parameter, uint256 data);
    event ModifyAssetTypeLoanParameters(bytes32 parameter, uint256 data);
    event DisableAssetType(address contractAddress);
    event EnableAssetType(address contractAddress);
    event AddAssetType(address contractAddress, uint256 maxLoanAmount, uint256 minLoanAmount);
}