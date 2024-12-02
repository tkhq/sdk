import { styled, Switch } from "@mui/material";

const CustomSwitch = styled(Switch)(({ theme }) => ({
  padding: 8,
  "& .MuiSwitch-track": {
    borderRadius: 22 / 2,
    backgroundColor: theme.palette.grey[400],
    opacity: 1,
  },
  "& .MuiSwitch-thumb": {
    backgroundColor: "#FFFFFF",
    boxShadow: "none",
    width: 16,
    height: 16,
    margin: 2,
  },
  "& .MuiSwitch-switchBase.Mui-checked": {
    color: "var(--Greyscale-900, #2B2F33)",
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: "var(--Greyscale-900, #2B2F33)",
    opacity: 1,
  },
}));

export default CustomSwitch;
