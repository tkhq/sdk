import React from 'react';
import { UUID } from 'crypto';

interface TurnkeyAuthModalProps {
  onComplete: (walletId: UUID) => void;
  onError: (error: Error) => void;
}

const TurnkeyAuthModal = ({ onComplete, onError }: TurnkeyAuthModalProps) => {
  const [email, setEmail] = React.useState('');

  const handleSignIn = () => {
    // Perform any necessary actions with the email
    // ...
    const walletId = '581b8fb0-6b7f-5316-a795-911df6ea032a';
    // Call the handleUserData callback to pass the email back to the SDK
    onComplete(walletId);
  };

  const handleError = (error: Error) => {
    // Call the handleUserError callback to pass the error back to the SDK
    onError(error);
  };

  return (
    <div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
      />
      <button onClick={handleSignIn}>Sign In</button>
      <button onClick={() => handleError(new Error('User canceled the flow'))}>
        Cancel
      </button>
    </div>
  );
};

export const onTurnkeyAuth = ({
  onComplete,
  onError,
}: TurnkeyAuthModalProps) => (
  <TurnkeyAuthModal onComplete={onComplete} onError={onError} />
);
