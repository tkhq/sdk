import styles from "./Auth.module.css";
import "./PhoneInput.css"
import { SetStateAction, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTurnkey } from "../../hooks/useTurnkey";
import type { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";
import { initAuth } from "../../api/initAuth";
import { getSuborgs } from "../../api/getSuborgs";
import  {PhoneInput}  from 'react-international-phone';

interface AuthProps {
  turnkeyClient: TurnkeySDKClient;
}

const emailSchema = {
  email: "",
};

const phoneSchema = {
  phone: "",
};

const otpSchema = {
  otp: "",
};

const Auth: React.FC<AuthProps> = ({ turnkeyClient }) => {
  const { turnkey, passkeyClient, authIframeClient } = useTurnkey();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState({
    email: true,
    passkey: true,
    phone: true,
    socials: {
      google: true,
      facebook: true,
      apple: true,
    },
  });

  const emailForm = useForm({
    defaultValues: emailSchema,
  });

  const phoneForm = useForm({
    defaultValues: phoneSchema,
  });

  const otpForm = useForm({
    defaultValues: otpSchema,
  });

  useEffect(() => {
    if (error) {
      alert(error);
    }
  }, [error]);

  const handlePasskeyLogin = async (email: string) => {
    setLoadingAction("passkey");
    setLoadingAction(null);
  };

  const handleEmailLogin = async (email: string) => {
    const getSuborgsRequest = {
      filterType: "EMAIL",
      filterValue: email,
    };
    const getSuborgsResponse = await getSuborgs(getSuborgsRequest, turnkeyClient);

    const initAuthRequest = {
      suborgID: getSuborgsResponse!.organizationIds[0]!,
      otpType: "OTP_TYPE_EMAIL",
      contact: email,
    };
    const initAuthResponse = await initAuth(initAuthRequest, turnkeyClient);

    setOtpId(initAuthResponse!.otpId);
    setLoadingAction("email");
    setLoadingAction(null);
  };

  const handlePhoneLogin = async () => {
    if (!phone) return;
    setLoadingAction("phone");
    setLoadingAction(null);
  };

  const handleEnterOtp = async (otp: string) => {
    setLoadingAction("otp");
    // Here you would add your logic to verify the OTP using the otpId
    console.log(`Verifying OTP: ${otp} with otpId: ${otpId}`);
    setLoadingAction(null);
  };

  const onSubmitEmail = async (values: any) => {
    const email = values.email;
    await handleEmailLogin(email);
  };

  const onSubmitPhone = async (values: any) => {
    // TODO: Handle phone login
  };

  const onSubmitOtp = async (values: any) => {
    const otp = values.otp;
    await handleEnterOtp(otp);
  };

  return (
    <div className={styles.authCard}>
      <h2>Log in or sign up</h2>
      <div className={styles.authForm}>
        {authConfig.email && !otpId && (
          <form onSubmit={emailForm.handleSubmit(onSubmitEmail)}>
            <div className={styles.inputGroup}>
              <input
                type="email"
                placeholder="Enter your email"
                {...emailForm.register("email")}
              />
            </div>
            <button type="submit" disabled={loadingAction === "email"}>
              Continue with email
            </button>
          </form>
        )}

{authConfig.passkey && !otpId && (
          <form onSubmit={emailForm.handleSubmit(onSubmitEmail)}>
            <button className={styles.passkeyButton} type="submit" disabled={loadingAction === "passkey"}>
              Continue with passkey
            </button>
          </form>
        )}

        {authConfig.phone && (
          <form onSubmit={phoneForm.handleSubmit(onSubmitPhone)}>
            <div className={styles.inputGroup}>
            <PhoneInput
        defaultCountry="ua"
        value={phone!}
        onChange={(phone: SetStateAction<string | null>) => setPhone(phone)}
      /> 
            </div>
            <button type="button" onClick={handlePhoneLogin}>
              Continue with phone
            </button>
          </form>
        )}

        {otpId && (
          <form onSubmit={otpForm.handleSubmit(onSubmitOtp)}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                placeholder="Enter your 6 digit OTP"
                {...otpForm.register("otp")}
              />
            </div>
            <button type="submit" disabled={loadingAction === "otp"}>
              Continue
            </button>
          </form>
        )}
      </div>

      <div className={styles.separator}>
        <span>OR</span>
      </div>

          <div className = {styles.tos}>
<span>By logging in you agree to our <span className = {styles.tosBold}>Terms of Service</span> & <span className = {styles.tosBold}>Privacy Policy</span></span>
          </div>

          <div className = {styles.poweredBy}>
          <span>Powered by</span> <svg width="60" height="11" viewBox="0 0 60 11" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_216_22334)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M36.6054 0.458008H36.713H37.8391H37.9468V0.559475V5.93186V7.21982V8.81084V8.91233H37.8391H36.713H36.6054V8.81084V0.559475V0.458008ZM14.716 7.76302V3.3255H16.1437V2.17215H14.5996C14.6906 2.06524 14.7632 1.94566 14.8151 1.81769C14.912 1.58567 14.9637 1.28871 14.9588 0.889603V0.458036H13.6661V0.904484C13.6747 1.15788 13.6203 1.40966 13.5074 1.63979C13.3386 1.96583 12.9788 2.32638 12.1968 2.49955L12.1135 2.51849V3.3255H13.3616V8.06607C13.3624 8.29033 13.4572 8.50525 13.6255 8.66394C13.7938 8.82254 14.0219 8.9121 14.26 8.91296H16.1645V7.76302H14.7168H14.716ZM25.7321 3.29168C26.2535 2.59087 26.9458 2.18094 27.7831 2.18094H28.4524V3.40668H27.6359C27.0643 3.40668 26.6046 3.58188 26.2793 3.95122C25.954 4.32056 25.7595 4.8969 25.7595 5.71743V8.91296H24.3907V2.18094H25.7321V3.29168ZM54.9349 2.18094H56.2441L56.3992 2.18568L56.3425 2.32097L52.9242 10.6684L52.8409 10.6379L52.8509 10.642L52.9227 10.6684C52.826 10.8845 52.6651 11.0696 52.4594 11.2016C52.2536 11.3336 52.0118 11.4068 51.763 11.4125H50.2477V10.2747H51.7162L52.331 8.81013L49.6517 2.31623L49.5949 2.18094H51.103L51.1289 2.24859L53.014 7.20832L54.9098 2.24859L54.9349 2.18094ZM21.6711 2.18094H21.7788H23.0255V8.91498H21.7379V8.08433C21.2295 8.75131 20.4818 9.06657 19.5663 9.06657C18.6341 9.06657 17.9971 8.80951 17.6065 8.36171C17.2158 7.91387 17.0722 7.28883 17.0722 6.57788V2.18094H18.4273V6.70166C18.4273 7.07777 18.5529 7.37879 18.7728 7.58511C18.9925 7.79142 19.3149 7.91387 19.7271 7.91387C20.3922 7.91387 20.8719 7.70619 21.19 7.36526C21.5081 7.02433 21.6711 6.53932 21.6711 5.96907V2.18094ZM46.1687 2.0294C45.1554 2.0294 44.3202 2.38115 43.74 3.00348C43.1597 3.62582 42.843 4.5052 42.843 5.55303C42.843 6.60085 43.1713 7.48633 43.7608 8.10258C44.3504 8.71886 45.1971 9.06446 46.2089 9.06446C47.0139 9.06446 47.7055 8.84665 48.2462 8.4455C48.787 8.04439 49.1697 7.46603 49.3694 6.75441L49.4053 6.62656H48.01L47.9842 6.69419C47.6768 7.49173 47.0441 7.92804 46.2089 7.92804C45.6085 7.92804 45.146 7.71564 44.8172 7.35984C44.5063 7.0216 44.3109 6.55215 44.2391 5.99678H49.4154L49.4262 5.9068C49.4378 5.78967 49.4423 5.67201 49.4398 5.55438C49.4398 4.50791 49.1367 3.62649 48.5715 3.00551C48.0064 2.38453 47.182 2.0294 46.1687 2.0294ZM44.2864 4.8326C44.382 4.35909 44.5802 3.94849 44.8739 3.65626C45.0402 3.49218 45.2411 3.36273 45.4637 3.27628C45.6864 3.18983 45.9258 3.14829 46.1666 3.15433C46.3957 3.14896 46.6234 3.18792 46.8358 3.26878C47.0484 3.34965 47.2409 3.4707 47.4018 3.62446C47.6962 3.90789 47.9044 4.31715 48.0078 4.8326H44.2864ZM32.8904 2.0294C31.9748 2.0294 31.2273 2.34462 30.7189 3.0116V2.18092H29.4312V8.91296H30.7856V5.12484C30.7856 4.55458 30.9486 4.06957 31.2668 3.72796C31.5849 3.38635 32.0646 3.18004 32.7296 3.18004C33.1418 3.18004 33.4643 3.30247 33.684 3.50879C33.9038 3.71511 34.0294 4.01612 34.0294 4.39224V8.91366H35.3845V4.51671C35.3845 3.80644 35.2409 3.18139 34.8502 2.73359C34.4596 2.28578 33.8226 2.0294 32.8904 2.0294ZM43.2475 2.19831L39.6902 5.55087L43.2451 8.90164L41.4499 8.89806L38.8528 6.45049C38.5999 6.21193 38.4577 5.88846 38.4577 5.55116C38.4577 5.21387 38.5999 4.89038 38.8528 4.65183L41.4562 2.19831H43.2475Z" fill="#A2A7AE"/>
<path d="M6.39906 4.34455L8.76102 9.22357H3.4917L5.85366 4.34455C5.87764 4.29535 5.91607 4.25366 5.96441 4.22444C6.01274 4.19522 6.06895 4.17969 6.12635 4.17969C6.18376 4.17969 6.23997 4.19522 6.2883 4.22444C6.33664 4.25366 6.37507 4.29535 6.39906 4.34455Z" fill="#A2A7AE"/>
<path d="M6.12613 3.58868C7.04256 3.58868 7.78546 2.88785 7.78546 2.02335C7.78546 1.15883 7.04256 0.458008 6.12613 0.458008C5.2097 0.458008 4.4668 1.15883 4.4668 2.02335C4.4668 2.88785 5.2097 3.58868 6.12613 3.58868Z" fill="#A2A7AE"/>
</g>
<defs>
<clipPath id="clip0_216_22334">
<rect width="59" height="11" fill="white" transform="translate(0.5)"/>
</clipPath>
</defs>
</svg>
            </div>
      {/* {authConfig.socials.google && <GoogleAuth />}
      {authConfig.socials.facebook && <FacebookAuth />}
      {authConfig.socials.apple && <AppleAuth />} */}
    </div>
  );
};

export default Auth;
