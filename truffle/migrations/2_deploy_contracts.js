const Janken = artifacts.require('Janken');

module.exports = (deployer) => {
  deployer.deploy(Janken);
};
