import "./PhoneInput.css";
import {
  BaseTextFieldProps,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  CountryIso2,
  defaultCountries,
  parseCountry,
  usePhoneInput,
} from "react-international-phone";
import { FlagImage as OriginalFlagImage } from "react-international-phone";

const FlagImage = OriginalFlagImage as React.ElementType; // fix for typecheck issue

const countries = defaultCountries.filter((country) => {
  const { iso2 } = parseCountry(country);
  return ["us", "ca"].includes(iso2);
});

export interface MUIPhoneProps extends BaseTextFieldProps {
  value: string;
  onChange: (phone: string) => void;
}

export const MuiPhone: React.FC<MUIPhoneProps> = ({
  value,
  onChange,
  ...restProps
}) => {
  const { inputValue, handlePhoneValueChange, inputRef, country, setCountry } =
    usePhoneInput({
      defaultCountry: "us",
      disableDialCodeAndPrefix: true,
      value,
      countries: countries,
      onChange: (data) => {
        onChange(data.phone);
      },
    });

  return (
    <TextField
      variant="outlined"
      color="primary"
      placeholder="Phone number"
      value={inputValue}
      onChange={handlePhoneValueChange}
      type="tel"
      inputRef={inputRef}
      fullWidth
      sx={{
        "& .MuiInputBase-input": {
          padding: "10px 4px",
        },
        backgroundColor: "white",
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment
            position="start"
            style={{ marginRight: "2px", marginLeft: "-8px" }}
          >
            <Select
              MenuProps={{
                style: {
                  height: "300px",
                  width: "360px",
                  top: "10px",
                  left: "-34px",
                },
                transformOrigin: {
                  vertical: "top",
                  horizontal: "left",
                },
              }}
              sx={{
                width: "max-content",
                // Remove default outline (display only on focus)
                fieldset: {
                  display: "none",
                },
                "&.Mui-focused:has(div[aria-expanded='false'])": {
                  fieldset: {
                    display: "block",
                  },
                },
                // Update default spacing
                ".MuiSelect-select": {
                  padding: "8px",
                  paddingRight: "24px !important",
                },
                svg: {
                  right: 0,
                },
              }}
              value={country.iso2}
              onChange={(e) => setCountry(e.target.value as CountryIso2)}
              renderValue={(value) => (
                <FlagImage iso2={value} style={{ display: "flex" }} />
              )}
            >
              {countries.map((c) => {
                const country = parseCountry(c);
                return (
                  <MenuItem key={country.iso2} value={country.iso2}>
                    <FlagImage
                      iso2={country.iso2}
                      style={{ marginRight: "8px" }}
                    />
                    <Typography marginRight="8px">{country.name}</Typography>
                    <Typography color="gray">+{country.dialCode}</Typography>
                  </MenuItem>
                );
              })}
            </Select>
          </InputAdornment>
        ),
      }}
      {...restProps}
    />
  );
};
