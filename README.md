# WavesLPoSDistributer
A revenue distribution tool for Waves nodes

## Installation
First of all, you need to install Node.js (https://nodejs.org/en/) and NPM. Afterwards the installation of the dependencies could be done via:
```sh
mkdir node_modules
npm install
```
Once the dependencies are installed, the script that generates the payouts need to be configured. In order to do so:

copy config.json.sample config.json

, change the settings of the configuration file:
```sh
/**
 * Put your settings here:
 *     - address: the address of your node that you want to distribute from
 *     - alias: the alias of the node address
 *     - startBlockHeight: the block from which you want to start distribution for
 *     - firstBlockWithLeases: the block where you received the first lease
 *     - endBlock: the block until you want to distribute the earnings
 *     - distributableMRTPerBlock: amount of MRT distributed per forged block
 *     - filename: file to which the payments for the mass payment tool are written
 *     - node: address of your node in the form http://<ip>:<port
 *     - percentageOfFeesToDistribute: the percentage of Waves fees that you want to distribute
 *     - blockStorage: file for storing block history
 */

{
"address":"",
"alias":"",
"startBlockHeight":462000,
"firstBlockWithLeases":463000,
"endBlock":465000,
"distributableMRTPerBlock":0,
"filename":"payments.json",
"node":"http://<ip>:6869",
"percentageOfFeesToDistribute":90,
"blockStorage":"blocks.json"
}

```
After a successful configuration of the tool, it could be started with:
```sh
node appFastNG.js
```
After the script is finished, the payments that should be distributed to the leasers are written to the file configured by the filename setting in the configuration file.

## Doing the payments

For the actual payout, the masspayment tool needs to be run. Before it could be started, it also needs to be configured:
```sh
/*
 Put your settings here:
 - filename: file to which the payments for the mass payment tool are written
 - node: address of your node in the form http://<ip>:<port>
 - apiKey: the API key of the node that is used for distribution
 */
var config = {
    filename: 'test.json',
    node: 'http://<ip>:<port>',
    apiKey: 'put the apiKey for the node here'
},
```
After configuration, the script could be started with:
```sh
node massPayment.js
```
## Why two seperate tools?
We decided to use two seperate tools since this allows for additional tests of the payments before the payments are actually executed. On the other hand, it does not provide any drawback since both scripts could also be called directly one after the other with:
```sh
node appFastNG.js && node massPayment.js
```
We strongly recommend to check the payments file before the actual payments are done. In order to foster these checks, we added the _checkPaymentsFile.js_ tool that could need to be configured as follows:
```sh
/**
 * Put your settings here:
 *     - filename: file to check for payments
 *     - node: address of your node in the form http://<ip>:<port
 */
var config = {
    filename: '',
    node: 'http://<ip>:<port>'
};
```
After the configuration the checking tool could be executed with:
```sh
node checkPaymentsFile.js
```
The output of the tool should provide an information about how man tokens of each asset will be paid by the payment script. After checking this information, you should be ready to execute the payments.
## Airdrops
Payments for airdrops could be calculated by using the _airdrop.js_ script. Configuration works pretty much the same way as for the other scripts:
```sh
/**
 * Put your settings here:
 *     - address: the address of your node that you want to distribute from
 *     - block: the block for which you want to calculate your richlist
 *     - total: amount of supply for the reference asset
 *     - amountToDistribute: amount of tokens that you want to distribute (have decimals in mind here...)
 *     - assetId: id of the reference asset
 *     - assetToDistributeId: id of the asset you want to airdrop
 *     - filename: name of the file the payments are written to
 *     - node: address of your node in the form http://<ip>:<port
 *     - excludeList: a list of addresses that should not receive the airdrop, e.g., exchanges...
 */
var config = {
    address: '',
    block: 500859,
    amountToDistribute: 35000000,
    assetId: '',
    assetToDistributeId: '',
    filename: '',
    node: '',
    excludeList: []
};
```
Afterwards, the script could be started with:
```sh
node airdrop.js
```
## Mass transfer payouts
The generated payout files could now also be used as inputs for mass transfer transactions. this provides a faster and cheaper way to distribute funds.
```sh
python massPayment.py
```
Configuration is done via the configuration section:
```sh
'''
    Configuration section:
        privateKey: the private key of the address you want to distribute from
        file: the calculated payout file
        timeout: timeout between requests send to nodes in ms
        assetId: the id of the asset you want to distribute, '' for Waves
        nodes: a list of nodes to which the signed transactions should be send to, in the format: http://host:port
'''
config = {
	'privateKey': '',
	'file': '',
	# timeout between requests in ms
	'timeout': 20,
	'assetId': '',
	'nodes': [
	]
}
```
## Disclaimer
Please always test your resulting payment scripts, e.g., with the _checkPaymentsFile.js_ script!
