const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    const token = await ethers.getContract("ERC20FixedSupply");
    await deploy("Exchange", {
        from: deployer,
        log: true,
        args: [token.address],
    });
};
module.exports.tags = ["all", "exchange"];
