import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Lock,
  Phone,
  User,
  Mail,
  Heart,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Smartphone,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  evaluatePasswordStrength,
  checkAccountLockout,
  sanitizeInput,
  normalizeHelpNumber
} from '../utils/security';
import { playTactileClick } from '../utils/audio';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    setAuthModalMode,
    signUp,
    loginWithPassword,
    requestOtp,
    verifyOtp,
    simulatedOtpNotice,
    dismissSimulatedOtpNotice,
    setIsSecurityModalOpen
  } = useAuth();

  // Active sub-tab in Login mode: 'password' | 'otp'
  const [loginMethod, setLoginMethod] = useState('password');

  // Form Fields - Login
  const [loginHelpNumber, setLoginHelpNumber] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form Fields - Sign Up
  const [signupName, setSignupName] = useState('');
  const [signupHelpNumber, setSignupHelpNumber] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupBloodGroup, setSignupBloodGroup] = useState('O+');
  const [signupEmergencyContact, setSignupEmergencyContact] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpInputRefs = useRef([]);

  // Lockout / Status Messages
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // Password evaluation for Sign Up
  const passwordEvaluation = evaluatePasswordStrength(signupPassword);
  const passwordsMatch = signupPassword && signupConfirmPassword && signupPassword === signupConfirmPassword;

  // Countdown timer for OTP resend cooldown and Lockout
  useEffect(() => {
    let timer = null;
    if (otpResendCooldown > 0) {
      timer = setInterval(() => {
        setOtpResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpResendCooldown]);

  useEffect(() => {
    let timer = null;
    if (lockoutCountdown > 0) {
      timer = setInterval(() => {
        setLockoutCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutCountdown]);

  // Check lockout status on number change
  useEffect(() => {
    const checkNumber = authModalMode === 'login' ? loginHelpNumber : signupHelpNumber;
    if (checkNumber) {
      const lock = checkAccountLockout(normalizeHelpNumber(checkNumber));
      if (lock.isLocked) {
        setLockoutCountdown(lock.remainingSeconds);
      }
    }
  }, [loginHelpNumber, signupHelpNumber, authModalMode]);

  // Reset errors when modal mode changes
  useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, [authModalMode, loginMethod]);

  if (!isAuthModalOpen) return null;

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (loginMethod === 'password') {
      try {
        setIsSubmitting(true);
        await loginWithPassword(loginHelpNumber, loginPassword);
        setSuccessMessage('Login successful! Welcome back.');
      } catch (err) {
        setErrorMessage(err.message || 'Login failed.');
        const lock = checkAccountLockout(normalizeHelpNumber(loginHelpNumber));
        if (lock.isLocked) setLockoutCountdown(lock.remainingSeconds);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // OTP Verification
      try {
        setIsSubmitting(true);
        const code = otpDigits.join('');
        await verifyOtp(loginHelpNumber, code);
        setSuccessMessage('Verified successfully! Logging in...');
      } catch (err) {
        setErrorMessage(err.message || 'OTP verification failed.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Handle Send OTP
  const handleSendOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      setIsSubmitting(true);
      await requestOtp(loginHelpNumber);
      setOtpSent(true);
      setOtpResendCooldown(30); // 30s cooldown
      setSuccessMessage('Verification OTP sent via SMS.');
      // Focus first digit box
      setTimeout(() => {
        if (otpInputRefs.current[0]) otpInputRefs.current[0].focus();
      }, 100);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to dispatch OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Sign Up Submit
  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match. Please re-check.');
      return;
    }

    if (!passwordEvaluation.isValid) {
      setErrorMessage('Please create a stronger password meeting all security requirements.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signUp({
        name: signupName,
        helpNumber: signupHelpNumber,
        email: signupEmail,
        bloodGroup: signupBloodGroup,
        medicalConditions: '',
        emergencyContact: signupEmergencyContact,
        password: signupPassword
      });
      setSuccessMessage('Account created successfully! Logged in.');
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP Input key navigation & paste handling
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance
    if (digit && index < 5 && otpInputRefs.current[index + 1]) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasteData[i] || '';
    }
    setOtpDigits(newDigits);
    if (pasteData.length >= 6 && otpInputRefs.current[5]) {
      otpInputRefs.current[5].focus();
    }
  };

  // Auto-fill from simulated OTP toast
  const handleAutoFillOtp = (code) => {
    if (!code) return;
    const digits = code.split('').slice(0, 6);
    setOtpDigits(digits);
    dismissSimulatedOtpNotice();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Top Header Glow */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />

        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">
                  {authModalMode === 'login' ? 'RakshaPulse Sign In' : 'Create Citizen Account'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                  256-bit Secure
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {authModalMode === 'login'
                  ? 'Access your emergency profile & verified lifeline network'
                  : 'Register your basic information & secure your personal lifeline'}
              </p>
            </div>
          </div>

          <button
            onClick={() => { playTactileClick(); closeAuthModal(); }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs (Sign In vs Sign Up) */}
        <div className="p-2 mx-6 mt-4 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center gap-1">
          <button
            type="button"
            onClick={() => { playTactileClick(); setAuthModalMode('login'); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              authModalMode === 'login'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { playTactileClick(); setAuthModalMode('signup'); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
              authModalMode === 'signup'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Sign Up
          </button>
        </div>

        {/* Simulated SMS Toast (Demo helper) */}
        {simulatedOtpNotice && (
          <div className="mx-6 mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 shadow-lg flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-emerald-300">
                  📱 Simulated SMS Received
                </p>
                <p className="text-xs text-slate-200">
                  Code: <strong className="text-emerald-400 tracking-widest text-sm font-mono">{simulatedOtpNotice.code}</strong> (Expires in 5m)
                </p>
              </div>
            </div>
            <button
              onClick={() => handleAutoFillOtp(simulatedOtpNotice.code)}
              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shrink-0"
            >
              Auto-Fill
            </button>
          </div>
        )}

        {/* Notifications / Alerts */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {lockoutCountdown > 0 && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <div>
              <strong>Security Lockout Active:</strong> Excessive failed attempts.
              Please wait <span className="font-bold font-mono text-amber-200">{lockoutCountdown}s</span> before retrying.
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6">
          {authModalMode === 'login' ? (
            /* =========================================================
               LOGIN FORM
               ========================================================= */
            <div>
              {/* Login Method Sub-Toggle: Password vs OTP */}
              <div className="flex items-center gap-2 mb-4 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => { playTactileClick(); setLoginMethod('password'); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    loginMethod === 'password'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  Password Login
                </button>
                <button
                  type="button"
                  onClick={() => { playTactileClick(); setLoginMethod('otp'); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    loginMethod === 'otp'
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  OTP Login
                </button>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Help Number / Phone Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Help Number / Registered Mobile
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={loginHelpNumber}
                      onChange={(e) => setLoginHelpNumber(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Default demo user: <code className="text-rose-300">+91 98765 43210</code> (Password: <code className="text-rose-300">Raksha@2026</code>)
                  </p>
                </div>

                {loginMethod === 'password' ? (
                  /* Password Mode */
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Account Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                      >
                        {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* OTP Mode */
                  <div className="space-y-3">
                    {!otpSent ? (
                      <div className="pt-2">
                        <button
                          type="button"
                          disabled={!loginHelpNumber || isSubmitting || lockoutCountdown > 0}
                          onClick={handleSendOtp}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Smartphone className="w-4 h-4" />
                          Send 6-Digit OTP via SMS
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-300">
                            Enter 6-Digit Verification Code
                          </label>
                          {otpResendCooldown > 0 ? (
                            <span className="text-[11px] text-slate-400 font-mono">
                              Resend in {otpResendCooldown}s
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSendOtp}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-bold transition flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Resend OTP
                            </button>
                          )}
                        </div>

                        {/* 6-Digit Boxes */}
                        <div className="flex items-center justify-between gap-2" onPaste={handleOtpPaste}>
                          {otpDigits.map((digit, i) => (
                            <input
                              key={i}
                              ref={(el) => (otpInputRefs.current[i] = el)}
                              type="text"
                              maxLength={1}
                              inputMode="numeric"
                              value={digit}
                              onChange={(e) => handleOtpChange(i, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(i, e.target.value)}
                              className="w-11 h-12 text-center text-lg font-bold font-mono bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30 transition"
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Protected by 5-minute cryptographic time-to-live & max 3 verification attempts.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    lockoutCountdown > 0 ||
                    (loginMethod === 'otp' && (!otpSent || otpDigits.join('').length !== 6))
                  }
                  className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      {loginMethod === 'password' ? 'Sign In Securely' : 'Verify & Enter Dashboard'}
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* =========================================================
               SIGN UP FORM (Basic Information & Password Required)
               ========================================================= */
            <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="e.g. Kunal Gaur"
                    required
                    className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                  />
                </div>
              </div>

              {/* Help Number & Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Help Number (Phone) */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Help / Mobile Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={signupHelpNumber}
                      onChange={(e) => setSignupHelpNumber(e.target.value)}
                      placeholder="+91 98765 00000"
                      required
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="citizen@rakshapulse.org"
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Medical Information: Blood Group & Emergency Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Blood Group
                  </label>
                  <div className="relative">
                    <Heart className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={signupBloodGroup}
                      onChange={(e) => setSignupBloodGroup(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500 transition cursor-pointer"
                    >
                      {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(bg => (
                        <option key={bg} value={bg} className="bg-slate-900 text-white">{bg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Emergency Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={signupEmergencyContact}
                      onChange={(e) => setSignupEmergencyContact(e.target.value)}
                      placeholder="+91 98765 11223"
                      className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* PASSWORD (REQUIRED) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300">
                    Password <span className="text-rose-400">* Required</span>
                  </label>
                  {signupPassword && (
                    <span className={`text-[11px] font-bold ${passwordEvaluation.color}`}>
                      {passwordEvaluation.label}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    className="w-full pl-10 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator Meter */}
                {signupPassword && (
                  <div className="mt-2 space-y-1.5">
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                      {[1, 2, 3, 4].map(idx => (
                        <div
                          key={idx}
                          className={`flex-1 h-full transition-all duration-300 ${
                            idx <= passwordEvaluation.score ? passwordEvaluation.bg : 'bg-transparent'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Security Checklist Requirements */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                      <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.length ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {passwordEvaluation.checks.length ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>Min 8 characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.hasUpper ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {passwordEvaluation.checks.hasUpper ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>Uppercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.hasLower ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {passwordEvaluation.checks.hasLower ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>Lowercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.hasNumber && passwordEvaluation.checks.hasSpecial ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {passwordEvaluation.checks.hasNumber && passwordEvaluation.checks.hasSpecial ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        <span>Number & Special char</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Confirm Password <span className="text-rose-400">* Required</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showSignupConfirmPassword ? 'text' : 'password'}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    className="w-full pl-10 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                  >
                    {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signupConfirmPassword && (
                  <p className={`text-[11px] mt-1 flex items-center gap-1 font-medium ${passwordsMatch ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                  </p>
                )}
              </div>

              {/* Sign Up Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !passwordEvaluation.isValid || !passwordsMatch}
                className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Registering with Salted Encryption...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Complete Sign Up & Secure Account
                  </>
                )}
              </button>
            </form>
          )}

          {/* Bottom Security Footer & Emergency Bypass Guarantee */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => { playTactileClick(); setIsSecurityModalOpen(true); }}
              className="text-slate-400 hover:text-rose-400 transition flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-rose-500" />
              <span>Inspect Security & Cryptography Audit</span>
            </button>

            <button
              type="button"
              onClick={() => { playTactileClick(); closeAuthModal(); }}
              className="text-amber-400 hover:text-amber-300 transition font-bold flex items-center gap-1"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Emergency SOS Bypass (No Login Needed)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
