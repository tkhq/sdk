"use client"

import { useTurnkey } from "@turnkey/sdk-react";
import { useEffect, useState } from "react";
import "./dashboard.css";
import {
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  Button,
  Modal,
  Box,
  TextField,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { verifyEthSignature, verifySolSignatureWithAddress } from "../utils";
import { keccak256, toUtf8Bytes } from "ethers";

export default function Dashboard() {
  const { authIframeClient } = useTurnkey();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messageToSign, setMessageToSign] = useState("");
  const [signature, setSignature] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<string | null>(
    null
  );


  useEffect(() => {
    const fetchWhoami = async () => {
      try {
        if (authIframeClient) {
          const whoamiResponse = await authIframeClient.getWhoami({
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
          });
          const wallets = await authIframeClient.getWallets({
            organizationId: whoamiResponse.organizationId,
          });
          const accountsResponse = await authIframeClient.getWalletAccounts({
            organizationId: whoamiResponse.organizationId,
            walletId: wallets.wallets[0].walletId,
          });
          setAccounts(accountsResponse.accounts);
          if (accountsResponse.accounts.length > 0) {
            setSelectedAccount(accountsResponse.accounts[0].address);
          }
          if (authIframeClient && authIframeClient.config) {
            authIframeClient.config.organizationId = whoamiResponse.organizationId!;
          }
        }
      } catch (error) {
        console.error("Error fetching Whoami:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWhoami();
  }, [authIframeClient]);

  const handleAccountSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedAccount(event.target.value); // Save the full address (untruncated)
  };

  const handleSignMessageClick = () => {
    if (!selectedAccount) {
      alert("Please select an account first!");
      return;
    }
    setIsModalOpen(true); // Open the modal
  };

  const handleModalClose = () => {
    setIsModalOpen(false); // Close the modal
    setMessageToSign("");
    setSignature(null);
    setVerificationResult(null);
  };

  const handleSign = async () => {
    try {
      const addressType = selectedAccount?.startsWith("0x") ? "ETH" : "SOL";
      const hashedMessage =
        addressType === "ETH"
          ? keccak256(toUtf8Bytes(messageToSign)) // Ethereum requires keccak256 hash
          : Buffer.from(messageToSign, "utf8").toString("hex"); // Solana doesn't require hashing

      const resp = await authIframeClient?.signRawPayload({
        signWith: selectedAccount!,
        payload: hashedMessage,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction:
          addressType === "ETH"
            ? "HASH_FUNCTION_NO_OP"
            : "HASH_FUNCTION_NOT_APPLICABLE",
      });

      setSignature({ r: resp?.r, s: resp?.s, v: resp?.v });
    } catch (error) {
      console.error("Error signing message:", error);
    }
  };

  const handleVerify = () => {
    if (!signature) return;

    const addressType = selectedAccount?.startsWith("0x") ? "ETH" : "SOL";
    const verificationPassed =
      addressType === "ETH"
        ? verifyEthSignature(
            messageToSign,
            signature.r,
            signature.s,
            signature.v,
            selectedAccount!
          )
        : verifySolSignatureWithAddress(
            messageToSign,
            signature.r,
            signature.s,
            selectedAccount!
          );

    setVerificationResult(
      verificationPassed
        ? `Signed with: ${selectedAccount}`
        : "Verification failed"
    );
  };

  return (
    <main className="main">
      <div className="authConfigCard">
        <Typography variant="h6" className="configTitle">
          Login Methods
        </Typography>
      </div>
      <div className="authComponent">
        <div className="authConfigCard">
          <h3>Wallets</h3>
          <RadioGroup value={selectedAccount} onChange={handleAccountSelect}>
            <div className="accountContainer">
              {accounts.map((account: any, index: number) => (
                <div key={index} className="accountRow">
                  {account.addressFormat === "ADDRESS_FORMAT_ETHEREUM" && (
                    <img
                      src="/eth.svg"
                      style={{
                        width: "32px",
                        height: "32px",
                        marginLeft: "8px",
                        marginRight: "8px",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          `https://etherscan.io/address/${account.address}`,
                          "_blank"
                        )
                      }
                    />
                  )}
                  {account.addressFormat === "ADDRESS_FORMAT_SOLANA" && (
                    <img
                      src="/solana.svg"
                      style={{
                        width: "32px",
                        height: "32px",
                        marginLeft: "8px",
                        marginRight: "8px",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        window.open(
                          `https://solscan.io/account/${account.address}`,
                          "_blank"
                        )
                      }
                    />
                  )}
                  <span className="accountAddress">{`${account.address.slice(
                    0,
                    5
                  )}...${account.address.slice(-5)}`}</span>
                  <FormControlLabel
                    value={account.address}
                    control={
                      <Radio
                        sx={{
                          color: "var(--Greyscale-900, #2b2f33)",
                          "&.Mui-checked": {
                            color: "var(--Greyscale-900, #2b2f33)",
                          },
                        }}
                      />
                    }
                    label=""
                    className="radioButton"
                  />
                </div>
              ))}
              <button className="signMessage" onClick={handleSignMessageClick}>
                Sign a message
              </button>
            </div>
          </RadioGroup>

          <div className="exportImportGroup">
            <button>Export wallet</button>
            <button className="exportImportButton">Import wallet</button>
          </div>
          <div className="authFooter">
            <div className="authFooterLeft">
              <div className="authFooterButton">
                <LogoutIcon />
                <Typography>Log out</Typography>
              </div>
            </div>
            <div className="authFooterSeparatorVertical" />
            <div className="authFooterRight">
              <div className="authFooterButton">
                <DeleteOutlineIcon sx={{ color: "#FB4E2B" }} />
                <Typography>Delete account</Typography>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal open={isModalOpen} onClose={handleModalClose}>
  <Box
    sx={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 400,
      bgcolor: "var(--Greyscale-20, #f5f7fb)", 
      boxShadow: 24,
      p: 4,
      borderRadius: 2,
    }}
  >
        <Typography variant="h6" className="modalTitle">
          Sign a Message
        </Typography>
        <Typography
      variant="subtitle2"
      sx={{
        color: "#6C727E",
      }}
    >
      Signing this message will not cost you any fees.
    </Typography>
    <TextField
      fullWidth
      margin="normal"
      value={messageToSign}
      onChange={(e) => setMessageToSign(e.target.value)}
      sx={{
        bgcolor: "#ffffff", 
        "& .MuiOutlinedInput-root": {
          height: "80px", // Set the height of the input field
          alignItems: "flex-start", // Align text to the top
          "& fieldset": {
            borderColor: "#D0D5DD", // Default border color
          },
          "&:hover fieldset": {
            borderColor: "#8A929E", // Hover border color
          },
          "&.Mui-focused fieldset": {
            borderColor: "#D0D5DD", // Focus highlight color
            border: "1px solid"
          },
        },
      }}
    />
    <button
      onClick={handleSign}
      style={{
        marginTop: "12px",
      }}
    >
      Sign
    </button>
    {signature && (
      <>
        <Typography
          sx={{ mt: 2, wordBreak: "break-word" }}
        >{`Signature: ${JSON.stringify(signature)}`}</Typography>
        <button
          style={{
            marginTop: "12px",
          }}
          onClick={handleVerify}
        >
          Verify
        </button>
      </>
    )}
    {verificationResult && (
      <Typography
        sx={{
          mt: 2,
          color: verificationResult.startsWith("Signed")
            ? "green"
            : "red",
        }}
      >
        {verificationResult}
      </Typography>
    )}
  </Box>
</Modal>

    </main>
  );
}
