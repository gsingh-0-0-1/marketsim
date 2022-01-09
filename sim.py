import numpy as np
import matplotlib.pyplot as plt

START_PRICE = 100.0

PRICES = [START_PRICE]

SALES = []
PRICE_LISTINGS = []

ID_LISTINGS = {}

LAST_SALE_ID = 0

TOTAL_SHARES = 0

#PARAMETERS

#these are percentage values - make sure to calculate percentages before using these!
PAPER_HANDS_MEAN = 15
PAPER_HANDS_STD = 3

PROFIT_SELL_MEAN = 25
PROFIT_SELL_STD = 3

SELL_INC_MEAN = 0.01
SELL_INC_STD = 0.002


#following parameters are based on the total number of people investing
#the benchmark period - where people check the price and determine if they want
#to invest - is based on the total number of people investing - so a value of 2
#means they will wait until everyone has taken 2 "turns"
BENCHMARK_PERIOD_MEAN = 0.3
BENCHMARK_PERIOD_STD = 0.05

#when the number of shares on sale is less than this parameter multiplied by the total number of shares
#selling, the low-supply-sell mechanism kicks in
LOW_SUPPLY_SELL_MEAN = 0.1
LOW_SUPPLY_SELL_STD = 0.02

#this controls the max price inflation that a person will sell a share at if the supply is low enough
SUPPLY_FACTOR_MAX_INC = 0.5

#and this is the opposite - when there are "too many" sales, we can assume that demand is low - for
#whatever reason - and so we can sell a bit lower than the market in an attempt to make some money
HIGH_SUPPLY_SELL_MEAN = 0.4
HIGH_SUPPLY_SELL_STD = 0.05

SUPPLY_FACTOR_MAX_DEC = 0.2


#and this one controls the random chance of buying a share every turn
#this is basically a rudimentary attempt to simulate more complex reasoning
#people will invest for various reasons that obviously can't be broken down
#into basic algorithms - of course, that's why we can't predict the market
#so hopefully, this randomness can help introduce something to that effect
BUY_CHANCE_MEAN = 0.1
BUY_CHANCE_STD = 0.05

def cheapest_sale():
	return SALES[np.argmin(PRICE_LISTINGS)]

def removelisting(share):
	ind = SALES.index(share)
	SALES.remove(share)
	del PRICE_LISTINGS[ind]

class Share:
	def __init__(self):
		global TOTAL_SHARES
		self.lastbuy = None
		self.owner = None
		self.sellingfor = None
		TOTAL_SHARES += 1

class Group:
	def __init__(self):
		self.people = []

	def addPerson(self, p):
		p.group = self
		self.people.append(p)

class Person:
	def __init__(self, bal, group = None):
		self.bal = bal
		self.shares = []

		if group:
			group.addPerson(self)
			self.num = len(group.people)
		else:
			raise Exception("No group specified")

		#assign parameters to self
		self.PAPER_HANDS = np.random.normal(PAPER_HANDS_MEAN, PAPER_HANDS_STD)
		self.PROFIT_SELL = np.random.normal(PROFIT_SELL_MEAN, PROFIT_SELL_STD)
		self.SELL_INC = np.random.normal(SELL_INC_MEAN, SELL_INC_STD)
		self.BENCHMARK = np.random.normal(BENCHMARK_PERIOD_MEAN, BENCHMARK_PERIOD_STD)
		self.LOW_SUPPLY_SELL = np.random.normal(LOW_SUPPLY_SELL_MEAN, LOW_SUPPLY_SELL_STD)
		self.HIGH_SUPPLY_SELL = np.random.normal(HIGH_SUPPLY_SELL_MEAN, HIGH_SUPPLY_SELL_STD)
		self.BUY_CHANCE = np.random.normal(BUY_CHANCE_MEAN, BUY_CHANCE_STD)

		if self.BENCHMARK < 0:
			self.BENCHMARK = 0

		if self.LOW_SUPPLY_SELL < 0:
			self.LOW_SUPPLY_SELL = 0

	#get the share owned by self that was bought for the lowest price
	#provided the share is not currently for sale
	def find_min_buy_share_notselling(self):
		mi = None
		s = None
		for share in self.shares:
			if (mi is None or share.lastbuy < mi) and share not in SALES:
				mi = share.lastbuy
				s = share

		return s


	def sell(self, share, price):
		if share in SALES:
			return "Cannot sell same share twice!"
		share.sellingfor = price
		SALES.append(share)
		PRICE_LISTINGS.append(price)

	def buy(self, share):
		#sanity checks, etc...
		if share not in SALES:
			return "Sale does not exist / was already bought"

		if share.sellingfor > self.bal:
			return "Not enough money"

		if share.owner == self:
			return "Can't buy own share"

		removelisting(share)

		#add the price of this transaction to the timeseries list
		PRICES.append(share.sellingfor)

		#take care of balance changes, assign the share to the new owner
		share.owner.bal += share.sellingfor
		share.owner.shares.remove(share)

		self.bal -= share.sellingfor
		self.shares.append(share)

		#update share properties
		share.owner = self
		share.lastbuy = share.sellingfor
		share.sellingfor = None

	def invest_loop(self):
		global TOTAL_SHARES

		for share in self.shares:
			#multiply by 100 in these calculations to get percentages

			#if the price has gone up enough, sell
			if 100 * (PRICES[-1] - share.lastbuy) / share.lastbuy > self.PROFIT_SELL:
				self.sell(share, PRICES[-1] + (self.SELL_INC * PRICES[-1]))

			#if the price has gone down enough, sell
			if 100 * (PRICES[-1] - share.lastbuy) / share.lastbuy < -self.PAPER_HANDS:
				self.sell(share, PRICES[-1] - (self.SELL_INC * PRICES[-1]))

		#get the benchmark period
		bp = PRICES[-int(self.BENCHMARK * len(self.group.people)):]
		#check whether the price has gone up or down, in percentage
		if len(bp) > 0:
			diff = 100 * (bp[-1] - bp[0]) / bp[0]
		else:
			diff = None

		if diff is not None and diff >= 0:
			#base the chance of buying a new share off of the growth of this stock
			#if the diff is 0, then chance is 0 - for now, this may change later
			#if the diff is equal to the difference at which point an individual share
			#would be sold, then we are definitely buying
			chance = diff / self.PROFIT_SELL
			if np.random.random() < chance and len(SALES) != 0:
				#buy the cheapest share on the market
				self.buy(cheapest_sale())

		nsales = len(PRICE_LISTINGS)

		#check if the supply is low enough to incentivize selling at higher than market price
		modified_lss = int(self.LOW_SUPPLY_SELL * TOTAL_SHARES)
		supply_factor = (modified_lss - nsales) / modified_lss
		if supply_factor >= 0 and len(self.shares) > 0:
			#modify the sell price based on how low the demand is
			sellshare = self.find_min_buy_share_notselling()
			if sellshare is not None:
				targetprice = PRICES[-1] * (1 + (supply_factor * SUPPLY_FACTOR_MAX_INC))

				#we don't want to lose money on any sale
				if sellshare.lastbuy > targetprice:
					pass
				else:
					self.sell(sellshare, targetprice)

		#check if the supply is high enough (effectively, if the demand is low enough) to incentivize
		#selling lower than the market price
		modified_hss = int(self.HIGH_SUPPLY_SELL * TOTAL_SHARES)
		supply_factor = (nsales - modified_hss) / modified_hss
		if supply_factor > 0 and len(self.shares) > 0:
			#decrease the target sell price
			sellshare = self.find_min_buy_share_notselling()
			if sellshare is not None:
				targetprice = PRICES[-1] * (1 - (supply_factor * SUPPLY_FACTOR_MAX_DEC))

				if sellshare.lastbuy > targetprice:
					pass
				else:
					self.sell(sellshare, targetprice)

		#and now the random per-turn buy chance
		if np.random.random() < self.BUY_CHANCE and len(SALES) > 0:
			self.buy(cheapest_sale())

G = Group()
for i in range(100):
	p = Person(1000.0, G)

nshares = 1

for i in range(100):
	for j in range(nshares):
		s = Share()
		s.owner = G.people[i]
		s.lastbuy = START_PRICE
		G.people[i].shares.append(s)

while True:
	for person in G.people:
		person.invest_loop()

	plt.clf()
	plt.subplot(2, 2, 1)
	plt.title("All-Time Values")
	plt.plot(PRICES)

	plt.subplot(2, 2, 2)
	plt.title("Last 20 Values")
	plt.plot(PRICES[-20:])

	plt.subplot(2, 2, 3)
	plt.title("Net Worth Distribution")
	BALS = []
	for person in G.people:
		BALS.append(person.bal + (len(person.shares) * PRICES[-1]))
	plt.hist(BALS, 30)

	plt.subplot(2, 2, 4)
	plt.title("Share Distribution")
	SHARE_DIST = []
	for person in G.people:
		SHARE_DIST.append(len(person.shares))
	plt.hist(SHARE_DIST, 30)

	plt.pause(0.001)
