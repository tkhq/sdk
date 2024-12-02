import parsePhoneNumberFromString from "libphonenumber-js";

export const formatPhoneNumber = (phone: string) => {
    const phoneNumber = parsePhoneNumberFromString(phone);
    return phoneNumber ? phoneNumber.formatInternational() : phone;
  };
