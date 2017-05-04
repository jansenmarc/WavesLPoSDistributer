var request = require('sync-request');
var fs = require('fs');

var config = {
    address: '',
    startBlockHeight: 462000,
    endBlock: 465000,
    distributableMrtPerBlock: 20,
    filename: 'test.json',
    node: 'http://<ip>:6869'
}

var payments = [];
var mrt = [];
var myLeases = {};
var myCanceledLeases = {};
var myForgedBlocks = [];

var start = function() {
    console.log('getting blocks...');
    var blocks = getAllBlocks();
    console.log('preparing datastructures...');
    prepareDataStructure(blocks);

    console.log('preparing payments...');
    myForgedBlocks.forEach(function(block) {
        var blockLeaseData = getActiveLeasesAtBlock(block);
        var activeLeasesForBlock = blockLeaseData.activeLeases;
        var amountTotalLeased = blockLeaseData.totalLeased;

        distribute(activeLeasesForBlock, amountTotalLeased, block);
    });
    pay();
};

var prepareDataStructure = function(blocks) {
    blocks.forEach(function(block) {
        var wavesFees = 0;

        if (block.generator === config.address) {
            myForgedBlocks.push(block);
        }

        block.transactions.forEach(function(transaction) {
            if (transaction.type === 8 && transaction.recipient === config.address) {
                transaction.block = block.height;
                myLeases[transaction.id] = transaction;
            } else if (transaction.type === 9 && myLeases[transaction.leaseId]) {
                transaction.block = block.height;
                myCanceledLeases[transaction.id] = transaction;
            }
            if (!transaction.feeAsset || transaction.feeAsset === '' || transaction.feeAsset === null) {
                wavesFees += transaction.fee;
            }
        });
        block.wavesFees = wavesFees;
    });
};

var getAllBlocks = function() {
    var firstBlockWithLeases = 462000;
    var currentStartBlock = firstBlockWithLeases;
    var blocks = [];

    while (currentStartBlock < config.endBlock) {
        var currentBlocks;

        console.log('getting blocks from ' + currentStartBlock);
        if (currentStartBlock + 99 < config.endBlock) {
            currentBlocks = JSON.parse(request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + (currentStartBlock + 99), {
                'headers': {
                    'Connection': 'keep-alive'
                }
            }).getBody('utf8'));
        } else {
            currentBlocks = JSON.parse(request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + config.endBlock, {
                'headers': {
                    'Connection': 'keep-alive'
                }
            }).getBody('utf8'));
        }
        currentBlocks.forEach(function(block) {
            if (block.height <= config.endBlock) {
                blocks.push(block);
            }
        });

        if (currentStartBlock + 99 < config.endBlock) {
            currentStartBlock += 99;
        } else {
            currentStartBlock = config.endBlock;
        }
    }

    return blocks;
};

var distribute = function(activeLeases, amountTotalLeased, block) {
    var fee = block.wavesFees;

    for (var address in activeLeases) {
        var amount = fee * (activeLeases[address] / amountTotalLeased);

        if (payments[address]) {
            payments[address] += amount;
            mrt[address] += (activeLeases[address] / amountTotalLeased) * config.distributableMrtPerBlock;
        } else {
            payments[address] = amount;
            mrt[address] = (activeLeases[address] / amountTotalLeased) * config.distributableMrtPerBlock;
        }

        console.log(address + ' will receive ' + amount + ' of(' + fee + ') for block: ' + block.height);
    }
};

var pay = function() {
    var transactions = [];
    for (var address in payments) {
        var payment = (payments[address] / Math.pow(10, 8)) - 0.002;
        console.log(address + ' will receive ' + parseFloat(payment).toFixed(8) + ' and ' + parseFloat(mrt[address]).toFixed(2) + ' MRT!');

        if (payment > 0) {
            transactions.push({
                "amount": Number(Math.round(payments[address] - 200000)),
                "fee": 100000,
                "sender": config.address,
                "attachment": "",
                "recipient": address
            });
        }
        if (mrt[address] > 0) {
            transactions.push({
                "amount": Number(Math.round(mrt[address] * Math.pow(10, 2))),
                "fee": 100000,
                "assetId": "4uK8i4ThRGbehENwa6MxyLtxAjAo1Rj9fduborGExarC",
                "sender": config.address,
                "attachment": "",
                "recipient": address
            });
        }
    }
    fs.writeFile(config.filename, JSON.stringify(transactions), {}, function(err) {
        if (!err) {
            console.log('payments written to ' + config.filename + '!');
        } else {
            console.log(err);
        }
    });
};

var getActiveLeasesAtBlock = function(block) {
    var activeLeases = [];
    var totalLeased = 0;
    var activeLeasesPerAddress = {};

    for (var leaseId in myLeases) {
        var currentLease = myLeases[leaseId];

        if (!myCanceledLeases[leaseId] || myCanceledLeases[leaseId].block > block.height) {

            activeLeases.push(currentLease);
            totalLeased = currentLease.amount;
        }
    }
    activeLeases.forEach(function (lease) {
        if (block.height > lease.block + 1000) {
            if (!activeLeasesPerAddress[lease.sender]) {
                activeLeasesPerAddress[lease.sender] = lease.amount;
            } else {
                activeLeasesPerAddress[lease.sender] += lease.amount;
            }
        }
    });
    console.log(activeLeasesPerAddress);

    return { totalLeased: totalLeased, activeLeases: activeLeasesPerAddress };
};

start();
