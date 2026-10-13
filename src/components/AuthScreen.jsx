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
  Check,
  LogOut,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  evaluatePasswordStrength,
  checkAccountLockout,
  sanitizeInput,
  normalizeHelpNumber
} from '../utils/security';
import { playTactileClick } from '../utils/audio';

export default function AuthScreen({ onContinueToSos }) {
  const {
    currentUser,
    isAuthenticated,
    signUp,
    loginWithPassword,
    requestOtp,
    verifyOtp,
    logout,
    simulatedOtpNotice,
    dismissSimulatedOtpNotice,
    setIsSecurityModalOpen
  } = useAuth();

  // Mode: 'login' | 'signup'
  const [authMode, setAuthMode] = useState('login');
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'

  // Login Form
  const [loginHelpNumber, setLoginHelpNumber] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up Form
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

  // Status & Lockout
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutCountdown, setLockoutCountdown] = useState(0);

  // Password Strength
  const passwordEvaluation = evaluatePasswordStrength(signupPassword);
  const passwordsMatch = signupPassword && signupConfirmPassword && signupPassword === signupConfirmPassword;

  // Timers
  useEffect(() => {
    let t = null;
    if (otpResendCooldown > 0) {
      t = setInterval(() => setOtpResendCooldown(p => (p > 0 ? p - 1 : 0)), 1000);
    }
    return () => clearInterval(t);
  }, [otpResendCooldown]);

  useEffect(() => {
    let t = null;
    if (lockoutCountdown > 0) {
      t = setInterval(() => setLockoutCountdown(p => (p > 0 ? p - 1 : 0)), 1000);
    }
    return () => clearInterval(t);
  }, [lockoutCountdown]);

  // Check lockout on number change
  useEffect(() => {
    const num = authMode === 'login' ? loginHelpNumber : signupHelpNumber;
    if (num) {
      const lock = checkAccountLockout(normalizeHelpNumber(num));
      if (lock.isLocked) setLockoutCountdown(lock.remainingSeconds);
    }
  }, [loginHelpNumber, signupHelpNumber, authMode]);

  useEffect(() => {
    setErrorMessage('');
    setSuccessMessage('');
  }, [authMode, loginMethod]);

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (loginMethod === 'password') {
      try {
        setIsSubmitting(true);
        await loginWithPassword(loginHelpNumber, loginPassword);
        setSuccessMessage('Authenticated successfully! Redirecting to SOS Lifeline...');
        setTimeout(() => {
          onContinueToSos();
        }, 500);
      } catch (err) {
        setErrorMessage(err.message || 'Login failed.');
        const lock = checkAccountLockout(normalizeHelpNumber(loginHelpNumber));
        if (lock.isLocked) setLockoutCountdown(lock.remainingSeconds);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // OTP Method
      try {
        setIsSubmitting(true);
        const code = otpDigits.join('');
        await verifyOtp(loginHelpNumber, code);
        setSuccessMessage('Verification successful! Redirecting to SOS Lifeline...');
        setTimeout(() => {
          onContinueToSos();
        }, 500);
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
      setOtpResendCooldown(30);
      setSuccessMessage('Verification OTP sent via SMS.');
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
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    if (!passwordEvaluation.isValid) {
      setErrorMessage('Password does not meet required security standards.');
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
      setSuccessMessage('Citizen account registered & secured! Entering Lifeline...');
      setTimeout(() => {
        onContinueToSos();
      }, 500);
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP Input handlers
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
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
    for (let i = 0; i < 6; i++) newDigits[i] = pasteData[i] || '';
    setOtpDigits(newDigits);
    if (pasteData.length >= 6 && otpInputRefs.current[5]) {
      otpInputRefs.current[5].focus();
    }
  };

  const handleAutoFillOtp = (code) => {
    if (!code) return;
    setOtpDigits(code.split('').slice(0, 6));
    dismissSimulatedOtpNotice();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 font-sans selection:bg-rose-500 selection:text-white">
      {/* Background Decorative Rings */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-[450px] h-[450px] rounded-full bg-rose-600/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[450px] h-[450px] rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      {/* Top Application Bar */}
      <header className="relative z-10 max-w-xl w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 font-black text-xl tracking-tight border border-rose-400/30">
            R
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-lg tracking-tight">RakshaPulse</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">
                Shield Armed
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Personal Lifeline & Immediate Emergency Response</p>
          </div>
        </div>

        <button
          onClick={() => { playTactileClick(); setIsSecurityModalOpen(true); }}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-white transition flex items-center gap-1.5 text-xs font-bold"
          title="Security Features & Cryptography Audit"
        >
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Security Audit</span>
        </button>
      </header>

      {/* Center Auth Card */}
      <main className="relative z-10 max-w-xl w-full mx-auto my-auto py-6">
        {/* If already authenticated, show Welcome Back quick-entry card */}
        {isAuthenticated && currentUser ? (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-emerald-600/30 border border-emerald-400/30">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-bold">
                ✓ Authenticated Citizen
              </span>
              <h2 className="text-2xl font-black text-white">{currentUser.name}</h2>
              <p className="text-xs text-slate-400 font-mono">
                Registered Help Number: {currentUser.helpNumber}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-emerald-400">Lifeline Connected & Ready</p>
              <p className="text-slate-400">
                Your emergency profile, contacts, and instant 112/telephony dispatch are primed.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => { playTactileClick(); onContinueToSos(); }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 active:scale-95 text-white font-black text-sm tracking-wide shadow-xl shadow-rose-600/40 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>ENTER EMERGENCY DASHBOARD (GO TO SOS)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => { playTactileClick(); logout(); }}
                className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 font-bold text-xs transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Switch Citizen Account / Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* UNATHENTICATED: Full Sign In / Sign Up Form */
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden">
            {/* Top Color Accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />

            <div className="p-6 sm:p-7 space-y-5">
              {/* Card Title */}
              <div className="text-center space-y-1">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {authMode === 'login' ? 'Citizen Sign In' : 'Create Lifeline Account'}
                </h2>
                <p className="text-xs text-slate-400">
                  {authMode === 'login'
                    ? 'Log in with your Help Number & password or OTP to access personal emergency services'
                    : 'Register your basic information with mandatory password encryption'}
                </p>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="p-1.5 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { playTactileClick(); setAuthMode('login'); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                    authMode === 'login'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { playTactileClick(); setAuthMode('signup'); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
                    authMode === 'signup'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Sign Up
                </button>
              </div>

              {/* Simulated SMS Alert Toast */}
              {simulatedOtpNotice && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 shadow-lg flex items-center justify-between gap-3 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-emerald-300">📱 SMS Dispatch Simulated</p>
                      <p className="text-xs text-slate-200">
                        Code: <strong className="text-emerald-400 tracking-widest font-mono text-sm">{simulatedOtpNotice.code}</strong> (Expires in 5m)
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

              {/* Error & Success Toasts */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {lockoutCountdown > 0 && (
                <div className="p-3 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                  <div>
                    <strong>Security Lockout:</strong> Too many failed attempts. Wait{' '}
                    <span className="font-bold font-mono text-amber-200">{lockoutCountdown}s</span>.
                  </div>
                </div>
              )}

              {/* AUTH FORMS */}
              {authMode === 'login' ? (
                /* ================= LOGIN ================= */
                <div className="space-y-4">
                  {/* Method Toggle: Password vs OTP */}
                  <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
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
                      Help Number + Password
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
                      Help Number + OTP
                    </button>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    {/* Help Number */}
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
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Demo Account: <code className="text-rose-300">+91 98765 43210</code> · Password:{' '}
                        <code className="text-rose-300">Raksha@2026</code>
                      </p>
                    </div>

                    {loginMethod === 'password' ? (
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
                            className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
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
                      /* OTP Section */
                      <div className="space-y-3">
                        {!otpSent ? (
                          <button
                            type="button"
                            disabled={!loginHelpNumber || isSubmitting || lockoutCountdown > 0}
                            onClick={handleSendOtp}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Smartphone className="w-4 h-4" />
                            Send 6-Digit OTP via SMS
                          </button>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-slate-300">
                                Enter 6-Digit Verification PIN
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
                                  <RefreshCw className="w-3 h-3" /> Resend Code
                                </button>
                              )}
                            </div>

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
                              Protected by 5-minute TTL & 3 max attempts.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        lockoutCountdown > 0 ||
                        (loginMethod === 'otp' && (!otpSent || otpDigits.join('').length !== 6))
                      }
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>{loginMethod === 'password' ? 'Sign In & Enter Lifeline' : 'Verify & Continue'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              ) : (
                /* ================= SIGN UP (PASSWORD REQUIRED) ================= */
                <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
                  {/* Name */}
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

                  {/* Help Number & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {/* Blood Group & Emergency Contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Blood Group</label>
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
                      <label className="block text-xs font-bold text-slate-300 mb-1">Emergency Contact</label>
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
                        placeholder="Create strong password"
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

                    {/* Password Strength Meter */}
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
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1">
                          <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.length ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {passwordEvaluation.checks.length ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>Min 8 chars</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.hasUpper ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {passwordEvaluation.checks.hasUpper ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>Uppercase</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.hasLower ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {passwordEvaluation.checks.hasLower ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>Lowercase</span>
                          </div>
                          <div className={`flex items-center gap-1.5 ${passwordEvaluation.checks.hasNumber && passwordEvaluation.checks.hasSpecial ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {passwordEvaluation.checks.hasNumber && passwordEvaluation.checks.hasSpecial ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>Number & symbol</span>
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
                        placeholder="Re-enter password"
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

                  <button
                    type="submit"
                    disabled={isSubmitting || !passwordEvaluation.isValid || !passwordsMatch}
                    className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-sm shadow-lg shadow-rose-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Encrypting & Registering...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        <span>Complete Sign Up & Go To SOS</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Bottom Emergency Bypass Footer */}
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => { playTactileClick(); onContinueToSos(); }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 transition font-bold flex items-center justify-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Emergency Bypass: Go Directly to SOS Button</span>
              </button>

              <span className="text-[11px] text-slate-500">Zero-Delay Lifeline Guarantee</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer Disclaimer */}
      <footer className="relative z-10 max-w-xl w-full mx-auto text-center text-[11px] text-slate-500 pt-3 border-t border-slate-900">
        RakshaPulse Personal Safety Lifeline · In an active emergency dial 112 directly
      </footer>
    </div>
  );
}
