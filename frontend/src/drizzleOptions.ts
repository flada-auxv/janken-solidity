import Janken from '../../truffle/build/contracts/Janken.json'

const options = {
  web3: {
    block: false,
    fallback: {
      type: "ws",
      url: "ws://127.0.0.1:8545",
    },
  },
  contracts: [Janken],
  events: {},
};

export default options;
