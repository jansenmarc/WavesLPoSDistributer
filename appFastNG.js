//var request = require('sync-request');
var request = require('request');
var LineReaderSync = require("line-reader-sync")

var fs = require('fs');

/**
 * Put your settings here:
 *     - address: the address of your node that you want to distribute from
 *     - alias: the alias of the node address
 *     - startBlockHeight: the block from which you want to start distribution for
 *     - endBlock: the block until you want to distribute the earnings
 *     - firstBlockWithLeases: the block where you received the first lease
 *     - distributableMRTPerBlock: amount of MRT distributed per forged block
 *     - filename: file to which the payments for the mass payment tool are written
 *     - node: address of your node in the form http://<ip>:<port
 *     - percentageOfFeesToDistribute: the percentage of Waves fees that you want to distribute
 *     - blockStorage: file for storing block history
 */

var config = {
    address: '3P2HNUd5VUPLMQkJmctTPEeeHumiPN2GkTb',
    alias: 'WavesGo',
    startBlockHeight: 3178000,
    endBlock: 3178907,
    firstBlockWithLeases: 462000,
    distributableMrtPerBlock: 0,
    filename: 'payments.json',
    node: 'http://node.wavesbi.com:6869',
    percentageOfFeesToDistribute: 90,
    blockStorage: 'blocks.json'
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
async function start() {
    console.log('getting blocks...');
    var blocks = await getAllBlocks();
    if (fs.existsSync(config.blockStorage)) {
        fs.unlinkSync(config.blockStorage);
    }
    console.log('preparing datastructures...');
    prepareDataStructure(blocks);
    blocks.forEach(function(block) {
        var transactions = [];

        if (block.height < config.startBlockHeight) {
            block.transactions.forEach(function(tx) {
                if (tx.type === 8 || tx.type === 9) {
                    transactions.push(tx);
                }
            });
        } else {
            transactions = block.transactions;
        }

        var blockInfo = {
            height: block.height,
            generator: block.generator,
            wavesFees: block.wavesFees,
            previousBlockWavesFees: block.previousBlockWavesFees,
            transactions: transactions
        };
        if (block.height >= 1740000) {
            blockInfo.reward = block.reward;
        }
        fs.appendFileSync(config.blockStorage, JSON.stringify(blockInfo) + '\n');
    });
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
    var previousBlock;
    blocks.forEach(function(block) {
        var wavesFees = 0;

        if (block.generator === config.address) {
            myForgedBlocks.push(block);
        }

        block.transactions.forEach(function(transaction) {
            // type 8 are leasing tx
            if (transaction.type === 8 && (transaction.recipient === config.address || transaction.recipient === "address:" + config.address || transaction.recipient === 'alias:W:' + config.alias)) {
                transaction.block = block.height;
                myLeases[transaction.id] = transaction;
            } else if (transaction.type === 9 && myLeases[transaction.leaseId]) { // checking for lease cancel tx
                transaction.block = block.height;
                myCanceledLeases[transaction.leaseId] = transaction;
            }
            // considering Waves fees
            if (!transaction.feeAsset || transaction.feeAsset === '' || transaction.feeAsset === null) {
                if (transaction.fee < 10 * Math.pow(10, 8)) {
                    wavesFees += transaction.fee;
                }
            } else if (block.height > 1090000 && (transaction.type === 4 || transaction.type === 16)) {
                wavesFees += 100000;
            }
        });
        if (previousBlock) {
            block.previousBlockWavesFees = previousBlock.wavesFees;
        }
        block.wavesFees = wavesFees;
        previousBlock = block;
    });
};

async function getBlocks(from, to) {
    return new Promise(function(resolve, reject){
        request(config.node + '/blocks/seq/' + from + '/' + to, function (error, response, body) {
            // in addition to parsing the value, deal with possible errors
            if (error) return reject(error);
            try {
                // JSON.parse() can throw an exception if not valid JSON
                resolve(JSON.parse(body));
            } catch(e) {
                reject(e);
            }
        });
    });
};

/**
 * Method that returns all relevant blocks.
 *
 * @returns {Array} all relevant blocks
 */
async function getAllBlocks() {
    // leases have been resetted in block 462000, therefore, this is the first relevant block to be considered
    var firstBlockWithLeases = config.firstBlockWithLeases;
    var currentStartBlock = firstBlockWithLeases;
    var blocks = [];
    var steps = 100;

    if (fs.existsSync(config.blockStorage)) {
        lrs = new LineReaderSync(config.blockStorage);

        var lineFound = true;
        while(lineFound){
            var line = lrs.readline()
            if(line){
                blocks.push(JSON.parse(line));
            } else {
                lineFound = false;
            }
        }

        currentStartBlock = blocks[blocks.length - 1].height + 1;
        console.log('retrieved blocks from ' + blocks[0].height + ' to ' + (currentStartBlock - 1));
    }

    while (currentStartBlock < config.endBlock) {
        var currentBlocks;

        if (currentStartBlock + (steps - 1) < config.endBlock) {
            console.log('getting blocks from ' + currentStartBlock + ' to ' + (currentStartBlock + (steps - 1)));
            //var res = request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + (currentStartBlock + (steps - 1)));
            /*, {
                //'headers': {
                //    'Connection': 'keep-alive'
                //}
            });*/
            var blocksJSON = await getBlocks(currentStartBlock, currentStartBlock + (steps - 1));
            currentBlocks = blocksJSON;
        } else {
            console.log('getting blocks from ' + currentStartBlock + ' to ' + config.endBlock);
            currentBlocks = JSON.parse(request('GET', config.node + '/blocks/seq/' + currentStartBlock + '/' + config.endBlock, {
                'headers': {
                    'Connection': 'keep-alive'
                }
            }).getBody('utf8'));
        }
        if (currentBlocks.length > 0) {
            currentBlocks.forEach(function(block) {
                if (block.height <= config.endBlock) {
                    blocks.push(block);
                }
            });

            if (currentStartBlock + steps < config.endBlock) {
                currentStartBlock += steps;
            } else {
                currentStartBlock = config.endBlock;
            }
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
var distribute = function(activeLeases, amountTotalLeased, block, previousBlock) {
    var fee;

    if (block.height >= 1740000) {
        fee = block.wavesFees * 0.4 + block.previousBlockWavesFees * 0.6 + block.reward;
    } else if (block.height >= 805000) {
        fee = block.wavesFees * 0.4 + block.previousBlockWavesFees * 0.6;
    } else {
        fee = block.wavesFees
    }

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
    }
};

/**
 * Method that creates the concrete payment tx and writes it to the file
 * configured in the config section.
 */
var pay = function() {
    var transactions = [];
    for (var address in payments) {
        var payment = (payments[address] / Math.pow(10, 8));

        if (payment > 0) {
            transactions.push({
                "amount": Number(Math.round(payments[address])),
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
