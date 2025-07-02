import {
  usePhoneInput,
  parseCountry,
  defaultCountries,
  FlagImage as OriginalFlagImage,
} from "react-international-phone";
import {
  Input,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
import { Listbox } from "@headlessui/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import parsePhoneNumberFromString from "libphonenumber-js";

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

export interface PhoneInputBoxProps {
  value: string;
  onChange: (phone: string, formattedPhone: string, isValid: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onEnter?: () => void;
}

const isValidPhone = (phone: string) => {
  const phoneNumber = parsePhoneNumberFromString(phone);
  return phoneNumber?.isValid() ?? false;
};

export function PhoneInputBox(props: PhoneInputBoxProps) {
  const { value, onChange, onFocus, onBlur, onEnter } = props;
  const { inputValue, handlePhoneValueChange, inputRef, country, setCountry } =
    usePhoneInput({
      value,
      defaultCountry: "us",
      disableDialCodeAndPrefix: true,
      countries,
      onChange: (data) => {
        onChange(
          data.phone,
          `+${data.country.dialCode} ${data.inputValue}`,
          isValidPhone(data.phone),
        );
      },
    });

  return (
    <div className="w-full flex items-center gap-2 rounded-md text-inherit bg-button-light dark:bg-button-dark border border-modal-background-dark/20 dark:border-modal-background-light/20 focus-within:outline-primary-light focus-within:dark:outline-primary-dark focus-within:outline-[1px] focus-within:outline-offset-0 box-border transition-all">
      <Listbox as="div" value={country.iso2} onChange={setCountry}>
        <div className="relative">
          <ListboxButton className="cursor-pointer px-3 gap-2 bg-button-light dark:bg-button-dark border-none rounded-md text-left flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FlagImage iso2={country.iso2} className="w-5 h-4 rounded-sm" />
              <span className="text-sm text-modal-text-light dark:text-modal-text-dark">
                +{country.dialCode}
              </span>
            </span>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="w-3 h-3 text-gray-400"
            />
          </ListboxButton>

          <ListboxOptions
            transition
            className="absolute tk-scrollbar z-10 mt-1 bg-white dark:bg-button-dark border border-gray-300 dark:border-modal-background-light/20 rounded-md shadow-lg max-h-60 overflow-auto text-sm 
            transition duration-200 ease-out data-closed:-translate-y-2 data-closed:opacity-0"
          >
            {countries.map((c) => {
              const { iso2, name, dialCode } = parseCountry(c);
              return (
                <ListboxOption
                  key={iso2}
                  value={iso2}
                  className={({ active }) =>
                    `cursor-pointer select-none py-2 px-3 flex items-center gap-2 ${
                      active ? "bg-gray-100 dark:bg-modal-background-dark" : ""
                    }`
                  }
                >
                  <FlagImage iso2={iso2} className="w-5 h-4 rounded-sm" />
                  <span>{name}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    +{dialCode}
                  </span>
                </ListboxOption>
              );
            })}
          </ListboxOptions>
        </div>
      </Listbox>

      <Input
        type="tel"
        value={inputValue}
        ref={inputRef}
        onChange={handlePhoneValueChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter?.();
        }}
        placeholder="Phone number"
        className="w-full py-3 bg-transparent border-none text-inherit focus:outline-none focus:ring-0 focus:border-none"
      />
    </div>
  );
}
