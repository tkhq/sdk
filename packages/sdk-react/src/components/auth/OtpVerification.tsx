"use client";

import React, { useRef, useState } from "react";
import OtpInput from "./otp";
import styles from "./OtpVerification.module.css";
import { formatPhoneNumber } from "./utils";
import { otpAuth } from "../../actions";
import EmailIcon from "@mui/icons-material/Email";
import SmsIcon from "@mui/icons-material/Sms";
import { CircularProgress } from "@mui/material";
import { OtpType, FilterType } from "./constants";

const resendTimerMs = 15000;
interface OtpVerificationProps {
  type: string;
  contact: string;
  suborgId: string;
  otpId: string;
  authIframeClient: any;
  onValidateSuccess: (credentialBundle: any) => Promise<void>;
  onResendCode: (
    type: FilterType.Email | FilterType.PhoneNumber,
    value: string
  ) => Promise<void>;
}

const OtpVerification: React.FC<OtpVerificationProps> = ({
  type,
  contact,
  suborgId,
  otpId,
  authIframeClient,
  onValidateSuccess,
  onResendCode,
}) => {
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resendText, setResendText] = useState("Resend code");
  const otpInputRef = useRef<any>(null);

  const handleValidateOtp = async (otp: string) => {
    setOtpError(null);
    setIsLoading(true);
    try {
      const authResponse = await otpAuth({
        suborgID: suborgId,
        otpId,
        otpCode: otp,
        targetPublicKey: authIframeClient!.iframePublicKey!,
      });

      if (authResponse?.credentialBundle) {
        await onValidateSuccess(authResponse.credentialBundle);
      } else {
        setOtpError("Invalid code. Please try again.");
      }
      otpInputRef.current.resetOtp();
    } catch (error) {
      setOtpError("An error occurred. Please try again.");
    }
    setIsLoading(false);
  };

  const handleResendCode = async () => {
    setOtpError(null);
    try {
      await onResendCode(
        type === OtpType.Email ? FilterType.Email : FilterType.PhoneNumber,
        contact
      );
      setResendText("Code sent ✓");

      setTimeout(() => {
        setResendText("Resend code");
      }, resendTimerMs);
    } catch {
      setOtpError("Failed to resend the code. Please try again.");
    }
  };

  return (
    <div className={styles.verification}>
      {isLoading && (
        <div className={styles.loadingWrapper}>
          <CircularProgress
            size={80}
            thickness={1}
            className={styles.circularProgress!}
          />
        </div>
      )}
      <div
        className={styles.contentWrapper}
        style={{ opacity: isLoading ? 0.5 : 1 }}
      >
        <div className={styles.verificationIcon}>
          {type === OtpType.Email ? (
            <EmailIcon
              sx={{
                fontSize: "86px",
                color: "var(--icon-color)",
              }}
            />
          ) : (
            <SmsIcon
              sx={{
                fontSize: "86px",
                color: "var(--icon-color)",
              }}
            />
          )}
        </div>
        <div>
          <span className={styles.verificationText}>
            Enter the 6-digit code we{" "}
            {type === OtpType.Email ? "emailed" : "sent"} to{" "}
          </span>
          <span className={styles.verificationBold}>
            {type === OtpType.Email ? contact : formatPhoneNumber(contact)}
          </span>
        </div>
        <div className={styles.otpInputWrapper}>
          <OtpInput
            ref={otpInputRef}
            onComplete={handleValidateOtp}
            hasError={!!otpError}
          />
        </div>

        <div className={styles.errorText}>{otpError ? otpError : " "}</div>

        <div className={styles.resendCode}>
          <span
            onClick={
              resendText === "Resend code" ? handleResendCode : undefined
            }
            style={{
              cursor: resendText === "Resend code" ? "pointer" : "not-allowed",
            }}
            className={styles.resendCodeBold}
          >
            {resendText}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OtpVerification;
