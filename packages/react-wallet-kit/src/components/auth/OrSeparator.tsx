export function OrSeparator() {
  return (
    <div className="flex flex-row w-full items-center justify-center my-4">
      <div className="flex flex-grow h-[1px] bg-gray-600" />
      <span className="mx-2 text-xs text-gray-600">OR</span>
      <div className="flex flex-grow h-[1px] bg-gray-600" />
    </div>
  );
}
