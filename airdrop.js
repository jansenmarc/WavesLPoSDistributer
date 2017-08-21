var syncRequest = require('sync-request');
var fs = require('fs');

/**
 * Put your settings here:
 *     - address: the address of your node that you want to distribute from
 *     - block: the block for which you want to calculate your richlist (only used for distribution to Waves holders)
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
    excludeList: [ ]
};

var total = 0;
var payments = [];
var totalDistributed = 0;

/**
 * This method starts the overall process by first downloading the blocks,
 * preparing the necessary datastructures and finally preparing the payments
 * and serializing them into a file that could be used as input for the
 * masspayment tool.
 */
var start = function() {
    var richlist;

    if (config.assetId && config.assetId.length > 0) {
        richlist= JSON.parse(syncRequest('GET', config.node + '/assets/' + config.assetId + '/distribution', {
            'headers': {
                'Connection': 'keep-alive'
            }
        }).getBody());
    } else {
        richlist= JSON.parse(syncRequest('GET', config.node + '/debug/stateWaves/' + config.block, {
            'headers': {
                'Connection': 'keep-alive'
            }
        }).getBody());
    }

    config.excludeList.forEach(function(excludeAddress) {
        richlist[excludeAddress] = 0;
    });
    total = checkTotalDistributableAmount(richlist);
    startDistribute(richlist);
};

/**
 * Method that sums up the total supply of the reference asset.
 *
 * @param richlist the richlist for the reference asset
 * @returns {number} total supply of the reference asset
 */
var checkTotalDistributableAmount = function(richlist) {
    var total = 0;
    for (var address in richlist) {
        var amount = richlist[address];

        total += amount;
    }

    return total;
};

/**
 * This method starts the distribution process by calculating the amount each address
 * should receive and storing the appropriate transaction.
 *
 * @param richlist the richlist for the reference asset
 */
var startDistribute = function(richlist) {
    var transactions = [];

    for (var address in richlist) {
        var amount = richlist[address];

        var percentage = amount / total;
        var amountToSend = Math.floor(config.amountToDistribute * percentage);


        totalDistributed += Number(amountToSend);
        transactions.push( { address: address, amount: amountToSend });
    }

    sendToRecipients(transactions, 0);
    console.log('totally distributed: ' + totalDistributed);
};

/**
 * Method that writes the payments in the configured file.
 *
 * @param txList list of transactions that should be stored
 * @param index current index of the payments
 */
var sendToRecipients = function(txList, index) {
    var payment = {
        "amount": txList[index].amount,
        "fee": 100000,
        "assetId": config.assetToDistributeId,
        "sender": config.address,
        "attachment": "",
        "recipient": txList[index].address
    };

    if (txList[index].amount > 0) {
        payments.push(payment);
    }
    index++;
    if (index < txList.length) {
        sendToRecipients(txList, index);
    } else {
        fs.writeFile(config.filename, JSON.stringify(payments), {}, function(err) {
            if (err) {
                console.log(err);
            }
        });
    }
};

start();
