const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer, user } = await getNamedAccounts();

    await deploy("Factory", {
        from: deployer,
        log: true,
        args: [],
    });
};
module.exports.tags = ["all", "factory"];
