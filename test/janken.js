const Janken = artifacts.require("Janken");
const truffleAssert = require('truffle-assertions');

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
        await truffleAssert.reverts(
          instance.createGame(),
          "deposit must be greater than 0"
        );
      });
    });
  });

  describe('joinGame', () => {
    beforeEach(async () => {
      await deploy().then(async () => {
        await instance.createGame({from: accounts[0], value: 10})
      });
    });

    context('when depositing the same amount of requiredDeposit', () => {
      it('should update the game', async () => {
        await instance.joinGame(1, {from: accounts[1], value: 10});

        const game = await instance.games.call(1);
        assert.equal(accounts[1], game.opponent);
      });
    });

    context('when specified wrong gameId', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.joinGame(42, {from: accounts[1], value: 10}),
          "the game does not found"
        );
      });
    });

    context('when depositing the not same amount of requiredDeposit', () => {
      it('should revert', async () => {
        await truffleAssert.reverts(
          instance.joinGame(1, {from: accounts[1], value: 5}),
          "deposit amount must be equal onwer's amount"
        );
      });
    });
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
  });
});
