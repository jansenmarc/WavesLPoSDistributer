var fs = require('fs');
var request = require('request');

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

var start = function() {
    var paymentsString = fs.readFileSync(config.filename).toString();
    var payments = JSON.parse(paymentsString);

    doPayment(payments, 0);
};

var doPayment = function(payments, counter) {
    var payment = payments[counter];
    setTimeout(function() {
        request.post({ url: config.node + '/assets/transfer', json: payment, headers: { "Accept": "application/json", "Content-Type": "application/json", "api_key": config.apiKey } }, function(err) {
            if (err) {
                console.log(err);
            } else {
                console.log(counter + ' send ' + payment.amount + ' of ' + payment.assetId + ' to ' + payment.recipient + '!');
                counter++;
                if (counter < payments.length) {
                    doPayment(payments, counter);
                }
            }
        });
    }, 1000);
};

start();