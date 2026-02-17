'use client';

import { useState } from 'react';

export function WelcomeModal() {
  const [dismissed, setDismissed] = useState(false);

  if (typeof window === 'undefined') {
    return null;
  }

  const hasOpenedBefore =
    window.localStorage.getItem('chartgobrralpha_welcomed') === 'true';

  if (dismissed || hasOpenedBefore) {
    return null;
  }

  const handleClose = () => {
    setDismissed(true);
    window.localStorage.setItem('chartgobrralpha_welcomed', 'true');
  };

  return (
    <div className="chartgobrr-modal-overlay">
      <div className="chartgobrr-modal-content">
        <h2>How it works?</h2>

        <p>
          ChartGoBrrAlpha lets anyone take control of the live chart session. The
          chart reacts to the active token loaded in ChartGoBrrAlpha.
        </p>

        <ul>
          <li>Connect Phantom</li>
          <li>Enter token address and choose tier</li>
          <li>Pay and watch chart sync and go brr</li>
          <li>Standard = 10 minutes</li>
          <li>Priority = Jump queue</li>
        </ul>

        <button onClick={handleClose}>I&apos;m ready to go brrr</button>

        <div className="chartgobrr-modal-footer">
          Built for SessionMint.fun
          <br />
          No official token endorsement is provided by SessionMint.fun.
          <br />
          ChartGoBrrAlpha is an entertainment experience. Chart synchronization is
          best effort.
        </div>
      </div>
    </div>
  );
}
