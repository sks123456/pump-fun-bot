const {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  sendAndConfirmRawTransaction,
  Keypair,
} = require("@solana/web3.js");
const {
  LAMPORTS_PER_SOL,
  PUMP_PROGRAM,
  PUMP_EVENT_AUTHORITY,
} = require("./constant");
const { ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const TOKEN_DECIMALS = 6;

async function getKeyPairFromPrivateKey(key) {
  const privateKeyArray = key.split(",").map((num) => parseInt(num));
  return Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
}

// Calculate bonding curve details
async function calculateDetails(mintAddress) {
  const mintPublicKey = new PublicKey(mintAddress);

  const [bondingCurve] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mintPublicKey.toBuffer()],
    PUMP_PROGRAM
  );

  const [associatedBondingCurve] = PublicKey.findProgramAddressSync(
    [
      bondingCurve.toBuffer(),
      PUMP_EVENT_AUTHORITY.toBuffer(),
      mintPublicKey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return {
    bondingCurve: bondingCurve.toBase58(),
    associatedBondingCurve: associatedBondingCurve.toBase58(),
  };
}

// Function to calculate bonding curve price
function calculatePumpCurvePrice(curveState) {
  console.log(curveState);
  if (
    curveState.virtualTokenReserves <= 0 ||
    curveState.virtualSolReserves <= 0
  ) {
    throw new Error("Invalid reserve state.");
  }

  return (
    curveState.virtualSolReserves /
    LAMPORTS_PER_SOL /
    (curveState.virtualTokenReserves / 10 ** TOKEN_DECIMALS)
  );
}

// Function to calculate bonding curve price
function calculatePumpCurvePrice(curveState) {
  console.log(curveState);
  if (
    curveState.virtualTokenReserves <= 0 ||
    curveState.virtualSolReserves <= 0
  ) {
    throw new Error("Invalid reserve state.");
  }

  return (
    curveState.virtualSolReserves /
    LAMPORTS_PER_SOL /
    (curveState.virtualTokenReserves / 10 ** TOKEN_DECIMALS)
  );
}

class BondingCurveState {
  constructor(data) {
    const offset = 8; // Skip discriminator
    this.virtualTokenReserves = Number(data.readBigUInt64LE(offset));
    this.virtualSolReserves = Number(data.readBigUInt64LE(offset + 8));
    this.realTokenReserves = Number(data.readBigUInt64LE(offset + 16));
    this.realSolReserves = Number(data.readBigUInt64LE(offset + 24));
    this.tokenTotalSupply = Number(data.readBigUInt64LE(offset + 32));
    this.complete = data[offset + 40] === 1;
  }
}
async function getPumpCurveState(connection, curveAddress) {
  console.log(curveAddress);

  const accountInfo = await connection.getAccountInfo(curveAddress);
  console.log(accountInfo);
  if (!accountInfo || !accountInfo.data) {
    throw new Error("Invalid curve state: No data");
  }

  const data = accountInfo.data;

  // Dynamically extract discriminator
  const discriminator = data.slice(0, 8);
  console.log("Retrieved Discriminator:", discriminator.toString("hex"));

  return new BondingCurveState(data);
}

async function createTransaction(
  connection,
  instructions,
  payer,
  priorityFeeInSol = 0
) {
  // Create the instruction to set the compute unit limit
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1000000,
  });

  // Initialize a new transaction and add the compute unit limit instruction
  const transaction = new Transaction().add(modifyComputeUnits);

  // Add priority fee if specified
  if (priorityFeeInSol > 0) {
    const microLamports = priorityFeeInSol * 1_000_000_000; // Convert SOL to microLamports
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports,
    });
    transaction.add(addPriorityFee);
  }

  // Add the provided instructions
  transaction.add(...instructions);

  // Set the fee payer
  transaction.feePayer = payer;

  // Fetch the latest blockhash and set it on the transaction
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;

  console.log(transaction);
  return transaction;
}

async function sendAndConfirmTransactionWrapper(
  connection,
  transaction,
  signers
) {
  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      { skipPreflight: true, preflightCommitment: "confirmed" }
    );
    console.log("Transaction confirmed with signature:", signature);
    return signature;
  } catch (error) {
    console.error("Error sending transaction:", error);
    return null;
  }
}
module.exports = {
  calculateDetails,
  calculatePumpCurvePrice,
  getPumpCurveState,
  createTransaction,
  BondingCurveState,
  sendAndConfirmTransactionWrapper,
  getKeyPairFromPrivateKey,
};
