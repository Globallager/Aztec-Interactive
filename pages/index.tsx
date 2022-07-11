import type { NextPage } from "next";
import { ethers } from "ethers";
import { JsonRpcSigner, Web3Provider } from "@ethersproject/providers";
import { useEffect, useState } from "react";
import {
  AccountId,
  AztecSdk,
  createAztecSdk,
  EthersAdapter,
  EthereumProvider,
  SdkFlavour,
  AztecSdkUser,
  GrumpkinAddress,
  SchnorrSigner,
  EthAddress,
  TxSettlementTime,
} from "@aztec/sdk";

import { randomBytes } from "crypto";

import {
  depositEthToAztec,
  registerAccount,
} from "./utils";

const Home: NextPage = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [hasMetamask, setHasMetamask] = useState(false);
  const [signer, setSigner] = useState<null | JsonRpcSigner>(null);
  const [ethereumProvider, setEthereumProvider] =
    useState<null | EthereumProvider>(null);
  const [ethAccount, setEthAccount] = useState<EthAddress | null>(null);
  const [sdk, setSdk] = useState<null | AztecSdk>(null);
  const [account0, setAccount0] = useState<AztecSdkUser | null>(null);
  const [userExists, setUserExists] = useState<boolean>(false);
  const [accountPrivateKey, setAccountPrivateKey] = useState<Buffer | null>(null);
  const [accountPublicKey, setAccountPublicKey] = useState<GrumpkinAddress | null>(null);
  const [spendingSigner, setSpendingSigner] = useState<SchnorrSigner | undefined>(undefined);
  const [zkEthBalance, setZkEthBalance] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      setHasMetamask(true);
    }
    window.ethereum.on("accountsChanged", () => location.reload());
  });

  async function connect() {
    setConnecting(true);
    if (typeof window.ethereum !== "undefined") {
      try {
        let accounts = await ethereum.request({
          method: "eth_requestAccounts",
        });
        setEthAccount(EthAddress.fromString(accounts[0]));


        const ethersProvider: Web3Provider = new ethers.providers.Web3Provider(
          window.ethereum
        );
        const ethereumProvider: EthereumProvider = new EthersAdapter(
          ethersProvider
        );

        const sdk = await createAztecSdk(ethereumProvider, {
          serverUrl: "https://api.aztec.network/aztec-connect-testnet/falafel", // goerli testnet
          pollInterval: 1000,
          memoryDb: true,
          debug: "bb:*",
          flavour: SdkFlavour.PLAIN,
          minConfirmation: 1, // ETH block confirmations
        });

        await sdk.run();

        console.log("Aztec SDK initialized", sdk);
        setIsConnected(true);
        setSigner(ethersProvider.getSigner());
        setEthereumProvider(ethereumProvider);
        setSdk(sdk);
      } catch (e) {
        console.log(e);
      }
    } else {
      setIsConnected(false);
    }
    setConnecting(false);
  }

  async function login() {
    const { publicKey: pubkey, privateKey } = await sdk!.generateAccountKeyPair(ethAccount!)
    console.log("privacy key", privateKey);
    console.log("public key", pubkey.toString());

    setAccountPrivateKey(privateKey);
    setAccountPublicKey(pubkey);
  }

  async function initUsersAndPrintBalances() {

    let account0 = (await sdk!.userExists(accountPublicKey!))
      ? await sdk!.getUser(accountPublicKey!)
      : await sdk!.addUser(accountPrivateKey!);

    setAccount0(account0!);

    if ((await sdk?.isAccountRegistered(accountPublicKey!)))
      setUserExists(true);

    await account0.awaitSynchronised();
    // Wait for the SDK to read & decrypt notes to get the latest balances
    setZkEthBalance(sdk!.fromBaseUnits(
      await sdk!.getBalance(account0.id, sdk!.getAssetIdBySymbol("ETH"))
    ));
    console.log("zkETH balance", zkEthBalance);
  }

  async function getSpendingKey() {
    const { privateKey } = await sdk!.generateSpendingKeyPair(ethAccount!);
    const signer = await sdk?.createSchnorrSigner(privateKey);
    console.log("signer added", signer);
    setSpendingSigner(signer);
  }

  async function registerNewAccount() {
    let alias = "test232";
    const depositTokenQuantity: bigint = ethers.utils
      .parseEther("0.01")
      .toBigInt();
    const recoverySigner = await sdk!.createSchnorrSigner(randomBytes(32));
    let recoverPublicKey = recoverySigner.getPublicKey();
    let txId = await registerAccount(
      accountPublicKey!,
      alias,
      accountPrivateKey!,
      spendingSigner!.getPublicKey(),
      recoverPublicKey,
      EthAddress.ZERO,
      depositTokenQuantity,
      TxSettlementTime.INSTANT,
      ethAccount!,
      sdk!
    );
    console.log("registration txId", txId);
    console.log(
      "lookup tx on explorer",
      `https://aztec-connect-testnet-explorer.aztec.network/goerli/tx/${txId.toString()}`
    );
  }

  async function depositEth() {
    const depositTokenQuantity: bigint = ethers.utils
      .parseEther("0.01")
      .toBigInt();

    let txId = await depositEthToAztec(
      ethAccount!,
      accountPublicKey!,
      depositTokenQuantity,
      TxSettlementTime.INSTANT,
      sdk!,
    );

    console.log("deposit txId", txId);
    console.log(
      "lookup tx on explorer",
      `https://aztec-connect-testnet-explorer.aztec.network/goerli/tx/${txId.toString()}`
    );
  }

  return (
    <div className="w-screen h-screen flex justify-center">
      <div className="max-w-prose">
        {hasMetamask ? (
          isConnected ? (
            <div>
              <h1>Account Info</h1>
              <table className="break-all">
                <thead>
                  <tr>
                    <th className="w-44">Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Ethereum Address</td>
                    <td>{`${ethAccount}`}</td>
                  </tr>
                  <tr>
                    <td>zkETH Balance</td>
                    <td>{`${zkEthBalance}`}</td>
                  </tr>
                  <tr>
                    <td>[Public] Privacy Key</td>
                    <td>{`${accountPublicKey}`}</td>
                  </tr>
                  <tr>
                    <td>[Private] Privacy Key</td>
                    <td>{`${JSON.stringify(accountPrivateKey)}`}</td>
                  </tr>
                  <tr>
                    <td>[Public] Spending Key</td>
                    <td>{`${spendingSigner?.publicKey}`}</td>
                  </tr>
                  <tr>
                    <td>[Private] Spending Key</td>
                    <td>{`${JSON.stringify(spendingSigner?.privateKey)}`}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            // Step 1 - Connect Metamask
            <div>
              <h1>Connect Metamask</h1>
              <p>Welcome to Aztec Interactive. This tutorial will walk you through the process of using Aztec. Before we begin, you would need a Metamask wallet funded with &gt;0.02 ETH on the Goerli Testnet.</p>
              <p>Once that is ready, connect your wallet with the button below.</p>
              <button className="bg-gradient-to-r from-pink-500 to-yellow-500" onClick={() => connect()}>Connect</button>
            </div>
          )
        ) : (
          "Please install metamask"
        )}
        {connecting ? "Loading..." : ""}
        {sdk ? (
          <div>
            <button className="bg-gradient-to-r from-gray-400 to-gray-600" onClick={() => console.log("sdk", sdk)}>[Debug] Log SDK</button>
            {accountPrivateKey && !account0 ? (
              // Step 3 - Explain Privacy Keys + Update Account Balance
              <div>
                <h1>Update Account Balance</h1>
                <p>Your privacy key pair is now generated. This key pair is used to decrypt your Aztec value notes, enabling you to retrieve your account balance on Aztec while maintaining such information encrypted from public knowledge (hence privacy).</p>
                <p>Now that your privacy key pair is ready, you can check your ETH balance available on Aztec with the button below. You should see "zkETH Balance" in your account info above updated once the process completes. If this is your first time interacting with Aztec and no previous deposits were made, you should see a 0 balance.</p>
              </div>
            ) : (
              ""
            )}
            {accountPrivateKey ? (
              <button onClick={() => initUsersAndPrintBalances()}>
                Update zkETH Balance
              </button>
            ) : (
              // Step 2 - Generate Privacy Key Pair
              <div>
                <h1>Generate Privacy Key Pair</h1>
                <p>With your wallet connected, you can now generate the privacy key pair corresponding to your wallet for account registration / login on Aztec.</p>
                <p>An Ethereum public / private key cannot derive an account address / sign transactions directly on Aztec, as Aztec uses a different elliptic curve for cryptographic signature (Grumpkin) than Ethereum (ECDSA) for more efficient SNARK operations.</p>
                <p>To ensure users' access to their Aztec accounts as long as they possess access to their Ethereum accounts, Aztec account keys are derived from messages signed by the user using his/her Ethereum account. Different messages are used to generate different key pairs (privacy / spending). You can generate the privacy key pair using the button below. You should see "Privacy Public Key" and "Privacy Private Key" in your account info above updated once the process completes.</p>
                <button onClick={() => login()}>Generate Privacy Keys</button>
              </div>
            )}
            {spendingSigner && account0 ? (
              <button onClick={() => depositEth()}>Deposit 0.01 ETH</button>
            ) : (
              ""
            )}
            {spendingSigner && !userExists ? (
              // Step 5 - Register Account
              <div>
                <h1>Register Account</h1>
                <p>At this point, account information from previous steps were all generated locally off-chain. To fully enjoy the features Aztec offers, you would have to register an account on Aztec using such information.</p>
                <p>The registration ties a human-readable account alias (≤20 alphanumeric, lowercase characters) to your privacy keys and spending public key, helpful for easing the value transfer UX on Aztec. In production, the user should be offered the choice of a preferred alias, but for testing purpose it is hardcoded as "test232" here.</p>
                <p>The registration also requires ETH value attached to the transaction. The value consists of a minimum deposit of 0.01 ETH (later spendable on Aztec) plus the Aztec network fee for registering the account. In production, the network fee should be set as NEXT_ROLLUP, which batches the user's registration into the next rollup batch at the benefit of lower fees. Yet for testing purpose INSTANT fees is used here instead.</p>
                <p>Now that your keys are ready, you can register your Aztec account with the button below.</p>
                <button onClick={() => registerNewAccount()}>Register Account</button>
              </div>
            ) : (
              ""
            )}
            {!spendingSigner && account0 ? (
              // Step 4 - Generate Spending Key Pair
              <div>
                <h1>Generate Spending Key Pair</h1>
                <p>Similar to privacy keys, a separate set of spending key pair can be generated through signing a different message. This key pair is used to spend your Aztec value notes.</p>
                <p>The separation of the key required to decrypt notes (privacy key) and the key required to spend notes (spending key) theoretically enables users to take advantage of account abstraction. A user for example may generate multiple spending keys to be used on multiple devices respectively, avoiding the risk of sharing the underlying Ethereum account on different devices.</p>
                <p>Aztec value notes are also only spendable by the specific note receiver's spending key marked when the note was created. Using multiple spending keys across environments can also be beneficial to limiting risks against fund losses due to environmental compromisation.</p>
                <p>At this moment however generating one set of spending keys is encouraged for simple UX.</p>
                <p>You can generate a spending key pair using the button below. You should see "Spending Public Key" and "Spending Private Key" in your account info above updated once the process completes.</p>
                <button onClick={() => getSpendingKey()}>Generate Spending Keys</button>
              </div>
            ) : (
              ""
            )}
          </div>
        ) : (
          ""
        )}
      </div>
    </div>
  );
};

export default Home;
