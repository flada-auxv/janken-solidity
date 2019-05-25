const Janken = artifacts.require("Janken");

const HAND = {
  ROCK: 0,
  PAPER: 1,
  SCISSORS: 2,
}

const RESULT = {
  DRAW: 0,
  WIN: 1,
  LOSS: 2,
}

let instance;

contract('Janken', (accounts) => {
  const deploy = async () => {
    instance = await Janken.new();
  };

  describe('createGame', () => {
    beforeEach(deploy);

    context('with sending a few ETH', () => {
      it('should create new game and save deposit amount', async () => {
        await instance.createGame({from: accounts[0], value: 10});
        assert.equal(1, await instance.gameId.call());

        const firstGame = await instance.games.call(1);
        assert.equal(accounts[0], firstGame.owner);
        assert.equal(10, firstGame.requiredDeposit);

        await instance.createGame({from: accounts[1], value: 42});
        assert.equal(2, await instance.gameId.call());

        const secondGame = await instance.games.call(2);
        assert.equal(accounts[1], secondGame.owner);
        assert.equal(42, secondGame.requiredDeposit);
      });
    });

    context('without sending any ETH', () => {
      it('should revert', async () => {
        await instance.createGame();
        const createdGame = await instance.games(1);
        assert.equal(accounts[0], createdGame.owner);
        assert.equal(0, createdGame.requiredDeposit); // FIXME!!
      });
    })
  });

  describe('startSolo', () => {
    it('should return the code of draw', async () => {
      const instance = await Janken.deployed();
      const result = await instance.startSolo.call(HAND.ROCK);

      assert.equal(result, RESULT.DRAW);
    });

    it('should return the code of loss', async () => {
      const instance = await Janken.deployed();
      const result = await instance.startSolo.call(HAND.SCISSORS);

      assert.equal(result, RESULT.LOSS);
    });

    it('should return the code of win', async () => {
      const instance = await Janken.deployed();
      const result = await instance.startSolo.call(HAND.PAPER);

      assert.equal(result, RESULT.WIN);
    });
  })
});
