const fs = require('fs');

var START_PRICE = 1.0

var npeople = 100;
var nshares = 2
var bal_per_person = 1.01;

var PRICES = [START_PRICE, START_PRICE]
var LAST_SALE_TIME = Date.now()

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
var BENCHMARK_PERIOD_MEAN = 3
var BENCHMARK_PERIOD_STD = 0.4

//when the number of shares on sale is less than this parameter multiplied by the total number of shares
//selling, the low-supply-sell mechanism kicks in
var LOW_SUPPLY_SELL_MEAN = 0.15
var LOW_SUPPLY_SELL_STD = 0.02

//this controls the max price inflation that a person will sell a share at if the supply is low enough
var SUPPLY_FACTOR_MAX_INC = 0.5

//and this is the opposite - when there are "too many" sales, we can assume that demand is low - for
//whatever reason - and so we can sell a bit lower than the market in an attempt to make some money
var HIGH_SUPPLY_SELL_MEAN = 0.4
var HIGH_SUPPLY_SELL_STD = 0.05

var SUPPLY_FACTOR_MAX_DEC = 0.2


//if there haven't been sales for a long time, undercut the price
var SALE_TIME_UNDERCUT_MEAN = 7
var SALE_TIME_UNDERCUT_STD = 2.5

var UNDERCUT_PERCENT_MEAN = 1.5
var UNDERCUT_PERCENT_STD = 0.4


//remove a share if it's been long enough
var REMOVE_SHARE_TIME_MEAN = 20
var REMOVE_SHARE_TIME_STD = 4


//and this one controls the random chance of buying a share every turn
//this is basically a rudimentary attempt to simulate more complex reasoning
//people will invest for various reasons that obviously can't be broken down
//into basic algorithms - of course, that's why we can't predict the market
//so hopefully, this randomness can help introduce something to that effect
var BUY_CHANCE_MEAN = 0.08
var BUY_CHANCE_STD = 0.015

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

function removelisting(share, timerm = true){
	console.log("rm", "\t", share.sellingfor.toFixed(2))
	ind = SALES.indexOf(share)
	SALES.splice(ind, 1)
	PRICE_LISTINGS.splice(ind, 1)
}


class Share{
	constructor(){
		this.lastbuy = null
		this.owner = null
		this.sellingfor = null
		this.listtime = null
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
		this.SALE_TIME_UNDERCUT = randomnormal(SALE_TIME_UNDERCUT_MEAN, SALE_TIME_UNDERCUT_STD)
		this.UNDERCUT_PERCENT = randomnormal(UNDERCUT_PERCENT_MEAN, UNDERCUT_PERCENT_STD)
		this.REMOVE_SHARE_TIME = randomnormal(REMOVE_SHARE_TIME_MEAN, REMOVE_SHARE_TIME_STD)

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
		var mi = null
		var s = null
		for (var tshare of this.shares){
			if ((mi === null || tshare.lastbuy <= mi)){
				if (!SALES.includes(tshare)){
					mi = tshare.lastbuy
					s = tshare
				}
			}
		}

		return s
	}


	sell = (share, price, reason) => {
		if (SALES.includes(share)){
			return "Cannot sell same share twice!"
		}
		share.sellingfor = price
		share.listtime = Date.now()
		SALES.push(share)
		PRICE_LISTINGS.push(price)
		console.log("s", "\t", reason, "\t", price.toFixed(2), "\t", SALES.length, "\t", cheapest_sale().sellingfor.toFixed(2))
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

		console.log("b", "\t", share.sellingfor.toFixed(2), "\t", SALES.length, "\t", cheapest_sale().sellingfor.toFixed(2))

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
		share.listtime = null

		LAST_SALE_TIME = Date.now()
	}

	invest_loop = () => {
		for (var share of this.shares){
			//multiply by 100 in these calculations to get percentages

			if (share.lastbuy !== null){
				//if the price has gone up enough, sell
				if (100 * (PRICES[PRICES.length - 1] - share.lastbuy) / share.lastbuy > this.PROFIT_SELL){
					this.sell(share, PRICES[PRICES.length - 1] + (this.SELL_INC * PRICES[PRICES.length - 1]), "up-")
				}

				//if the price has gone down enough, sell
				if (100 * (PRICES[PRICES.length - 1] - share.lastbuy) / share.lastbuy < -this.PAPER_HANDS){
					this.sell(share, PRICES[PRICES.length - 1] - (this.SELL_INC * PRICES[PRICES.length - 1]), "dow")
				}
			}

			if (share.sellingfor !== null && share.listtime !== null){
				//remove a share if it's been long enough
				if ((Date.now() - share.listtime) / 1000 > this.REMOVE_SHARE_TIME){
					removelisting(share)
				}
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
			if (randomuniform() < chance && SALES.length != 0){
				//buy the cheapest share on the market
				this.buy(cheapest_sale())
			}
		}

		//undersell if it's been long enough
		if ((Date.now() - LAST_SALE_TIME) / 1000 > this.SALE_TIME_UNDERCUT){
			var sellshare = this.find_min_buy_share_notselling()
			if (sellshare !== null && SALES.length > 0){
				var targetprice = cheapest_sale().sellingfor * (1 - (this.UNDERCUT_PERCENT / 100))
				if (sellshare.lastbuy === null || sellshare.lastbuy < targetprice){
					this.sell(sellshare, targetprice, "und")
				}
			}
		}

		var nsales = PRICE_LISTINGS.length

		//check if the supply is low enough to incentivize selling at higher than market price
		var modified_lss = Math.round(this.LOW_SUPPLY_SELL * TOTAL_SHARES)
		var supply_factor = (modified_lss - nsales) / modified_lss
		if (supply_factor >= 0 && this.shares.length > 0){
			//modify the sell price based on how low the demand is
			if (supply_factor > SUPPLY_FACTOR_MAX_INC){
				supply_factor = SUPPLY_FACTOR_MAX_INC
			}
			var sellshare = this.find_min_buy_share_notselling()
			if (sellshare !== null){
				var targetprice = PRICES[PRICES.length - 1] * (1 + (supply_factor))
				//we don't want to lose money on any sale
				if (sellshare.lastbuy === null || sellshare.lastbuy < targetprice){
					this.sell(sellshare, targetprice, "ls-")
				}
			}
		}

		//check if the supply is high enough (effectively, if the demand is low enough) to incentivize
		//selling lower than the market price
		var modified_hss = Math.round(this.HIGH_SUPPLY_SELL * TOTAL_SHARES)
		var supply_factor = (nsales - modified_hss) / modified_hss
		if (supply_factor > 0 && this.shares.length > 0){
			//decrease the target sell price
			if (supply_factor > SUPPLY_FACTOR_MAX_DEC){
				supply_factor = SUPPLY_FACTOR_MAX_DEC
			}
			var sellshare = this.find_min_buy_share_notselling()
			if (sellshare !== null){
				//if (SALES.length > 0){
					//var targetprice = cheapest_sale().sellingfor * (1 - (supply_factor))
				//}
				//else{
				var targetprice = PRICES[PRICES.length - 1] * (1 - (supply_factor))
				//}
				if (sellshare.lastbuy === null || sellshare.lastbuy < targetprice){
					this.sell(sellshare, targetprice, "hs-")
				}
			}
		}


		//and now the random per-turn buy chance
		if (randomuniform() < this.BUY_CHANCE && SALES.length > 0){
			this.buy(cheapest_sale())
		}

		setTimeout(this.invest_loop, 1)
	}
}


var G = new Group()

for (var i = 0; i < npeople; i++){
	var p = new Person(bal_per_person, G)
	p.invest_loop.bind(p)
}

for (var i = 0; i < npeople; i++){
	for (var j = 0; j < nshares; j++){
		var s = new Share()
		s.owner = G.people[i]
		s.lastbuy = null
		G.people[i].shares.push(s)
	}
}

for (var person of G.people){
	person.invest_loop()
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

	let money_file = fs.createWriteStream(__dirname + '/cash.txt', {flags : 'w'});
	for (var person of G.people){
		money_file.write(String(person.bal))
		money_file.write("\n")
	}

	price_file.end()
	share_file.end()
	worth_file.end()
	money_file.end()


	setTimeout(saveData, 2000)
}

saveData()

setInterval(function(){
	//console.log(SALES.length, "\t", PRICES.length, "\t", cheapest_sale().sellingfor.toFixed(2), "\t", PRICES[PRICES.length - 1].toFixed(2), "\t", TOTAL_SHARES)
}, 200)
