# WavesLPoSDistributer
A revenue distribution tool for Waves nodes

## Installation
First of all, you need to install Node.js (https://nodejs.org/en/) and NPM. Afterwards the installation of the dependencies could be done via:
```sh
mkdir node_modules
npm install
```
Once the dependencies are installed, the script that generates the payouts need to be configured. In order to do so, change the settings of the configuration section:
```sh
/*
    Put your settings here:
        - address: the address of your node that you want to distribute from
        - startBlockHeight: the block from which you want to start distribution for
        - endBlock: the block until you want to distribute the earnings
        - distributableMRTPerBlock: amount of MRT distributed per forged block
        - filename: file to which the payments for the mass payment tool are written
        - node: address of your node in the form http://<ip>:<port
        - percentageOfFeesToDistribute: the percentage of Waves fees that you want to distribute
 */
var config = {
    address: '',
    startBlockHeight: 462000,
    endBlock: 465000,
    distributableMrtPerBlock: 20,
    filename: 'test.json',
    node: 'http://<ip>:6869',
    percentageOfFeesToDistribute: 100
}
```
After a successful configuration of the tool, it could be started with:
```sh
node app.js
```
After the script is finished, the payments that should be distributed to the leasers are written to the file configured by the _config.filename_ setting in the configuration section.
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
node apps.js && node massPayment.js
```