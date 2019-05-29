const Janken = artifacts.require('Janken');
module.exports = function (deployer) {
  deployer.deploy(Janken);
};
