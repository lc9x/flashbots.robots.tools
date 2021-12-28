#!/usr/bin/env node

//recue ETH token
const Web3 = require('web3');
const ethers = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

const web3URL = 'https://...'; //Ethereum RPC
const relayURL = 'https://...'; //flashbots relay RPC
const netInfo = {
    chainId: 1,
    name: 'Ethereum Mainnet'
};
const provider = new ethers.providers.JsonRpcProvider(web3URL, netInfo);
const authWallet = new ethers.Wallet('0x0000000000000000000000000000000000000000000000000000000000000001');

const walletPrivateKey1 = Buffer.from('0x...'); //wallet have some ETH
const walletPrivateKey2 = Buffer.from('0x...'); //wallet contain token
const tokenContractAddress = '0x...';
const transferTokenGasLimit = '70000';
const gwei = '60'; //should be bigger than Current gwei, https://etherscan.io/gastracker

//amount of ETH to send: 60 * 70000 * 1e9 / 1e18 = 0.0042 ETH
//amount of ETH to be paid: 0.0042 + 60 * 21000 * 1e9 / 1e18 = 0.00546 ETH 

const web3 = new Web3(web3URL);
const wallet1 = web3.eth.accounts.privateKeyToAccount(walletPrivateKey1.toString());
const wallet2 = web3.eth.accounts.privateKeyToAccount(walletPrivateKey2.toString());

console.log('wallet1 address: ', wallet1.address);
console.log('wallet2 address: ', wallet2.address);

const minABI = [{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}];
const contract = new web3.eth.Contract(minABI, tokenContractAddress);

//get balance of token in wallet2
contract.methods.balanceOf(wallet2.address).call().then(function(tokenBalance){
	var balance = Web3.utils.toBN(tokenBalance);
	if (balance.lte(Web3.utils.toBN(0))){
		return console.log('Wallet2 with balance of token equal to 0');
	}
	
	const gasPrice = Web3.utils.toWei(gwei, 'gwei');
	const value = gasPrice.mul(Web3.utils.toBN(transferTokenGasLimit));
	
	//send some ETH to wallet2
	const txObject1 = {
		to: wallet2.address,
		value: value,
		gas: '21000',
		gasPrice: gasPrice
	};
	
	//transfer token to wallet1
	const encoded = contract.methods.transfer(wallet1.address, balance).encodeABI();
	const txObject2 = {
		to: tokenContractAddress,
		value: 0,
		data: encoded,
		gas: transferTokenGasLimit,
		gasPrice: gasPrice
	};
	
	wallet1.signTransaction(txObject1).then(function(tx1){
		
		wallet2.signTransaction(txObject2).then(function(tx2){
			
			FlashbotsBundleProvider.create(provider, authWallet, relayURL).then(function(flashbotsProvider){
				
				const signedTxs = [{
					signedTransaction: tx1.rawTransaction
				}, {
					signedTransaction: tx2.rawTransaction
				}];
				
				flashbotsProvider.signBundle(signedTxs).then(function(signedTransactions){
					
					web3.eth.getBlockNumber().then(function(blockNumber){
						
						flashbotProvider.simulate(signedTransactions, blockNumber + 1).then(function(simulation){
                            console.log('simulation: ', simulation);
                            
                            var isError = "error" in simulation || !simulation.results;
                            
                            !isError && simulation.results.forEach(function(r){
                                if (!isError && r.error){
                                    isError = r.error || true;
                                }
                            });
                            
                            if (!isError){
                            	[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                                .forEach(function(i){
                                    var bundleSubmission = flashbotProvider.sendRawBundle(signedTransactions, blockNumber + i);
                                    console.log('bundle submission: ', blockNumber + i, i);
                                });
                            }
						});
                    });
				})
			});
		});
	});
});
