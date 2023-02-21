// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "./Exchange.sol";

error Factory__InvalidAddress();
error Factory__ExchangeAlreadyExists();

contract Factory {
    mapping(address => address) public tokenToExchange;

    function createExchange(address _tokenAddress) public returns (address) {
        if (_tokenAddress == address(0)) {
            revert Factory__InvalidAddress();
        }

        if (tokenToExchange[_tokenAddress] != address(0)) {
            revert Factory__ExchangeAlreadyExists();
        }

        Exchange exchange = new Exchange(_tokenAddress);
        tokenToExchange[_tokenAddress] = address(exchange);

        return address(exchange);
    }

    function getExchange(address _tokenAddress) public view returns (address) {
        return tokenToExchange[_tokenAddress];
    }
}
