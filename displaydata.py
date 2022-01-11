import numpy as np
import matplotlib.pyplot as plt
import time

f = plt.figure(figsize = (5, 5))

while True:
	PRICES = np.loadtxt("prices.txt")
	WORTHS = np.loadtxt("worths.txt")
	SHARES = np.loadtxt("shares.txt")
	CASH = np.loadtxt("cash.txt")

	a1 = f.add_subplot(2, 2, 1)
	a1.set_title("All-Time Values")
	a1.plot(PRICES)

	a2 = f.add_subplot(2, 2, 2)
	a2.set_title("Liquid Cash Distribution")
	a2.hist(CASH, 30)

	a3 = f.add_subplot(2, 2, 3)
	a3.set_title("Net Worth Distribution")
	a3.hist(WORTHS, 30)

	a4 = f.add_subplot(2, 2, 4)
	a4.set_title("Share Distribution")
	a4.hist(SHARES, 30)

	plt.pause(0.1)

	plt.clf()