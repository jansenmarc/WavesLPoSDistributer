var fs = require('fs');
var request = require('request');

/**
 * Put your settings here:
 *     - filename: file to check for payments
 *     - node: address of your node in the form http://<ip>:<port
 */
var config = {
    filename: 'test.json',
    node: 'http://5.189.136.6:6869'
};

var payments;
var assets = {};
var assetsFound = 0;

/**
 * Method that starts the checking process.
 */
var start = function() {
    var paymentsString = fs.readFileSync(config.filename).toString();
    payments = JSON.parse(paymentsString);
    console.log(payments.length + ' payments found!');

    payments.forEach(function(payment) {
        if (payment.assetId) {
            if (!assets[payment.assetId]) {
                assetsFound++;
                assets[payment.assetId] = {
                    amount: payment.amount,
                    decimals: 0,
                    name: ''
                };
            } else {
                assets[payment.assetId].amount += payment.amount;
            }
        } else {
            if (!assets['Waves']) {
                assetsFound++;
                assets['Waves'] = {
                    amount: payment.amount,
                    decimals: 8,
                    name: 'Waves'
                };

            } else {
                assets['Waves'].amount += payment.amount;
            }
        }
    });
    addAssetInfo(assets, function() {
        for (var assetId in assets) {
            var asset = assets[assetId];

            console.log((asset.amount / Math.pow(10, asset.decimals)) + ' of ' + asset.name + ' will be paid!');
        }
    });
};

/**
 * Method that adds infor like decimals and name to an asset.
 *
 * @param assets The asset that have been found
 * @param cb The callback that gets executed after all infos are added
 */
var addAssetInfo = function(assets, cb) {
    var counter = 0;

    for (var assetId in assets) {
        if (assetId !== 'Waves') {
            request.get(config.node + '/transactions/info/' + assetId, function(err, response, body) {
                if (!err) {
                    var asset = JSON.parse(body);

                    counter++;
                    assets[asset.assetId].decimals = asset.decimals;
                    assets[asset.assetId].name = asset.name;

                    if (assetsFound === counter) {
                        cb();
                    }
                }
            });
        } else {
            counter++;

            if (assetsFound === counter) {
                cb();
            }
        }
    }
};

start();
