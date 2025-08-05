import { AddSVG, PhoneSVG, UnlinkSVG } from "@/components/Svg";
import { useTurnkey } from "@turnkey/react-wallet-kit";

const PhoneAuthButton = () => {
  const { handleAddPhoneNumber, handleRemoveUserPhoneNumber, user } =
    useTurnkey();

  return (
    <button
      onClick={() => {
        if (!user?.userPhoneNumber) {
          handleAddPhoneNumber();
        } else {
          handleRemoveUserPhoneNumber({});
        }
      }}
      className="flex hover:cursor-pointer items-center gap-2 p-3 bg-background-light dark:bg-background-dark shadow rounded-lg justify-between"
    >
      <p className="flex items-center gap-2 text-text-light dark:text-text-dark">
        <PhoneSVG className="w-6 h-6" />
        <span className=" text-text-light dark:text-text-dark">SMS</span>
      </p>
      {user?.userPhoneNumber ? (
        <p className="flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40">
          <UnlinkSVG className="w-4 h-4" />
        </p>
      ) : (
        <p className="flex items-center text-sm gap-2 text-text-light/40 dark:text-text-dark/40">
          <AddSVG className="w-4 h-4" />
          <span>Connect</span>
        </p>
      )}
    </button>
  );
};

export default PhoneAuthButton;
