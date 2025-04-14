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
  "+1",
  "+33",
  "+420",
  "+358",
  "+49",
  "+30",
  "+36",
  "+354",
  "+353",
  "+39",
  "+371",
  "+370",
  "+352",
  "+356",
  "+373",
  "+382",
  "+31",
  "+47",
  "+48",
  "+351",
  "+40",
  "+381",
  "+386",
  "+34",
  "+46",
  "+41",
  "+355",
  "+376",
  "+244",
  "+54",
  "+374",
  "+61",
  "+43",
  "+994",
  "+1242",
  "+973",
  "+880",
  "+1246",
  "+32",
  "+501",
  "+229",
  "+591",
  "+387",
  "+267",
  "+55",
  "+1284",
  "+673",
  "+237",
  "+238",
  "+1345",
  "+235",
  "+56",
  "+57",
  "+506",
  "+385",
  "+599",
  "+357",
  "+243",
  "+45",
  "+253",
  "+1767",
  "+593",
  "+503",
  "+240",
  "+372",
  "+298",
  "+679",
  "+689",
  "+220",
  "+995",
  "+233",
  "+350",
  "+1473",
  "+502",
  "+590",
  "+224",
  "+592",
  "+509",
  "+504",
  "+852",
  "+91",
  "+62",
  "+972",
  "+225",
  "+1876",
  "+81",
  "+383",
  "+965",
  "+996",
  "+856",
  "+961",
  "+266",
  "+231",
  "+261",
  "+60",
  "+960",
  "+223",
  "+230",
  "+52",
  "+373",
  "+976",
  "+212",
  "+258",
  "+264",
  "+977",
  "+64",
  "+505",
  "+227",
  "+234",
  "+92",
  "+507",
  "+51",
  "+63",
  "+1787",
  "+1939",
  "+974",
  "+262",
  "+1758",
  "+1784",
  "+685",
  "+966",
  "+221",
  "+248",
  "+232",
  "+65",
  "+27",
  "+82",
  "+597",
  "+268",
  "+992",
  "+255",
  "+66",
  "+228",
  "+1868",
  "+216",
  "+598",
  "+998",
  "+58",
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
