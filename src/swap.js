const {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  sendAndConfirmTransaction,
  Keypair,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const bs58 = require("bs58");

const { calculateDetails } = require("./utils");
const { calculatePumpCurvePrice } = require("./utils");
const { getPumpCurveState } = require("./utils");
const { createTransaction } = require("./utils");
const { sendAndConfirmTransactionWrapper } = require("./utils");
const { getKeyPairFromPrivateKey } = require("./utils");
const { getCoinData } = require("./api");
const {
  GLOBAL,
  FEE_RECIPIENT,
  SYSTEM_PROGRAM_ID,
  RENT,
  PUMP_FUN_PROGRAM,
  PUMP_FUN_ACCOUNT,
  ASSOC_TOKEN_ACC_PROG,
} = require("./constant");

async function pumpFunBuy(
  transactionMode,
  payerPrivateKey,
  mintStr,
  solIn,
  priorityFeeInSol = 0,
  slippageDecimal = 0.25
) {
  console.log("Getting Connection...");
  try {
    const connection = new Connection(
      clusterApiUrl("mainnet-beta"),
      "confirmed"
    );
    console.log("Connection complete, getting Coin data from chain");

    console.log("Connection complete, getting Coin data from PUMPFUN api");

    const coinData = await getCoinData(mintStr);
    if (!coinData) {
      console.error("Failed to retrieve coin data...");
      return;
    }

    console.log("Getting keyPair from private key");
    const payer = new Keypair(await getKeyPairFromPrivateKey(payerPrivateKey));
    console.log(payer);
    const owner = payer.publicKey;
    const mint = new PublicKey(mintStr);

    const txBuilder = new Transaction();

    const tokenAccountAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false
    );

    const tokenAccountInfo = await connection.getAccountInfo(
      tokenAccountAddress
    );

    let tokenAccount;
    if (!tokenAccountInfo) {
      txBuilder.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          tokenAccountAddress,
          payer.publicKey,
          mint
        )
      );
      tokenAccount = tokenAccountAddress;
    } else {
      tokenAccount = tokenAccountAddress;
    }

    // Get bonding curve state
    console.log(coinData);
    const curveState = await getPumpCurveState(
      connection,
      new PublicKey(coinData["bonding_curve"])
    );
    const tokenPriceSol = calculatePumpCurvePrice(curveState);
    console.log(`HOW MUCH WE BUYING IN SOL ${solIn}`);
    console.log(`TOKEN PRICE PER SOL ${tokenPriceSol}`);

    const solInLamports = solIn * LAMPORTS_PER_SOL;
    const tokenOut = Math.floor(
      (solInLamports * coinData["virtual_token_reserves"]) /
        coinData["virtual_sol_reserves"]
    );

    const solInWithSlippage = solIn * (1 + slippageDecimal);
    const maxSolCost = Math.floor(solInWithSlippage * LAMPORTS_PER_SOL);
    const ASSOCIATED_USER = tokenAccount;
    const USER = owner;
    const BONDING_CURVE = new PublicKey(coinData["bonding_curve"]);
    const ASSOCIATED_BONDING_CURVE = coinData["associated_bonding_curve"];
    console.log(ASSOCIATED_BONDING_CURVE);

    const keys = [
      {
        pubkey: new PublicKey(GLOBAL),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(FEE_RECIPIENT),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: new PublicKey(mint), isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey(BONDING_CURVE),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(ASSOCIATED_BONDING_CURVE),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(ASSOCIATED_USER),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: new PublicKey(USER), isSigner: false, isWritable: true },
      {
        pubkey: new PublicKey(SYSTEM_PROGRAM_ID),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(TOKEN_PROGRAM_ID),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(RENT),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(PUMP_FUN_ACCOUNT),
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(PUMP_FUN_PROGRAM),
        isSigner: false,
        isWritable: false,
      },
    ];

    function bufferFromUInt64(value) {
      let buffer = Buffer.alloc(8);
      buffer.writeBigUInt64LE(BigInt(value));
      return buffer;
    }

    const data = Buffer.concat([
      bufferFromUInt64("16927863322537952870"),
      bufferFromUInt64(tokenOut),
      bufferFromUInt64(maxSolCost),
    ]);

    const instruction = new TransactionInstruction({
      keys: keys,
      programId: PUMP_FUN_PROGRAM,
      data: data,
    });
    txBuilder.add(instruction);

    const transaction = await createTransaction(
      connection,
      txBuilder.instructions,
      payer.publicKey,
      priorityFeeInSol
    );

    if (transactionMode === "Execution") {
      const signature = await sendAndConfirmTransactionWrapper(
        connection,
        transaction,
        [payer]
      );
      console.log("Buy transaction confirmed:", signature);
    } else if (transactionMode === "Simulation") {
      const simulatedResult = await connection.simulateTransaction(transaction);
      console.log(simulatedResult);
    }
  } catch (error) {
    console.log(error);
  }
}

async function pumpFunSell(
  transactionMode,
  payerPrivateKey,
  mintStr,
  tokenBalance,
  priorityFeeInSol = 0,
  slippageDecimal = 0.25
) {
  try {
    const connection = new Connection(
      clusterApiUrl("mainnet-beta"),
      "confirmed"
    );

    const coinData = await getCoinData(mintStr);
    if (!coinData) {
      console.error("Failed to retrieve coin data...");
      return;
    }

    const payer = await getKeyPairFromPrivateKey(payerPrivateKey);
    const owner = payer.publicKey;
    const mint = new PublicKey(mintStr);
    const txBuilder = new Transaction();

    const tokenAccountAddress = await getAssociatedTokenAddress(
      mint,
      owner,
      false
    );

    const tokenAccountInfo = await connection.getAccountInfo(
      tokenAccountAddress
    );

    let tokenAccount;
    if (!tokenAccountInfo) {
      txBuilder.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          tokenAccountAddress,
          payer.publicKey,
          mint
        )
      );
      tokenAccount = tokenAccountAddress;
    } else {
      tokenAccount = tokenAccountAddress;
    }

    const minSolOutput = Math.floor(
      (tokenBalance *
        (1 - slippageDecimal) *
        coinData["virtual_sol_reserves"]) /
        coinData["virtual_token_reserves"]
    );

    const keys = [
      { pubkey: GLOBAL, isSigner: false, isWritable: false },
      { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey(coinData["bonding_curve"]),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(coinData["associated_bonding_curve"]),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: true },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOC_TOKEN_ACC_PROG, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
      { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
    ];
    function bufferFromUInt64(value) {
      let buffer = Buffer.alloc(8);
      buffer.writeBigUInt64LE(BigInt(value));
      return buffer;
    }

    const data = Buffer.concat([
      bufferFromUInt64("12502976635542562355"),
      bufferFromUInt64(tokenBalance),
      bufferFromUInt64(minSolOutput),
    ]);

    const instruction = new TransactionInstruction({
      keys: keys,
      programId: PUMP_FUN_PROGRAM,
      data: data,
    });
    txBuilder.add(instruction);

    const transaction = await createTransaction(
      connection,
      txBuilder.instructions,
      payer.publicKey,
      priorityFeeInSol
    );

    if (transactionMode === "Execution") {
      const signature = await sendAndConfirmTransactionWrapper(
        connection,
        transaction,
        [payer]
      );
      console.log("Sell transaction confirmed:", signature);
    } else if (transactionMode === "Simulation") {
      const simulatedResult = await connection.simulateTransaction(transaction);
      console.log(simulatedResult);
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = { pumpFunBuy, pumpFunSell };
