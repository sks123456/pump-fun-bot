const { pumpFunBuy, pumpFunSell } = require("./src/swap");
const readline = require("readline");
require("dotenv").config();

class Example {
  constructor(privateKey, mintAddress, mode) {
    this.payerPrivateKey = privateKey;
    this.mintAddress = mintAddress;
    this.transactionMode = mode;
  }

  async main() {
    const solIn = 0.0001; // Example value, adjust as needed
    const slippageDecimal = 0.25; // Example value, adjust as needed
    const tokenBalance = 3 * 1000000 * 21; // Example value, adjust as needed
    const priorityFeeInSol = 0.0001; // Example value for tip to get faster inclusion, adjust as needed

    try {
      // // Call the buy function
      // await pumpFunBuy(
      //   this.transactionMode,
      //   this.payerPrivateKey,
      //   this.mintAddress,
      //   solIn,
      //   priorityFeeInSol,
      //   slippageDecimal
      // );

      // Uncomment the following to call the sell function
      await pumpFunSell(
        this.transactionMode,
        this.payerPrivateKey,
        this.mintAddress,
        tokenBalance,
        priorityFeeInSol,
        slippageDecimal
      );
    } catch (error) {
      console.error("Error in main function:", error);
    }
  }
}

// Prompt user for input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const privateKey = process.env.PRIVATE_KEY;
rl.question("Enter the mint address: ", (mintAddress) => {
  rl.question(
    "Enter the transaction mode (Simulation/Execution): ",
    (txMode) => {
      let transactionMode;

      if (txMode.toLowerCase() === "simulation") {
        transactionMode = "Simulation";
      } else if (txMode.toLowerCase() === "execution") {
        transactionMode = "Execution";
      } else {
        console.error(
          "Invalid transaction mode. Please use 'Simulation' or 'Execution'."
        );
        rl.close();
        return;
      }

      const example = new Example(privateKey, mintAddress, transactionMode);
      example.main().finally(() => rl.close());
    }
  );
});
