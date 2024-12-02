"use client"

import { Export, Import, useTurnkey, getSuborgs } from "@turnkey/sdk-react";
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { verifyEthSignature, verifySolSignatureWithAddress } from "../utils";
import { keccak256, toUtf8Bytes } from "ethers";
import { useRouter } from "next/navigation";
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import LaunchIcon from '@mui/icons-material/Launch';
import { appleOidcToken, facebookOidcToken, googleOidcToken } from "../utils/oidc";

export default function Dashboard() {
  const router = useRouter();
  const { turnkey, getActiveClient, authIframeClient, passkeyClient } = useTurnkey();
  const [loading, setLoading] = useState(true);
  const [iframeClient, setIframeClient] = useState<any>();
  const [accounts, setAccounts] = useState<any>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [messageToSign, setMessageToSign] = useState("Signing within Turnkey Demo");
  const [signature, setSignature] = useState<any>(null);
  const [suborgId, setSuborgId] = useState<string>("")
  const [user, setUser] = useState<any>("")
  const [messageSigningResult, setMessageSigningResult] = useState<string | null>(
    null
  );
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleDeleteOauth = async (oauthType: string) => {
    let providerId
    switch (oauthType) {
      case "Apple":
        providerId = user?.oauthProviders?.find((provider: { issuer: string }) => provider.issuer.toLowerCase().includes("apple"))?.providerId || null;
        break;
  
      case "Facebook":
        providerId = user?.oauthProviders?.find((provider: { issuer: string }) => provider.issuer.toLowerCase().includes("facebook"))?.providerId || null;
        break;
  
      case "Google":
        providerId = user?.oauthProviders?.find((provider: { issuer: string }) => provider.issuer.toLowerCase().includes("google"))?.providerId || null;
        break;
  
      default:
        console.error(`Unknown OAuth type: ${oauthType}`);
    }

    if (providerId){
      await authIframeClient?.deleteOauthProviders({organizationId: suborgId, userId: user.userId, providerIds: [providerId]})
      window.location.reload();
    }
  }

  const handleAddOauth = async (oauthType: string) => {
    let oidcToken
    switch (oauthType) {
      case "Apple":
        oidcToken = await appleOidcToken({iframePublicKey: authIframeClient?.iframePublicKey!, clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!, redirectURI: `${process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!}dashboard`})
        break;
  
      case "Facebook":
        oidcToken = await facebookOidcToken({iframePublicKey: authIframeClient?.iframePublicKey!, clientId: process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID!, redirectURI: `${process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!}dashboard`})
        break;
  
      case "Google":
        oidcToken = await googleOidcToken({iframePublicKey: authIframeClient?.iframePublicKey!, clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!, redirectURI: `${process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!}dashboard`})
        break;
  
      default:
        console.error(`Unknown OAuth type: ${oauthType}`);
    }
    if (oidcToken){
      const suborgs = await getSuborgs({filterType:"OIDC_TOKEN", filterValue:oidcToken.idToken})
      if (suborgs!.organizationIds.length > 0){
        alert("Social login is already connected to another account")
        return
      }
      await authIframeClient?.createOauthProviders({organizationId: suborgId, userId: user.userId, oauthProviders: [{providerName: `TurnkeyDemoApp - ${Date.now()}`, oidcToken: oidcToken.idToken}]})
      window.location.reload();
    }
  }

  const handleAddPasskey = async () => {
    const siteInfo = `${new URL(window.location.href).hostname} - ${new Date().toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
  })}`;
    const { encodedChallenge, attestation } =
      (await passkeyClient?.createUserPasskey({
        publicKey: { user: { name: siteInfo, displayName: siteInfo } },
      })) || {};

    if (encodedChallenge && attestation) {
      authIframeClient?.createAuthenticators({organizationId: suborgId, userId: user.userId, authenticators: [{authenticatorName: `Passkey - ${Date.now()}`, challenge:encodedChallenge, attestation  }]})
      window.location.reload();
    }
  }

  const handleDeletePasskey = async () => {
    const authenticators = await authIframeClient?.getAuthenticators({organizationId: suborgId, userId: user.userId})
    const authenticatorId = authenticators?.authenticators[0].authenticatorId
    await authIframeClient?.deleteAuthenticators({organizationId: suborgId, userId: user.userId, authenticatorIds:[authenticatorId!]})
    window.location.reload();
  }

  const handleDropdownClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleDropdownClose = () => {
    setAnchorEl(null);
  };

  const handleDeleteAccount: any = async () => {
    authIframeClient?.deleteSubOrganization({organizationId: suborgId, deleteWithoutExport: true})
    await handleLogout()
  }

const handleLogout: any = async () => {
  turnkey?.logoutUser()
  router.push("/");
}
useEffect(() => {
  const manageSession = async () => {
    try {
      if (turnkey && authIframeClient) {
        const session = await turnkey?.getReadWriteSession();
        if (!session || Date.now() > session!.sessionExpiry) {
          await handleLogout();
        }

        const iframeClient = await getActiveClient();
        setIframeClient(iframeClient);

        const whoami = await iframeClient?.getWhoami();
        const suborgId = whoami?.organizationId;
        setSuborgId(suborgId!)

        const userResponse = await iframeClient!.getUser({organizationId: suborgId!, userId: whoami?.userId!})
        setUser(userResponse.user)
        const walletsResponse = await iframeClient!.getWallets({
          organizationId: suborgId!,
        });
        setWallets(walletsResponse.wallets);

        // Default to the first wallet if available
        if (walletsResponse.wallets.length > 0) {
          const defaultWalletId = walletsResponse.wallets[0].walletId;
          setSelectedWallet(defaultWalletId);

          const accountsResponse = await iframeClient!.getWalletAccounts({
            organizationId: suborgId!,
            walletId: defaultWalletId,
          });
          setAccounts(accountsResponse.accounts);
          if (accountsResponse.accounts.length > 0) {
            setSelectedAccount(accountsResponse.accounts[0].address);
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  manageSession();
}, [authIframeClient, turnkey]);


  const getWallets = async () => {
    const walletsResponse = await iframeClient!.getWallets({
      organizationId: suborgId!,
    });
    setWallets(walletsResponse.wallets);
    
  }
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
    setSignature(null);
    setMessageSigningResult(null);
  };


  const handleWalletSelect = async (walletId: string) => {
    setSelectedWallet(walletId);
    setAnchorEl(null); // Close the dropdown
  
    // Fetch accounts for the selected wallet
    const accountsResponse = await iframeClient!.getWalletAccounts({
      organizationId: suborgId!,
      walletId,
    });
    setAccounts(accountsResponse.accounts);
    if (accountsResponse.accounts.length > 0) {
      setSelectedAccount(accountsResponse.accounts[0].address);
    } else {
      setSelectedAccount(null); // Clear selected account if no accounts found
    }
  };

  const handleSign = async () => {
    try {
      const addressType = selectedAccount?.startsWith("0x") ? "ETH" : "SOL";
      const hashedMessage = addressType === "ETH"
          ? keccak256(toUtf8Bytes(messageToSign)) // Ethereum requires keccak256 hash
          : Buffer.from(messageToSign, "utf8").toString("hex"); // Solana doesn't require hashing
      
      const resp = await iframeClient?.signRawPayload({
        organizationId: suborgId!,
        signWith: selectedAccount!,
        payload: hashedMessage,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction:
          addressType === "ETH"
            ? "HASH_FUNCTION_NO_OP"
            : "HASH_FUNCTION_NOT_APPLICABLE",
      });
      setMessageSigningResult("✔ Success! Message signed")
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

    setMessageSigningResult(
      verificationPassed
        ? `Verified! The address used to sign the message matches your wallet address: ${`${selectedAccount!.slice(
          0,
          5
        )}...${selectedAccount!.slice(-5)}`}`
        : "Verification failed"
    );
  };

  return (
    <main className="main">
      <link rel="preload" href="/eth-hover.svg" as="image"/>
      <link rel="preload" href="/solana-hover.svg" as="image"/>
      <div className="dashboardCard">
        <Typography variant="h6" className="configTitle">
          Login methods
        </Typography>
        <div className = "loginMethodContainer">
        <div className="loginMethodRow">
  <div className="labelContainer">
    <img src="/mail.svg" className="iconSmall" />
    <Typography>Email</Typography>
    {user && user.userEmail && (
      <span className="loginMethodDetails">{user.userEmail}</span>
    )}
  </div>
  {user && user.userEmail ? (
    <RemoveCircleIcon
      sx={{ cursor: "pointer", color: "#D8DBE3" }}
    />
  ) : (
    <AddCircleIcon sx={{ cursor: "pointer" }} />
  )}
</div>


<div className="loginMethodRow">
  <div className="labelContainer">
    <img src="/phone.svg" className="iconSmall" />
    <Typography>Phone</Typography>
    {user && user.userPhoneNumber && (
      <span className="loginMethodDetails">{user.userPhoneNumber}</span>
    )}
  </div>
  {user && user.userPhoneNumber ? (
    <RemoveCircleIcon
      sx={{ cursor: "pointer", color: "#D8DBE3" }}
    />
  ) : (
    <AddCircleIcon sx={{ cursor: "pointer" }} />
  )}
</div>

<div className="loginMethodRow">
  <div className="labelContainer">
    <img src="/key.svg" className="iconSmall" />
    <Typography>Passkey</Typography>
    {user && user.authenticators && user.authenticators.length > 0 && (
      <span className="loginMethodDetails">{user.authenticators[0].credentialId}</span>
    )}
  </div>
  {user && user.authenticators && user.authenticators.length > 0 ? (
    <div onClick = {()=> handleDeletePasskey()}>
    <RemoveCircleIcon
      sx={{ cursor: "pointer", color: "#D8DBE3" }}
    />
    </div>
  ) : (
    <div onClick = {() => handleAddPasskey()}>
    <AddCircleIcon sx={{ cursor: "pointer" }} />
    </div>
  )}
</div>

        <Typography className="socialsTitle">
          Socials
        </Typography>   
        <div className="loginMethodRow">
  <div className="labelContainer">
    <img src="/google.svg" className="iconSmall" />
    <Typography>Google</Typography>
    {user && user.oauthProviders && user.oauthProviders.some(
  (provider: { issuer: string; }) => provider.issuer.toLowerCase().includes("google"))
 && (
      <span className="loginMethodDetails">{}</span>
    )}
  </div>
  {user && user.oauthProviders && user.oauthProviders.some(
  (provider: { issuer: string; }) => provider.issuer.toLowerCase().includes("google")
) ? (
  <div onClick = {()=> handleDeleteOauth("Google")}>
    <RemoveCircleIcon
      sx={{ cursor: "pointer", color: "#D8DBE3" }}
    />
    </div>
  ) : (
    <div onClick = {() => handleAddOauth("Google")} >
    <AddCircleIcon sx={{ cursor: "pointer" }} />
    </div>
  )}
</div>
<div className="loginMethodRow">
  <div className="labelContainer">
    <img src="/apple.svg" className="iconSmall" />
    <Typography>Apple</Typography>
  </div>
  {user && user.oauthProviders && user.oauthProviders.some(
  (provider: { issuer: string; }) => provider.issuer.toLowerCase().includes("apple")
) ? (
  <div onClick = {()=> handleDeleteOauth("Apple")}>
    <RemoveCircleIcon
      sx={{ cursor: "pointer", color: "#D8DBE3" }}
    />
    </div>
  ) : (
    <div onClick ={() => handleAddOauth("Apple")}>
    <AddCircleIcon sx={{ cursor: "pointer" }} />
    </div>
  )}
</div>
<div className="loginMethodRow">
  <div className="labelContainer">
    <img src="/facebook.svg" className="iconSmall" />
    <Typography>Facebook</Typography>
  </div>
  {user && user.oauthProviders && user.oauthProviders.some(
  (provider: { issuer: string; }) => provider.issuer.toLowerCase().includes("facebook")
) ? (
  <div onClick = {()=> handleDeleteOauth("Facebook")}>
    <RemoveCircleIcon
      sx={{ cursor: "pointer", color: "#D8DBE3" }}
    />
    </div>
  ) : (
    <div onClick ={() => handleAddOauth("Facebook")}>
    <AddCircleIcon sx={{ cursor: "pointer" }} />
    </div>
  )}
</div>
        </div>
      </div>
      <div className="dashboardComponent">
        <div className="dashboardCard">
          <div
  style={{
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    marginTop: "16px",
    marginBottom: "16px",
  }}
  onClick={handleDropdownClick}
>
  <Typography variant="body1" style={{ marginRight: "2px", fontSize: "1.5rem", fontWeight: "600" }}>
    {wallets.find((wallet) => wallet.walletId === selectedWallet)?.walletName ||
      "Select Wallet"}
  </Typography>
  <ArrowDropDownIcon />
</div>

<Menu
  anchorEl={anchorEl}
  open={Boolean(anchorEl)}
  onClose={handleDropdownClose}
>
  {wallets.map((wallet) => (
    <MenuItem
      key={wallet.walletId}
      onClick={() => handleWalletSelect(wallet.walletId)}
    >
      {wallet.walletName || wallet.walletId}
    </MenuItem>
  ))}
</Menu>
          <RadioGroup value={selectedAccount} onChange={handleAccountSelect}>
            <div className="accountContainer">
              {accounts.map((account: any, index: number) => (
                <div
  key={index}
  className="accountRow"
  onClick={() => setSelectedAccount(account.address)} // Ensures the radio button is selected
  style={{
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  }}
>
  <div
    className="hoverContainer"
    onClick={() =>
      window.open(
        account.addressFormat === "ADDRESS_FORMAT_ETHEREUM"
          ? `https://etherscan.io/address/${account.address}`
          : `https://solscan.io/account/${account.address}`,
        "_blank"
      )
    }
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
    }}
  >
    {account.addressFormat === "ADDRESS_FORMAT_ETHEREUM" && (
      <div className="eth-icon" />
    )}
    {account.addressFormat === "ADDRESS_FORMAT_SOLANA" && (
      <div className="sol-icon" />
    )}
    <span className="accountAddress">{`${account.address.slice(
      0,
      5
    )}...${account.address.slice(-5)}`}</span>
    <LaunchIcon className="launchIcon" />
  </div>
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
    style={{ pointerEvents: "none" }} // Ensures radio works via the parent click
  />
</div>



              ))}
              <button className="signMessage" onClick={handleSignMessageClick}>
                Sign a message
              </button>
            </div>
          </RadioGroup>

          <div className="exportImportGroup">
          <Export walletId = {selectedWallet!}></Export>
          <Import onSuccess = {getWallets}/>
          </div>
          <div className="authFooter">
            <div className="authFooterLeft">
              <div onClick ={handleLogout} className="authFooterButton">
                <LogoutIcon />
                <Typography>Log out</Typography>
              </div>
            </div>
            <div className="authFooterSeparatorVertical" />
            <div className="authFooterRight">
              <div onClick= {() => setIsDeleteModalOpen(true)}className="authFooterButton">
                <DeleteOutlineIcon sx={{ color: "#FB4E2B" }} />
                <Typography>Delete account</Typography>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Modal open={isDeleteModalOpen}>
  <Box
    sx={{
      outline: "none",
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
    <div
      onClick={()=> setIsDeleteModalOpen(false)}
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        background: "none",
        border: "none",
        fontSize: "20px",
        fontWeight: "bold",
        cursor: "pointer",
        color: "#6C727E",
      }}
    >
      &times;
    </div>
    <Typography variant="h6" className="modalTitle">
    Confirm account deletion
    </Typography>
    <Typography
      variant="subtitle2"
      sx={{
        color: "#6C727E",
        marginTop: "8px",
      }}
    >
      This action can not be undone.
    </Typography>
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "16px",
        gap: "12px",
      }}
    >
      <button
        style={{
          padding: "8px 16px",
          background: "#FB4E2B",
          color: "#ffffff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
        onClick={handleDeleteAccount}
      >
        Continue
      </button>
    </div>
  </Box>
</Modal>


      <Modal open={isModalOpen} onClose={handleModalClose}>
  <Box
    sx={{
      outline: "none",
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
        <div
      onClick={handleModalClose}
      style={{
        position: "absolute",
        top: "16px",
        right: "16px",
        background: "none",
        border: "none",
        fontSize: "20px",
        fontWeight: "bold",
        cursor: "pointer",
        color: "#6C727E",
      }}
    >
      &times;
    </div>
        <Typography variant="h6" className="modalTitle">
          Sign a message
        </Typography>
        <Typography
      variant="subtitle2"
      sx={{
        color: "#6C727E",
      }}
    >
      This helps prove you signed a message using your address
    </Typography>
    <TextField
      fullWidth
      margin="normal"
      value={signature ? JSON.stringify(signature) : messageToSign}
      rows = {5}
      multiline
      onChange={(e) => signature ? setSignature(JSON.parse(e.target.value)) : setMessageToSign(e.target.value)}
      sx={{
        bgcolor: "#ffffff", 
        "& .MuiOutlinedInput-root": {
          height: "auto", 
          alignItems: "flex-start",
          "& fieldset": {
            borderColor: "#D0D5DD",
          },
          "&:hover fieldset": {
            borderColor: "#8A929E",
          },
          "&.Mui-focused fieldset": {
            borderColor: "#D0D5DD",
            border: "1px solid",
          },
        },
        "& .MuiInputBase-input": {
          whiteSpace: "pre-wrap", 
          wordWrap: "break-word",
        },
      }}
    />
    {signature ? 
        <button
          style={{
            marginTop: "12px",
          }}
          onClick={handleVerify}
        >
          Verify
        </button>
        :     <button
      onClick={handleSign}
      style={{
        marginTop: "12px",
      }}
    >
      Sign
    </button>
    }
    {messageSigningResult && (
      <Typography
        sx={{
          mt: 2,
          color: (messageSigningResult.startsWith("Verified") ||  messageSigningResult.startsWith("✔"))
            ? "green"
            : "red",
        }}
      >
        {messageSigningResult}
      </Typography>
    )}
  </Box>
</Modal>

    </main>
  );
}
