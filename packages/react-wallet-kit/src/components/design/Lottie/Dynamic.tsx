export async function getLottiePlayer() {
  const mod = await import("@lottiefiles/react-lottie-player");
  return mod.Player;
}
