"use client";

import {
  Export,
  Import,
  useTurnkey,
  OtpVerification,
  OtpType,
} from "@turnkey/sdk-react";

import { server } from "@turnkey/sdk-server";
import { useEffect, useState } from "react";
import "./dashboard.css";
import {
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  Modal,
  Box,
  TextField,
  MenuItem,
  Menu,
  CircularProgress,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  verifyEthSignatureWithAddress,
  verifySolSignatureWithAddress,
} from "../utils";
import { keccak256, toUtf8Bytes } from "ethers";
import { useRouter } from "next/navigation";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import LaunchIcon from "@mui/icons-material/Launch";
import {
  appleOidcToken,
  facebookOidcToken,
  googleOidcToken,
} from "../utils/oidc";
import { MuiPhone } from "../components/PhoneInput";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Navbar from "../components/Navbar";
import { Toaster, toast } from "sonner";

export default function Dashboard() {
  const router = useRouter();
  const { turnkey, authIframeClient, passkeyClient } = useTurnkey();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [messageToSign, setMessageToSign] = useState(
    "Signing within Turnkey Demo.",
  );
  const [signature, setSignature] = useState<any>(null);
  const [suborgId, setSuborgId] = useState<string>("");
  const [isVerifiedEmail, setIsVerifiedEmail] = useState<boolean>(false);
  const [isVerifiedPhone, setIsVerifiedPhone] = useState<boolean>(false);
  const [user, setUser] = useState<any>("");
  const [otpId, setOtpId] = useState("");
  const [messageSigningResult, setMessageSigningResult] = useState<
    string | null
  >(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const handleExportSuccess = async () => {
    toast.success("Wallet successfully exported");
  };
  const handleImportSuccess = async () => {
    await getWallets();
    toast.success("Wallet successfully imported");
  };
  const handleResendEmail = async () => {
    const sendOtpResponse = await server.sendOtp({
      suborgID: suborgId,
      otpType: OtpType.Email,
      contact: emailInput,
      userIdentifier: authIframeClient?.iframePublicKey!,
    });
    if (!sendOtpResponse || !sendOtpResponse.otpId!) {
      toast.error("Failed to send OTP");
      return;
    }
    setOtpId(sendOtpResponse?.otpId!);
  };
  const handleResendSms = async () => {
    const sendOtpResponse = await server.sendOtp({
      suborgID: suborgId,
      otpType: OtpType.Sms,
      contact: phoneInput,
      customSmsMessage: "Your Turnkey Demo OTP is {{.OtpCode}}",
      userIdentifier: authIframeClient?.iframePublicKey!,
    });
    if (!sendOtpResponse || !sendOtpResponse.otpId!) {
      toast.error("Failed to send OTP");
      return;
    }
    setOtpId(sendOtpResponse?.otpId!);
  };

  const handleOtpSuccess = async (credentialBundle: any) => {
    window.location.reload();
  };
  const handleOpenEmailModal = () => {
    setIsEmailModalOpen(true);
  };
  const handleOpenPhoneModal = () => {
    setIsPhoneModalOpen(true);
  };
  const handleEmailSubmit = async () => {
    if (!emailInput) {
      toast.error("Please enter a valid email address");
      return;
    }
    const suborgs = await server.getVerifiedSuborgs({
      filterType: "EMAIL",
      filterValue: emailInput,
    });
    if (suborgs && suborgs!.organizationIds.length > 0) {
      toast.error("Email is already connected to another account");
      return;
    }
    await authIframeClient?.updateUser({
      organizationId: suborgId,
      userId: user.userId,
      userEmail: emailInput,
    });

    const sendOtpResponse = await server.sendOtp({
      suborgID: suborgId,
      otpType: OtpType.Email,
      contact: emailInput,
      userIdentifier: authIframeClient?.iframePublicKey!,
    });
    if (!sendOtpResponse || !sendOtpResponse.otpId!) {
      toast.error("Failed to send OTP");
      return;
    }
    setOtpId(sendOtpResponse?.otpId!);
    setIsEmailModalOpen(false);
    setIsOtpModalOpen(true);
  };

  const handlePhoneSubmit = async () => {
    if (!phoneInput) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    const suborgs = await server.getVerifiedSuborgs({
      filterType: "PHONE_NUMBER",
      filterValue: phoneInput,
    });
    if (suborgs && suborgs!.organizationIds.length > 0) {
      toast.error("Phone Number is already connected to another account");
      return;
    }
    await authIframeClient?.updateUser({
      organizationId: suborgId,
      userId: user.userId,
      userPhoneNumber: phoneInput,
    });

    const sendOtpResponse = await server.sendOtp({
      suborgID: suborgId,
      otpType: OtpType.Sms,
      contact: phoneInput,
      customSmsMessage: "Your Turnkey Demo OTP is {{.OtpCode}}",
      userIdentifier: authIframeClient?.iframePublicKey!,
    });
    if (!sendOtpResponse || !sendOtpResponse.otpId!) {
      toast.error("Failed to send OTP");
      return;
    }
    setOtpId(sendOtpResponse?.otpId!);
    setIsEmailModalOpen(false);
    setIsOtpModalOpen(true);
  };

  const handleAddOauth = async (oauthType: string) => {
    let oidcToken;
    switch (oauthType) {
      case "Apple":
        oidcToken = await appleOidcToken({
          iframePublicKey: authIframeClient?.iframePublicKey!,
          clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!,
          redirectURI: `${process.env
            .NEXT_PUBLIC_OAUTH_REDIRECT_URI!}dashboard`,
        });
        break;

      case "Facebook":
        oidcToken = await facebookOidcToken({
          iframePublicKey: authIframeClient?.iframePublicKey!,
          clientId: process.env.NEXT_PUBLIC_FACEBOOK_CLIENT_ID!,
          redirectURI: `${process.env
            .NEXT_PUBLIC_OAUTH_REDIRECT_URI!}dashboard`,
        });
        break;

      case "Google":
        oidcToken = await googleOidcToken({
          iframePublicKey: authIframeClient?.iframePublicKey!,
          clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
          redirectURI: `${process.env
            .NEXT_PUBLIC_OAUTH_REDIRECT_URI!}dashboard`,
        });
        break;

      default:
        console.error(`Unknown OAuth type: ${oauthType}`);
    }
    if (oidcToken) {
      const suborgs = await server.getSuborgs({
        filterType: "OIDC_TOKEN",
        filterValue: oidcToken.idToken,
      });
      if (suborgs!.organizationIds.length > 0) {
        toast.error("Social login is already connected to another account");
        return;
      }
      await authIframeClient?.createOauthProviders({
        organizationId: suborgId,
        userId: user.userId,
        oauthProviders: [
          {
            providerName: `TurnkeyDemoApp - ${Date.now()}`,
            oidcToken: oidcToken.idToken,
          },
        ],
      });
      window.location.reload();
    }
  };

  const handleAddPasskey = async () => {
    const siteInfo = `${
      new URL(window.location.href).hostname
    } - ${new Date().toLocaleString(undefined, {
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
      await authIframeClient?.createAuthenticators({
        organizationId: suborgId,
        userId: user.userId,
        authenticators: [
          {
            authenticatorName: `Passkey - ${Date.now()}`,
            challenge: encodedChallenge,
            attestation,
          },
        ],
      });

      window.location.reload();
    }
  };

  const handleDropdownClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleDropdownClose = () => {
    setAnchorEl(null);
  };

  const handleDeleteAccount: any = async () => {
    await authIframeClient?.deleteSubOrganization({
      organizationId: suborgId,
      deleteWithoutExport: true,
    });
    await handleLogout();
  };

  const handleLogout: any = async () => {
    console.log("handleLogout");
    await turnkey?.logout();
    router.push("/");
  };

  useEffect(() => {
    const manageSession = async () => {
      try {
        if (turnkey && authIframeClient) {
          const session = await turnkey?.getSession();
          if (!session || Date.now() > session.expiry) {
            await handleLogout();
          }

          await authIframeClient.injectCredentialBundle(session.token);

          const suborgId = session?.organizationId;
          setSuborgId(suborgId!);

          const userResponse = await authIframeClient!.getUser({
            organizationId: suborgId!,
            userId: session?.userId!,
          });

          setUser(userResponse.user);
          const walletsResponse = await authIframeClient!.getWallets({
            organizationId: suborgId!,
          });
          setWallets(walletsResponse.wallets);
          if (userResponse.user.userEmail) {
            const suborgs = await server.getVerifiedSuborgs({
              filterType: "EMAIL",
              filterValue: userResponse.user.userEmail,
            });

            if (
              suborgs &&
              suborgs!.organizationIds.length > 0 &&
              suborgs!.organizationIds[0] == suborgId
            ) {
              setIsVerifiedEmail(true);
            }
          }
          if (userResponse.user.userPhoneNumber) {
            const suborgs = await server.getVerifiedSuborgs({
              filterType: "PHONE_NUMBER",
              filterValue: userResponse.user.userPhoneNumber,
            });
            if (
              suborgs &&
              suborgs!.organizationIds.length > 0 &&
              suborgs!.organizationIds[0] == suborgId
            ) {
              setIsVerifiedPhone(true);
            }
          }

          // Default to the first wallet if available
          if (walletsResponse.wallets.length > 0) {
            const defaultWalletId = walletsResponse.wallets[0].walletId;
            setSelectedWallet(defaultWalletId);

            const accountsResponse = await authIframeClient!.getWalletAccounts({
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
    if (authIframeClient) {
      manageSession();
    }
  }, [authIframeClient, turnkey]);

  const getWallets = async () => {
    const walletsResponse = await authIframeClient!.getWallets({
      organizationId: suborgId!,
    });
    setWallets(walletsResponse.wallets);
  };
  const handleAccountSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedAccount(event.target.value); // Save the full address (untruncated)
  };

  const handleSignMessageClick = () => {
    if (!selectedAccount) {
      toast.error("Please select an account first!");
      return;
    }
    setIsSignModalOpen(true);
  };

  const handleModalClose = () => {
    setIsSignModalOpen(false);
    setSignature(null);
    setMessageSigningResult(null);
  };

  const handleWalletSelect = async (walletId: string) => {
    setSelectedWallet(walletId);
    setAnchorEl(null);

    // Fetch accounts for the selected wallet
    const accountsResponse = await authIframeClient!.getWalletAccounts({
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
      const hashedMessage =
        addressType === "ETH"
          ? keccak256(toUtf8Bytes(messageToSign)) // Ethereum requires keccak256 hash
          : Buffer.from(messageToSign, "utf8").toString("hex"); // Solana doesn't require hashing

      const resp = await authIframeClient?.signRawPayload({
        organizationId: suborgId!,
        signWith: selectedAccount!,
        payload: hashedMessage,
        encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
        hashFunction:
          addressType === "ETH"
            ? "HASH_FUNCTION_NO_OP"
            : "HASH_FUNCTION_NOT_APPLICABLE",
      });
      setMessageSigningResult("Success! Message signed.");
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
        ? verifyEthSignatureWithAddress(
            messageToSign,
            signature.r,
            signature.s,
            signature.v,
            selectedAccount!,
          )
        : verifySolSignatureWithAddress(
            messageToSign,
            signature.r,
            signature.s,
            selectedAccount!,
          );

    setMessageSigningResult(
      verificationPassed
        ? "Verified! The address used to sign the message matches your wallet address."
        : "Verification failed.",
    );
  };
  if (loading) {
    return (
      <main className="main">
        <Navbar />
        <div className="loaderOverlay">
          <CircularProgress
            size={80}
            thickness={1}
            className="circularProgress"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="main">
      <Navbar />
      <link rel="preload" href="/eth-hover.svg" as="image" />
      <link rel="preload" href="/solana-hover.svg" as="image" />
      <div className="dashboardCard">
        <div className="configTitle">Login methods</div>
        <div className="loginMethodContainer">
          <div className="loginMethodRow">
            <div className="labelContainer">
              <img src="/mail.svg" className="iconSmall" />
              <Typography>Email</Typography>
              {user && user.userEmail && isVerifiedEmail && (
                <span className="loginMethodDetails">{user.userEmail}</span>
              )}
            </div>
            {user && user.userEmail && isVerifiedEmail ? (
              <CheckCircleIcon sx={{ color: "#4c48ff" }} />
            ) : (
              <div onClick={handleOpenEmailModal}>
                <AddCircleIcon sx={{ cursor: "pointer" }} />
              </div>
            )}
          </div>

          <div className="loginMethodRow">
            <div className="labelContainer">
              <img src="/phone.svg" className="iconSmall" />
              <Typography>Phone</Typography>
              {user && user.userPhoneNumber && isVerifiedPhone && (
                <span className="loginMethodDetails">
                  {user.userPhoneNumber}
                </span>
              )}
            </div>
            {user && user.userPhoneNumber && isVerifiedPhone ? (
              <CheckCircleIcon sx={{ color: "#4c48ff" }} />
            ) : (
              <div onClick={handleOpenPhoneModal}>
                <AddCircleIcon sx={{ cursor: "pointer" }} />
              </div>
            )}
          </div>

          <div className="loginMethodRow">
            <div className="labelContainer">
              <img src="/key.svg" className="iconSmall" />
              <Typography>Passkey</Typography>
            </div>
            {user && user.authenticators && user.authenticators.length > 0 ? (
              <CheckCircleIcon sx={{ color: "#4c48ff" }} />
            ) : (
              <div onClick={() => setIsPasskeyModalOpen(true)}>
                <AddCircleIcon sx={{ cursor: "pointer" }} />
              </div>
            )}
          </div>

          <div className="socialsTitle">Socials</div>
          <div className="loginMethodRow">
            <div className="labelContainer">
              <img src="/google.svg" className="iconSmall" />
              <Typography>Google</Typography>
              {user &&
                user.oauthProviders &&
                user.oauthProviders.some((provider: { issuer: string }) =>
                  provider.issuer.toLowerCase().includes("google"),
                ) && <span className="loginMethodDetails">{}</span>}
            </div>
            {user &&
            user.oauthProviders &&
            user.oauthProviders.some((provider: { issuer: string }) =>
              provider.issuer.toLowerCase().includes("google"),
            ) ? (
              <CheckCircleIcon sx={{ color: "#4c48ff" }} />
            ) : (
              <div onClick={() => handleAddOauth("Google")}>
                <AddCircleIcon sx={{ cursor: "pointer" }} />
              </div>
            )}
          </div>
          <div className="loginMethodRow">
            <div className="labelContainer">
              <img src="/apple.svg" className="iconSmall" />
              <Typography>Apple</Typography>
            </div>
            {user &&
            user.oauthProviders &&
            user.oauthProviders.some((provider: { issuer: string }) =>
              provider.issuer.toLowerCase().includes("apple"),
            ) ? (
              <CheckCircleIcon sx={{ color: "#4c48ff" }} />
            ) : (
              <div onClick={() => handleAddOauth("Apple")}>
                <AddCircleIcon sx={{ cursor: "pointer" }} />
              </div>
            )}
          </div>
          <div className="loginMethodRow">
            <div className="labelContainer">
              <img src="/facebook.svg" className="iconSmall" />
              <Typography>Facebook</Typography>
            </div>
            {user &&
            user.oauthProviders &&
            user.oauthProviders.some((provider: { issuer: string }) =>
              provider.issuer.toLowerCase().includes("facebook"),
            ) ? (
              <CheckCircleIcon sx={{ color: "#4c48ff" }} />
            ) : (
              <div onClick={() => handleAddOauth("Facebook")}>
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
            <Typography
              variant="body1"
              style={{
                marginRight: "2px",
                fontSize: "1.5rem",
                fontWeight: "600",
              }}
            >
              {wallets.find((wallet) => wallet.walletId === selectedWallet)
                ?.walletName || "Select Wallet"}
            </Typography>
            <ArrowDropDownIcon />
          </div>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleDropdownClose}
            sx={{
              "& .MuiPaper-root": {
                width: "112px",
              },
            }}
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
                  onClick={() => setSelectedAccount(account.address)}
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
                        "_blank",
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
                      5,
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
                    style={{ pointerEvents: "none" }}
                  />
                </div>
              ))}
              <button className="signMessage" onClick={handleSignMessageClick}>
                Sign a message
              </button>
            </div>
          </RadioGroup>

          <div className="exportImportGroup">
            <Export
              walletId={selectedWallet!}
              onHandleExportSuccess={handleExportSuccess}
              onError={(errorMessage: string) => toast.error(errorMessage)}
            ></Export>
            <Import
              onError={(errorMessage: string) => toast.error(errorMessage)}
              onHandleImportSuccess={handleImportSuccess}
            />
          </div>
          <div className="authFooter">
            <div className="authFooterLeft">
              <div onClick={handleLogout} className="authFooterButton">
                <LogoutIcon />
                <Typography>Log out</Typography>
              </div>
            </div>
            <div className="authFooterSeparatorVertical" />
            <div className="authFooterRight">
              <div
                onClick={() => setIsDeleteModalOpen(true)}
                className="authFooterButton"
              >
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
            onClick={() => setIsDeleteModalOpen(false)}
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

      <Modal open={isSignModalOpen} onClose={handleModalClose}>
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
            This helps prove you signed a message using your address.
          </Typography>
          <TextField
            disabled={messageSigningResult?.startsWith("Verif")}
            fullWidth
            margin="normal"
            value={signature ? JSON.stringify(signature) : messageToSign}
            rows={5}
            multiline
            onChange={(e) =>
              signature
                ? setSignature(JSON.parse(e.target.value))
                : setMessageToSign(e.target.value)
            }
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
          {messageSigningResult && (
            <Typography
              sx={{
                color:
                  messageSigningResult.startsWith("Verified") ||
                  messageSigningResult.startsWith("Success")
                    ? "green"
                    : "red",
              }}
            >
              {messageSigningResult}
            </Typography>
          )}
          {signature ? (
            messageSigningResult?.startsWith("Verif") ? (
              <button
                style={{
                  marginTop: "12px",
                }}
                onClick={handleModalClose}
              >
                Done
              </button>
            ) : (
              <button
                style={{
                  marginTop: "12px",
                }}
                onClick={handleVerify}
              >
                Verify
              </button>
            )
          ) : (
            <button
              onClick={handleSign}
              style={{
                marginTop: "12px",
              }}
            >
              Sign
            </button>
          )}
        </Box>
      </Modal>
      {isEmailModalOpen && (
        <Modal
          open={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
        >
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
              onClick={() => setIsEmailModalOpen(false)}
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
              Connect email
            </Typography>
            <TextField
              fullWidth
              autoComplete="off"
              name="emailInput"
              margin="normal"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter your email"
              sx={{
                bgcolor: "#ffffff",
                "& .MuiOutlinedInput-root": {
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
            <button className="continue" onClick={handleEmailSubmit}>
              Continue
            </button>
          </Box>
        </Modal>
      )}

      {isPhoneModalOpen && (
        <Modal
          open={isPhoneModalOpen}
          onClose={() => setIsPhoneModalOpen(false)}
        >
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
              onClick={() => setIsPhoneModalOpen(false)}
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
              Connect phone
            </Typography>
            <MuiPhone
              placeholder="Phone number"
              fullWidth
              margin="normal"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e)}
            />
            <button className="continue" onClick={handlePhoneSubmit}>
              Continue
            </button>
          </Box>
        </Modal>
      )}

      {isOtpModalOpen && (
        <Modal open={isOtpModalOpen} onClose={() => setIsOtpModalOpen(false)}>
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
              onClick={() => setIsOtpModalOpen(false)}
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
            <OtpVerification
              type={emailInput ? OtpType.Email : OtpType.Sms}
              contact={emailInput ? emailInput : phoneInput}
              suborgId={suborgId}
              otpId={otpId!}
              onValidateSuccess={handleOtpSuccess}
              onResendCode={emailInput ? handleResendEmail : handleResendSms}
            />
          </Box>
        </Modal>
      )}

      {isPasskeyModalOpen && (
        <Modal
          open={isPasskeyModalOpen}
          onClose={() => setIsPasskeyModalOpen(false)}
        >
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
              onClick={() => setIsPasskeyModalOpen(false)}
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
            <div className="passkeyContainer">
              <div className="passkeyIconContainer">
                <img src="/key.svg" />
              </div>
              <center>
                <h3>Create a passkey</h3>
              </center>
              <div className="rowsContainer">
                <center>
                  Passkeys allow for easy biometric access to your wallet and
                  can be synced across devices.
                </center>
                <button className="continue" onClick={handleAddPasskey}>
                  Continue
                </button>
              </div>
            </div>
          </Box>
        </Modal>
      )}
      <div>
        <Toaster
          position="bottom-right"
          toastOptions={{ className: "sonner-toaster", duration: 2500 }}
        />
      </div>
    </main>
  );
}
