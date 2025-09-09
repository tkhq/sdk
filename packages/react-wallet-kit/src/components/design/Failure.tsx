interface DeveloperErrorProps {
  developerTitle?: string;
  developerMessages?: string[];
  userTitle?: string;
  userMessages?: string[];
}

export function DeveloperError(props: DeveloperErrorProps) {
  const {
    developerTitle = "Developer Error",
    developerMessages,
    userTitle,
    userMessages,
  } = props;

  const isDev = process.env.NODE_ENV === "development";
  return (
    <div className="flex flex-col justify-center items-center mt-10 text-sm min-w-80 max-w-full min-48 font-normal text-center text-icon-text-light dark:text-icon-text-dark">
      <strong className="text-danger-light dark:text-danger-dark text-lg">
        {isDev ? developerTitle : userTitle}
      </strong>
      {isDev
        ? developerMessages?.map((msg, index) => (
            <div key={index} className="w-full">
              <div className="w-full h-[1px] bg-icon-background-light dark:bg-icon-background-dark my-4" />
              {msg}
            </div>
          ))
        : userMessages?.map((msg, index) => <div key={index}>{msg}</div>)}
      {isDev && (
        <div className="text-xs mt-10 font-extralight italic">
          You will only see this error if you are a developer!
        </div>
      )}
    </div>
  );
}
