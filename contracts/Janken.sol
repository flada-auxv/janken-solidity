pragma solidity >=0.5.0 <0.6.0;

contract Janken {
  enum Hand { Rock, Paper, Scissors }
  enum Result { Draw, Win, Loss }

  uint public gameId = 0;
  mapping (uint => Game) public games;
  struct Game {
    GameStatus status;
    uint requiredDeposit;
    address owner;
    address opponent;
    uint256 owner_encrypted_hand;
    uint256 opponent_encrypted_hand;
    uint256 owner_decrypted_hand;
    uint256 opponent_decrypted_secret;
    uint256 owner_secret;
    uint256 opponent_secret;
  }
  enum GameStatus {
    DoesNotExist,
    GameCreated,
    GameStarted,
    OwnerCommited,
    OpponentCommited,
    OwnerRevealed,
    OpponentRevealed,
    Finished
  }

  function startSolo(Hand hand) public pure returns (Result) {
    return judge(hand, Hand.Rock);
  }

  function createGame() public payable {
    require(msg.value > 0, "deposit must be greater than 0");

    gameId += 1;
    Game storage game = games[gameId];
    game.owner = msg.sender;
    game.requiredDeposit = msg.value;
    game.status = GameStatus.GameCreated;
  }

  function joinGame(uint id) public payable {
    Game storage game = games[id];

    require(game.status != GameStatus.DoesNotExist, "the game does not found");
    require(game.status == GameStatus.GameCreated, "status is invalid");
    require(msg.value == game.requiredDeposit, "deposit amount must be equal onwer's amount");

    game.opponent = msg.sender;
    game.status = GameStatus.GameStarted;
  }

  // function commitHand(gameId, hashedHand) {}

  // function revealHand(gameId, secret, hand) {}

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
}
