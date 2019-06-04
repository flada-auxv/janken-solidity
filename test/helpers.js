const { soliditySha3, toBN } = web3.utils;

const HAND = {
  NULL: 0,
  ROCK: 1,
  PAPER: 2,
  SCISSORS: 3,
};

function createEncryptedHash(hand, salt) {
  const hashedSecret = soliditySha3(salt);
  return soliditySha3({ type: 'uint', value: hand }, { type: 'bytes32', value: hashedSecret });
}

async function calcFeeFromTxReceipt(receipt) {
  const tx = await web3.eth.getTransaction(receipt.tx);
  const gasUsed = toBN(receipt.receipt.gasUsed);
  const gasPrice = toBN(tx.gasPrice);
  return gasPrice.mul(gasUsed);
}

module.exports = {
  createEncryptedHash,
  calcFeeFromTxReceipt,
  HAND,
};
