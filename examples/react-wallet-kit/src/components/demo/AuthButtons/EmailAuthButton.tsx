import { AddSVG, EmailSVG, UnlinkSVG } from "@/components/Svg";
import { useTurnkey } from "@turnkey/react-wallet-kit";

const EmailAuthButton = () => {
  const { handleAddEmail, handleRemoveUserEmail, user } = useTurnkey();

  return (
    <button
      onClick={() => {
        if (!user?.userEmail) {
          handleAddEmail();
        } else {
          handleRemoveUserEmail();
        }
      }}
      className="flex hover:cursor-pointer items-center gap-2 p-3 bg-background-light dark:bg-background-dark shadow rounded-lg justify-between"
    >
      <p className="flex items-center gap-2 text-text-light dark:text-text-dark">
        <EmailSVG className="w-6 h-6" />
        <span className=" text-text-light dark:text-text-dark">E-mail</span>
      </p>
      {user?.userEmail ? (
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

export default EmailAuthButton;
