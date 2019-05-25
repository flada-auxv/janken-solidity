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

contract('Janken', (accounts) => {
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
