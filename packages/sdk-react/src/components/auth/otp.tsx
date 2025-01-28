import React, { useState, forwardRef, useImperativeHandle } from "react";
import { TextField, Box } from "@mui/material";

interface OtpInputProps {
  onComplete: (otp: string) => void;
  hasError: boolean;
}

const OtpInput = forwardRef<unknown, OtpInputProps>(
  ({ onComplete, hasError }, ref) => {
    const [otp, setOtp] = useState<string[]>(Array(6).fill(""));

    useImperativeHandle(ref, () => ({
      resetOtp() {
        setOtp(Array(6).fill(""));
        const firstInput = document.getElementById("otp-input-0");
        if (firstInput) (firstInput as HTMLInputElement).focus();
      },
    }));

    const handleChange = (value: string, index: number) => {
      if (/^\d*$/.test(value)) {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // If all boxes are filled, call onComplete with the OTP
        if (newOtp.every((digit) => digit !== "")) {
          onComplete(newOtp.join(""));
        }

        // Move focus to the next box if current is filled
        if (value && index < 5) {
          const nextInput = document.getElementById(`otp-input-${index + 1}`);
          if (nextInput) (nextInput as HTMLInputElement).focus();
        }
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
      if (event.key === "Backspace" && otp[index] === "" && index > 0) {
        const prevInput = document.getElementById(`otp-input-${index - 1}`);
        if (prevInput) (prevInput as HTMLInputElement).focus();
      }
    };

    const handlePaste = (event: React.ClipboardEvent) => {
      const pasteData = event.clipboardData.getData("Text").replace(/\D/g, ""); // Ensure only digits are pasted
      if (pasteData.length === 6) {
        const newOtp = pasteData.split("");
        setOtp(newOtp);
        onComplete(newOtp.join(""));

        // Automatically move focus to the last input box
        const lastInput = document.getElementById(`otp-input-5`);
        if (lastInput) (lastInput as HTMLInputElement).focus();

        event.preventDefault();
      }
    };

    return (
      <Box display="flex" gap={1} justifyContent="center" mt={2}>
        {otp.map((digit, index) => (
          <TextField
            autoComplete="off"
            key={index}
            id={`otp-input-${index}`}
            value={digit}
            onChange={(e) => handleChange(e.target.value, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={index === 0 ? handlePaste : undefined}
            inputProps={{
              maxLength: 1,
              style: {
                textAlign: "center",
                fontSize: "1.5rem",
                height: "20px",
                width: "100%",
                background: "var(--input-bg)",
              },
            }}
            variant="outlined"
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "var(--input-text)",
                "& fieldset": {
                  borderColor:
                    hasError && !digit
                      ? "var(--error-color)"
                      : "var(--input-border)",
                },
                "&:hover fieldset": {
                  borderColor: "var(--input-border-hover)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "var(--input-border-focus)",
                  border: "1px solid",
                },
              },
            }}
          />
        ))}
      </Box>
    );
  },
);

export default OtpInput;
