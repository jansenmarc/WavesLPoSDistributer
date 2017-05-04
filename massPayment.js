var fs = require('fs');
var request = require('request');

var filename = '';
var node = '';
var apiKey = '';

var start = function() {
    var paymentsString = fs.readFileSync(filename).toString();
    var payments = JSON.parse(paymentsString);

    doPayment(payments, 0);
};

var doPayment = function(payments, counter) {
    var payment = payments[counter];
    setTimeout(function() {
        request.post({ url: node + '/assets/transfer', json: payment, headers: { "Accept": "application/json", "Content-Type": "application/json", "api_key": apiKey } }, function(err, response, body) {
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