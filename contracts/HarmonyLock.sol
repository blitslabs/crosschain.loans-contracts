pragma solidity ^0.6.0;
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract HarmonyLock {
    using SafeMath for uint256;

    enum State {Locked, Closed}

    struct Loan {
        address payable borrower;
        address payable lender;
        bytes32 secretHashA1;
        bytes32 secretHashB1;
        bytes32 secretHashAutoA1;
        bytes32 secretHashAutoB1;
        bytes32 secretA1;
        bytes32 secretB1;
        uint256 loanExpiration;
        uint256 seizureExpiration;
        uint256 seizableCollateral;
        uint256 refundableCollateral;
        uint256 cRatio;
        State state;
    }

    uint256 public loanCounter = 0;
    mapping(uint256 => Loan) loans;

    function lockCollateral(
        address payable _lender,
        bytes32 _secretHashA1,
        bytes32 _secretHashB1,
        bytes32 _secretHashAutoA1,
        bytes32 _secretHashAutoB1,
        uint256 _loanExpiration,
        uint256 _seizureExpiration,
        uint256 _collateralizationRatio
    ) public payable {
        require(_collateralizationRatio <= 1000 && _collateralizationRatio >= 100);

        loanCounter = loanCounter + 1;
        uint256 baseRatio = 100;
        uint256 amount = msg.value;
        uint256 seizableCollateral = baseRatio.mul(amount).div(_collateralizationRatio);
        uint256 refundableCollateral = amount.sub(seizableCollateral);

        loans[loanCounter] = Loan({
            borrower: msg.sender,
            lender: _lender,
            secretHashA1: _secretHashA1,
            secretHashB1: _secretHashB1,
            secretHashAutoA1: _secretHashAutoA1,
            secretHashAutoB1: _secretHashAutoB1,
            secretA1: "",
            secretB1: "",
            loanExpiration: _loanExpiration,
            seizureExpiration: _seizureExpiration,
            seizableCollateral: seizableCollateral,
            refundableCollateral: refundableCollateral,
            cRatio: _collateralizationRatio,
            state: State.Locked
        });
    }

    function fetchLoan(uint256 _loanId)
        public
        view
        returns (
            address payable[2] memory actors,
            bytes32[4] memory secretHashes,
            bytes32[2] memory secrets,
            uint256[2] memory expirations,
            uint256[3] memory details,
            State state
        )
    {
        actors = [loans[_loanId].borrower, loans[_loanId].lender];
        secretHashes = [
            loans[_loanId].secretHashA1,
            loans[_loanId].secretHashB1,
            loans[_loanId].secretHashAutoA1,
            loans[_loanId].secretHashAutoB1
        ];
        secrets = [loans[_loanId].secretA1, loans[_loanId].secretB1];
        expirations = [
            loans[_loanId].loanExpiration,
            loans[_loanId].seizureExpiration
        ];
        state = loans[_loanId].state;
        details = [
            loans[_loanId].seizableCollateral,
            loans[_loanId].refundableCollateral,
            loans[_loanId].cRatio
        ];
    }

    // If the lender is not satisfied with the collateral locked by the borrower, then the lender
    // can refund their loan amount by revealing secretB2, which will subsequently allow the borrower
    // to refund the collateral amount they deposited
    // Borrower can refund when the Loan repayment is accepted or the loan is cancelled (before Alice withdraws the principal)

    // Withdraw Pattern
    // https://solidity.readthedocs.io/en/develop/common-patterns.html#withdrawal-from-contracts

    // Refund Collateral function
    // https://github.com/AtomicLoans/chainabstractionlayer/blob/dev/packages/bitcoin-collateral-provider/lib/BitcoinCollateralProvider.js#L246

    // Durante `loanPeriod` y seizurePeriod && seizable => se require secretoB2?
    // Si es 'seizurePeriod' && 'requiresSecret' ? se envia a Lender : se envia a Borrower

    // secretA2 or secretB2

    // Used when the Lender Accepts repayment or Cancels the loan
    function unlockCollateralAndCloseLoan(uint256 _loanId, bytes32 _secretB1)
        public
    {
        require(loans[_loanId].state == State.Locked);
        require(now <= loans[_loanId].loanExpiration);
        require(
            sha256(abi.encodePacked(_secretB1)) == loans[_loanId].secretHashB1
        );

        // Change loan's state
        loans[_loanId].state = State.Closed;

        // Zero collateral amount
        uint256 tCollateral = loans[_loanId].seizableCollateral.add(
            loans[_loanId].refundableCollateral
        );
        loans[_loanId].seizableCollateral = 0;
        loans[_loanId].refundableCollateral = 0;

        // Refund the entire collateral to the borrower
        loans[_loanId].borrower.transfer(tCollateral);

        // Emit unlockCollateralAndCloseLoan event
        emit UnlockAndClose(
            _loanId,
            loans[_loanId].borrower,
            loans[_loanId].seizureExpiration,
            loans[_loanId].refundableCollateral
        );
    }

    // Can be used once the loan expires
    function unlockRefundableCollateral(uint256 _loanId) public {
        require(now > loans[_loanId].loanExpiration);
        require(loans[_loanId].state == State.Locked);
        require(loans[_loanId].refundableCollateral > 0);
        uint256 rCollateral = loans[_loanId].refundableCollateral;
        // Zero collateral amount
        loans[_loanId].refundableCollateral = 0;
        // Close loan
        if (loans[_loanId].seizableCollateral == 0) {
            loans[_loanId].state = State.Closed;
        }
        // Refund rCollateral to borrower
        loans[_loanId].borrower.transfer(rCollateral);

        emit UnlockRefundableCollateral(
            _loanId,
            loans[_loanId].borrower,
            rCollateral
        );
    }

    function unlockSeizableCollateral(uint256 _loanId, bytes32 _secretA1)
        public
    {
        require(
            sha256(abi.encodePacked(_secretA1)) ==
                loans[_loanId].secretHashA1 ||
                sha256(abi.encodePacked(_secretA1)) ==
                loans[_loanId].secretHashAutoA1
        );
        require(now > loans[_loanId].loanExpiration);
        require(now > loans[_loanId].seizureExpiration);
        require(loans[_loanId].state == State.Locked);
        require(loans[_loanId].seizableCollateral > 0);
        uint256 sCollateral = loans[_loanId].seizableCollateral;
        // Zero collateral amount
        loans[_loanId].seizableCollateral = 0;
        // Close Loan
        if (loans[_loanId].refundableCollateral == 0) {
            loans[_loanId].state = State.Closed;
        }
        //  Refund sCollateral to borrower
        loans[_loanId].borrower.transfer(sCollateral);
        emit UnlockSeizableCollateral(
            _loanId,
            loans[_loanId].borrower,
            sCollateral
        );
    }

    // This function can only be used by the lender if he has secretA1
    function seizeCollateral(uint256 _loanId, bytes32 _secretA1) public {
        require(
            sha256(abi.encodePacked(_secretA1)) ==
                loans[_loanId].secretHashA1 ||
                sha256(abi.encodePacked(_secretA1)) ==
                loans[_loanId].secretHashAutoA1
        );
        require(now > loans[_loanId].loanExpiration);
        require(now <= loans[_loanId].seizureExpiration);
        require(loans[_loanId].state == State.Locked);
        require(loans[_loanId].seizableCollateral > 0);
        uint256 sCollateral = loans[_loanId].seizableCollateral;
        // Zero collateral amount
        loans[_loanId].seizableCollateral = 0;
        // Close loan
        if (loans[_loanId].refundableCollateral == 0) {
            loans[_loanId].state = State.Closed;
        }
        // Refund sColltareal to lender
        loans[_loanId].lender.transfer(sCollateral);
        emit SeizeCollateral(_loanId, loans[_loanId].lender, sCollateral);
    }

    // Events
    event UnlockAndClose(
        uint256 loanId,
        address borrower,
        uint256 sCollateral,
        uint256 rCollateral
    );

    event UnlockRefundableCollateral(
        uint256 loanId,
        address borrower,
        uint256 amount
    );
    event UnlockSeizableCollateral(
        uint256 loanId,
        address borrower,
        uint256 amount
    );
    event SeizeCollateral(uint256 loanId, address lender, uint256 amount);
}
