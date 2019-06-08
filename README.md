# janken-solidity

## operation flow

### create a game by Player1(the host)

Generate a secret in a cryptographically secure way and hash it with your chosen hand. You need to remember the secret to prove correctness later. Also, need to send ether with that transaction as a deposit.

```js
createGame(hostEncryptedHand, { value: web3.utils.toWei('1'), from: host })
```

#### how to generate encrypted hand

```js
// chose your hand in Rock: 1, Paper: 2, Scissors: 3
const hand = 1;
// this `secret` is necessary for a step that reveals your hand so you need to make a note.
const secret = web3.utils.soliditySha3({ type: 'bytes32', value: crypto.randomBytes(32).toString('hex') });
const encryptedHand = web3.utils.soliditySha3({ type: 'uint', value: hand }, { type: 'bytes32', value: secret });
```

### join the game by Player2(the opponent)

Commit the hand in the same way as the host. The transaction requires you to send the same amount of ether as host's deposit.

```js
joinGame(gameId, opponentEncryptedHand, { value: web3.utils.toWei('1'), from: opponent })
```

#### note

You can join a game only if commitmentDeadline is not past.

### reveal the hand you commited before

Reveal the not encrypted hand by sending it together with the secret used for encryption before.

```js
revealHand(gameId, hostHand, hostSecret, { from: host })
revealHand(gameId, opponentHand, opponentSecret, { from: opponent })
```

#### note

If you do not reveal by revelationDeadline, you may lose money by running rescue on your opponent.

### withdraw funds deposited by the two (if you win!)

```js
withdraw(gameId, { from: opponent })
```

### rescue the deposit (optional)

There are two situations in which you can execute `resuce()`.
The first situation is when you are a host of a game that no one has joined by commitmentDeadline.
The second one is when you reveal a hand but your opponent doesn't reveal by revelationDeadline.
commitmentDeadLine and revelationDeadline are set a term of a day in default.

```js
rescue(gameId, { from: host })
```

See [run.js](run.js) for more details.

## run through in your console

```js
npx truffle develop

truffle(develop)> migrate --reset
truffle(develop)> exec scripts/run.js
Using network 'develop'.

host =>
  handInt: 1,
  encryptedHand: 0xf307279d3fe9b98cbf0514a3de81e4e2c7465ea4c3893527ec105629e31f4959,
  secret: 0xbf5631c9938a1638afad2e1ba2439fe8b7e7d6410957a05c1b60ed8536373203
gameId =>  1
opponent =>
  handInt: 2,
  encryptedHand: 0x9b9d9d35bfd420b9c7e860583927b1773583caca81c75b0326d48ea2ecd66cd9,
  secret: 0x740ce4b15f0ed6433d4d981f33ba2b3bff4d32f2b9cb3eb277b005bed19519fc
result =>
    beforeBalance: 98995848940000000000,
    afterBalance: 100995330380000000000,
    delta: 1999481440000000000,
    fee: 518560000000000,
    deltaWithoutFee: 1998962880000000000
```
