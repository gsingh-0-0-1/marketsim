const fs = require('fs');

var START_PRICE = 100.0

var PRICES = [START_PRICE]

var SALES = []
var PRICE_LISTINGS = []

ID_LISTINGS = new Object()

var LAST_SALE_ID = 0

var TOTAL_SHARES = 0

//PARAMETERS

//these are percentage values - make sure to calculate percentages before using these!
var PAPER_HANDS_MEAN = 15
var PAPER_HANDS_STD = 3

var PROFIT_SELL_MEAN = 25
var PROFIT_SELL_STD = 3

var SELL_INC_MEAN = 0.01
var SELL_INC_STD = 0.002


//following parameters are based on the total number of people investing
//the benchmark period - where people check the price and determine if they want
//to invest - is based on the total number of people investing - so a value of 2
//means they will wait until everyone has taken 2 "turns"
var BENCHMARK_PERIOD_MEAN = 0.3
var BENCHMARK_PERIOD_STD = 0.05

//when the number of shares on sale is less than this parameter multiplied by the total number of shares
//selling, the low-supply-sell mechanism kicks in
var LOW_SUPPLY_SELL_MEAN = 0.1
var LOW_SUPPLY_SELL_STD = 0.02

//this controls the max price inflation that a person will sell a share at if the supply is low enough
var SUPPLY_FACTOR_MAX_INC = 0.5

//and this is the opposite - when there are "too many" sales, we can assume that demand is low - for
//whatever reason - and so we can sell a bit lower than the market in an attempt to make some money
var HIGH_SUPPLY_SELL_MEAN = 0.4
var HIGH_SUPPLY_SELL_STD = 0.05

var SUPPLY_FACTOR_MAX_DEC = 0.2


//and this one controls the random chance of buying a share every turn
//this is basically a rudimentary attempt to simulate more complex reasoning
//people will invest for various reasons that obviously can't be broken down
//into basic algorithms - of course, that's why we can't predict the market
//so hopefully, this randomness can help introduce something to that effect
var BUY_CHANCE_MEAN = 0.1
var BUY_CHANCE_STD = 0.05

//random functions
function randomnormal(mean, std){
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    var out = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v )
    out = std*out + mean
    return out;
}

function randomuniform(){
	return Math.random();
}

Array.prototype.max = function() {
  return Math.max.apply(null, this);
};

Array.prototype.min = function() {
  return Math.min.apply(null, this);
};

function cheapest_sale(){
	let mininum = PRICE_LISTINGS.min()
	let ind = PRICE_LISTINGS.indexOf(mininum)
	return SALES[ind]
}

function removelisting(share){
	ind = SALES.indexOf(share)
	SALES.splice(ind, 1)
	PRICE_LISTINGS.splice(ind, 1)
}


class Share{
	constructor(){
		this.lastbuy = null
		this.owner = null
		this.sellingfor = null
		TOTAL_SHARES += 1
	}
}

class Group{
	constructor(){
		this.people = []
	}

	addPerson(p){
		p.group = this
		this.people.push(p)
	}
}



class Person{
	constructor(bal, group){
		this.bal = bal
		this.shares = []

		group.addPerson(this)
		this.num = group.people.length

		//assign parameters to this
		this.PAPER_HANDS = randomnormal(PAPER_HANDS_MEAN, PAPER_HANDS_STD)
		this.PROFIT_SELL = randomnormal(PROFIT_SELL_MEAN, PROFIT_SELL_STD)
		this.SELL_INC = randomnormal(SELL_INC_MEAN, SELL_INC_STD)
		this.BENCHMARK = randomnormal(BENCHMARK_PERIOD_MEAN, BENCHMARK_PERIOD_STD)
		this.LOW_SUPPLY_SELL = randomnormal(LOW_SUPPLY_SELL_MEAN, LOW_SUPPLY_SELL_STD)
		this.HIGH_SUPPLY_SELL = randomnormal(HIGH_SUPPLY_SELL_MEAN, HIGH_SUPPLY_SELL_STD)
		this.BUY_CHANCE = randomnormal(BUY_CHANCE_MEAN, BUY_CHANCE_STD)

		if (this.BENCHMARK < 0){
			this.BENCHMARK = 0
		}

		if (this.LOW_SUPPLY_SELL < 0){
			this.LOW_SUPPLY_SELL = 0
		}
	}

	//get the share owned by this that was bought for the lowest price
	//provided the share is not currently for sale
	find_min_buy_share_notselling = () => {
		let mi = null
		let s = null
		for (var share of this.shares){
			if ((mi === null || share.lastbuy < mi) && !SALES.includes(share)){
				mi = share.lastbuy
				s = share
			}
		}

		return s
	}


	sell = (share, price) => {
		if (SALES.includes(share)){
			return "Cannot sell same share twice!"
		}
		share.sellingfor = price
		SALES.push(share)
		PRICE_LISTINGS.push(price)
	}

	buy = (share) => {
		//sanity checks, etc...
		if (!SALES.includes(share)){
			return "Sale does not exist / was already bought"
		}

		if (share.sellingfor > this.bal){
			return "Not enough money"
		}

		if (share.owner === this){
			return "Can't buy own share"
		}

		removelisting(share)

		//add the price of this transaction to the timeseries list
		PRICES.push(share.sellingfor)

		//take care of balance changes, assign the share to the new owner
		share.owner.bal += share.sellingfor
		share.owner.shares.splice(share.owner.shares.indexOf(share), 1)

		this.bal -= share.sellingfor
		this.shares.push(share)

		//update share properties
		share.owner = this
		share.lastbuy = share.sellingfor
		share.sellingfor = null
	}

	invest_loop = () => {
		//while (true){
			for (var share of this.shares){
				//multiply by 100 in these calculations to get percentages

				//if the price has gone up enough, sell
				if (100 * (PRICES[PRICES.length - 1] - share.lastbuy) / share.lastbuy > this.PROFIT_SELL){
					this.sell(share, PRICES[PRICES.length - 1] + (this.SELL_INC * PRICES[PRICES.length - 1]))
				}

				//if the price has gone down enough, sell
				if (100 * (PRICES[PRICES.length - 1] - share.lastbuy) / share.lastbuy < -this.PAPER_HANDS){
					this.sell(share, PRICES[PRICES.length - 1] - (this.SELL_INC * PRICES[PRICES.length - 1]))
				}
			}

			//get the benchmark period
			var bp = PRICES.slice(-Math.round(this.BENCHMARK * this.group.people.length), PRICES.length)
			//check whether the price has gone up or down, in percentage
			if (bp.length > 0){
				var diff = 100 * (bp[-1] - bp[0]) / bp[0]
			}
			else{
				var diff = null
			}

			if (diff !== null && diff >= 0){
				//base the chance of buying a new share off of the growth of this stock
				//if the diff is 0, then chance is 0 - for now, this may change later
				//if the diff is equal to the difference at which point an individual share
				//would be sold, then we are definitely buying
				chance = diff / this.PROFIT_SELL
				if (randomuniform() < chance && len(SALES) != 0){
					//buy the cheapest share on the market
					this.buy(cheapest_sale())
				}
			}

			var nsales = PRICE_LISTINGS.length

			//check if the supply is low enough to incentivize selling at higher than market price
			var modified_lss = Math.round(this.LOW_SUPPLY_SELL * TOTAL_SHARES)
			var supply_factor = (modified_lss - nsales) / modified_lss
			if (supply_factor >= 0 && this.shares.length > 0){
				//modify the sell price based on how low the demand is
				var sellshare = this.find_min_buy_share_notselling()
				if (sellshare !== null){
					var targetprice = PRICES[PRICES.length - 1] * (1 + (supply_factor * SUPPLY_FACTOR_MAX_INC))

					//we don't want to lose money on any sale
					if (sellshare.lastbuy > targetprice){
					}
					else{
						this.sell(sellshare, targetprice)
					}
				}
			}

			//check if the supply is high enough (effectively, if the demand is low enough) to incentivize
			//selling lower than the market price
			var modified_hss = Math.round(this.HIGH_SUPPLY_SELL * TOTAL_SHARES)
			var supply_factor = (nsales - modified_hss) / modified_hss
			if (supply_factor > 0 && this.shares.length > 0){
				//decrease the target sell price
				var sellshare = this.find_min_buy_share_notselling()
				if (sellshare !== null){
					var targetprice = PRICES[PRICES.length - 1] * (1 - (supply_factor * SUPPLY_FACTOR_MAX_DEC))

					if (sellshare.lastbuy > targetprice){
					}
					else{
						this.sell(sellshare, targetprice)
					}
				}
			}

			//and now the random per-turn buy chance
			if (randomuniform() < this.BUY_CHANCE && SALES.length > 0){
				this.buy(cheapest_sale())
			}
		//}
	}
}


var G = new Group()

var npeople = 100;

for (var i = 0; i < npeople; i++){
	var p = new Person(5000.0, G)
	p.invest_loop.bind(p)
}

var nshares = 3

for (var i = 0; i < npeople; i++){
	for (var j = 0; j < nshares; j++){
		var s = new Share()
		s.owner = G.people[i]
		s.lastbuy = START_PRICE
		G.people[i].shares.push(s)
	}
}

for (var person of G.people){
	setInterval(person.invest_loop, 100)
}

function saveData(){

	let cur_val = PRICES[PRICES.length - 1]

	let price_file = fs.createWriteStream(__dirname + '/prices.txt', {flags : 'w'});
	for (var price of PRICES){
		price_file.write(String(price))
		price_file.write("\n")
	}

	let share_file = fs.createWriteStream(__dirname + '/shares.txt', {flags : 'w'});
	for (var person of G.people){
		share_file.write(String(person.shares.length))
		share_file.write("\n")
	}

	let worth_file = fs.createWriteStream(__dirname + '/worths.txt', {flags : 'w'});
	for (var person of G.people){
		worth_file.write(String((person.shares.length * cur_val) + person.bal))
		worth_file.write("\n")
	}

	price_file.end()
	share_file.end()
	worth_file.end()

	setTimeout(saveData, 2000)
}

saveData()
