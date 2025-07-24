import { Session, TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";
import { OtpType } from "@utils";
import { OtpVerification } from "../components/auth/OTP";
import { SuccessPage } from "../components/design/Success";
import type { ModalPage } from "../providers/modal/Provider";
import type { DefaultParams } from "@turnkey/sdk-js";

// --- addEmailContinue ---
export const addEmailContinue = async (
  params: {
    email: string;
    session: Session;
    initOtp: (
      params: { otpType: OtpType; contact: string } & DefaultParams,
    ) => Promise<string>;
    verifyOtp: (
      params: {
        otpId: string;
        otpCode: string;
        contact: string;
        otpType: OtpType;
      } & DefaultParams,
    ) => Promise<{
      subOrganizationId: string;
      verificationToken: string;
    }>;
    updateUserEmail: (
      params: {
        email: string;
        verificationToken?: string;
        userId?: string;
      } & DefaultParams,
    ) => Promise<string>;
    pushPage: (page: ModalPage) => void;
    closeModal: () => void;
    onSuccess?: ((userId: string) => void) | undefined;
    successPageDuration?: number | undefined;
  } & DefaultParams,
) => {
  const {
    email,
    session,
    successPageDuration,
    onSuccess,
    initOtp,
    verifyOtp,
    updateUserEmail,
    pushPage,
    closeModal,
    stampWith,
  } = params;
  if (!email || email === "") {
    throw new TurnkeyError(
      "Email is required for email verification.",
      TurnkeyErrorCodes.MISSING_PARAMS,
    );
  }
  const otpId = await initOtp({ otpType: OtpType.Email, contact: email });
  pushPage({
    key: "Verify OTP",
    content: (
      <OtpVerification
        contact={email}
        otpId={otpId}
        otpType={OtpType.Email}
        onContinue={async (otpCode: string) => {
          const { verificationToken } = await verifyOtp({
            otpId,
            otpCode,
            contact: email,
            otpType: OtpType.Email,
            stampWith,
          });
          const res = await updateUserEmail({
            email,
            verificationToken,
            userId: session!.userId,
            stampWith,
          });

          if (res) {
            if (onSuccess) {
              onSuccess(res);
            } else {
              if (successPageDuration && successPageDuration !== 0) {
                pushPage({
                  key: "success",
                  content: (
                    <SuccessPage
                      text="Email Added Successfully!"
                      duration={successPageDuration}
                      onComplete={() => {
                        closeModal();
                      }}
                    />
                  ),
                  preventBack: true,
                  showTitle: false,
                });
              } else {
                closeModal();
              }
            }
          } else {
            closeModal();
            throw new TurnkeyError(
              "Failed to add user email.",
              TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
            );
          }
        }}
      />
    ),
    showTitle: false,
  });
};

// --- updateEmailContinue ---
export const updateEmailContinue = async (
  params: {
    email: string;
    session: Session;
    successPageDuration?: number | undefined;
    initOtp: (
      params: { otpType: OtpType; contact: string } & DefaultParams,
    ) => Promise<string>;
    verifyOtp: (
      params: {
        otpId: string;
        otpCode: string;
        contact: string;
        otpType: OtpType;
      } & DefaultParams,
    ) => Promise<{
      subOrganizationId: string;
      verificationToken: string;
    }>;
    updateUserEmail: (
      params: {
        email: string;
        verificationToken?: string;
        userId?: string;
      } & DefaultParams,
    ) => Promise<string>;
    pushPage: (page: ModalPage) => void;
    closeModal: () => void;
    onSuccess?: ((userId: string) => void) | undefined;
  } & DefaultParams,
) => {
  const {
    email,
    session,
    successPageDuration,
    onSuccess,
    initOtp,
    verifyOtp,
    updateUserEmail,
    pushPage,
    closeModal,
    stampWith,
  } = params;
  if (!email || email === "") {
    throw new TurnkeyError(
      "Email is required for email verification.",
      TurnkeyErrorCodes.MISSING_PARAMS,
    );
  }
  const otpId = await initOtp({
    otpType: OtpType.Email,
    contact: email,
    stampWith,
  });
  pushPage({
    key: "Verify OTP",
    content: (
      <OtpVerification
        contact={email}
        otpId={otpId}
        otpType={OtpType.Email}
        onContinue={async (otpCode: string) => {
          const { verificationToken } = await verifyOtp({
            otpId,
            otpCode,
            contact: email,
            otpType: OtpType.Email,
            stampWith,
          });
          const res = await updateUserEmail({
            email,
            verificationToken,
            userId: session!.userId,
            stampWith,
          });

          if (res) {
            if (onSuccess) {
              onSuccess(res);
            } else {
              if (successPageDuration && successPageDuration !== 0) {
                pushPage({
                  key: "success",
                  content: (
                    <SuccessPage
                      text="Email Changed Successfully!"
                      duration={successPageDuration}
                      onComplete={() => {
                        closeModal();
                      }}
                    />
                  ),
                  preventBack: true,
                  showTitle: false,
                });
              } else {
                closeModal();
              }
            }
          } else {
            closeModal();
            throw new TurnkeyError(
              "Failed to update user email.",
              TurnkeyErrorCodes.UPDATE_USER_EMAIL_ERROR,
            );
          }
        }}
      />
    ),
    showTitle: false,
  });
};

// --- addPhoneNumberContinue ---
export const addPhoneNumberContinue = async (
  params: {
    phone: string;
    formattedPhone?: string;
    session: Session;
    initOtp: (
      params: { otpType: OtpType; contact: string } & DefaultParams,
    ) => Promise<string>;
    verifyOtp: (
      params: {
        otpId: string;
        otpCode: string;
        contact: string;
        otpType: OtpType;
      } & DefaultParams,
    ) => Promise<{
      subOrganizationId: string;
      verificationToken: string;
    }>;
    updateUserPhoneNumber: (
      params: {
        phoneNumber: string;
        verificationToken?: string;
        userId?: string;
      } & DefaultParams,
    ) => Promise<string>;
    pushPage: (page: ModalPage) => void;
    closeModal: () => void;
    onSuccess?: ((userId: string) => void) | undefined;
    successPageDuration?: number | undefined;
  } & DefaultParams,
) => {
  const {
    phone,
    formattedPhone,
    onSuccess,
    successPageDuration,
    initOtp,
    verifyOtp,
    updateUserPhoneNumber,
    session,
    pushPage,
    closeModal,
    stampWith,
  } = params;
  if (!phone || phone === "") {
    throw new TurnkeyError(
      "Phone number is required for sms verification.",
      TurnkeyErrorCodes.MISSING_PARAMS,
    );
  }
  const otpId = await initOtp({ otpType: OtpType.Sms, contact: phone });
  pushPage({
    key: "Verify OTP",
    content: (
      <OtpVerification
        contact={phone}
        {...(formattedPhone ? { formattedPhone } : {})}
        otpId={otpId}
        otpType={OtpType.Sms}
        onContinue={async (otpCode: string) => {
          const { verificationToken } = await verifyOtp({
            otpId,
            otpCode,
            contact: phone,
            otpType: OtpType.Sms,
            stampWith,
          });
          const res = await updateUserPhoneNumber({
            phoneNumber: phone,
            verificationToken,
            userId: session!.userId,
            stampWith,
          });

          if (res) {
            if (onSuccess) {
              onSuccess(res);
            } else {
              if (successPageDuration && successPageDuration !== 0) {
                pushPage({
                  key: "success",
                  content: (
                    <SuccessPage
                      text="Phone Number Added Successfully!"
                      duration={successPageDuration}
                      onComplete={() => {
                        closeModal();
                      }}
                    />
                  ),
                  preventBack: true,
                  showTitle: false,
                });
              } else {
                closeModal();
              }
            }
          } else {
            closeModal();
            throw new TurnkeyError(
              "Failed to add phone number.",
              TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
            );
          }
        }}
      />
    ),
    showTitle: false,
  });
};

// --- updatePhoneNumberContinue ---
export const updatePhoneNumberContinue = async (
  params: {
    phone: string;
    formattedPhone?: string;
    session: Session;
    initOtp: (
      params: { otpType: OtpType; contact: string } & DefaultParams,
    ) => Promise<string>;
    verifyOtp: (
      params: {
        otpId: string;
        otpCode: string;
        contact: string;
        otpType: OtpType;
      } & DefaultParams,
    ) => Promise<{
      subOrganizationId: string;
      verificationToken: string;
    }>;
    updateUserPhoneNumber: (
      params: {
        phoneNumber: string;
        verificationToken?: string;
        userId?: string;
      } & DefaultParams,
    ) => Promise<string>;
    pushPage: (page: ModalPage) => void;
    closeModal: () => void;
    onSuccess?: ((userId: string) => void) | undefined;
    successPageDuration?: number | undefined;
  } & DefaultParams,
) => {
  const {
    phone,
    formattedPhone,
    onSuccess,
    successPageDuration,
    initOtp,
    verifyOtp,
    updateUserPhoneNumber,
    session,
    pushPage,
    closeModal,
    stampWith,
  } = params;
  if (!phone || phone === "") {
    throw new TurnkeyError(
      "Phone number is required for sms verification.",
      TurnkeyErrorCodes.MISSING_PARAMS,
    );
  }
  const otpId = await initOtp({ otpType: OtpType.Sms, contact: phone });
  pushPage({
    key: "Verify OTP",
    content: (
      <OtpVerification
        contact={phone}
        {...(formattedPhone ? { formattedPhone } : {})}
        otpId={otpId}
        otpType={OtpType.Sms}
        onContinue={async (otpCode: string) => {
          const { verificationToken } = await verifyOtp({
            otpId,
            otpCode,
            contact: phone,
            otpType: OtpType.Sms,
            stampWith,
          });
          const res = await updateUserPhoneNumber({
            phoneNumber: phone,
            verificationToken,
            userId: session!.userId,
            stampWith,
          });

          if (res) {
            if (onSuccess) {
              onSuccess(res);
            } else {
              if (successPageDuration && successPageDuration !== 0) {
                pushPage({
                  key: "success",
                  content: (
                    <SuccessPage
                      text="Phone Number Changed Successfully!"
                      duration={successPageDuration}
                      onComplete={() => {
                        closeModal();
                      }}
                    />
                  ),
                  preventBack: true,
                  showTitle: false,
                });
              } else {
                closeModal();
              }
            }
          } else {
            closeModal();
            throw new TurnkeyError(
              "Failed to update user phone number.",
              TurnkeyErrorCodes.UPDATE_USER_PHONE_NUMBER_ERROR,
            );
          }
        }}
      />
    ),
    showTitle: false,
  });
};

// --- removeOAuthProviderContinue ---
export const removeOAuthProviderContinue = async (
  params: {
    providerId: string;
    session: Session;
    removeOAuthProvider: (
      params: {
        providerId: string;
        userId?: string;
      } & DefaultParams,
    ) => Promise<string[]>;
    pushPage: (page: ModalPage) => void;
    closeModal: () => void;
    onSuccess?: ((providerIds: string[]) => void) | undefined;
    successPageDuration?: number | undefined;
  } & DefaultParams,
) => {
  const {
    session,
    providerId,
    removeOAuthProvider,
    pushPage,
    closeModal,
    onSuccess,
    successPageDuration,
    stampWith,
  } = params;
  const res = await removeOAuthProvider({
    providerId,
    userId: session!.userId,
    stampWith,
  });

  if (res) {
    if (onSuccess) {
      onSuccess(res);
    } else {
      if (successPageDuration && successPageDuration !== 0) {
        pushPage({
          key: "success",
          content: (
            <SuccessPage
              text="OAuth Provider Removed Successfully!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      } else {
        closeModal();
      }
    }
  } else {
    closeModal();
    throw new TurnkeyError(
      "Failed to remove OAuth provider.",
      TurnkeyErrorCodes.REMOVE_OAUTH_PROVIDER_ERROR,
    );
  }
};

export const removePasskeyContinue = async (
  params: {
    authenticatorId: string;
    session: Session;
    removePasskey: (
      params: {
        authenticatorId: string;
        userId?: string;
      } & DefaultParams,
    ) => Promise<string[]>;
    pushPage: (page: ModalPage) => void;
    closeModal: () => void;
    onSuccess?: ((authenticatorIds: string[]) => void) | undefined;
    successPageDuration?: number | undefined;
  } & DefaultParams,
) => {
  const {
    session,
    authenticatorId,
    removePasskey,
    pushPage,
    closeModal,
    onSuccess,
    successPageDuration,
    stampWith,
  } = params;
  const res = await removePasskey({
    authenticatorId,
    userId: session!.userId,
    stampWith,
  });

  if (res) {
    if (onSuccess) {
      onSuccess(res);
    } else {
      if (successPageDuration && successPageDuration !== 0) {
        pushPage({
          key: "success",
          content: (
            <SuccessPage
              text="Passkey Removed Successfully!"
              duration={successPageDuration}
              onComplete={() => {
                closeModal();
              }}
            />
          ),
          preventBack: true,
          showTitle: false,
        });
      } else {
        closeModal();
      }
    }
  } else {
    closeModal();
    throw new TurnkeyError(
      "Failed to remove passkey.",
      TurnkeyErrorCodes.REMOVE_PASSKEY_ERROR,
    );
  }
};
