import React, { useEffect } from 'react';

interface LoginWithSanscountsProps {
  onLoginSuccess?: (userData: any) => void;
}

export function LoginWithSanscounts({ onLoginSuccess }: LoginWithSanscountsProps) {
  const handleLogin = () => {
    const clientId = 'sansneat-client-id'; // আপনার অ্যাপের ক্লায়েন্ট আইডি
    const redirectUri = `${window.location.origin}/auth/callback`;
    
    // আপনার Sanscounts-এর Dev URL
    const authUrl = `https://ais-dev-nzkcf6uurov3zlnhgpfwpv-488568450855.asia-east1.run.app/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
    
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    window.open(
      authUrl,
      'SanscountsAuth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('nzkcf6uurov3zlnhgpfwpv')) return;

      if (event.data?.type === 'SANSCOUNTS_AUTH_SUCCESS') {
        const userData = event.data.payload;
        if (onLoginSuccess) {
          onLoginSuccess(userData);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess]);

  return (
    <button 
      onClick={handleLogin}
      className="w-full py-3 px-4 bg-white hover:bg-zinc-100 text-black font-bold rounded-full transition-all flex items-center justify-center gap-3 shadow-sm border border-zinc-200"
    >
      <img 
        src="https://i.postimg.cc/wvXS9k1D/IMG-9128.jpg" 
        alt="Sanscounts" 
        className="w-6 h-6 rounded-md object-cover shadow-sm" 
        referrerPolicy="no-referrer"
      />
      Sign in with Sanscounts
    </button>
  );
}
