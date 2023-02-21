const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy("ERC20FixedSupply", {
        from: deployer,
        log: true,
        args: ["Doge", "Doge", "10000"],
    });
};
module.exports.tags = ["all", "token"];
