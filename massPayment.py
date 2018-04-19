import json
import time
import pywaves as pw
import time

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

startTime = time.time()
totalPayments = 0
paid = 0
counter = 0

pw.setNode(config['nodes'][1], 'mainnet')
print(config['nodes'][0])
address = pw.Address(privateKey = config['privateKey'])

'''
    Method that actually generates the signed transactions and sends them to
    the configured nodes.
'''
def pay(batch):
	global paid
	global address
	global counter

	node = config['nodes'][counter % len(config['nodes'])]
	counter += 1
	pw.setNode(node, 'mainnet')

	print('number of payouts in batch: ' + str(len(batch)))
	print('batch: ' + str(batch))
	print('paid from address: ' + address.address)
	print('paid via node: ' + node)
	paid += len(batch)
	if (config['assetId'] != ''):
		print('paying in asset: ' + config['assetId'])
		tx = address.massTransferAssets(batch, pw.Asset(config['assetId']))
	else:
		print('paying in Waves!')
		tx = address.massTransferWaves(batch)
	print('tx: ' + str(tx))

with open(config['file']) as json_data:
	payments = json.load(json_data)
	currentBatch = []

	totalPayments = len(payments)
	for payment in payments:
		if (len(currentBatch) < 100):
			if (('assetId' in payment and payment['assetId'] != config['assetId']) or ('assetId' not in payment and config['assetId'] != '')):
				print('transaction with wrong assetId found!')
				exit()
			currentBatch.append({ 'recipient': payment['recipient'], 'amount': payment['amount'] })
		if (len(currentBatch) == 100):
			pay(currentBatch)
			currentBatch = []
			time.sleep(config['timeout'] / 1000)
	pay(currentBatch)
	print('planned payouts: ' + str(totalPayments) + ', paid: ' + str(paid))
	usedTime = time.time() - startTime
	print('time: ' + str(usedTime) + ' (' + str(totalPayments / usedTime) + 'transfers/s)')
