"use client";

import { Auth, useTurnkey } from "@turnkey/sdk-react";
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
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { verifyEthSignature, verifySolSignatureWithAddress } from "../utils";
import { keccak256, toUtf8Bytes } from "ethers";

export default function Dashboard() {
  const { authIframeClient } = useTurnkey();
  const [orgData, setOrgData] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messageToSign, setMessageToSign] = useState("");
  const [suborgId, setSuborgId] = useState("")
  useEffect(() => {
    const fetchWhoami = async () => {
      try {
        if (authIframeClient) {
          const whoamiResponse = await authIframeClient.getWhoami({
            organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
          });
          setSuborgId(whoamiResponse.organizationId!)
          const wallets = await authIframeClient.getWallets({
            organizationId: whoamiResponse.organizationId,
          });
          const accountsResponse = await authIframeClient.getWalletAccounts({
            organizationId: whoamiResponse.organizationId,
            walletId: wallets.wallets[0].walletId,
          });
          setAccounts(accountsResponse.accounts);
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
  };

  const handleSign = async () => {
    console.log("Message to sign:", messageToSign);
    console.log("Using address:", selectedAccount);
    const addressType = selectedAccount?.startsWith("0x") ? "ETH" : "SOL"

    const hashedMessage =
    addressType === "ETH"
      ? keccak256(toUtf8Bytes(messageToSign)) // Ethereum requires keccak256 hash
      : Buffer.from(messageToSign, "utf8").toString("hex"); // Solana doesn't require hashing


    const resp = await authIframeClient?.signRawPayload({organizationId: suborgId, signWith: selectedAccount!, payload: hashedMessage, encoding: "PAYLOAD_ENCODING_HEXADECIMAL", hashFunction: addressType === "ETH" ? "HASH_FUNCTION_NO_OP" : "HASH_FUNCTION_NOT_APPLICABLE"})
    if (addressType === "ETH"){
        console.log(verifyEthSignature(messageToSign, resp?.r!, resp?.s!, resp?.v!))
    }
    else {
        console.log(verifySolSignatureWithAddress(messageToSign, resp?.r!, resp?.s!, selectedAccount!))
    }
    setIsModalOpen(false); // Close the modal after signing
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
                      }}
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
                      }}
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
            <button>Export Wallet</button>
            <button className="exportImportButton">Import Wallet</button>
          </div>
          <div className="authFooter">
            <div className="authFooterLeft">
              <div className="authFooterButton">
                <LogoutIcon />
                <Typography>Logout</Typography>
              </div>
            </div>
            <div className="authFooterSeparatorVertical" />
            <div className="authFooterRight">
              <div className="authFooterButton">
                <DeleteOutlineIcon sx={{ color: "#FB4E2B" }} />
                <Typography>Delete Account</Typography>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal open={isModalOpen} onClose={handleModalClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            bgcolor: "background.paper",
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" component="h2">
            Sign a Message
          </Typography>
          <TextField
            fullWidth
            margin="normal"
            label="Message"
            value={messageToSign}
            onChange={(e) => setMessageToSign(e.target.value)}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSign}
            sx={{ mt: 2 }}
          >
            Sign
          </Button>
        </Box>
      </Modal>
    </main>
  );
}
