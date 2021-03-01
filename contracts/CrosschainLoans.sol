pragma solidity ^0.5.16;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./AssetTypes.sol";

contract CrosschainLoans is AssetTypes {
    using SafeMath for uint256;

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
        address aCoinLenderAddress;
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

    // -- Init ---
    constructor() public {
        contractEnabled = 1;
        authorizedAccounts[msg.sender] = 1;
        emit AddAuthorization(msg.sender);
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
        address _aCoinLenderAddress
    ) public contractIsEnabled returns (uint256 loanId) {
        require(_principal > 0, "CrosschainLoans/invalid-principal-amount");
        require(
            _contractAddress != address(0),
            "CrosschainLoans/invalid-token-address"
        );
        require(
            _aCoinLenderAddress != address(0),
            "CrosschainLoans/invalid-acoin-address"
        );
        require(
            assetTypes[_contractAddress].enabled == 1,
            "CrosschainLoans/asset-type-disabled"
        );
        require(
            _principal <= assetTypes[_contractAddress].maxLoanAmount &&
                _principal >= assetTypes[_contractAddress].minLoanAmount,
            "CrosschainLoans/invalid-principal-range"
        );

        // Check allowance
        ERC20 token = ERC20(_contractAddress);
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(
            allowance >= _principal,
            "CrosschainLoans/insufficient-token-allowance"
        );

        // Transfer Token
        require(
            token.transferFrom(msg.sender, address(this), _principal),
            "CrosschainLoans/token-transfer-failed"
        );

        // Increment loanIdCounter
        loanIdCounter = loanIdCounter + 1;

        // Add Loan to mapping
        loans[loanIdCounter] = Loan({ // Actors
            borrower: address(0),
            lender: msg.sender,
            lenderAuto: _lenderAuto,
            aCoinLenderAddress: _aCoinLenderAddress, // Secret Hashes
            secretHashA1: "",
            secretHashB1: _secretHashB1,
            secretHashAutoB1: _secretHashAutoB1,
            secretA1: "",
            secretB1: "",
            secretAutoB1: "", // Expiration dates
            loanExpiration: 0,
            acceptExpiration: 0,
            createdAt: now,
            principal: _principal,
            interest: _principal
                .mul(getAssetInterestRate(_contractAddress))
                .div(1e18),
            contractAddress: _contractAddress,
            token: token,
            state: State.Funded
        });

        // Add LoanId to user
        userLoans[msg.sender].push(loanIdCounter);

        // Increase userLoansCount
        userLoansCount[msg.sender] = userLoansCount[msg.sender] + 1;

        // Increase asset type supply
        assetTypes[_contractAddress].supply = assetTypes[_contractAddress]
            .supply
            .add(_principal);

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
        require(
            loans[_loanId].state == State.Funded,
            "CrosschainLoans/loan-not-funded"
        );
        require(
            msg.sender == loans[_loanId].lender ||
                msg.sender == loans[_loanId].lenderAuto,
            "CrosschainLoans/account-not-authorized"
        );
        require(_borrower != address(0), "CrosschainLoans/invalid-borrower");

        // Add LoanId to user
        userLoans[_borrower].push(loanIdCounter);

        // Increase userLoanCount
        userLoansCount[_borrower] = userLoansCount[_borrower] + 1;

        loans[_loanId].state = State.Approved;
        loans[_loanId].borrower = _borrower;
        loans[_loanId].secretHashA1 = _secretHashA1;
        loans[_loanId].loanExpiration = now.add(loanExpirationPeriod);
        loans[_loanId].acceptExpiration = now.add(loanExpirationPeriod).add(
            acceptExpirationPeriod
        );

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
    function withdraw(uint256 _loanId, bytes32 _secretA1)
        public
        contractIsEnabled
    {
        require(
            loans[_loanId].state == State.Approved,
            "CrosschainLoans/loan-not-approved"
        );
        require(
            sha256(abi.encodePacked(_secretA1)) == loans[_loanId].secretHashA1,
            "CrosschainLoans/invalid-secret-A1"
        );
        require(
            now <= loans[_loanId].loanExpiration,
            "CrosschainLoans/loan-expired"
        );

        loans[_loanId].state = State.Withdrawn;
        loans[_loanId].secretA1 = _secretA1;

        loans[_loanId].token.transfer(
            loans[_loanId].borrower,
            loans[_loanId].principal
        );

        // Increase asset type demand
        address contractAddress = loans[_loanId].contractAddress;
        assetTypes[contractAddress].demand = assetTypes[contractAddress]
            .demand
            .add(loans[_loanId].principal);

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
    function acceptRepayment(uint256 _loanId, bytes32 _secretB1)
        public
        contractIsEnabled
    {
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

        uint256 repayment =
            loans[_loanId].principal.add(loans[_loanId].interest);
        require(
            loans[_loanId].token.transfer(loans[_loanId].lender, repayment),
            "CrosschainLoans/token-transfer-failed"
        );

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
    ) public contractIsEnabled {
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
        assetTypes[contractAddress].supply = assetTypes[contractAddress]
            .supply
            .sub(loans[_loanId].principal);

        require(
            loans[_loanId].token.transfer(loans[_loanId].lender, principal),
            "CrosschainLoans/token-refund-failed"
        );
        emit CancelLoan(_loanId, _secretB1, loans[_loanId].state);
    }

    /**
     * @notice Payback loan's principal and interest
     * @param _loanId The ID of the loan
     */
    function payback(uint256 _loanId) public contractIsEnabled {
        require(
            loans[_loanId].state == State.Withdrawn,
            "CrosschainLoans/invalid-loan-state"
        );
        require(
            now <= loans[_loanId].loanExpiration,
            "CrosschainLoans/loan-expired"
        );

        uint256 repayment =
            loans[_loanId].principal.add(loans[_loanId].interest);

        // Check allowance
        uint256 allowance =
            loans[_loanId].token.allowance(msg.sender, address(this));
        require(
            allowance >= repayment,
            "CrosschainLoans/insufficient-token-allowance"
        );

        loans[_loanId].state = State.Repaid;
        require(
            loans[_loanId].token.transferFrom(
                msg.sender,
                address(this),
                repayment
            ),
            "CrosschainLoans/token-transfer-failed"
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
    function refundPayback(uint256 _loanId) public contractIsEnabled {
        require(
            now > loans[_loanId].acceptExpiration,
            "CrosschainLoans/accept-period-not-expired"
        );
        require(
            loans[_loanId].state == State.Repaid,
            "CrosschainLoans/loan-not-repaid"
        );
        loans[_loanId].state = State.PaybackRefunded;
        uint256 refund = loans[_loanId].principal.add(loans[_loanId].interest);
        loans[_loanId].principal = 0;
        loans[_loanId].interest = 0;
        require(
            loans[_loanId].token.transfer(loans[_loanId].borrower, refund),
            "CrosschainLoans/token-transfer-failed"
        );
        emit RefundPayback(
            _loanId,
            loans[_loanId].borrower,
            refund,
            loans[_loanId].state
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
            address[3] memory actors,
            bytes32[3] memory secretHashes,
            bytes32[3] memory secrets,
            uint256[2] memory expirations,
            uint256[2] memory details,
            address aCoinLenderAddress,
            State state,
            address contractAddress
        )
    {
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
    function getAccountLoans(address _account)
        public
        view
        returns (uint256[] memory)
    {
        return userLoans[_account];
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
}
