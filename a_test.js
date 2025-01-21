require("dotenv").config();
const fs = require('fs');
const path = require('path');
const {
    Connection, ComputeBudgetProgram,
    LAMPORTS_PER_SOL,
    SystemProgram,
    PublicKey,
    Transaction,
    TransactionInstruction,
    clusterApiUrl,
    sendAndConfirmTransaction,
    Keypair,
} = require("@solana/web3.js");
const {
    getAssociatedTokenAddress, createTransferInstruction, getOrCreateAssociatedTokenAccount,
    createAssociatedTokenAccountInstruction, Token,
    TOKEN_PROGRAM_ID
} = require("@solana/spl-token");

function logToFile(message) {
    const logDir = path.join(__dirname, 'logs');

    // Ensure the logs directory exists
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }

    const logFilePath = path.join(logDir, 'sendSol.log'); // Save logs in /logs/sendSol.log
    const timestamp = new Date().toISOString();

    // If the message is an object, create a structured log
    let logMessage;
    if (typeof message === "object") {
        logMessage = `[${timestamp}] ${JSON.stringify(message, null, 2)}\n`;
    } else {
        logMessage = `[${timestamp}] ${message}\n`;
    }

    fs.appendFileSync(logFilePath, logMessage, 'utf8');
}


async function sendSPLToken(senderPrivateKey, receiverAddress, amount, tokenMintAddress, priorityFee = 10000) {
    let transactionData = {};

    try {
        const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
        const sender = Keypair.fromSecretKey(Uint8Array.from(senderPrivateKey));
        const senderPublicKey = sender.publicKey;
        const receiverPublicKey = new PublicKey(receiverAddress);
        const mintPublicKey = new PublicKey(tokenMintAddress);

        transactionData.sender = senderPublicKey.toBase58();
        transactionData.receiver = receiverAddress;
        transactionData.tokenMint = tokenMintAddress;
        transactionData.amount = amount;
        transactionData.priorityFee = priorityFee;

        console.log("Initializing transaction...");

        // Fetch associated token accounts
        const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            sender,
            mintPublicKey,
            senderPublicKey
        );

        console.log("Sender's Token Account:", senderTokenAccount.address.toBase58());

        const receiverTokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            sender,
            mintPublicKey,
            receiverPublicKey,
            true
        );

        console.log("Receiver's Token Account:", receiverTokenAccount.address.toBase58());

        transactionData.senderTokenAccount = senderTokenAccount.address.toBase58();
        transactionData.receiverTokenAccount = receiverTokenAccount.address.toBase58();

        // Create the transfer instruction
        const transferInstruction = createTransferInstruction(
            senderTokenAccount.address,
            receiverTokenAccount.address,
            senderPublicKey,
            amount
        );

        // Fetch the most current blockhash right before sending the transaction
        const latestBlockhash = await connection.getLatestBlockhash({ commitment: "confirmed" });
        console.log("Latest Blockhash:", latestBlockhash);

        // Prepare the transaction
        const transaction = new Transaction().add(transferInstruction);
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = senderPublicKey;

        // Sign and send the transaction
        console.log("Sending transaction...");
        const signature = await sendAndConfirmTransaction(connection, transaction, [sender]);

        console.log("Transaction confirmed with signature:", signature);
        transactionData.txHash = signature;

        return {
            status: "success",
            message: `Transaction successful with signature: ${signature}`,
            ...transactionData,
        };
    } catch (error) {
        console.error("Error during transaction:", error);
        return {
            status: "error",
            message: `Error during transaction: ${error.message}`,
            ...transactionData,
        };
    }
}


async function sendSplTokenTransaction() {
    try {
        const senderPrivateKey = (process.env.PRIVATE_KEY1).split(",").map(Number);
        if (senderPrivateKey.length !== 64 || senderPrivateKey.some(n => n < 0 || n > 255)) {
            throw new Error("Invalid private key format.");
        }

        const splReceiverAddress = "B8zFq8TdhFsp5kPV7PRiat3opj5nkY4s2xtAgb3R1cfW"; // Recipient's public key
        const tokenMintAddress = "5sePc7REhT2Mpn9AHEJ2CpBvd919sb3BYCvH7hLLpump"; // Token mint address
        const tokenAmountInDecimal = 1001000000; // Amount of tokens in decimal

        const result = await sendSPLToken(senderPrivateKey, splReceiverAddress, tokenAmountInDecimal, tokenMintAddress);
        console.log(result);
        logToFile(result);
    } catch (error) {
        console.error("Error in sendSplTokenTransaction function:", error);
        logToFile({ status: "error", message: error.message });
    }
}


async function main() {
    try {
        await sendSplTokenTransaction();
    } catch (error) {
        console.error("Error in main function:", error);
    }
}



main();