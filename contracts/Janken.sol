pragma solidity >=0.5.0 <0.6.0;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract Janken {
    using SafeMath for uint256;

    struct Game {
        GameStatus status;
        uint256 deposit;
        address host;
        address opponent;
        bytes32 hostEncryptedHand;
        bytes32 opponentEncryptedHand;
        Hand hostDecryptedHand;
        Hand opponentDecryptedHand;
        bytes32 hostSecret;
        bytes32 opponentSecret;
        uint256 commitmentDeadline;
        uint256 revelationDeadline;
        mapping (address => uint256) allowedWithdrawal;
    }

    enum Hand { Null, Rock, Paper, Scissors }
    enum Result { Null, Draw, Win, Loss }
    enum GameStatus {
        DoesNotExist,
        Created,
        Started,
        AcceptingWithdrawal,
        Finished
    }

    uint256 public gameId = 0;
    uint256 public defaultWaitingWindow = 1 days;
    mapping (uint256 => Game) public games;

    constructor() public payable {}
    function () external payable {}

    function createGame(bytes32 encryptedHand) public payable {
        require(msg.value > 0, "deposit must be greater than 0");

        gameId += 1;
        Game storage game = games[gameId];
        game.host = msg.sender;
        game.deposit = msg.value;
        game.hostEncryptedHand = encryptedHand;
        // solium-disable-next-line security/no-block-members
        game.commitmentDeadline = block.timestamp.add(defaultWaitingWindow);
        game.status = GameStatus.Created;
    }

    function joinGame(uint256 id, bytes32 encryptedHand) public payable {
        Game storage game = games[id];

        require(game.status != GameStatus.DoesNotExist, "the game does not exist");
        gameStatusShouldBe(game, GameStatus.Created);
        require(msg.value == game.deposit, "deposit amount must be equal the game host's amount");
        require(hasNotOver(game.commitmentDeadline), "the game was closed for participation");

        game.opponent = msg.sender;
        game.opponentEncryptedHand = encryptedHand;
        // solium-disable-next-line security/no-block-members
        game.revelationDeadline = block.timestamp.add(defaultWaitingWindow);
        game.status = GameStatus.Started;
    }

    function revealHand(uint256 id, uint256 n, bytes32 secret) public {
        Game storage game = games[id];

        gameStatusShouldBe(game, GameStatus.Started);
        restrictAccessOnlyParticipants(game);

        Hand hand = convertIntToHand(n);
        bytes32 eHand = encryptedHand(n, secret);

        if (msg.sender == game.host) {
            require(game.hostEncryptedHand == eHand, "commit verification is failed");
            game.hostDecryptedHand = hand;
            game.hostSecret = secret;
        } else if (msg.sender == game.opponent) {
            require(game.opponentEncryptedHand == eHand, "commit verification is failed");
            game.opponentDecryptedHand = hand;
            game.opponentSecret = secret;
        }

        if (game.hostDecryptedHand != Hand.Null && game.opponentDecryptedHand != Hand.Null) {
            Result result = judge(game.hostDecryptedHand, game.opponentDecryptedHand);
            if (result == Result.Win) {
                game.allowedWithdrawal[game.host] = game.deposit.mul(2);
            } else if (result == Result.Loss) {
                game.allowedWithdrawal[game.opponent] = game.deposit.mul(2);
            } else if (result == Result.Draw) {
                game.allowedWithdrawal[game.host] = game.deposit;
                game.allowedWithdrawal[game.opponent] = game.deposit;
            } else {
                revert("unreachable!");
            }
            game.status = GameStatus.AcceptingWithdrawal;
        }
    }

    function withdraw(uint256 id) public {
        Game storage game = games[id];

        gameStatusShouldBe(game, GameStatus.AcceptingWithdrawal);
        restrictAccessOnlyParticipants(game);

        uint256 allowedAmount = game.allowedWithdrawal[msg.sender];
        if (allowedAmount != 0) {
            game.allowedWithdrawal[msg.sender] = 0;
            msg.sender.transfer(allowedAmount);
        } else {
            revert("you aren't eligible to withdraw");
        }
    }

    function rescue(uint256 id) public {
        Game memory game = games[id];

        restrictAccessOnlyParticipants(game);

        if (game.status == GameStatus.Created && msg.sender == game.host && hasOver(game.commitmentDeadline)) {
            // TODO: do not rescue twice
            msg.sender.transfer(game.deposit);
        } else if (game.status == GameStatus.Started && isRevealed(game, msg.sender) && hasOver(game.revelationDeadline)) {
            // TODO: do not rescue twice
            msg.sender.transfer(game.deposit);
        } else {
            revert("invalid rescue");
        }
    }

    function getAllowedWithdrawalAmount(uint256 id, address addr) public view returns (uint256) {
        Game storage game = games[id];
        return game.allowedWithdrawal[addr];
    }

    function judge(Hand hand1, Hand hand2) public pure returns (Result) {
        if (hand1 == hand2) {
            return Result.Draw;
        } else if (
         hand1 == Hand.Rock && hand2 == Hand.Scissors ||
         hand1 == Hand.Paper && hand2 == Hand.Rock ||
         hand1 == Hand.Scissors && hand2 == Hand.Paper
        ) {
            return Result.Win;
        } else if (
         hand1 == Hand.Rock && hand1 == Hand.Paper ||
         hand1 == Hand.Paper && hand2 == Hand.Scissors ||
         hand1 == Hand.Scissors && hand2 == Hand.Rock
        ) {
            return Result.Loss;
        } else {
            revert("unreachable!");
        }
    }

    function hasOver(uint256 time) private view returns(bool) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp > time;
    }

    function hasNotOver(uint256 time) private view returns(bool) {
        return !hasOver(time);
    }

    function isRevealed(Game memory game, address addr) private view returns(bool) {
        if (addr == game.host) {
            return game.hostDecryptedHand != Hand.Null;
        } else if (addr == game.opponent) {
            return game.opponentDecryptedHand != Hand.Null;
        } else {
            revert("Unknown player");
        }
    }

    function restrictAccessOnlyParticipants(Game memory game) private view {
        require(msg.sender == game.host || msg.sender == game.opponent, "forbidden");
    }

    function gameStatusShouldBe(Game memory game, GameStatus status) private pure {
        require(game.status == status, "status is invalid");
    }

    function convertIntToHand(uint256 n) private pure returns (Hand) {
        if (n == 0) {
            return Hand.Null;
        } else if (n == 1) {
            return Hand.Rock;
        } else if (n == 2) {
            return Hand.Paper;
        } else if (n == 3) {
            return Hand.Scissors;
        } else {
            revert("Unknown value");
        }
    }

    function encryptedHand(uint256 n, bytes32 secret) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(n, secret));
    }
}
