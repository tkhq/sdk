import "./PhoneInput.module.css";
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
const FlagImage = OriginalFlagImage as React.ElementType;

// Supported country dial codes
const supported_country_codes = [
  "+1", // USA, Canada, Mexico
  "+33", // France
  "+420", // Czech Republic
  "+358", // Finland
  "+49", // Germany
  "+30", // Greece
  "+36", // Hungary
  "+354", // Iceland
  "+353", // Ireland
  "+39", // Italy
  "+371", // Latvia
  "+370", // Lithuania
  "+352", // Luxembourg
  "+356", // Malta
  "+373", // Moldova
  "+382", // Montenegro
  "+31", // Netherlands
  "+47", // Norway
  "+48", // Poland
  "+351", // Portugal
  "+40", // Romania
  "+381", // Serbia
  "+386", // Slovenia
  "+34", // Spain
  "+46", // Sweden
  "+41", // Switzerland
];

const countries = defaultCountries.filter((country) => {
  const { dialCode } = parseCountry(country);
  return supported_country_codes.includes(`+${dialCode}`);
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
      name="phone-input"
      variant="outlined"
      color="primary"
      placeholder="Phone number"
      value={inputValue}
      onChange={handlePhoneValueChange}
      type="tel"
      inputRef={inputRef}
      fullWidth
      sx={{
        "& .MuiOutlinedInput-root": {
          color: "var(--input-text)",
          "& fieldset": {
            borderColor: "var(--input-border)",
          },
          "&:hover fieldset": {
            borderColor: "var(--input-hover-border)",
          },
          "&.Mui-focused fieldset": {
            borderColor: "var(--input-focus-border)",
            border: "1px solid",
          },
        },
        "& .MuiInputBase-input": {
          padding: "12px",
        },
        backgroundColor: "var(--input-bg)",
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
                fieldset: {
                  display: "none",
                },
                "&.Mui-focused:has(div[aria-expanded='false'])": {
                  fieldset: {
                    display: "block",
                  },
                },
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
              renderValue={(value) => {
                const selectedCountry = countries.find(
                  (c) => parseCountry(c).iso2 === value,
                );
                const parsedCountry = selectedCountry
                  ? parseCountry(selectedCountry)
                  : null;
                return (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {parsedCountry && (
                      <>
                        <FlagImage
                          iso2={parsedCountry.iso2}
                          style={{ marginRight: "8px" }}
                        />
                        <Typography marginRight="8px">
                          +{parsedCountry.dialCode}
                        </Typography>
                      </>
                    )}
                  </div>
                );
              }}
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
