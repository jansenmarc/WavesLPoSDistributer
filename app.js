var request = require('sync-request');
var fs = require('fs');

/**
  * Put your settings here:
  *     - address: the address of your node that you want to distribute from
  *     - startBlockHeight: the block from which you want to start distribution for
  *     - endBlock: the block until you want to distribute the earnings
  *     - distributableMRTPerBlock: amount of MRT distributed per forged block
  *     - filename: file to which the payments for the mass payment tool are written
  *     - node: address of your node in the form http://<ip>:<port
  *     - percentageOfFeesToDistribute: the percentage of Waves fees that you want to distribute
 */
var config = {
    address: '',
    startBlockHeight: 462000,
    endBlock: 465000,
    distributableMrtPerBlock: 20,
    filename: 'test.json',
    node: 'http://<ip>:6869',
    percentageOfFeesToDistribute: 100
};

var payments = [];
var mrt = [];
var myLeases = {};
var myCanceledLeases = {};
var myForgedBlocks = [];

/**
  * This method starts the overall process by first downloading the blocks,
  * preparing the necessary datastructures and finally preparing the payments
  * and serializing them into a file that could be used as input for the
  * masspayment tool.
 */
var start = function() {
    console.log('getting blocks...');
    var blocks = getAllBlocks();
    console.log('preparing datastructures...');
    prepareDataStructure(blocks);

    console.log('preparing payments...');
    myForgedBlocks.forEach(function(block) {
        if (block.height >= config.startBlockHeight && block.height <= config.endBlock) {
            var blockLeaseData = getActiveLeasesAtBlock(block);
            var activeLeasesForBlock = blockLeaseData.activeLeases;
            var amountTotalLeased = blockLeaseData.totalLeased;

            distribute(activeLeasesForBlock, amountTotalLeased, block);
        }
    });
    pay();
};

/**
 * This method organizes the datastructures that are later on necessary
 * for the block-exact analysis of the leases.
 *
 *   @param blocks all blocks that should be considered
 */
var prepareDataStructure = function(blocks) {
    blocks.forEach(function(block) {
        var wavesFees = 0;

        if (block.generator === config.address) {
            myForgedBlocks.push(block);
        }

        block.transactions.forEach(function(transaction) {
            // type 8 are leasing tx
            if (transaction.type === 8 && transaction.recipient === config.address) {
                transaction.block = block.height;
                myLeases[transaction.id] = transaction;
            } else if (transaction.type === 9 && myLeases[transaction.leaseId]) { // checking for lease cancel tx
                transaction.block = block.height;
                myCanceledLeases[transaction.leaseId] = transaction;
            }
            // considering Waves fees
            if (!transaction.feeAsset || transaction.feeAsset === '' || transaction.feeAsset === null) {
                wavesFees += transaction.fee;
            }
        });
        block.wavesFees = wavesFees;
    });
};

/**
 * Method that returns all relevant blocks.
 *
 * @returns {Array} all relevant blocks
 */
var getAllBlocks = function() {
    // leases have been resetted in block 462000, therefore, this is the first relevant block to be considered
    var firstBlockWithLeases = 462000;
    var currentStartBlock = firstBlockWithLeases;
    var blocks = [];

    while (currentStartBlock < config.endBlock) {
        var currentBlocks;

        if (currentStartBlock + 99 < config.endBlock) {
            console.log('getting blocks from ' + currentStartBlock + ' to ' + (currentStartBlock + 99));
            currentBlocks = JSON.parse(request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + (currentStartBlock + 99), {
                'headers': {
                    'Connection': 'keep-alive'
                }
            }).getBody('utf8'));
        } else {
            console.log('getting blocks from ' + currentStartBlock + ' to ' + config.endBlock);
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

        if (currentStartBlock + 100 < config.endBlock) {
            currentStartBlock += 100;
        } else {
            currentStartBlock = config.endBlock;
        }
    }

    return blocks;
};

/**
 * This method distributes either Waves fees and MRT to the active leasers for
 * the given block.
 *
 * @param activeLeases active leases for the block in question
 * @param amountTotalLeased total amount of leased waves in this particular block
 * @param block the block to consider
 */
var distribute = function(activeLeases, amountTotalLeased, block) {
    var fee = block.wavesFees;

    for (var address in activeLeases) {
        var share = (activeLeases[address] / amountTotalLeased)
        var amount = fee * share;
        var amountMRT = share * config.distributableMrtPerBlock;

        if (payments[address]) {
            payments[address] += amount * (config.percentageOfFeesToDistribute / 100);
            mrt[address] += amountMRT;
        } else {
            payments[address] = amount * (config.percentageOfFeesToDistribute / 100);
            mrt[address] = amountMRT;
        }

        console.log(address + ' will receive ' + amount + ' of(' + fee + ') and ' + amountMRT + ' MRT for block: ' + block.height + ' share: ' + share);
    }
};

/**
 * Method that creates the concrete payment tx and writes it to the file
 * configured in the config section.
 */
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

/**
 * This method returns (block-exact) the active leases and the total amount
 * of leased Waves for a given block.
 *
 * @param block the block to consider
 * @returns {{totalLeased: number, activeLeases: {}}} total amount of leased waves and active leases for the given block
 */
var getActiveLeasesAtBlock = function(block) {
    var activeLeases = [];
    var totalLeased = 0;
    var activeLeasesPerAddress = {};

    for (var leaseId in myLeases) {
        var currentLease = myLeases[leaseId];

        if (!myCanceledLeases[leaseId] || myCanceledLeases[leaseId].block > block.height) {
            activeLeases.push(currentLease);
        }
    }
    activeLeases.forEach(function (lease) {
        if (block.height > lease.block + 1000) {
            if (!activeLeasesPerAddress[lease.sender]) {
                activeLeasesPerAddress[lease.sender] = lease.amount;
            } else {
                activeLeasesPerAddress[lease.sender] += lease.amount;
            }

            totalLeased += lease.amount;
        }
    });

    return { totalLeased: totalLeased, activeLeases: activeLeasesPerAddress };
};

start();
