import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { OAuthButton, OAuthLoading } from "./OAuth";
import { faGoogle } from "@fortawesome/free-brands-svg-icons";
import { useModal, useTurnkey } from "../../providers";

export function AuthComponent() {
  const { handleGoogleOauth } = useTurnkey();
  const { pushPage } = useModal();
  return (
    <div className="flex flex-col items-center w-96 h-[500px]">
      <div className="w-full h-11 flex flex-row justify-center items-center gap-2 mt-12">
        <OAuthButton
          name={"Google"}
          icon={<FontAwesomeIcon icon={faGoogle} />}
          onClick={async () => {
            pushPage({
              key: "Google OAuth",
              content: (
                <OAuthLoading
                  name="Google"
                  action={() =>
                    handleGoogleOauth({
                      additionalState: { openModal: "true" }, // Tell the provider to reopen the auth modal and show the loading state
                    })
                  }
                  icon={<FontAwesomeIcon size="3x" icon={faGoogle} />}
                />
              ),
              showTitle: false,
            });
          }}
        />
      </div>
    </div>
  );
}
