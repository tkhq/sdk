import React, { useState } from "react";
import { TextField, Box } from "@mui/material";

interface OTPInputProps {
  onComplete: (otp: string) => void;
  onChange: () => void;
}

const OTPInput: React.FC<OTPInputProps> = ({ onComplete, onChange }) => {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));

  const handleChange = (value: string, index: number) => {
    onChange()
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
    const pasteData = event.clipboardData.getData("Text");
    if (/^\d{6}$/.test(pasteData)) {
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
          key={index}
          id={`otp-input-${index}`}
          value={digit}
          onChange={(e) => handleChange(e.target.value, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={index === 0 ? handlePaste : undefined} // Handle paste on the first input only
          inputProps={{
            maxLength: 1,
            style: {
              textAlign: "center",
              fontSize: "1.5rem",
              width: "60px",
              background: "white",
            },
          }}
          variant="outlined"
        />
      ))}
    </Box>
  );
};

export default OTPInput;